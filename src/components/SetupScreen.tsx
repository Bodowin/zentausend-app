import { useMemo, useState } from 'react'
import type { Player } from '../lib/types'
import { getEvents } from '../lib/storage'
import { IconChart, IconUserPlus, IconUsers, IconX, IconTag, IconSettings } from './Icons'
import { SettingsModal } from './SettingsModal'
import { playerColor } from '../lib/colors'

const PRESETS = ['Gabi', 'Mabi', 'Dana', 'Bodo']

interface Props {
  makePlayer: (name: string) => Player
  onStart: (players: Player[], event: string, testMode: boolean) => void
  onShowStats: () => void
}

export function SetupScreen({ makePlayer, onStart, onShowStats }: Props) {
  const [players, setPlayers] = useState<Player[]>([])
  const [guest, setGuest] = useState('')
  const [event, setEvent] = useState('')
  const [testMode, setTestMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const pastEvents = useMemo(() => getEvents(), [])

  const add = (name: string) => {
    const n = name.trim()
    if (!n || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return
    setPlayers((prev) => [...prev, makePlayer(n)])
    setGuest('')
  }
  const removeAt = (i: number) => setPlayers((prev) => prev.filter((_, j) => j !== i))

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)] safe-pb">
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
            onClick={() => setShowSettings(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-ink-700 bg-ink-800/70 text-fog-400 transition-colors hover:text-fog-100"
            aria-label="Einstellungen"
          >
            <IconSettings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <section className="mb-5 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-5 shadow-2xl shadow-black/40 animate-rise">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-fog-100">
          <IconUsers className="h-5 w-5 text-gold-500" /> Wer spielt mit?
        </h2>

        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {PRESETS.map((name) => {
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
            players.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-ink-700/70 bg-ink-900/60 px-3 py-2.5 animate-pop"
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
                <button
                  onClick={() => removeAt(i)}
                  className="p-1.5 text-fog-600 transition-colors hover:text-coral-400"
                  aria-label={`${p.name} entfernen`}
                >
                  <IconX />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-5 animate-rise">
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-fog-200">
          <IconTag className="h-4 w-4 text-gold-500" /> Anlass <span className="font-normal text-fog-600">(optional)</span>
        </label>
        <input
          type="text"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="z. B. Skiurlaub 2025"
          className="w-full rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600 transition-colors focus:border-gold-500/70 focus:outline-none"
        />
        {pastEvents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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
      </section>

      <button
        type="button"
        role="switch"
        aria-checked={testMode}
        onClick={() => setTestMode((v) => !v)}
        className={`mb-4 flex w-full items-center justify-between rounded-2xl border bg-ink-850/60 px-4 py-3 text-left transition-colors ${
          testMode ? 'border-gold-500/50' : 'border-ink-700/80'
        }`}
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-fog-200">Testspiel</span>
          <span className="text-[11px] text-fog-500">Zählt nicht für die Statistik</span>
        </span>
        <span
          className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${
            testMode ? 'bg-gold-500' : 'bg-ink-600'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              testMode ? 'translate-x-[26px]' : 'translate-x-1'
            }`}
          />
        </span>
      </button>

      <button
        onClick={() => onStart(players, event, testMode)}
        disabled={players.length < 2}
        className="mb-6 mt-auto w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-4 text-lg font-bold text-ink-950 shadow-lg shadow-mint-500/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-fog-600 disabled:shadow-none"
      >
        {players.length < 2
          ? 'Mind. 2 Spieler wählen'
          : `${testMode ? 'Testspiel' : 'Spiel'} starten · ${players.length} Spieler`}
      </button>
    </div>
  )
}
