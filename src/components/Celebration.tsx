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

export interface CelebrationScoreParts {
  value: string
  label: string
}

/**
 * Trennt eine große Sicherungsanzeige in die eigentliche Zahl und eine kurze,
 * separat skalierbare Beschriftung. So muss „1.500 Punkte“ auf kleinen iPhones
 * nicht als eine einzige überbreite Textzeile gerendert werden.
 */
export function splitCelebrationScore(sub: string): CelebrationScoreParts {
  const trimmed = sub.trim()
  const match = trimmed.match(/^(.+?)\s+Punkte?$/i)
  if (!match) return { value: trimmed, label: '' }
  return { value: match[1], label: 'Punkte gesichert' }
}

const GOLD = '#f5b83d'
const MINT = '#2fd3a5'
const CORAL = '#ff6b6b'
const IRIS = '#7c8bff'
const WHITE = '#f4f7ff'

// Pro Stufe: Glow-Hintergrund, Schatten, Akzentfarbe, Konfetti-Menge/-Farben,
// Textskalierung und Dauer. Je seltener/wertvoller, desto wilder.
const TIER: Record<
  CelebrationTier,
  { glow: string; shadow: string; accent: string; count: number; colors: string[]; scale: number; dur: number }
> = {
  legend: {
    glow: 'rgba(245,184,61,0.32)',
    shadow: 'rgba(245,184,61,0.65)',
    accent: '#ffcb5c',
    count: 40,
    colors: [GOLD, MINT, CORAL, IRIS, WHITE],
    scale: 1,
    dur: 1900,
  },
  epic: {
    glow: 'rgba(245,184,61,0.28)',
    shadow: 'rgba(245,184,61,0.6)',
    accent: '#ffcb5c',
    count: 28,
    colors: [GOLD, CORAL, WHITE],
    scale: 0.92,
    dur: 1800,
  },
  strong: {
    glow: 'rgba(245,184,61,0.26)',
    shadow: 'rgba(245,184,61,0.55)',
    accent: '#ffcb5c',
    count: 22,
    colors: [GOLD, WHITE],
    scale: 0.88,
    dur: 1700,
  },
  nice: {
    glow: 'rgba(47,211,165,0.26)',
    shadow: 'rgba(47,211,165,0.55)',
    accent: '#6ff0c9',
    count: 16,
    colors: [MINT, GOLD, WHITE],
    scale: 0.82,
    dur: 1500,
  },
  hot: {
    glow: 'rgba(124,139,255,0.26)',
    shadow: 'rgba(124,139,255,0.55)',
    accent: '#aab4ff',
    count: 24,
    colors: [IRIS, MINT, WHITE],
    scale: 0.88,
    dur: 1600,
  },
  mini: {
    glow: 'rgba(124,139,255,0.16)',
    shadow: 'rgba(124,139,255,0.4)',
    accent: '#aab4ff',
    count: 9,
    colors: [IRIS, WHITE],
    scale: 0.7,
    dur: 1200,
  },
}

/**
 * Kurze Vollbild-Feier bei Highlights – Stil/Intensität je nach Stufe (Tier).
 * Sie fängt während ihrer kurzen Laufzeit Touches ab, damit nicht versehentlich
 * bereits eine Aktion des nächsten Zuges ausgelöst wird.
 */
export function Celebration({ data, onDone }: { data: CelebrationData; onDone: () => void }) {
  const t = TIER[data.tier]
  const score = data.bigSub ? splitCelebrationScore(data.sub) : null

  useEffect(() => {
    // Haptik-Muster je nach Stufe (länger/kräftiger bei seltenen Würfen).
    buzz(
      data.tier === 'mini'
        ? [10, 30, 10]
        : data.tier === 'legend'
          ? [16, 28, 16, 28, 16, 28, 60]
          : [14, 30, 14, 40],
    )
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
      className="celebr fixed inset-0 z-[70] grid place-items-center"
      style={{
        ['--celebr-duration' as string]: `${t.dur}ms`,
        ['--celebr-scale' as string]: t.scale,
        ['--celebr-accent' as string]: t.accent,
        ['--celebr-shadow' as string]: t.shadow,
      }}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      aria-label={`${data.title} ${data.sub}`}
    >
      <div className="celebr-scrim" />
      <div
        className="celebr-glow"
        style={{ background: `radial-gradient(60% 45% at 50% 45%, ${t.glow}, transparent 70%)` }}
      />
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.5,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.dur}s`,
            ['--rot' as string]: `${piece.rot}deg`,
          }}
        />
      ))}

      <div className="celebr-content">
        <div className={`celebr-title${data.bigSub ? ' celebr-title--support' : ''}`}>{data.title}</div>
        {score ? (
          <div className="celebr-score">
            <span className="celebr-score-value">{score.value}</span>
            {score.label && <span className="celebr-score-label">{score.label}</span>}
          </div>
        ) : (
          <div className="celebr-sub">{data.sub}</div>
        )}
      </div>
    </div>
  )
}
