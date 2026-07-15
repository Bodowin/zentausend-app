import { useMemo, useState } from 'react'
import type { Turn } from '../lib/types'
import { playerColor } from '../lib/colors'

interface CorrectionResult {
  ok: boolean
  message: string
}

interface Props {
  turns: Turn[]
  onCorrectTurn: (index: number, points: number, bust: boolean) => CorrectionResult
  onClose: () => void
}

const fmt = (value: number) => value.toLocaleString('de-DE')

export function TurnLogDialog({ turns, onCorrectTurn, onClose }: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [points, setPoints] = useState('')
  const [bust, setBust] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const rows = useMemo(() => turns.map((turn, index) => ({ turn, index })).reverse(), [turns])
  const editedTurn = editing === null ? null : turns[editing]

  const beginEdit = (index: number) => {
    const turn = turns[index]
    setEditing(index)
    setBust(turn.bust)
    setPoints(turn.bust ? '0' : String(turn.points))
    setError('')
    setNotice('')
  }

  const save = () => {
    if (editing === null) return
    const parsed = bust ? 0 : Number(points)
    const result = onCorrectTurn(editing, parsed, bust)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEditing(null)
    setError('')
    setNotice(result.message)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 py-[max(env(safe-area-inset-top),1rem)]"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Rundenprotokoll"
        className="flex max-h-[min(88dvh,760px)] w-full max-w-md min-w-0 flex-col overflow-hidden rounded-3xl border border-ink-700 bg-ink-900 shadow-2xl shadow-black/70"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-black tracking-tight text-fog-100">Rundenprotokoll</h2>
            <p className="mt-1 text-xs leading-relaxed text-fog-500">
              Frühere Züge korrigieren – alle späteren Spielstände werden automatisch neu berechnet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-ink-700 px-3 py-2 text-sm font-bold text-fog-400"
            aria-label="Rundenprotokoll schließen"
          >
            ✕
          </button>
        </header>

        {notice && (
          <div className="mx-4 mt-3 rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-sm font-bold text-mint-300">
            {notice}
          </div>
        )}

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-10 text-center text-sm text-fog-500">
              Noch keine abgeschlossenen Züge.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(({ turn, index }) => (
                <article key={`${index}-${turn.playerId ?? turn.player}`} className="rounded-2xl border border-ink-800 bg-ink-950/45 p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black text-ink-950"
                      style={{ backgroundColor: playerColor(turn.player) }}
                    >
                      {turn.round}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-fog-100">{turn.player}</div>
                      <div className={`mt-0.5 font-mono text-sm font-black ${turn.bust ? 'text-coral-400' : 'text-mint-400'}`}>
                        {turn.bust ? 'Niete' : `+${fmt(turn.points)} Punkte`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => beginEdit(index)}
                      className="shrink-0 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-bold text-fog-300"
                      aria-label={`${turn.player} Zug korrigieren`}
                    >
                      Ändern
                    </button>
                  </div>

                  {editing === index && editedTurn && (
                    <div className="mt-3 border-t border-ink-800 pt-3 animate-rise">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBust(false)
                            if (points === '0') setPoints(String(Math.max(50, editedTurn.points || 50)))
                            setError('')
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${
                            !bust
                              ? 'border-mint-500/60 bg-mint-500/10 text-mint-300'
                              : 'border-ink-700 bg-ink-800 text-fog-500'
                          }`}
                        >
                          Punkte
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBust(true)
                            setError('')
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${
                            bust
                              ? 'border-coral-500/60 bg-coral-500/10 text-coral-300'
                              : 'border-ink-700 bg-ink-800 text-fog-500'
                          }`}
                        >
                          Niete
                        </button>
                      </div>

                      {!bust && (
                        <label className="mt-3 block text-xs font-bold text-fog-400">
                          Neue Punkte
                          <input
                            type="number"
                            inputMode="numeric"
                            min={50}
                            max={1_000_000}
                            step={50}
                            value={points}
                            onChange={(event) => {
                              setPoints(event.target.value)
                              setError('')
                            }}
                            aria-label={`Punkte für ${editedTurn.player}`}
                            className="mt-1.5 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 font-mono text-lg font-black text-fog-100 outline-none focus:border-gold-500/70"
                          />
                        </label>
                      )}

                      <p className="mt-3 text-[11px] leading-relaxed text-fog-500">
                        Der aktuelle, noch nicht abgeschlossene Wurf wird verworfen. Vorher wird automatisch eine lokale Sicherheitskopie angelegt.
                      </p>
                      {error && <p className="mt-2 rounded-lg bg-coral-500/10 px-3 py-2 text-xs font-bold text-coral-300">{error}</p>}

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(null)
                            setError('')
                          }}
                          className="flex-1 rounded-xl border border-ink-700 px-3 py-2.5 text-sm font-bold text-fog-400"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={save}
                          className="flex-[1.4] rounded-xl bg-gold-500 px-3 py-2.5 text-sm font-black text-ink-950"
                        >
                          Korrektur speichern
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-ink-800 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 font-bold text-fog-200"
          >
            Schließen
          </button>
        </footer>
      </section>
    </div>
  )
}
