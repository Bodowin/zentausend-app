import { useEffect, useMemo, useRef } from 'react'

/**
 * Virtuelle Würfel: echte CSS-3D-Würfel (6 Flächen, preserve-3d), deren
 * Orientierung pro Frame als QUATERNION geführt und als matrix3d ausgegeben wird
 * – angetrieben von einer festen 2D-Physik.
 *
 * Synthese aus drei Ansätzen:
 *  - Würfel werden in den (leicht getilteten) Tisch geworfen, prallen an Wänden
 *    UND aneinander ab und ROLLEN dabei in Bewegungsrichtung (ω = v/R) → echtes
 *    Würfel-Gefühl statt flacher Drehung.
 *  - Quaternion-Tumble: kein Gimbal-Lock, beliebige Achse, kein Flackern.
 *  - Beim Stoß zusätzlicher Drall + kurzer Impact-Pop (Haptik gibt es auf iOS-Web
 *    nicht – das ist der sichtbare Ersatz).
 *  - Landung per Slerp auf die nächstgelegene gültige Endlage, die die
 *    vorbestimmte Augenzahl zeigt → springt nie um, Ergebnis bleibt exakt.
 *  - Fester Physik-Timestep mit dt-Clamp → 120-Hz-ProMotion sauber abgefangen.
 *  Kein WebGL → iOS-stabil, offline, design-treu.
 */

// ---- Quaternion-Helfer (x, y, z, w) --------------------------------------
type Q = [number, number, number, number]

const qMul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const qNorm = (q: Q): Q => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}
const qAxis = (x: number, y: number, z: number, ang: number): Q => {
  const h = ang / 2
  const s = Math.sin(h)
  return [x * s, y * s, z * s, Math.cos(h)]
}
const qDot = (a: Q, b: Q) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
const qSlerp = (a: Q, b: Q, t: number): Q => {
  let d = qDot(a, b)
  let bb = b
  if (d < 0) {
    bb = [-b[0], -b[1], -b[2], -b[3]]
    d = -d
  }
  if (d > 0.9995) {
    return qNorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t])
  }
  const th = Math.acos(d)
  const s = Math.sin(th)
  const wa = Math.sin((1 - t) * th) / s
  const wb = Math.sin(t * th) / s
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb]
}
const qToMatrix3d = (q: Q): string => {
  const [x, y, z, w] = q
  const m00 = 1 - 2 * (y * y + z * z)
  const m01 = 2 * (x * y - w * z)
  const m02 = 2 * (x * z + w * y)
  const m10 = 2 * (x * y + w * z)
  const m11 = 1 - 2 * (x * x + z * z)
  const m12 = 2 * (y * z - w * x)
  const m20 = 2 * (x * z - w * y)
  const m21 = 2 * (y * z + w * x)
  const m22 = 1 - 2 * (x * x + y * y)
  // CSS matrix3d ist spaltenweise.
  return `matrix3d(${m00},${m10},${m20},0,${m01},${m11},${m21},0,${m02},${m12},${m22},0,0,0,0,1)`
}

const PIP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
const FACES: { v: number; r: string }[] = [
  { v: 1, r: '' },
  { v: 6, r: 'rotateY(180deg)' },
  { v: 3, r: 'rotateY(90deg)' },
  { v: 4, r: 'rotateY(-90deg)' },
  { v: 5, r: 'rotateX(90deg)' },
  { v: 2, r: 'rotateX(-90deg)' },
]
// Euler-Rotation (Grad), die die Augenzahl nach vorne (zur Kamera, +Z) bringt.
const BASE: Record<number, [number, number]> = {
  1: [0, 0],
  2: [90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  6: [0, 180],
}
const rad = (d: number) => (d * Math.PI) / 180
// Basis-Quaternion je Augenzahl: Rx(rx)·Ry(ry).
const baseQuat = (v: number): Q => {
  const [rx, ry] = BASE[v]
  return qNorm(qMul(qAxis(1, 0, 0, rad(rx)), qAxis(0, 1, 0, rad(ry))))
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Body {
  x: number
  y: number
  vx: number
  vy: number
  q: Q
  wx: number // Launch-Tumble-Winkelgeschwindigkeit (rad/s), klingt ab
  wy: number
  wz: number
  value: number
  pop: number // Impact-Pop-Restzeit (s)
  settling: boolean
  startQ: Q
  targetQ: Q
  st: number // Slerp-Fortschritt 0..1
}

export default function DiceArena({ values, onSettle }: { values: number[]; onSettle: () => void }) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const dieRefs = useRef<(HTMLDivElement | null)[]>([])
  const cubeRefs = useRef<(HTMLDivElement | null)[]>([])
  const shadowRefs = useRef<(HTMLSpanElement | null)[]>([])
  const settledRef = useRef(false)

  const size = useMemo(
    () => Math.round(Math.max(46, Math.min(66, Math.min(window.innerWidth, window.innerHeight * 0.5) * 0.16))),
    [],
  )

  useEffect(() => {
    const arena = arenaRef.current
    if (!arena) return
    const W = arena.clientWidth
    const H = arena.clientHeight
    const R = size * 0.6
    const pad = R + 2
    const n = Math.max(1, values.length)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const finish = () => {
      if (settledRef.current) return
      settledRef.current = true
      onSettle()
    }

    // 4 gültige Endlagen je Augenzahl (Rollung um die Blickachse) – nächstgelegene wählen.
    const targetFor = (v: number, cur: Q): Q => {
      const base = baseQuat(v)
      let best = base
      let bestDot = -2
      for (let k = 0; k < 4; k++) {
        const cand = qNorm(qMul(qAxis(0, 0, 1, (k * Math.PI) / 2), base))
        const d = Math.abs(qDot(cand, cur))
        if (d > bestDot) {
          bestDot = d
          best = cand
        }
      }
      return best
    }

    const bodies: Body[] = values.map((value, i) => {
      const a = rand(-Math.PI * 0.72, -Math.PI * 0.28)
      const speed = reduce ? 0 : rand(720, 1080)
      return {
        x: W / 2 + (i - (n - 1) / 2) * (size * 0.7) + rand(-10, 10),
        y: reduce ? H / 2 : H - pad - rand(0, size * 0.4),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        q: reduce ? baseQuat(value) : qNorm([rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)]),
        wx: reduce ? 0 : rand(-10, 10),
        wy: reduce ? 0 : rand(-10, 10),
        wz: reduce ? 0 : rand(-10, 10),
        value,
        pop: 0,
        settling: false,
        startQ: [0, 0, 0, 1],
        targetQ: [0, 0, 0, 1],
        st: 0,
      }
    })

    const draw = () => {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i]
        const die = dieRefs.current[i]
        const cube = cubeRefs.current[i]
        const sh = shadowRefs.current[i]
        const speed = Math.hypot(b.vx, b.vy)
        const lift = Math.min(size * 0.7, speed * 0.06)
        const pop = b.pop > 0 ? 1 + Math.min(0.16, b.pop * 1.4) : 1
        if (die)
          die.style.transform = `translate(${b.x - size / 2}px, ${b.y - size / 2}px) translateZ(${lift}px) scale(${pop})`
        if (cube) cube.style.transform = qToMatrix3d(b.q)
        if (sh) {
          const s = 1 - lift / (size * 1.4)
          sh.style.transform = `translate(${b.x - size * 0.45}px, ${b.y - size * 0.16}px) scale(${s})`
          sh.style.opacity = `${0.5 * s}`
        }
      }
    }

    if (reduce) {
      const cols = Math.min(n, 4)
      bodies.forEach((b, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const rows = Math.ceil(n / cols)
        b.x = W / 2 + (col - (Math.min(n, cols) - 1) / 2) * (size * 1.4)
        b.y = H / 2 + (row - (rows - 1) / 2) * (size * 1.4)
      })
      draw()
      const t = window.setTimeout(finish, 500)
      return () => window.clearTimeout(t)
    }

    const WALL_REST = 0.58
    const DIE_REST = 0.74
    const FR = 0.986 // lineare Reibung pro Physik-Schritt
    const ANG_FR = 0.99
    const SETTLE_SPEED = 18
    const FIXED = 1 / 120
    const MAX_MS = 2900
    const SETTLE_MS = 300

    const integrate = (h: number) => {
      for (const b of bodies) {
        b.x += b.vx * h
        b.y += b.vy * h
        b.vx *= FR
        b.vy *= FR
        b.wx *= ANG_FR
        b.wy *= ANG_FR
        b.wz *= ANG_FR
        if (b.pop > 0) b.pop = Math.max(0, b.pop - h)

        if (b.x < pad) {
          b.x = pad
          b.vx = Math.abs(b.vx) * WALL_REST
          b.wz += rand(-3, 3)
        } else if (b.x > W - pad) {
          b.x = W - pad
          b.vx = -Math.abs(b.vx) * WALL_REST
          b.wz += rand(-3, 3)
        }
        if (b.y < pad) {
          b.y = pad
          b.vy = Math.abs(b.vy) * WALL_REST
          b.wz += rand(-3, 3)
        } else if (b.y > H - pad) {
          b.y = H - pad
          b.vy = -Math.abs(b.vy) * WALL_REST
          b.wz += rand(-3, 3)
        }

        // Rollen in Bewegungsrichtung (ω = v/R, Achse ⟂ zur Bewegung) + Launch-Tumble.
        const ox = b.vy / R + b.wx
        const oy = -b.vx / R + b.wy
        const oz = b.wz
        const om = Math.hypot(ox, oy, oz)
        if (om > 1e-4) {
          const dq = qAxis(ox / om, oy / om, oz / om, om * h)
          b.q = qNorm(qMul(dq, b.q))
        }
      }

      // Würfel-Kollisionen: elastisch (gleiche Masse) + Drall + Pop.
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i]
          const b = bodies[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy)
          const min = R * 2
          if (dist < min && dist > 0) {
            const nx = dx / dist
            const ny = dy / dist
            const ov = (min - dist) / 2
            a.x -= nx * ov
            a.y -= ny * ov
            b.x += nx * ov
            b.y += ny * ov
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
            if (rel > 0) {
              const imp = (-(1 + DIE_REST) * rel) / 2
              a.vx += imp * nx
              a.vy += imp * ny
              b.vx -= imp * nx
              b.vy -= imp * ny
              const kick = Math.min(12, Math.abs(rel) * 0.012 + 3)
              a.wx += rand(-kick, kick)
              a.wy += rand(-kick, kick)
              a.wz += rand(-kick, kick)
              b.wx += rand(-kick, kick)
              b.wy += rand(-kick, kick)
              b.wz += rand(-kick, kick)
              a.pop = b.pop = 0.12
            }
          }
        }
      }
    }

    let raf = 0
    let last = performance.now()
    let acc = 0
    const t0 = performance.now()
    let phase: 'roll' | 'settle' = 'roll'

    const loop = (now: number) => {
      let frame = (now - last) / 1000
      last = now
      if (frame > 0.05) frame = 0.05 // dt-Clamp gegen Tab-Stalls

      if (phase === 'roll') {
        acc += frame
        while (acc >= FIXED) {
          integrate(FIXED)
          acc -= FIXED
        }
        let maxSpeed = 0
        for (const b of bodies) maxSpeed = Math.max(maxSpeed, Math.hypot(b.vx, b.vy))
        if (maxSpeed < SETTLE_SPEED || now - t0 > MAX_MS) {
          phase = 'settle'
          for (const b of bodies) {
            b.settling = true
            b.startQ = b.q
            b.targetQ = targetFor(b.value, b.q)
            b.st = 0
            b.vx = b.vy = 0
          }
        }
      } else {
        // Slerp auf die Endlage (easeOutCubic).
        let done = true
        for (const b of bodies) {
          b.st = Math.min(1, b.st + frame / (SETTLE_MS / 1000))
          const e = 1 - Math.pow(1 - b.st, 3)
          b.q = qSlerp(b.startQ, b.targetQ, e)
          if (b.st < 1) done = false
        }
        draw()
        if (done) {
          finish()
          return
        }
        raf = requestAnimationFrame(loop)
        return
      }

      draw()
      raf = requestAnimationFrame(loop)
    }

    draw()
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const half = size / 2
  return (
    <div ref={arenaRef} className="die-arena">
      <div className="die-table">
        {values.map((_, i) => (
          <div key={i}>
            <span ref={(el) => (shadowRefs.current[i] = el)} className="die-shadow" style={{ width: size * 0.9, height: size * 0.34 }} />
            <div ref={(el) => (dieRefs.current[i] = el)} className="die" style={{ width: size, height: size }}>
              <div ref={(el) => (cubeRefs.current[i] = el)} className="die-cube" style={{ width: size, height: size }}>
                {FACES.map((f) => (
                  <div
                    key={f.v}
                    className="die-face"
                    style={{ transform: `${f.r} translateZ(${half}px)`, padding: size * 0.13, borderRadius: size * 0.22 }}
                  >
                    {Array.from({ length: 9 }, (_, c) =>
                      PIP[f.v].includes(c) ? <span key={c} className="die-pip" /> : <span key={c} />,
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
