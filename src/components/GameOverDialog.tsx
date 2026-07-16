import { useMemo, useState } from 'react'
import type { Player, Turn } from '../lib/types'
import { computeGameAwards, gameAwardNames, type GameAwardTone } from '../lib/gameAwards'
import { playerColor } from '../lib/colors'
import { IconChart, IconCheck, IconRefresh, IconShare, IconTrophy } from './Icons'

interface Props {
  winner: Player
  players: Player[]
  turns: Turn[]
  event: string
  onRematch: () => void
  onAnalysis: () => void
  onNewGame: () => void
}

type ShareState = 'idle' | 'sharing' | 'done'

const fmt = (value: number) => value.toLocaleString('de-DE')

const awardTone: Record<GameAwardTone, string> = {
  gold: 'border-gold-500/35 bg-gold-500/10 text-gold-300',
  mint: 'border-mint-500/35 bg-mint-500/10 text-mint-300',
  coral: 'border-coral-500/35 bg-coral-500/10 text-coral-300',
}

const awardSymbol = {
  'high-roller': '◆',
  'statistik-trotzer': '↗',
  efficiency: '◎',
  pechvogel: '×',
} as const

export function GameOverDialog({ winner, players, turns, event, onRematch, onAnalysis, onNewGame }: Props) {
  const [shareState, setShareState] = useState<ShareState>('idle')
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const awards = useMemo(() => computeGameAwards(players, turns), [players, turns])
  const rounds = useMemo(() => new Set(turns.map((turn) => turn.round)).size, [turns])
  const margin = sorted.length > 1 ? Math.max(0, winner.score - sorted[1].score) : winner.score

  const handleShare = async () => {
    if (shareState === 'sharing') return
    setShareState('sharing')
    try {
      const { shareResultImage } = await import('../lib/shareImage')
      const result = await shareResultImage(winner, players, event, turns)
      if (result === 'cancelled') {
        setShareState('idle')
        return
      }
      setShareState('done')
      window.setTimeout(() => setShareState('idle'), 1800)
    } catch (error) {
      console.warn('Ergebnisbild konnte nicht erstellt werden:', error)
      setShareState('idle')
    }
  }

  return (
    <div
      className="glass absolute inset-0 z-50 overflow-y-auto px-3 py-[max(env(safe-area-inset-top),0.75rem)] animate-pop"
      role="dialog"
      aria-modal="true"
      aria-label={`Spiel beendet – ${winner.name} gewinnt`}
    >
      <div className="mx-auto flex min-h-full w-full max-w-lg items-center justify-center py-3">
        <section className="relative w-full overflow-hidden rounded-[2rem] border border-gold-500/30 bg-ink-900 shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-mint-500/10 blur-3xl" />

          <div className="relative px-5 pb-5 pt-6 text-center sm:px-7">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 shadow-lg">
              <IconTrophy className="h-9 w-9 text-gold-400" />
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.32em] text-fog-500">Champion der Clique</p>
            <h2 className="mt-1 font-display text-4xl font-black tracking-tight text-fog-100 sm:text-5xl">{winner.name}</h2>
            <p className="mt-1 font-mono text-2xl font-black text-gold-400">{fmt(winner.score)} Punkte</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-fog-500">
              {event && <span className="rounded-full border border-ink-700 bg-ink-950/50 px-3 py-1">{event}</span>}
              {rounds > 0 && <span className="rounded-full border border-ink-700 bg-ink-950/50 px-3 py-1">{rounds} Runden</span>}
              {sorted.length > 1 && (
                <span className="rounded-full border border-ink-700 bg-ink-950/50 px-3 py-1">+{fmt(margin)} Vorsprung</span>
              )}
            </div>
          </div>

          <div className="relative border-y border-ink-800 bg-ink-950/35 px-4 py-4 sm:px-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-fog-500">Endstand</h3>
              <span className="text-[10px] text-fog-600">N = Nieten</span>
            </div>
            <div className="space-y-2">
              {sorted.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                    index === 0 ? 'border-gold-500/30 bg-gold-500/10' : 'border-ink-800 bg-ink-900/60'
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-mono text-sm font-black ${
                      index === 0 ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-fog-400'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: playerColor(player.name) }} />
                  <div className="min-w-0 flex-1 text-left">
                    <p className={`truncate font-bold ${index === 0 ? 'text-gold-300' : 'text-fog-200'}`}>{player.name}</p>
                    <p className="text-[10px] text-fog-600">{player.busts} N</p>
                  </div>
                  <span className={`font-mono text-base font-black ${index === 0 ? 'text-gold-300' : 'text-fog-300'}`}>
                    {fmt(player.score)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {awards.length > 0 && (
            <div className="relative px-4 py-4 sm:px-6">
              <h3 className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-fog-500">Auszeichnungen</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {awards.map((award) => (
                  <div key={award.id} className={`rounded-2xl border p-3 text-left ${awardTone[award.tone]}`}>
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-black/15 text-lg font-black">
                        {awardSymbol[award.id]}
                      </span>
                      <p className="text-[10px] font-black uppercase tracking-wide">{award.title}</p>
                    </div>
                    <p className="mt-2 truncate text-sm font-black text-fog-100">{gameAwardNames(award)}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-fog-500">{award.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative grid gap-2 border-t border-ink-800 bg-ink-950/20 p-4 sm:grid-cols-2 sm:p-5">
            <button
              onClick={onRematch}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 px-4 py-3 font-black text-ink-950 shadow-lg transition-transform active:scale-[0.98]"
            >
              <IconRefresh className="h-5 w-5" /> Revanche
            </button>
            <button
              onClick={() => void handleShare()}
              disabled={shareState === 'sharing'}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 px-4 py-3 font-black text-ink-950 shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
            >
              {shareState === 'done' ? <IconCheck className="h-5 w-5" /> : <IconShare className="h-5 w-5" />}
              {shareState === 'sharing' ? 'Bild wird erstellt…' : shareState === 'done' ? 'Bereit zum Teilen' : 'Ergebnis teilen'}
            </button>
            <button
              onClick={onAnalysis}
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3 font-bold text-fog-200 transition-colors hover:text-fog-100"
            >
              <IconChart className="h-4 w-4" /> Runden-Analyse
            </button>
            <button
              onClick={onNewGame}
              className="min-h-11 rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3 font-bold text-fog-300 transition-colors hover:text-fog-100"
            >
              Zum Start
            </button>
            <p className="text-center text-[10px] text-fog-600 sm:col-span-2">
              Bei der Revanche beginnt {winner.name}; die Reihenfolge kann vor dem Start geändert werden.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
