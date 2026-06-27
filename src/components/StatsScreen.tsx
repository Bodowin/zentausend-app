import { useEffect, useMemo, useState } from 'react'
import { aggregateStats, computeAwards, getEvents } from '../lib/storage'
import { deleteGame, syncAndMerge } from '../lib/cloud'
import { cloudEnabled } from '../lib/supabase'
import type { GameRecord } from '../lib/types'
import { IconBack, IconChart, IconTrash, IconTrophy } from './Icons'
import { SettingsModal } from './SettingsModal'
import { AnalysisScreen } from './AnalysisScreen'

const fmt = (n: number) => n.toLocaleString('de-DE')

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const [games, setGames] = useState<GameRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    syncAndMerge().then((res) => {
      if (!alive) return
      setGames(res.games)
      setOnline(res.online)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const events = useMemo(() => getEvents(games), [games])
  const stats = useMemo(() => aggregateStats(games, filter || undefined), [games, filter])
  const awards = useMemo(() => computeAwards(games, filter || undefined), [games, filter])
  const filtered = useMemo(
    () => (filter ? games.filter((g) => g.event === filter) : games),
    [games, filter],
  )

  const handleDelete = async (g: GameRecord) => {
    if (!window.confirm(`Spiel vom ${new Date(g.date).toLocaleDateString('de-DE')} (Sieger: ${g.winner}) löschen?`))
      return
    setBusyId(g.id)
    const res = await deleteGame(g)
    setBusyId(null)
    if (res === 'denied') {
      setShowSettings(true)
      return
    }
    setGames((prev) => prev.filter((x) => x.id !== g.id))
  }

  if (analysisGame) {
    return <AnalysisScreen game={analysisGame} onBack={() => setAnalysisGame(null)} />
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <header className="mb-4 mt-2 flex items-center justify-between">
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

      {/* Sync-Status */}
      <div className="mb-4 flex items-center gap-2 text-[11px]">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            loading ? 'animate-pulse bg-gold-500' : online ? 'bg-mint-400' : 'bg-fog-600'
          }`}
        />
        <span className="text-fog-500">
          {loading
            ? 'Synchronisiere mit der Cloud…'
            : online
              ? 'Mit Cloud synchronisiert · auf allen Geräten gleich'
              : cloudEnabled
                ? 'Offline – nur dieses Gerät'
                : 'Lokal – nur dieses Gerät'}
        </span>
      </div>

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

      {loading ? (
        <div className="grid flex-1 place-items-center text-fog-600">Lade…</div>
      ) : games.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-fog-600">
          <div>
            <IconTrophy className="mx-auto mb-3 h-10 w-10 text-ink-600" />
            <p>Noch keine Spiele gespeichert.</p>
            <p className="mt-1 text-sm">Spielt eine Runde – hier entsteht eure ewige Tabelle.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Awards & Rekorde */}
          {awards.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Awards & Rekorde</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {awards.map((a) => (
                  <div key={a.key} className="rounded-2xl border border-ink-700/70 bg-ink-850/70 p-3">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-fog-500">
                      <span className="text-base">{a.emoji}</span> {a.title}
                    </div>
                    <div className="font-bold text-fog-100">{a.name}</div>
                    <div className="text-xs text-gold-400">{a.detail}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

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
              Verlauf ({filtered.length})
            </h2>
            {filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => setAnalysisGame(g)}
                className="block w-full rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4 text-left transition-colors hover:border-ink-600"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="text-[11px] text-fog-500">
                    {new Date(g.date).toLocaleDateString('de-DE')}
                    {g.event && <span className="ml-2 text-gold-500/80">· {g.event}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-gold-400">
                      <IconTrophy className="h-3.5 w-3.5" /> {g.winner}
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(g)
                      }}
                      className={`p-1.5 text-fog-600 transition-colors hover:text-coral-400 ${
                        busyId === g.id ? 'opacity-40' : ''
                      }`}
                      aria-label="Spiel löschen"
                    >
                      <IconTrash className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-fog-400">
                  {[...g.players]
                    .sort((a, b) => b.score - a.score)
                    .map((pl) => (
                      <span key={pl.name}>
                        {pl.name} <span className="font-mono text-fog-300">{fmt(pl.score)}</span>
                      </span>
                    ))}
                  <span className="ml-auto text-[10px] text-fog-600">Analyse ›</span>
                </div>
              </button>
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
