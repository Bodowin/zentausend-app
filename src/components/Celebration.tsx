import { useEffect, useMemo } from 'react'
import { buzz } from '../lib/haptics'

export interface CelebrationData {
  title: string
  sub: string
}

const COLORS = ['#f5b83d', '#2fd3a5', '#ff6b6b', '#7c8bff', '#f4f7ff']

/**
 * Kurze Vollbild-Feier bei Highlights (Straße, Pasch, „Alles zählt" …):
 * Konfetti + Glow + Schriftzug, löst sich nach ~1,7 s von selbst auf.
 */
export function Celebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  useEffect(() => {
    buzz([14, 30, 14, 30, 50])
    const t = window.setTimeout(onDone, 1700)
    return () => window.clearTimeout(t)
  }, [onDone])

  // Konfetti-Stücke (einmal pro Feier erzeugt).
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.1 + Math.random() * 0.7,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 7,
        rot: Math.random() * 360,
      })),
    [],
  )

  return (
    <div className="celebr pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center">
      <div className="celebr-glow" />
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
      <div className="celebr-title">{data.title}</div>
      <div className="celebr-sub">{data.sub}</div>
    </div>
  )
}
