import { useMemo, useState } from 'react'
import type { GameRecord } from '../lib/types'
import { IconCheck } from './Icons'

interface Props {
  games: GameRecord[]
  events: string[]
  busy: boolean
  onClose: () => void
  onApply: (games: GameRecord[], event: string) => void
}

const pad = (value: number) => String(value).padStart(2, '0')

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 13)
  return { from: localDateKey(from), to: localDateKey(to) }
}

function inRange(game: GameRecord, from: string, to: string): boolean {
  const date = localDateKey(game.date)
  return Boolean(date && (!from || date >= from) && (!to || date <= to))
}

export function BulkEventAssignmentDialog({ games, events, busy, onClose, onApply }: Props) {
  const initialRange = useMemo(defaultRange, [])
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [event, setEvent] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(games.filter((game) => !game.event.trim() && inRange(game, initialRange.from, initialRange.to)).map((game) => game.id)),
  )

  const rangedGames = useMemo(
    () => games.filter((game) => inRange(game, from, to)).slice().sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [games, from, to],
  )
  const selectedGames = useMemo(() => games.filter((game) => selectedIds.has(game.id)), [games, selectedIds])

  const toggle = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectRange = (onlyUnassigned: boolean) => {
    setSelectedIds(
      new Set(rangedGames.filter((game) => !onlyUnassigned || !game.event.trim()).map((game) => game.id)),
    )
  }

  const changeRange = (setter: (value: string) => void, value: string) => {
    setter(value)
    setSelectedIds(new Set())
  }

  const submit = () => {
    const trimmed = event.trim()
    if (!trimmed || selectedGames.length === 0 || busy) return
    onApply(selectedGames, trimmed)
  }

  return (
    <div className="glass fixed inset-0 z-50 overflow-y-auto px-3 py-[max(env(safe-area-inset-top),0.75rem)] animate-pop" role="dialog" aria-modal="true" aria-label="Spiele gesammelt zuordnen">
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center py-2">
        <section className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[2rem] border border-gold-500/25 bg-ink-900 shadow-2xl">
          <header className="border-b border-ink-800 px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gold-400">Urlaubs-Workflow</p>
                <h2 className="mt-1 text-xl font-black text-fog-100">Spiele gesammelt zuordnen</h2>
                <p className="mt-1 text-xs leading-relaxed text-fog-500">
                  Ohne Anlass gespeicherte Spiele der letzten 14 Tage sind vorausgewählt. Zeitraum und Auswahl können frei geändert werden.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="shrink-0 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-bold text-fog-300 disabled:opacity-40"
              >
                Schließen
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-fog-600">
                Von
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => changeRange(setFrom, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950/70 px-3 py-2.5 text-sm font-semibold text-fog-200"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-fog-600">
                Bis
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => changeRange(setTo, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950/70 px-3 py-2.5 text-sm font-semibold text-fog-200"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => selectRange(true)}
                className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-2 py-2 text-[11px] font-bold text-gold-300"
              >
                Ohne Anlass
              </button>
              <button
                type="button"
                onClick={() => selectRange(false)}
                className="rounded-xl border border-ink-700 bg-ink-800 px-2 py-2 text-[11px] font-bold text-fog-300"
              >
                Alle im Zeitraum
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0}
                className="rounded-xl border border-ink-700 bg-ink-800 px-2 py-2 text-[11px] font-bold text-fog-500 disabled:opacity-40"
              >
                Leeren
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-fog-600">
              <span>{rangedGames.length} im Zeitraum</span>
              <span className={selectedIds.size > 0 ? 'text-gold-400' : ''}>{selectedIds.size} ausgewählt</span>
            </div>

            {rangedGames.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-fog-500">
                In diesem Zeitraum wurden keine Spiele gefunden.
              </div>
            ) : (
              <div className="space-y-2">
                {rangedGames.map((game) => {
                  const selected = selectedIds.has(game.id)
                  return (
                    <button
                      type="button"
                      key={game.id}
                      aria-pressed={selected}
                      onClick={() => toggle(game.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                        selected ? 'border-gold-500/45 bg-gold-500/10' : 'border-ink-700/70 bg-ink-850/70'
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                          selected ? 'border-gold-400 bg-gold-500 text-ink-950' : 'border-ink-600 bg-ink-900 text-transparent'
                        }`}
                      >
                        <IconCheck className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-fog-200">
                          {new Date(game.date).toLocaleDateString('de-DE')} · {game.winner} gewinnt
                        </span>
                        <span className={`mt-0.5 block truncate text-[10px] ${game.event ? 'text-gold-400' : 'text-fog-600'}`}>
                          {game.event || 'Noch ohne Anlass'} · {game.players.length} Spieler
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-ink-800 bg-ink-950/35 p-4">
            <label className="text-[10px] font-bold uppercase tracking-wide text-fog-600">
              Gemeinsamer Anlass
              <input
                type="text"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="z. B. Sommerurlaub 2026"
                className="mt-1 w-full rounded-xl border border-ink-700 bg-ink-950/80 px-4 py-3 text-fog-100 placeholder:text-fog-600 focus:border-gold-500/70 focus:outline-none"
              />
            </label>

            {events.length > 0 && (
              <div className="scrollbar-hide mt-2 flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
                {events.map((existing) => (
                  <button
                    type="button"
                    key={existing}
                    onClick={() => setEvent(existing)}
                    className="shrink-0 rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs text-fog-400 transition-colors hover:border-gold-500/50 hover:text-gold-400"
                  >
                    {existing}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={busy || selectedGames.length === 0 || event.trim().length === 0}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 px-4 py-3 font-black text-ink-950 shadow-lg transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-fog-500 disabled:shadow-none"
            >
              <IconCheck className="h-5 w-5" />
              {busy ? 'Wird gespeichert…' : `${selectedGames.length} ${selectedGames.length === 1 ? 'Spiel' : 'Spiele'} zuordnen`}
            </button>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-fog-600">
              Die Zuordnung wird sofort auf diesem Gerät gespeichert und bei Bedarf später mit der Clique synchronisiert.
            </p>
          </footer>
        </section>
      </div>
    </div>
  )
}
