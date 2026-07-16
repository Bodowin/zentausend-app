import { useMemo, useState } from 'react'
import type { DiceMode, Player } from '../lib/types'
import { getEvents } from '../lib/storage'
import { getRoster, addToRoster, removeFromRoster, renameInRoster } from '../lib/roster'
import { getPrefs, setPrefs } from '../lib/prefs'
import { hasCliqueCode } from '../lib/cliqueCode'
import { cloudEnabled } from '../lib/supabase'
import {
  IconChart,
  IconRefresh,
  IconUserPlus,
  IconUsers,
  IconX,
  IconTag,
  IconSettings,
  IconLock,
  IconPencil,
  IconCheck,
} from './Icons'
import { SettingsModal } from './SettingsModal'
import { playerColor } from '../lib/colors'
import type { ActiveGame } from '../lib/activeGame'
import type { PausedGameItem } from '../lib/pausedGames'
import { PausedGamesPanel } from './PausedGamesPanel'

const CODE_DISMISS_KEY = '10k_code_dismissed'

interface Props {
  makePlayer: (name: string) => Player
  onStart: (
    players: Player[],
    event: string,
    testMode: boolean,
    diceMode: DiceMode,
    goalScore: number,
    entryMin: number,
  ) => void
  onShowStats: () => void
  onShowHelp: () => void
  resumable: ActiveGame | null
  pausedGames: PausedGameItem[]
  archivedGames: PausedGameItem[]
  onResume: (g: ActiveGame) => void
  onPauseResume: () => boolean
  onDiscardResume: () => void
  onResumePaused: (sessionId: string) => void
  onDeletePaused: (sessionId: string) => void
  /** Vorbelegung (z. B. Revanche): Kader, Anlass, Würfel-Modus, Ziel, Einstieg. */
  initialPlayers?: Player[]
  initialEvent?: string
  initialDiceMode?: DiceMode
  initialGoalScore?: number
  initialEntryMin?: number
}

const GOAL_PRESETS = [5000, 10000, 15000]
const ENTRY_PRESETS = [0, 350, 500, 1000]

const formatResumeTime = (savedAt: string) => {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt'
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function SetupScreen({
  makePlayer,
  onStart,
  onShowStats,
  onShowHelp,
  resumable,
  pausedGames,
  archivedGames,
  onResume,
  onPauseResume,
  onDiscardResume,
  onResumePaused,
  onDeletePaused,
  initialPlayers,
  initialEvent,
  initialDiceMode,
  initialGoalScore,
  initialEntryMin,
}: Props) {
  const [players, setPlayers] = useState<Player[]>(() => initialPlayers ?? [])
  const [roster, setRoster] = useState<string[]>(() => getRoster())
  const [manage, setManage] = useState(false)
  const [newMember, setNewMember] = useState('')
  const [guest, setGuest] = useState('')
  // Ohne Vorbelegung (Revanche o. Ä.) den zuletzt genutzten Anlass vorschlagen –
  // spart bei einem mehrtägigen Urlaub das erneute Eintippen bei jedem Spiel.
  const [event, setEvent] = useState(initialEvent ?? getPrefs().lastEvent)
  const [testMode, setTestMode] = useState(false)
  const [diceMode, setDiceMode] = useState<DiceMode>(initialDiceMode ?? getPrefs().defaultDiceMode)
  const [goalScore, setGoalScore] = useState(initialGoalScore ?? 10000)
  const [entryMin, setEntryMin] = useState(initialEntryMin ?? 350)
  const [optsOpen, setOptsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [startConflictOpen, setStartConflictOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [codeDismissed, setCodeDismissed] = useState(() => {
    try {
      return !!localStorage.getItem(CODE_DISMISS_KEY)
    } catch {
      return false
    }
  })
  const pastEvents = useMemo(() => getEvents(), [])
  const needsCode = cloudEnabled && !hasCliqueCode() && !codeDismissed

  const add = (name: string) => {
    const n = name.trim()
    if (!n || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return
    setPlayers((prev) => [...prev, makePlayer(n)])
    setGuest('')
  }
  const removeAt = (i: number) => setPlayers((prev) => prev.filter((_, j) => j !== i))
  // Reihenfolge verschieben (oben = beginnt). Üblich: Sieger beginnt, Uhrzeigersinn bleibt.
  const move = (i: number, dir: -1 | 1) =>
    setPlayers((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const addMember = () => {
    const next = addToRoster(newMember)
    setRoster(next)
    setNewMember('')
  }
  const commitRename = (oldName: string, value: string) => {
    if (value.trim() && value.trim() !== oldName) setRoster(renameInRoster(oldName, value))
  }
  const dismissCode = () => {
    try {
      localStorage.setItem(CODE_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setCodeDismissed(true)
  }

  const startConfiguredGame = () => {
  setPrefs({ lastEvent: event.trim() })
  onStart(players, event, testMode, diceMode, goalScore, entryMin)
}

const requestStart = () => {
  if (resumable) {
    setStartConflictOpen(true)
    return
  }
  startConfiguredGame()
}

  return (
    <div data-testid="setup-screen" className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden px-3 pt-[max(env(safe-area-inset-top),0.65rem)] sm:px-4">
      <header className="mb-2.5 flex shrink-0 items-center justify-between gap-2 animate-rise">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-3xl font-black tracking-tighter text-gold-500 min-[390px]:text-4xl">10.000</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-fog-500 min-[350px]:inline">Die Clique</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowStats}
            className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-800/70 px-2.5 py-2 text-xs font-semibold text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
            aria-label="Statistik"
          >
            <IconChart className="h-4 w-4" />
            <span className="hidden min-[380px]:inline">Statistik</span>
            <span className="min-[380px]:hidden">Stats</span>
          </button>
          <button
            onClick={onShowHelp}
            className="grid h-9 w-9 place-items-center rounded-xl border border-ink-700 bg-ink-800/70 text-sm font-bold text-fog-400 transition-colors hover:text-fog-100"
            aria-label="Spielregeln"
          >
            ?
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-ink-700 bg-ink-800/70 text-fog-400 transition-colors hover:text-fog-100"
            aria-label="Einstellungen"
          >
            <IconSettings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {startConflictOpen && resumable && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Laufendes Spiel ersetzen?"
            className="w-full max-w-sm rounded-3xl border border-gold-500/40 bg-ink-900 p-5 shadow-2xl"
          >
            <h2 className="text-lg font-black text-fog-100">Laufendes Spiel pausieren?</h2>
            <p className="mt-2 text-sm leading-relaxed text-fog-400">
              Runde {resumable.round} mit {resumable.players.map((player) => player.name).join(', ')} ist noch gespeichert.
              Das neue Spiel überschreibt nichts: Dieser Stand bleibt 14 Tage in der Pausenliste und danach im Archiv.
            </p>
            <button
              type="button"
              onClick={() => {
                setStartConflictOpen(false)
                onResume(resumable)
              }}
              className="mt-5 w-full rounded-xl bg-gold-500 px-4 py-3 font-bold text-ink-950"
            >
              Altes Spiel fortsetzen
            </button>
            <button
              type="button"
              onClick={() => {
                if (!onPauseResume()) return
                setStartConflictOpen(false)
                startConfiguredGame()
              }}
              className="mt-2 w-full rounded-xl border border-mint-500/40 bg-mint-500/10 px-4 py-3 font-bold text-mint-300"
            >
              Spiel pausieren & neues starten
            </button>
            <button
              type="button"
              onClick={() => setStartConflictOpen(false)}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-fog-500"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {discardOpen && resumable && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Laufendes Spiel verwerfen?"
            className="w-full max-w-sm rounded-3xl border border-coral-500/40 bg-ink-900 p-5 shadow-2xl"
          >
            <h2 className="text-lg font-black text-fog-100">Laufendes Spiel verwerfen?</h2>
            <p className="mt-2 text-sm leading-relaxed text-fog-400">
              Der aktuelle Stand und alle drei lokalen Sicherheitskopien werden gelöscht.
            </p>
            <button
              type="button"
              onClick={() => {
                setDiscardOpen(false)
                onDiscardResume()
              }}
              className="mt-5 w-full rounded-xl bg-coral-500 px-4 py-3 font-bold text-white"
            >
              Endgültig verwerfen
            </button>
            <button
              type="button"
              onClick={() => setDiscardOpen(false)}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-fog-400"
            >
              Spiel behalten
            </button>
          </div>
        </div>
      )}

      <main data-testid="setup-scroll-area" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 scrollbar-hide">
      {/* Einmaliger Hinweis: Clique-Code eingeben, um die Cloud-Sync zu aktivieren. */}
      {needsCode && (
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-3 animate-rise">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-400">
            <IconLock className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold text-fog-100">Cloud-Sync aktivieren</span>
            <span className="text-xs text-fog-400">Clique-Code einmal eingeben – dann auf allen Geräten gleich.</span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="shrink-0 rounded-xl bg-gold-500 px-3 py-2 text-xs font-black uppercase tracking-wide text-ink-950"
          >
            Eingeben
          </button>
          <button onClick={dismissCode} className="shrink-0 p-1 text-fog-600 hover:text-fog-300" aria-label="Später">
            <IconX />
          </button>
        </div>
      )}

      {resumable && (
        <div className="mb-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-3 animate-rise">
          {resumable.recoveredFromBackup && (
            <div className="mb-3 rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-xs font-bold text-mint-300">
              Sicherheitskopie wiederhergestellt
            </div>
          )}
          <div className="flex items-start gap-3">
            <button onClick={() => onResume(resumable)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-400">
                <IconRefresh className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold text-fog-100">Spiel fortsetzen</span>
                <span className="mt-0.5 text-xs text-fog-400">
                  Runde {resumable.round} · {resumable.players[resumable.idx]?.name ?? 'Unbekannt'} ist dran
                  {resumable.testMode ? ' · TEST' : ''}
                </span>
                <span className="mt-1 truncate text-[11px] text-fog-500">
                  {resumable.players.map((player) => player.name + ' ' + player.score.toLocaleString('de-DE')).join(' · ')}
                </span>
                <span className="mt-1 text-[10px] text-fog-600">Gespeichert: {formatResumeTime(resumable.savedAt)}</span>
              </span>
            </button>
            <button
              onClick={() => setDiscardOpen(true)}
              className="shrink-0 p-1.5 text-fog-600 transition-colors hover:text-coral-400"
              aria-label="Laufendes Spiel verwerfen"
            >
              <IconX />
            </button>
          </div>
        </div>
      )}

      <PausedGamesPanel
        paused={pausedGames}
        archived={archivedGames}
        onResume={onResumePaused}
        onDelete={onDeletePaused}
      />

      <section className="mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-fog-100">
            <IconUsers className="h-5 w-5 text-gold-500" /> Wer spielt mit?
          </h2>
          <button
            onClick={() => setManage((m) => !m)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              manage
                ? 'border-mint-400/60 bg-mint-500/15 text-mint-300'
                : 'border-ink-700 bg-ink-800 text-fog-400 hover:text-fog-200'
            }`}
          >
            {manage ? <IconCheck className="h-3.5 w-3.5" /> : <IconPencil className="h-3.5 w-3.5" />}
            {manage ? 'Fertig' : 'Kader'}
          </button>
        </div>

        {manage ? (
          /* Kader-Verwaltung: Stamm-Spieler umbenennen, entfernen, hinzufügen. */
          <div className="mb-2 space-y-2">
            {roster.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: playerColor(name) }}
                />
                <input
                  defaultValue={name}
                  aria-label={`${name} umbenennen`}
                  onBlur={(e) => commitRename(name, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-fog-100 focus:border-gold-500/70 focus:outline-none"
                />
                <button
                  onClick={() => setRoster(removeFromRoster(name))}
                  className="shrink-0 p-1.5 text-fog-600 transition-colors hover:text-coral-400"
                  aria-label={`${name} aus dem Kader entfernen`}
                >
                  <IconX />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMember()}
                placeholder="Stamm-Spieler hinzufügen…"
                className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm text-fog-100 placeholder:text-fog-600 focus:border-gold-500/70 focus:outline-none"
              />
              <button
                onClick={addMember}
                className="grid w-11 place-items-center rounded-lg border border-ink-700 bg-ink-800 text-fog-300 transition-colors hover:text-fog-100"
                aria-label="Stamm-Spieler hinzufügen"
              >
                <IconUserPlus />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {roster.map((name) => {
                const i = players.findIndex((p) => p.name === name)
                const active = i >= 0
  return (
                  <button
                    key={name}
                    onClick={() => (active ? removeAt(i) : add(name))}
                    className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                      active
                        ? 'border-mint-400/60 bg-mint-500/15 text-mint-300'
                        : 'border-ink-700 bg-ink-800 text-fog-400 hover:border-ink-600 hover:text-fog-200'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add(guest)}
                placeholder="Gast hinzufügen…"
                className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-950/60 px-3 py-2.5 text-sm text-fog-100 placeholder:text-fog-600 transition-colors focus:border-gold-500/70 focus:outline-none"
              />
              <button
                onClick={() => add(guest)}
                className="grid w-11 place-items-center rounded-xl border border-ink-700 bg-ink-800 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
                aria-label="Gast hinzufügen"
              >
                <IconUserPlus />
              </button>
            </div>

            <div className="space-y-1.5">
              {players.length === 0 ? (
                <p className="py-2 text-center text-sm italic text-fog-600">Noch niemand ausgewählt…</p>
              ) : (
                <>
                  {players.length > 1 && (
                    <p className="px-1 pb-1 text-[11px] text-fog-500">
                      Reihenfolge: <span className="text-fog-300">Nr. 1 beginnt</span> · mit ↑↓ verschieben
                    </p>
                  )}
                  {players.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-ink-700/70 bg-ink-900/60 px-3 py-1.5 animate-pop"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-ink-950"
                          style={{ backgroundColor: playerColor(p.name) }}
                        >
                          {i + 1}
                        </span>
                        <span className="font-semibold text-fog-100">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="grid h-7 w-7 place-items-center rounded-lg text-fog-400 transition-colors hover:text-fog-100 disabled:opacity-25"
                          aria-label={`${p.name} nach oben`}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={i === players.length - 1}
                          className="grid h-7 w-7 place-items-center rounded-lg text-fog-400 transition-colors hover:text-fog-100 disabled:opacity-25"
                          aria-label={`${p.name} nach unten`}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeAt(i)}
                          className="ml-1 p-1.5 text-fog-600 transition-colors hover:text-coral-400"
                          aria-label={`${p.name} entfernen`}
                        >
                          <IconX />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* Optionen (Anlass + Testspiel) eingeklappt → hält den Startbildschirm aufgeräumt. */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setOptsOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl border border-ink-700/80 bg-ink-850/60 px-4 py-2.5 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fog-200">
            <IconTag className="h-4 w-4 shrink-0 text-gold-500" /> Optionen
            <span className="truncate text-xs font-normal text-fog-500">
              {[
                event && `„${event}"`,
                goalScore !== 10000 && `Ziel ${goalScore.toLocaleString('de-DE')}`,
                entryMin !== 350 && (entryMin === 0 ? 'kein Einstieg' : `Einstieg ${entryMin}`),
                testMode && 'Testspiel',
              ]
                .filter(Boolean)
                .join(' · ') || 'Anlass · Ziel · Testspiel'}
            </span>
          </span>
          <span className={`shrink-0 text-fog-500 transition-transform ${optsOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {optsOpen && (
          <div className="mt-3 space-y-3 animate-rise">
            <div>
              <input
                type="text"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                placeholder="Anlass, z. B. Skiurlaub 2025"
                className="w-full rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600 transition-colors focus:border-gold-500/70 focus:outline-none"
              />
              {pastEvents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {pastEvents.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEvent(e)}
                      className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs text-fog-400 transition-colors hover:border-gold-500/50 hover:text-gold-400"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ziel-Punktzahl */}
            <div>
              <div className="mb-1.5 text-xs font-semibold text-fog-400">Ziel-Punktzahl</div>
              <div className="flex gap-2">
                {GOAL_PRESETS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoalScore(g)}
                    className={`flex-1 rounded-xl border px-2 py-2 text-sm font-bold transition-colors ${
                      goalScore === g
                        ? 'border-gold-500/60 bg-gold-500/10 text-gold-400'
                        : 'border-ink-700 bg-ink-800 text-fog-400 hover:border-ink-600'
                    }`}
                  >
                    {g.toLocaleString('de-DE')}
                  </button>
                ))}
              </div>
            </div>

            {/* Einstieg (Mindestpunkte fürs erste Sichern) */}
            <div>
              <div className="mb-1.5 text-xs font-semibold text-fog-400">Einstieg</div>
              <div className="flex gap-2">
                {ENTRY_PRESETS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEntryMin(e)}
                    className={`flex-1 rounded-xl border px-2 py-2 text-sm font-bold transition-colors ${
                      entryMin === e
                        ? 'border-gold-500/60 bg-gold-500/10 text-gold-400'
                        : 'border-ink-700 bg-ink-800 text-fog-400 hover:border-ink-600'
                    }`}
                  >
                    {e === 0 ? 'Aus' : e}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={testMode}
              onClick={() => setTestMode((v) => !v)}
              className={`flex w-full items-center justify-between rounded-2xl border bg-ink-850/60 px-4 py-3 text-left transition-colors ${
                testMode ? 'border-gold-500/50' : 'border-ink-700/80'
              }`}
            >
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-fog-200">Testspiel</span>
                <span className="text-[11px] text-fog-500">Zählt nicht für die Statistik</span>
              </span>
              <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${testMode ? 'bg-gold-500' : 'bg-ink-600'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${testMode ? 'left-[26px]' : 'left-1'}`} />
              </span>
            </button>
          </div>
        )}
      </div>

      </main>

      {/* Würfel-Modus + Start bleiben außerhalb des Inhaltsbereichs immer sichtbar. */}
      <div data-testid="setup-actions" className="z-20 -mx-3 shrink-0 bg-gradient-to-t from-ink-900 via-ink-900 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] pt-2 sm:-mx-4 sm:px-4">
        <div className="mb-2 grid grid-cols-2 gap-2">
          {(
            [
              { v: 'real', label: '🎯 Echte Würfel' },
              { v: 'virtual', label: '🎲 Virtuelle' },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => {
                setDiceMode(m.v)
                setPrefs({ defaultDiceMode: m.v }) // Wahl merken
              }}
              className={`rounded-xl border-2 py-1.5 text-sm font-bold transition-all ${
                diceMode === m.v
                  ? 'border-gold-500/60 bg-gold-500/10 text-gold-400'
                  : 'border-ink-700 bg-ink-800 text-fog-400 hover:border-ink-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={requestStart}
          disabled={players.length < 2}
          className="w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3 text-base min-[390px]:py-3.5 min-[390px]:text-lg font-bold text-ink-950 shadow-lg shadow-mint-500/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-fog-600 disabled:shadow-none"
        >
          {players.length < 2
            ? 'Mind. 2 Spieler wählen'
            : `${testMode ? 'Testspiel' : 'Spiel'} starten · ${players.length} Spieler`}
        </button>
      </div>
    </div>
  )
}
