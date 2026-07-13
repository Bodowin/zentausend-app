import { useEffect, useMemo } from 'react'
import { buzz } from '../lib/haptics'

export type CelebrationTier = 'legend' | 'epic' | 'strong' | 'nice' | 'mini' | 'hot'

export interface CelebrationData {
  title: string
  sub: string
  tier: CelebrationTier
  /** Sub-Text als große Punktzahl statt kleiner Bildunterschrift betonen –
   * z. B. beim Sichern, wo die Gesamtsumme wichtiger ist als der Wurfname. */
  bigSub?: boolean
}

const GOLD = '#f5b83d'
const MINT = '#2fd3a5'
const CORAL = '#ff6b6b'
const IRIS = '#7c8bff'
const WHITE = '#f4f7ff'

// Pro Stufe: Glow-Hintergrund, Schatten, Akzentfarbe, Konfetti-Menge/-Farben,
// Titelgröße und Dauer. Je seltener/wertvoller, desto wilder.
const TIER: Record<
  CelebrationTier,
  { glow: string; shadow: string; accent: string; count: number; colors: string[]; scale: number; dur: number }
> = {
  legend: { glow: 'rgba(245,184,61,0.32)', shadow: 'rgba(245,184,61,0.65)', accent: '#ffcb5c', count: 40, colors: [GOLD, MINT, CORAL, IRIS, WHITE], scale: 1, dur: 1900 },
  epic: { glow: 'rgba(245,184,61,0.28)', shadow: 'rgba(245,184,61,0.6)', accent: '#ffcb5c', count: 28, colors: [GOLD, CORAL, WHITE], scale: 0.92, dur: 1800 },
  strong: { glow: 'rgba(245,184,61,0.26)', shadow: 'rgba(245,184,61,0.55)', accent: '#ffcb5c', count: 22, colors: [GOLD, WHITE], scale: 0.88, dur: 1700 },
  nice: { glow: 'rgba(47,211,165,0.26)', shadow: 'rgba(47,211,165,0.55)', accent: '#6ff0c9', count: 16, colors: [MINT, GOLD, WHITE], scale: 0.82, dur: 1500 },
  hot: { glow: 'rgba(124,139,255,0.26)', shadow: 'rgba(124,139,255,0.55)', accent: '#aab4ff', count: 24, colors: [IRIS, MINT, WHITE], scale: 0.88, dur: 1600 },
  mini: { glow: 'rgba(124,139,255,0.16)', shadow: 'rgba(124,139,255,0.4)', accent: '#aab4ff', count: 9, colors: [IRIS, WHITE], scale: 0.7, dur: 1200 },
}

/**
 * Kurze Vollbild-Feier bei Highlights – Stil/Intensität je nach Stufe (Tier).
 * Löst sich nach `dur` von selbst auf, blockiert nichts.
 */
export function Celebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  const t = TIER[data.tier]

  useEffect(() => {
    // Haptik-Muster je nach Stufe (länger/kräftiger bei seltenen Würfen).
    buzz(data.tier === 'mini' ? [10, 30, 10] : data.tier === 'legend' ? [16, 28, 16, 28, 16, 28, 60] : [14, 30, 14, 40])
    const id = window.setTimeout(onDone, t.dur)
    return () => window.clearTimeout(id)
  }, [onDone, data.tier, t.dur])

  const pieces = useMemo(
    () =>
      Array.from({ length: t.count }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.1 + Math.random() * 0.7,
        color: t.colors[Math.floor(Math.random() * t.colors.length)],
        size: 6 + Math.random() * 7,
        rot: Math.random() * 360,
      })),
    [t],
  )

  return (
    <div
      className="celebr pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center"
      style={{ animationDuration: `${t.dur}ms` }}
    >
      <div className="celebr-glow" style={{ background: `radial-gradient(60% 45% at 50% 45%, ${t.glow}, transparent 70%)` }} />
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
      <div
        className="celebr-title"
        style={{
          // Beim Sichern (bigSub) tritt der Titel zugunsten der Punktzahl
          // zurück – die Zahl, die gerade aufs Konto geht, soll dominieren.
          fontSize: data.bigSub
            ? `calc(clamp(1.5rem, 7vw, 2.6rem) * ${t.scale})`
            : `calc(clamp(2.2rem, 12vw, 4.3rem) * ${t.scale})`,
          textShadow: `0 4px 28px ${t.shadow}, 0 2px 6px rgba(0,0,0,0.5)`,
        }}
      >
        {data.title}
      </div>
      <div
        className="celebr-sub"
        style={
          data.bigSub
            ? {
                color: t.accent,
                fontSize: `calc(clamp(2.8rem, 15vw, 5.5rem) * ${t.scale})`,
                fontFamily: 'var(--font-mono)',
                fontWeight: 900,
                letterSpacing: 'normal',
                textTransform: 'none',
                textShadow: `0 4px 24px ${t.shadow}`,
              }
            : { color: t.accent }
        }
      >
        {data.sub}
      </div>
    </div>
  )
}
