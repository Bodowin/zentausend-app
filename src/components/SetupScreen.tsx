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
  onResume: (g: ActiveGame) => void
  onDiscardResume: () => void
  /** Vorbelegung (z. B. Revanche): Kader, Anlass, Würfel-Modus, Ziel, Einstieg. */
  initialPlayers?: Player[]
  initialEvent?: string
  initialDiceMode?: DiceMode
  initialGoalScore?: number
  initialEntryMin?: number
}

const GOAL_PRESETS = [5000, 10000, 15000]
const ENTRY_PRESETS = [0, 350, 500, 1000]

export function SetupScreen({
  makePlayer,
  onStart,
  onShowStats,
  onShowHelp,
  resumable,
  onResume,
  onDiscardResume,
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
  const [event, setEvent] = useState(initialEvent ?? '')
  const [testMode, setTestMode] = useState(false)
  const [diceMode, setDiceMode] = useState<DiceMode>(initialDiceMode ?? getPrefs().defaultDiceMode)
  const [goalScore, setGoalScore] = useState(initialGoalScore ?? 10000)
  const [entryMin, setEntryMin] = useState(initialEntryMin ?? 350)
  const [optsOpen, setOptsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
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

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="mb-7 mt-2 flex items-center justify-between animate-rise">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-4xl font-black tracking-tighter text-gold-500">10.000</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-fog-500">Die Clique</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShowStats}
            className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
          >
            <IconChart className="h-4 w-4" /> Statistik
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

      {/* Einmaliger Hinweis: Clique-Code eingeben, um die Cloud-Sync zu aktivieren. */}
      {needsCode && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4 animate-rise">
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
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4 animate-rise">
          <button onClick={() => onResume(resumable)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-400">
              <IconRefresh className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-bold text-fog-100">Spiel fortsetzen</span>
              <span className="truncate text-xs text-fog-400">
                Runde {resumable.round} · {resumable.players.map((p) => p.name).join(', ')}
                {resumable.testMode ? ' · TEST' : ''}
              </span>
            </span>
          </button>
          <button
            onClick={() => {
              if (window.confirm('Laufendes Spiel verwerfen? Der Spielstand geht verloren.')) onDiscardResume()
            }}
            className="shrink-0 p-1.5 text-fog-600 transition-colors hover:text-coral-400"
            aria-label="Laufendes Spiel verwerfen"
          >
            <IconX />
          </button>
        </div>
      )}

      <section className="mb-5 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-5 shadow-2xl shadow-black/40 animate-rise">
        <div className="mb-4 flex items-center justify-between">
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
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {roster.map((name) => {
                const i = players.findIndex((p) => p.name === name)
                const active = i >= 0
                return (
                  <button
                    key={name}
                    onClick={() => (active ? removeAt(i) : add(name))}
                    className={`rounded-2xl border-2 px-3 py-3.5 text-sm font-bold transition-all ${
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

            <div className="mb-5 flex gap-2">
              <input
                type="text"
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add(guest)}
                placeholder="Gast hinzufügen…"
                className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600 transition-colors focus:border-gold-500/70 focus:outline-none"
              />
              <button
                onClick={() => add(guest)}
                className="grid w-12 place-items-center rounded-xl border border-ink-700 bg-ink-800 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
                aria-label="Gast hinzufügen"
              >
                <IconUserPlus />
              </button>
            </div>

            <div className="space-y-2">
              {players.length === 0 ? (
                <p className="py-3 text-center text-sm italic text-fog-600">Noch niemand ausgewählt…</p>
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
                      className="flex items-center justify-between rounded-xl border border-ink-700/70 bg-ink-900/60 px-3 py-2 animate-pop"
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
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setOptsOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl border border-ink-700/80 bg-ink-850/60 px-4 py-3 text-left"
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

      {/* Würfel-Modus + Start kleben unten → beides immer sichtbar, kein Scrollen nötig. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-auto bg-gradient-to-t from-ink-900 via-ink-900 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-5">
        <div className="mb-2.5 grid grid-cols-2 gap-2">
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
              className={`rounded-xl border-2 py-2 text-sm font-bold transition-all ${
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
          onClick={() => onStart(players, event, testMode, diceMode, goalScore, entryMin)}
          disabled={players.length < 2}
          className="w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-4 text-lg font-bold text-ink-950 shadow-lg shadow-mint-500/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-fog-600 disabled:shadow-none"
        >
          {players.length < 2
            ? 'Mind. 2 Spieler wählen'
            : `${testMode ? 'Testspiel' : 'Spiel'} starten · ${players.length} Spieler`}
        </button>
      </div>
    </div>
  )
}
