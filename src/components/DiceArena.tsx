import { useEffect, useMemo, useRef } from 'react'
import { buzz } from '../lib/haptics'

/**
 * Virtuelle Würfel: echte CSS-3D-Würfel (6 Flächen, preserve-3d), angetrieben
 * von einer JS-Physik-Schleife.
 *
 * Die Würfel werden geworfen, prallen an Wänden UND aneinander ab und ROLLEN
 * dabei SICHTBAR in 3D durch ihre Flächen (kein Zahlen-Flackern, echte Würfel-
 * drehung). Beim Anstoßen bekommen sie zusätzlichen Drall. Am Ende klingt die
 * Drehung sanft auf der vorbestimmten Augenzahl aus. Bewusst kein WebGL → auf
 * iOS stabil, offline, design-treu.
 */

// Pip-Positionen im 3×3-Raster je Augenzahl.
const PIP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Flächen des Würfels: Augenzahl + Platzierungs-Rotation (vor translateZ).
const FACES: { v: number; r: string }[] = [
  { v: 1, r: '' },
  { v: 6, r: 'rotateY(180deg)' },
  { v: 3, r: 'rotateY(90deg)' },
  { v: 4, r: 'rotateY(-90deg)' },
  { v: 5, r: 'rotateX(90deg)' },
  { v: 2, r: 'rotateX(-90deg)' },
]

// Würfeldrehung [rx, ry], die die jeweilige Augenzahl nach vorne (zur Kamera) bringt.
const BASE: Record<number, [number, number]> = {
  1: [0, 0],
  2: [90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  6: [0, 180],
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Body {
  x: number
  y: number
  vx: number
  vy: number
  rx: number
  ry: number
  arx: number // Tumble-Winkelgeschwindigkeit (Grad/s)
  ary: number
  value: number
}

export default function DiceArena({ values, onSettle }: { values: number[]; onSettle: () => void }) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const dieRefs = useRef<(HTMLDivElement | null)[]>([])
  const cubeRefs = useRef<(HTMLDivElement | null)[]>([])
  const settledRef = useRef(false)

  // Würfelgröße responsiv, aber pro Wurf konstant (für stabile Flächen-Transforms).
  const size = useMemo(
    () => Math.round(Math.max(46, Math.min(66, Math.min(window.innerWidth, window.innerHeight * 0.5) * 0.16))),
    [],
  )

  useEffect(() => {
    const arena = arenaRef.current
    if (!arena) return
    const W = arena.clientWidth
    const H = arena.clientHeight
    const R = size * 0.62 // Kollisionsradius (etwas größer als halbe Kante → satte Stöße)
    const pad = R + 2
    const n = Math.max(1, values.length)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const settle = () => {
      if (settledRef.current) return
      settledRef.current = true
      buzz(14)
      onSettle()
    }

    // --- Würfel initialisieren: unten gestartet, nach oben geworfen, mit Drall. ---
    const bodies: Body[] = values.map((value, i) => {
      const a = rand(-Math.PI * 0.74, -Math.PI * 0.26)
      const speed = reduce ? 0 : rand(680, 1020)
      return {
        x: W / 2 + (i - (n - 1) / 2) * (size * 0.7) + rand(-10, 10),
        y: reduce ? H / 2 : H - pad - rand(0, size * 0.4),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        rx: rand(0, 360),
        ry: rand(0, 360),
        arx: reduce ? 0 : rand(-900, 900),
        ary: reduce ? 0 : rand(-900, 900),
        value,
      }
    })

    const writeTransforms = () => {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i]
        const die = dieRefs.current[i]
        const cube = cubeRefs.current[i]
        if (die) die.style.transform = `translate(${b.x - size / 2}px, ${b.y - size / 2}px)`
        if (cube) cube.style.transform = `rotateX(${b.rx}deg) rotateY(${b.ry}deg)`
      }
    }

    if (reduce) {
      // Reduzierte Bewegung: ordentlich anordnen, Endwerte zeigen, auflösen.
      const cols = Math.min(n, 4)
      bodies.forEach((b, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const rows = Math.ceil(n / cols)
        b.x = W / 2 + (col - (Math.min(n, cols) - 1) / 2) * (size * 1.4)
        b.y = H / 2 + (row - (rows - 1) / 2) * (size * 1.4)
        b.rx = BASE[b.value][0]
        b.ry = BASE[b.value][1]
      })
      writeTransforms()
      const t = window.setTimeout(settle, 500)
      return () => window.clearTimeout(t)
    }

    buzz([16, 26, 16])

    const WALL_REST = 0.58
    const DIE_REST = 0.74
    const LIN_FRICTION = 0.985
    const ANG_FRICTION = 0.985
    const SETTLE_SPEED = 16
    const dt = 1 / 60

    let raf = 0
    let calm = 0
    const startTs = performance.now()

    const step = (now: number) => {
      for (const b of bodies) {
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.rx += b.arx * dt
        b.ry += b.ary * dt
        b.vx *= LIN_FRICTION
        b.vy *= LIN_FRICTION
        b.arx *= ANG_FRICTION
        b.ary *= ANG_FRICTION

        // Wände: abprallen + Drall ändern (ein Aufprall dreht den Würfel weiter).
        if (b.x < pad) {
          b.x = pad
          b.vx = Math.abs(b.vx) * WALL_REST
          b.ary += rand(-260, 260)
        } else if (b.x > W - pad) {
          b.x = W - pad
          b.vx = -Math.abs(b.vx) * WALL_REST
          b.ary += rand(-260, 260)
        }
        if (b.y < pad) {
          b.y = pad
          b.vy = Math.abs(b.vy) * WALL_REST
          b.arx += rand(-260, 260)
        } else if (b.y > H - pad) {
          b.y = H - pad
          b.vy = -Math.abs(b.vy) * WALL_REST
          b.arx += rand(-260, 260)
        }
      }

      // Würfel-zu-Würfel-Kollision (gleiche Masse, elastisch) + Dralländerung.
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
            const overlap = (min - dist) / 2
            a.x -= nx * overlap
            a.y -= ny * overlap
            b.x += nx * overlap
            b.y += ny * overlap
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
            if (rel > 0) {
              const imp = (-(1 + DIE_REST) * rel) / 2
              a.vx += imp * nx
              a.vy += imp * ny
              b.vx -= imp * nx
              b.vy -= imp * ny
              // sichtbarer Effekt: beide Würfel bekommen beim Stoß extra Drall.
              const kick = Math.min(700, Math.abs(rel) * 0.9 + 180)
              a.arx += rand(-kick, kick)
              a.ary += rand(-kick, kick)
              b.arx += rand(-kick, kick)
              b.ary += rand(-kick, kick)
            }
          }
        }
      }

      writeTransforms()

      let maxSpeed = 0
      for (const b of bodies) maxSpeed = Math.max(maxSpeed, Math.hypot(b.vx, b.vy))
      if (maxSpeed < SETTLE_SPEED) calm++
      else calm = 0

      if (calm > 8 || now - startTs > 2800) {
        finishSnap()
        return
      }
      raf = requestAnimationFrame(step)
    }

    const finishSnap = () => {
      const starts = bodies.map((b) => ({ rx: b.rx, ry: b.ry }))
      const targets = bodies.map((b) => {
        const [brx, bry] = BASE[b.value]
        // nächstgelegene volle Umdrehung, die die Augenzahl nach vorne bringt
        return {
          rx: brx + Math.round((b.rx - brx) / 360) * 360,
          ry: bry + Math.round((b.ry - bry) / 360) * 360,
        }
      })
      const t0 = performance.now()
      const DUR = 280
      const animSnap = (now: number) => {
        const k = Math.min(1, (now - t0) / DUR)
        const e = 1 - Math.pow(1 - k, 3) // sanftes Ausklingen
        bodies.forEach((b, i) => {
          b.rx = starts[i].rx + (targets[i].rx - starts[i].rx) * e
          b.ry = starts[i].ry + (targets[i].ry - starts[i].ry) * e
        })
        writeTransforms()
        if (k < 1) requestAnimationFrame(animSnap)
        else settle()
      }
      requestAnimationFrame(animSnap)
    }

    writeTransforms()
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const half = size / 2
  return (
    <div ref={arenaRef} className="die-arena">
      {values.map((_, i) => (
        <div
          key={i}
          ref={(el) => (dieRefs.current[i] = el)}
          className="die"
          style={{ width: size, height: size }}
        >
          <span className="die-shadow" style={{ width: size * 0.86, bottom: -size * 0.16 }} />
          <div
            ref={(el) => (cubeRefs.current[i] = el)}
            className="die-cube"
            style={{ width: size, height: size }}
          >
            {FACES.map((f) => (
              <div
                key={f.v}
                className="die-face"
                style={{
                  transform: `${f.r} translateZ(${half}px)`,
                  padding: size * 0.13,
                  borderRadius: size * 0.22,
                }}
              >
                {Array.from({ length: 9 }, (_, c) =>
                  PIP[f.v].includes(c) ? <span key={c} className="die-pip" /> : <span key={c} />,
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
