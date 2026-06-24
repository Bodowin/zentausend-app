import { useMemo, useState } from 'react'
import { aggregateStats, getEvents, getHistory } from '../lib/storage'
import { IconBack, IconChart, IconTrophy } from './Icons'

const fmt = (n: number) => n.toLocaleString('de-DE')

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const history = useMemo(() => getHistory(), [])
  const events = useMemo(() => getEvents(history), [history])
  const [filter, setFilter] = useState<string>('')

  const stats = useMemo(() => aggregateStats(history, filter || undefined), [history, filter])
  const games = useMemo(
    () => (filter ? history.filter((g) => g.event === filter) : history),
    [history, filter],
  )

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
      <header className="mb-5 mt-2 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-black text-fog-100">
          <IconChart className="h-6 w-6 text-gold-500" /> Statistik
        </h1>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-semibold text-fog-300 transition-colors hover:text-fog-100"
        >
          <IconBack className="h-4 w-4" /> Zurück
        </button>
      </header>

      {events.length > 0 && (
        <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
          <Chip active={filter === ''} onClick={() => setFilter('')}>
            Alle
          </Chip>
          {events.map((e) => (
            <Chip key={e} active={filter === e} onClick={() => setFilter(e)}>
              {e}
            </Chip>
          ))}
        </div>
      )}

      {history.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-fog-600">
          <div>
            <IconTrophy className="mx-auto mb-3 h-10 w-10 text-ink-600" />
            <p>Noch keine Spiele gespeichert.</p>
            <p className="mt-1 text-sm">Spielt eine Runde – hier entsteht eure ewige Tabelle.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Ewige Bestenliste */}
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Ewige Bestenliste</h2>
            <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
              <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.9fr] gap-2 border-b border-ink-800 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-fog-600">
                <span>Spieler</span>
                <span className="text-right">Siege</span>
                <span className="text-right">Nieten</span>
                <span className="text-right">Bestwert</span>
              </div>
              {stats.map((s, i) => (
                <div
                  key={s.name}
                  className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.9fr] items-center gap-2 border-b border-ink-800/60 px-4 py-2.5 text-sm last:border-0"
                >
                  <span className="flex items-center gap-2 font-semibold text-fog-100">
                    {i === 0 && <IconTrophy className="h-3.5 w-3.5 text-gold-400" />}
                    {s.name}
                    <span className="text-[10px] font-normal text-fog-600">{s.games} Sp.</span>
                  </span>
                  <span className="text-right font-mono font-bold text-gold-400">{s.wins}</span>
                  <span className="text-right font-mono text-coral-400">{s.bustRate.toFixed(1)}</span>
                  <span className="text-right font-mono text-fog-300">{fmt(s.bestScore)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Verlauf */}
          <section className="space-y-2.5">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-fog-500">
              Verlauf ({games.length})
            </h2>
            {games.map((g) => (
              <div key={g.id} className="rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="text-[11px] text-fog-500">
                    {new Date(g.date).toLocaleDateString('de-DE')}
                    {g.event && <span className="ml-2 text-gold-500/80">· {g.event}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gold-400">
                    <IconTrophy className="h-3.5 w-3.5" /> {g.winner}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fog-400">
                  {[...g.players]
                    .sort((a, b) => b.score - a.score)
                    .map((pl) => (
                      <span key={pl.name}>
                        {pl.name} <span className="font-mono text-fog-300">{fmt(pl.score)}</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-gold-500/60 bg-gold-500/15 text-gold-400'
          : 'border-ink-700 bg-ink-800 text-fog-400 hover:text-fog-200'
      }`}
    >
      {children}
    </button>
  )
}
