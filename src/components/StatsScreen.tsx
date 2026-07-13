import { useEffect, useMemo, useRef, useState } from 'react'
import {
  aggregateStats,
  clearHistoryIntegrityReport,
  computeAwards,
  computeForm,
  computeHeadToHead,
  computeNemesis,
  getEvents,
  getHistory,
  getHistoryIntegrityReport,
} from '../lib/storage'
import { deleteGame, editGameEvent, pendingEventEditCount, syncAndMerge } from '../lib/cloud'
import { exportBackup, exportIntegrityReport, importBackup } from '../lib/backup'
import { cloudEnabled } from '../lib/supabase'
import type { GameRecord, PlayerStats } from '../lib/types'
import { playerColor } from '../lib/colors'
import { IconBack, IconChart, IconPencil, IconTrash, IconTrophy } from './Icons'
import { SettingsModal } from './SettingsModal'
import { AnalysisScreen } from './AnalysisScreen'

const fmt = (n: number) => n.toLocaleString('de-DE')

export function StatsScreen({ onBack }: { onBack: () => void }) {
  // Lokale Spiele sofort zeigen (offline-first): Die Cloud-Synchronisation läuft
  // im Hintergrund und ersetzt die Liste nur, wenn sie erfolgreich war. So sieht
  // man auf See (kein/schwaches Netz) seine Tabelle ohne Wartezeit.
  const [games, setGames] = useState<GameRecord[]>(() => getHistory())
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(false)
  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())
  const [integrity, setIntegrity] = useState(() => getHistoryIntegrityReport())
  const [filter, setFilter] = useState<string>('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [focusAdmin, setFocusAdmin] = useState(false)
  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null)
  // Nachträglich den Anlass eines Spiels bearbeiten (z. B. vergessen zu setzen
  // oder Tippfehler korrigieren) – hält Spiel + Eingabefeld-Wert getrennt vom
  // eigentlichen Spiel-Objekt, bis gespeichert wird.
  const [editingGame, setEditingGame] = useState<GameRecord | null>(null)
  const [editValue, setEditValue] = useState('')
  const [msg, setMsg] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const reload = () => {
    setLoading(true)
    return syncAndMerge().then((res) => {
      setGames(res.games)
      setOnline(res.online)
      setPendingSync(res.pending)
      setIntegrity(getHistoryIntegrityReport())
      setLoading(false)
    })
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    syncAndMerge().then((res) => {
      if (!alive) return
      setGames(res.games)
      setOnline(res.online)
      setPendingSync(res.pending)
      setIntegrity(getHistoryIntegrityReport())
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg((x) => (x === m ? '' : x)), 2600)
  }

  const handleImport = async (file: File) => {
    try {
      const res = await importBackup(file)
      await reload()
      const notes = [`${res.added} neu importiert`, `${res.total} gesamt`]
      if (res.repaired > 0) notes.push(`${res.repaired} repariert`)
      if (res.quarantined > 0) notes.push(`${res.quarantined} in Quarantäne`)
      setIntegrity(getHistoryIntegrityReport())
      flash(notes.join(' · '))
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Import fehlgeschlagen.')
    }
  }

  const events = useMemo(() => getEvents(games), [games])
  const stats = useMemo(() => aggregateStats(games, filter || undefined), [games, filter])
  const awards = useMemo(() => computeAwards(games, filter || undefined), [games, filter])
  const form = useMemo(() => computeForm(games, filter || undefined), [games, filter])
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
    if (res === 'offline') {
      flash('Offline – Spiel wurde nicht gelöscht.')
      return
    }
    if (res === 'denied') {
      flash('Löschen nur mit Admin-Code.')
      setFocusAdmin(true)
      setShowSettings(true)
      return
    }
    setGames((prev) => prev.filter((x) => x.id !== g.id))
  }

  // Sofort/optimistisch: lokal steht der neue Anlass schon fest, der Cloud-
  // Abgleich läuft unabhängig im Hintergrund weiter (siehe editGameEvent) –
  // die Bearbeitung soll nie auf ein schwaches Netz warten müssen.
  const handleSaveEvent = () => {
    if (!editingGame) return
    const trimmed = editValue.trim()
    const g = editingGame
    setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, event: trimmed } : x)))
    setEditingGame(null)
    const sync = editGameEvent(g, trimmed)
    setPendingSync(pendingEventEditCount())
    flash('Anlass lokal gespeichert · Sync läuft…')
    void sync.then((result) => {
      setPendingSync(pendingEventEditCount())
      if (result === 'ok') flash('Anlass synchronisiert.')
      else if (result === 'denied') flash('Lokal gespeichert · Clique-Code prüfen.')
      else flash('Lokal gespeichert · wird später synchronisiert.')
    })
  }

  if (analysisGame) {
    return <AnalysisScreen game={analysisGame} onBack={() => setAnalysisGame(null)} />
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
      {showSettings && (
        <SettingsModal
          focusAdmin={focusAdmin}
          onClose={() => {
            setShowSettings(false)
            setFocusAdmin(false)
          }}
        />
      )}

      {editingGame && (
        <div
          className="glass fixed inset-0 z-50 flex items-center justify-center p-6 animate-pop"
          onClick={() => setEditingGame(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-ink-700 bg-ink-850 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-black text-fog-100">Anlass bearbeiten</h3>
            <p className="mb-4 text-xs text-fog-500">
              {new Date(editingGame.date).toLocaleDateString('de-DE')} · Sieger: {editingGame.winner}
            </p>
            <input
              type="text"
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEvent()}
              placeholder="Anlass, z. B. Skiurlaub 2025"
              className="w-full rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600 transition-colors focus:border-gold-500/70 focus:outline-none"
            />
            {events.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {events.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEditValue(e)}
                    className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs text-fog-400 transition-colors hover:border-gold-500/50 hover:text-gold-400"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setEditingGame(null)}
                className="rounded-2xl border border-ink-700 bg-ink-800 py-3 font-bold text-fog-200 transition-colors hover:text-fog-100"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveEvent}
                className="rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3 font-bold text-ink-950 shadow-lg transition-all active:scale-[0.98]"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleImport(f)
          e.target.value = ''
        }}
      />

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

      {/* Backup-Werkzeuge: Export sichert die ewige Tabelle, Import spielt sie zurück. */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => exportBackup(games)}
          disabled={games.length === 0}
          className="flex-1 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-fog-300 transition-colors hover:text-fog-100 disabled:opacity-40"
        >
          ⬇︎ Backup sichern
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="flex-1 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-fog-300 transition-colors hover:text-fog-100"
        >
          ⬆︎ Backup laden
        </button>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-center text-xs font-semibold text-gold-300 animate-pop">
          {msg}
        </div>
      )}

      {integrity && (integrity.repaired > 0 || integrity.quarantined > 0) && (
        <div className="mb-4 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-3 text-xs text-fog-300">
          <div className="font-bold text-gold-300">Datenprüfung abgeschlossen</div>
          <div className="mt-1 leading-relaxed">
            {integrity.repaired > 0 && <span>{integrity.repaired} repariert</span>}
            {integrity.repaired > 0 && integrity.quarantined > 0 && <span> · </span>}
            {integrity.quarantined > 0 && <span>{integrity.quarantined} sicher isoliert</span>}
            {integrity.recoverySaved && <span> · Originalstand gesichert</span>}
          </div>
          {!integrity.quarantineStored && (
            <div className="mt-1 font-semibold text-coral-400">Quarantäne konnte wegen Gerätespeicher nicht vollständig geschrieben werden.</div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={exportIntegrityReport}
              className="rounded-xl border border-gold-500/30 bg-ink-900/60 px-2 py-2 font-semibold text-gold-300"
            >
              Prüfbericht sichern
            </button>
            <button
              type="button"
              onClick={() => {
                clearHistoryIntegrityReport()
                setIntegrity(null)
              }}
              className="rounded-xl border border-ink-700 bg-ink-900/60 px-2 py-2 font-semibold text-fog-400"
            >
              Hinweis ausblenden
            </button>
          </div>
        </div>
      )}

      {/* Sync-Status */}
      <div className="mb-4 flex items-center gap-2 text-[11px]">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            loading
              ? 'animate-pulse bg-gold-500'
              : pendingSync > 0
                ? 'bg-gold-500'
                : online
                  ? 'bg-mint-400'
                  : 'bg-fog-600'
          }`}
        />
        <span className="text-fog-500">
          {loading
            ? 'Synchronisiere mit der Cloud…'
            : pendingSync > 0
              ? `${pendingSync} ${pendingSync === 1 ? 'Änderung wartet' : 'Änderungen warten'} auf Cloud`
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

      {loading && games.length === 0 ? (
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
          {/* Event-Podest: nur wenn ein Anlass gefiltert ist */}
          {filter !== '' && stats.length > 0 && <EventPodium event={filter} top={stats.slice(0, 3)} />}

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

          {/* Aktuelle Form – wer läuft gerade heiß? (letzte 5 Spiele, neuestes links) */}
          {form.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">
                Aktuelle Form
              </h2>
              <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
                {form.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between gap-3 border-b border-ink-800/60 px-4 py-2.5 last:border-0"
                  >
                    <span className="truncate text-sm font-semibold text-fog-100">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {f.results.map((won, j) => (
                        <span
                          key={j}
                          title={won ? 'Sieg' : 'verloren'}
                          className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
                            won
                              ? 'bg-gold-500/20 text-gold-400'
                              : 'bg-ink-800 text-fog-600'
                          }`}
                        >
                          {won ? 'S' : '·'}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-fog-600">Letzte Spiele · neuestes links · S = Sieg</p>
            </section>
          )}

          {/* Duell – direkter Vergleich zweier Spieler */}
          {stats.length >= 2 && (
            <DuelSection names={stats.map((s) => s.name)} games={games} event={filter || undefined} />
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
                    <span className="w-4 shrink-0 text-center text-xs">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-fog-600">{i + 1}</span>}
                    </span>
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
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => setAnalysisGame(g)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setAnalysisGame(g)
                  }
                }}
                className="block w-full cursor-pointer rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4 text-left transition-colors hover:border-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60"
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditValue(g.event ?? '')
                        setEditingGame(g)
                      }}
                      className="p-1.5 text-fog-600 transition-colors hover:text-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60"
                      aria-label="Anlass bearbeiten"
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === g.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(g)
                      }}
                      className={`p-1.5 text-fog-600 transition-colors hover:text-coral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500/60 ${
                        busyId === g.id ? 'opacity-40' : ''
                      }`}
                      aria-label="Spiel löschen"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
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
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function EventPodium({ event, top }: { event: string; top: PlayerStats[] }) {
  // Reihenfolge auf dem Treppchen: 2. links, 1. Mitte (höchste Stufe), 3. rechts.
  const steps = [
    { p: top[1], rank: 2, medal: '🥈', h: 'h-16' },
    { p: top[0], rank: 1, medal: '🥇', h: 'h-24' },
    { p: top[2], rank: 3, medal: '🥉', h: 'h-11' },
  ].filter((s) => s.p)

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-fog-500">
        🏆 {event} – Podest
      </h2>
      <div className="flex items-end justify-center gap-2 rounded-2xl border border-ink-700/70 bg-ink-850/60 px-3 pt-3">
        {steps.map(({ p, rank, medal, h }) => (
          <div key={rank} className="flex w-1/3 max-w-[120px] flex-col items-center">
            <span className="text-2xl">{medal}</span>
            <span className="max-w-full truncate text-sm font-bold text-fog-100">{p!.name}</span>
            <span className="mb-1 text-[11px] font-semibold text-gold-400">
              {p!.wins} {p!.wins === 1 ? 'Sieg' : 'Siege'}
            </span>
            <div
              className={`grid w-full place-items-center rounded-t-xl ${h}`}
              style={{ background: `linear-gradient(to top, ${playerColor(p!.name)}22, ${playerColor(p!.name)}66)` }}
            >
              <span className="font-display text-2xl font-black text-fog-100">{rank}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function DuelSection({
  names,
  games,
  event,
}: {
  names: string[]
  games: GameRecord[]
  event?: string
}) {
  const [a, setA] = useState(names[0])
  const [b, setB] = useState(names[1])

  // Falls sich der Kader (z. B. durch Event-Filter) ändert, gültige Auswahl sichern.
  const aName = names.includes(a) ? a : names[0]
  const bName = names.includes(b) && b !== aName ? b : names.find((n) => n !== aName) ?? names[1]

  const h = useMemo(() => computeHeadToHead(aName, bName, games, event), [aName, bName, games, event])
  const nemA = useMemo(() => computeNemesis(aName, games, event), [aName, games, event])
  const nemB = useMemo(() => computeNemesis(bName, games, event), [bName, games, event])

  const aheadTotal = h.aAhead + h.bAhead
  const aPct = aheadTotal ? Math.round((h.aAhead / aheadTotal) * 100) : 50

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Duell</h2>
      <div className="rounded-2xl border border-ink-700/80 bg-ink-850/80 p-4">
        {/* Auswahl */}
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            value={aName}
            onChange={(e) => setA(e.target.value)}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-2.5 py-2 text-sm font-bold text-gold-400"
          >
            {names.map((n) => (
              <option key={n} value={n} disabled={n === bName}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-black text-fog-600">vs</span>
          <select
            value={bName}
            onChange={(e) => setB(e.target.value)}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-2.5 py-2 text-right text-sm font-bold text-mint-400"
          >
            {names.map((n) => (
              <option key={n} value={n} disabled={n === aName}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {h.games === 0 ? (
          <p className="py-3 text-center text-xs text-fog-500">Noch kein gemeinsames Spiel.</p>
        ) : (
          <>
            {/* Vorsprungs-Balken */}
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="text-gold-400">{h.aAhead}×</span>
              <span className="text-fog-600">öfter vorn</span>
              <span className="text-mint-400">{h.bAhead}×</span>
            </div>
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-ink-900">
              <div className="bg-gold-500/70" style={{ width: `${aPct}%` }} />
              <div className="bg-mint-400/70" style={{ width: `${100 - aPct}%` }} />
            </div>

            <DuelRow label={`Spiele zusammen`} a={h.games} b={h.games} same />
            <DuelRow label="Siege" a={h.aWins} b={h.bWins} />
            <DuelRow label="Bestwert" a={fmt(h.aBest)} b={fmt(h.bBest)} cmp={[h.aBest, h.bBest]} />
            <DuelRow label="Ø Punkte" a={fmt(h.aAvg)} b={fmt(h.bAvg)} cmp={[h.aAvg, h.bAvg]} />

            {(nemA || nemB) && (
              <div className="mt-3 border-t border-ink-800 pt-3 text-[11px] text-fog-500">
                {nemA && (
                  <p>
                    😨 <span className="font-semibold text-fog-300">{aName}</span>s Angstgegner:{' '}
                    <span className="font-semibold text-coral-400">{nemA.name}</span> ({nemA.ahead}/{nemA.of} vorn)
                  </p>
                )}
                {nemB && (
                  <p className="mt-0.5">
                    😨 <span className="font-semibold text-fog-300">{bName}</span>s Angstgegner:{' '}
                    <span className="font-semibold text-coral-400">{nemB.name}</span> ({nemB.ahead}/{nemB.of} vorn)
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function DuelRow({
  label,
  a,
  b,
  cmp,
  same,
}: {
  label: string
  a: string | number
  b: string | number
  cmp?: [number, number]
  same?: boolean
}) {
  const av = cmp ? cmp[0] : typeof a === 'number' ? a : 0
  const bv = cmp ? cmp[1] : typeof b === 'number' ? b : 0
  const aWin = !same && av > bv
  const bWin = !same && bv > av
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ink-800/50 py-2 text-sm last:border-0">
      <span className={`w-1/3 font-mono font-bold ${aWin ? 'text-gold-400' : 'text-fog-400'}`}>{a}</span>
      <span className="text-[10px] uppercase tracking-wide text-fog-600">{label}</span>
      <span className={`w-1/3 text-right font-mono font-bold ${bWin ? 'text-mint-400' : 'text-fog-400'}`}>{b}</span>
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
