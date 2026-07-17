import { useMemo, useState } from 'react'
import type { GameRecord } from '../lib/types'
import { computeEventCup } from '../lib/eventCup'
import { playerColor } from '../lib/colors'
import { IconBack, IconShare, IconTrophy } from './Icons'

interface Props {
  event: string
  games: GameRecord[]
  onBack: () => void
  onOpenGame: (game: GameRecord) => void
  onAssignUnassigned: () => void
}

const fmt = (value: number) => value.toLocaleString('de-DE')
const pct = (value: number) => `${Math.round(value * 100)} %`
const placement = (value: number) => value.toFixed(2).replace('.', ',')

function period(from: string, to: string): string {
  const start = new Date(from).toLocaleDateString('de-DE')
  const end = new Date(to).toLocaleDateString('de-DE')
  return start === end ? start : `${start} – ${end}`
}

export function EventCupScreen({ event, games, onBack, onOpenGame, onAssignUnassigned }: Props) {
  const summary = useMemo(() => computeEventCup(games, event), [games, event])
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  if (!summary) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
        <button onClick={onBack} className="mb-5 flex items-center gap-1.5 self-start rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-semibold text-fog-300">
          <IconBack className="h-4 w-4" /> Zurück
        </button>
        <div className="grid flex-1 place-items-center text-center text-fog-500">
          Für diesen Anlass wurden keine Spiele gefunden.
        </div>
      </div>
    )
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    setShareMessage('')
    try {
      const { shareEventCupImage } = await import('../lib/eventCupShareImage')
      const result = await shareEventCupImage(summary)
      if (result === 'downloaded') setShareMessage('Urlaubs-Cup als Bild gespeichert.')
      else if (result === 'shared') setShareMessage('Urlaubs-Cup geteilt.')
      else if (result === 'text') setShareMessage('Bild konnte auf diesem Gerät nicht erstellt werden.')
    } catch (error) {
      console.warn('Event-Cup konnte nicht geteilt werden:', error)
      setShareMessage('Teilen ist gerade nicht möglich.')
    } finally {
      setSharing(false)
    }
  }

  const championNames = summary.champions.map((champion) => champion.name).join(' & ')
  const champion = summary.champions[0]

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gold-400">Urlaubs-Cup</p>
          <h1 className="mt-1 truncate text-2xl font-black text-fog-100">{summary.event}</h1>
          <p className="mt-1 text-xs text-fog-500">
            {period(summary.from, summary.to)} · {summary.games.length} {summary.games.length === 1 ? 'Spiel' : 'Spiele'}
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-semibold text-fog-300"
        >
          <IconBack className="h-4 w-4" /> Zurück
        </button>
      </header>

      <section className="relative mb-5 overflow-hidden rounded-[2rem] border border-gold-500/30 bg-gradient-to-br from-gold-500/15 via-ink-850 to-ink-900 p-5 shadow-xl">
        <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold-400/40 bg-gold-500/15 text-gold-400">
            <IconTrophy className="h-8 w-8" />
          </div>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-fog-500">
            {summary.champions.length > 1 ? 'Gemeinsame Champions' : 'Urlaubs-Champion'}
          </p>
          <h2 className="mt-1 text-3xl font-black text-gold-300">{championNames}</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-bold">
            <span className="rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1.5 text-gold-300">
              {champion.wins} {champion.wins === 1 ? 'Sieg' : 'Siege'}
            </span>
            <span className="rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-fog-300">{pct(champion.winRate)} Siegquote</span>
            <span className="rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-fog-300">Ø Platz {placement(champion.averagePlacement)}</span>
          </div>
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-fog-500">Gesamtstand</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-fog-600">Siege → Siegquote → Ø Platzierung → direkte Duelle</p>
          </div>
          <span className="text-[10px] text-fog-600">Rohpunkte entscheiden nicht</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
          <div className="grid grid-cols-[1.55fr_0.48fr_0.62fr_0.68fr] gap-2 border-b border-ink-800 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-fog-600">
            <span>Spieler</span>
            <span className="text-right">Siege</span>
            <span className="text-right">Quote</span>
            <span className="text-right">Ø Platz</span>
          </div>
          {summary.standings.map((standing) => (
            <div
              key={standing.id}
              className={`grid grid-cols-[1.55fr_0.48fr_0.62fr_0.68fr] items-center gap-2 border-b border-ink-800/60 px-3 py-3 text-sm last:border-0 ${
                standing.rank === 1 ? 'bg-gold-500/7' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${standing.rank === 1 ? 'bg-gold-500 text-ink-950' : 'bg-ink-800 text-fog-500'}`}>
                  {standing.rank}
                </span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: playerColor(standing.name) }} />
                <span className="min-w-0">
                  <span className="block truncate font-bold text-fog-100">{standing.name}</span>
                  <span className="block text-[9px] text-fog-600">{standing.games} Sp. · Bestwert {fmt(standing.bestScore)}</span>
                </span>
              </div>
              <span className="text-right font-mono font-black text-gold-400">{standing.wins}</span>
              <span className="text-right font-mono text-fog-300">{pct(standing.winRate)}</span>
              <span className="text-right font-mono text-fog-300">{placement(standing.averagePlacement)}</span>
            </div>
          ))}
        </div>
      </section>

      {summary.records.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-fog-500">Event-Rekorde</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {summary.records.map((record, index) => (
              <div key={record.key} className={`${index === summary.records.length - 1 && summary.records.length % 2 === 1 ? 'col-span-2' : ''} rounded-2xl border border-ink-700/70 bg-ink-850/70 p-3`}>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-fog-500">
                  <span className="text-lg">{record.emoji}</span> {record.title}
                </div>
                <div className="mt-1 truncate font-bold text-fog-100">{record.name}</div>
                <div className="mt-0.5 text-xs text-gold-400">{record.detail}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {summary.duels.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-fog-500">Direkte Duelle</h2>
          <div className="space-y-2">
            {summary.duels.map((duel) => {
              const decisive = duel.aAhead + duel.bAhead
              const aWidth = decisive ? Math.round((duel.aAhead / decisive) * 100) : 50
              return (
                <div key={duel.key} className="rounded-2xl border border-ink-700/70 bg-ink-850/70 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-bold">
                    <span className="truncate text-gold-300">{duel.aName} <span className="font-mono">{duel.aAhead}</span></span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-fog-600">{duel.games} Duelle</span>
                    <span className="truncate text-right text-mint-300"><span className="font-mono">{duel.bAhead}</span> {duel.bName}</span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink-900">
                    <div className="bg-gold-500/70" style={{ width: `${aWidth}%` }} />
                    <div className="bg-mint-400/70" style={{ width: `${100 - aWidth}%` }} />
                  </div>
                  {duel.ties > 0 && <p className="mt-1 text-center text-[9px] text-fog-600">{duel.ties} Gleichstand</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-fog-500">Cup-Verlauf</h2>
        <div className="overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850/70">
          {summary.progress.map((entry) => {
            const game = summary.games.find((candidate) => candidate.id === entry.gameId)
            return (
              <button
                type="button"
                key={entry.gameId}
                onClick={() => game && onOpenGame(game)}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-ink-800/60 px-3 py-3 text-left last:border-0 hover:bg-ink-800/40"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-800 font-mono text-xs font-black text-fog-400">{entry.number}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-fog-100">{entry.winner} gewinnt</span>
                  <span className="block text-[10px] text-fog-600">{new Date(entry.date).toLocaleDateString('de-DE')} · Führung: {entry.leaders.join(' & ')}</span>
                </span>
                <span className={`text-[10px] font-bold ${entry.leaderChanged ? 'text-gold-400' : 'text-fog-600'}`}>
                  {entry.leaderChanged ? 'Führungswechsel' : 'Analyse ›'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {summary.unassignedGames.length > 0 && (
        <section className="mb-5 rounded-2xl border border-mint-500/30 bg-mint-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black text-mint-300">Noch nicht zugeordnet</h2>
              <p className="mt-1 text-xs leading-relaxed text-fog-400">
                {summary.unassignedGames.length} {summary.unassignedGames.length === 1 ? 'Spiel hat' : 'Spiele haben'} noch keinen Anlass.
              </p>
              <p className="mt-1 text-[10px] text-fog-600">
                {summary.unassignedGames.slice(0, 3).map((game) => `${new Date(game.date).toLocaleDateString('de-DE')} · ${game.winner}`).join('  ·  ')}
              </p>
            </div>
            <button type="button" onClick={onAssignUnassigned} className="shrink-0 rounded-xl bg-mint-400 px-3 py-2 text-xs font-black text-ink-950">
              Zuordnen
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => void share()}
        disabled={sharing}
        className="mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 px-4 py-3 font-black text-ink-950 shadow-lg disabled:opacity-50"
      >
        <IconShare className="h-5 w-5" /> {sharing ? 'Bild wird erstellt…' : 'Urlaubs-Cup teilen'}
      </button>
      {shareMessage && <p className="mb-4 text-center text-xs font-semibold text-gold-300" aria-live="polite">{shareMessage}</p>}
    </div>
  )
}
