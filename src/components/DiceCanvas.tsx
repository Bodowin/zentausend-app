import { useEffect, useRef } from 'react'
import { buzz } from '../lib/haptics'

/**
 * Virtuelle Würfel mit echter 2D-Physik auf einem Canvas.
 *
 * Die Würfel werden in die Schale „geworfen", prallen an den Wänden UND
 * aneinander ab (sie beeinflussen sich gegenseitig), taumeln (die Augenzahl
 * wechselt, solange sie schnell drehen) und kommen mit Reibung auf ihren
 * vorbestimmten Werten zur Ruhe. Bewusst KEIN WebGL → läuft zuverlässig auf iOS,
 * offline und ohne Absturzrisiko. Das Ergebnis (`values`) bleibt fix, nur die
 * Bewegung dorthin ist physikalisch.
 */

const PIP: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}

interface Die {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  av: number
  value: number
  face: number
  faceTick: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function DiceCanvas({ values, onSettle }: { values: number[]; onSettle: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settledRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onSettle()
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // Würfelgröße & Kollisionsradius an die Schale anpassen.
    const S = Math.max(40, Math.min(72, Math.min(W, H) * 0.17))
    const R = S * 0.52 // Kollisionsradius (Würfel als Kreis genähert)
    const pad = R + 4
    const n = Math.max(1, values.length)

    const settle = () => {
      if (settledRef.current) return
      settledRef.current = true
      buzz(14)
      onSettle()
    }

    if (reduce) {
      // Reduzierte Bewegung: Würfel einfach ordentlich anzeigen, dann auflösen.
      const cols = Math.min(n, 4)
      const rows = Math.ceil(n / cols)
      const gap = S * 1.3
      ctx.clearRect(0, 0, W, H)
      values.forEach((v, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = W / 2 + (col - (Math.min(n, cols) - 1) / 2) * gap
        const y = H / 2 + (row - (rows - 1) / 2) * gap
        drawDie(ctx, x, y, 0, v, S)
      })
      const t = window.setTimeout(settle, 500)
      return () => window.clearTimeout(t)
    }

    // --- Wurf initialisieren: alle Würfel starten unten und fliegen nach oben. ---
    const dice: Die[] = values.map((value, i) => {
      const a = rand(-Math.PI * 0.78, -Math.PI * 0.22) // überwiegend nach oben
      const speed = rand(640, 980)
      return {
        x: W / 2 + (i - (n - 1) / 2) * (S * 0.55) + rand(-8, 8),
        y: H - pad - rand(0, S * 0.4),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        angle: rand(0, Math.PI * 2),
        av: rand(-14, 14),
        value,
        face: value,
        faceTick: 0,
      }
    })

    buzz([16, 26, 16])

    const WALL_REST = 0.56
    const DIE_REST = 0.72
    const LIN_FRICTION = 0.986
    const ANG_FRICTION = 0.965
    const TUMBLE = 150 // ab dieser Geschwindigkeit wechselt die Augenzahl
    const SETTLE_SPEED = 14
    const dt = 1 / 60

    let raf = 0
    let calm = 0
    const startTs = performance.now()

    const step = (now: number) => {
      // --- Integration ---
      for (const d of dice) {
        d.x += d.vx * dt
        d.y += d.vy * dt
        d.angle += d.av * dt
        d.vx *= LIN_FRICTION
        d.vy *= LIN_FRICTION
        d.av *= ANG_FRICTION

        // Wände
        if (d.x < pad) {
          d.x = pad
          d.vx = Math.abs(d.vx) * WALL_REST
          d.av += rand(-3, 3)
        } else if (d.x > W - pad) {
          d.x = W - pad
          d.vx = -Math.abs(d.vx) * WALL_REST
          d.av += rand(-3, 3)
        }
        if (d.y < pad) {
          d.y = pad
          d.vy = Math.abs(d.vy) * WALL_REST
          d.av += rand(-3, 3)
        } else if (d.y > H - pad) {
          d.y = H - pad
          d.vy = -Math.abs(d.vy) * WALL_REST
          d.av += rand(-3, 3)
        }
      }

      // --- Würfel-zu-Würfel-Kollision (gleiche Masse, elastisch genähert) ---
      for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
          const a = dice[i]
          const b = dice[j]
          let dx = b.x - a.x
          let dy = b.y - a.y
          let dist = Math.hypot(dx, dy)
          const min = R * 2
          if (dist < min && dist > 0) {
            const nx = dx / dist
            const ny = dy / dist
            const overlap = (min - dist) / 2
            // auseinanderschieben
            a.x -= nx * overlap
            a.y -= ny * overlap
            b.x += nx * overlap
            b.y += ny * overlap
            // elastischer Stoß gleicher Masse: Normalkomponenten tauschen (mit
            // Restitution), aber nur wenn sich die Würfel aufeinander zubewegen.
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
            if (rel > 0) {
              const imp = (-(1 + DIE_REST) * rel) / 2
              a.vx += imp * nx
              a.vy += imp * ny
              b.vx -= imp * nx
              b.vy -= imp * ny
              a.av += rand(-4, 4)
              b.av += rand(-4, 4)
            }
          }
        }
      }

      // --- Augenzahl-Taumeln & Ruhe-Erkennung ---
      let maxSpeed = 0
      for (const d of dice) {
        const sp = Math.hypot(d.vx, d.vy)
        maxSpeed = Math.max(maxSpeed, sp, Math.abs(d.av) * R)
        if (sp > TUMBLE) {
          d.faceTick++
          if (d.faceTick % 4 === 0) d.face = 1 + Math.floor(Math.random() * 6)
        } else {
          d.face = d.value // beim Verlangsamen auf den echten Wert einrasten
        }
      }

      render(ctx, W, H, dice, S)

      const elapsed = now - startTs
      if (maxSpeed < SETTLE_SPEED) calm++
      else calm = 0

      if (calm > 8 || elapsed > 2600) {
        // sanftes Einrasten der Drehung auf die nächste Vierteldrehung
        finishSnap()
        return
      }
      raf = requestAnimationFrame(step)
    }

    const finishSnap = () => {
      const starts = dice.map((d) => d.angle)
      const targets = dice.map((d) => Math.round(d.angle / (Math.PI / 2)) * (Math.PI / 2))
      const t0 = performance.now()
      const DUR = 200
      const animSnap = (now: number) => {
        const k = Math.min(1, (now - t0) / DUR)
        const e = 1 - (1 - k) * (1 - k)
        dice.forEach((d, i) => {
          d.angle = starts[i] + (targets[i] - starts[i]) * e
          d.face = d.value
        })
        render(ctx, W, H, dice, S)
        if (k < 1) requestAnimationFrame(animSnap)
        else settle()
      }
      requestAnimationFrame(animSnap)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="h-full w-full" />
}

// --- Zeichnen -------------------------------------------------------------

function render(ctx: CanvasRenderingContext2D, W: number, H: number, dice: Die[], S: number) {
  ctx.clearRect(0, 0, W, H)
  // dezente „Tisch"-Fläche für Tiefe
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7)
  g.addColorStop(0, 'rgba(40,52,74,0.35)')
  g.addColorStop(1, 'rgba(6,9,16,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Schatten zuerst (alle), damit Würfel darüber liegen
  for (const d of dice) {
    ctx.save()
    ctx.translate(d.x, d.y + S * 0.14)
    ctx.scale(1, 0.6)
    const sh = ctx.createRadialGradient(0, 0, 1, 0, 0, S * 0.7)
    sh.addColorStop(0, 'rgba(0,0,0,0.45)')
    sh.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sh
    ctx.beginPath()
    ctx.arc(0, 0, S * 0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  for (const d of dice) drawDie(ctx, d.x, d.y, d.angle, d.face, S)
}

function drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, face: number, S: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const h = S / 2

  // Körper
  const body = ctx.createLinearGradient(0, -h, 0, h)
  body.addColorStop(0, '#f6f8ff')
  body.addColorStop(1, '#d4dcef')
  ctx.fillStyle = body
  roundRect(ctx, -h, -h, S, S, S * 0.22)
  ctx.fill()

  // unterer Innenschatten für Plastizität
  const inner = ctx.createLinearGradient(0, h * 0.2, 0, h)
  inner.addColorStop(0, 'rgba(10,14,22,0)')
  inner.addColorStop(1, 'rgba(10,14,22,0.18)')
  ctx.fillStyle = inner
  roundRect(ctx, -h, -h, S, S, S * 0.22)
  ctx.fill()

  // Rand
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(10,14,22,0.14)'
  roundRect(ctx, -h, -h, S, S, S * 0.22)
  ctx.stroke()

  // Augen
  const pr = S * 0.092
  const off = S * 0.27
  for (const [px, py] of PIP[face] ?? []) {
    const pg = ctx.createRadialGradient(px * off - pr * 0.3, py * off - pr * 0.3, 1, px * off, py * off, pr)
    pg.addColorStop(0, '#3a4763')
    pg.addColorStop(1, '#0a0e16')
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(px * off, py * off, pr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
