// Was-wäre-wenn-Modal: geplanten Kauf simulieren – Wirkung auf Gewichte,
// Diversifikations-Score, Dividenden und Risiko-Flags vor dem Kauf sehen,
// optional direkt als echte Buchung übernehmen.

import { useMemo, useState } from 'react'
import { fmtEur, fmtNum, fmtPct, todayIso, uid } from '../lib/format'
import { simulateBuy } from '../lib/simulate'
import { useCockpit } from '../state'
import { Badge, Button, Field, Modal, NumberInput, inputClass } from './ui'

export function SimulatorModal({
  presetInstrumentId,
  onClose,
}: {
  presetInstrumentId?: string
  onClose: () => void
}) {
  const { state, summary, addTransaction, notify } = useCockpit()
  const instruments = [...state.instruments].sort((a, b) =>
    `${a.assetClass === 'etf' ? 0 : 1}${a.name}`.localeCompare(
      `${b.assetClass === 'etf' ? 0 : 1}${b.name}`,
    ),
  )
  const [instrumentId, setInstrumentId] = useState(
    presetInstrumentId ?? instruments[0]?.id ?? '',
  )
  const [amount, setAmount] = useState(state.settings.monthlyBudget || 500)

  const result = useMemo(
    () => simulateBuy(state.instruments, state.transactions, instrumentId, amount),
    [state.instruments, state.transactions, instrumentId, amount],
  )

  const deltaCell = (before: number, after: number, format: (v: number) => string, higherBad = false) => {
    const delta = after - before
    const tone =
      Math.abs(delta) < 0.05
        ? 'text-ink-mute'
        : (delta > 0) !== higherBad
          ? 'text-gain'
          : 'text-loss'
    return (
      <>
        <td className="tnum py-2 text-right text-ink-soft">{format(before)}</td>
        <td className="tnum py-2 text-right font-semibold text-ink">{format(after)}</td>
        <td className={`tnum py-2 text-right text-xs ${tone}`}>
          {delta > 0 ? '+' : ''}
          {format(delta).replace('+', '')}
        </td>
      </>
    )
  }

  const book = () => {
    if (!result) return
    addTransaction({
      id: uid(),
      instrumentId: result.instrument.id,
      type: 'buy',
      date: todayIso(),
      shares: Math.round(result.shares * 1000) / 1000,
      price: result.instrument.price,
      fees: 1,
      note: 'aus Simulation',
    })
    notify(`Kauf gebucht: ${fmtNum(result.shares, 3)} × ${result.instrument.name}.`)
    onClose()
  }

  return (
    <Modal title="Was-wäre-wenn: Kauf simulieren" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Field label="Wertpapier">
            <select
              className={inputClass}
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
            >
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.assetClass === 'etf' ? 'ETF · ' : ''}
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Kaufbetrag">
          <NumberInput value={amount} onChange={setAmount} step={100} min={0} suffix="€" />
        </Field>
        <div className="flex items-end gap-1.5 pb-0.5">
          {[500, 1000, 2500].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="rounded-lg bg-raised px-2.5 py-1.5 text-xs text-ink-soft hover:text-ink"
            >
              {fmtEur(v)}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <>
          <div className="mt-4 rounded-xl bg-inset px-3 py-2 text-sm text-ink-soft">
            {fmtEur(result.amount)} kaufen ≈{' '}
            <span className="tnum font-semibold text-ink">{fmtNum(result.shares, 3)} Stück</span>{' '}
            {result.instrument.name} zu {fmtEur(result.instrument.price)}
          </div>

          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-right text-[11px] uppercase tracking-wide text-ink-mute">
                <th className="py-2 text-left font-medium">Kennzahl</th>
                <th className="py-2 font-medium">Vorher</th>
                <th className="py-2 font-medium">Nachher</th>
                <th className="py-2 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-edge/40">
                <td className="py-2 text-xs text-ink-soft">Depotwert</td>
                {deltaCell(result.before.totalValue, result.after.totalValue, (v) => fmtEur(v))}
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-2 text-xs text-ink-soft">
                  Gewicht {result.instrument.ticker}
                </td>
                {deltaCell(result.before.positionWeightPct, result.after.positionWeightPct, (v) => fmtPct(v, 1), true)}
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-2 text-xs text-ink-soft">Sektor {result.instrument.sector}</td>
                {deltaCell(result.before.sectorWeightPct, result.after.sectorWeightPct, (v) => fmtPct(v, 1), true)}
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-2 text-xs text-ink-soft">Region {result.instrument.region}</td>
                {deltaCell(result.before.regionWeightPct, result.after.regionWeightPct, (v) => fmtPct(v, 1), true)}
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-2 text-xs text-ink-soft">Diversifikations-Score</td>
                {deltaCell(result.before.diversificationScore, result.after.diversificationScore, (v) => fmtNum(v, 0))}
              </tr>
              <tr>
                <td className="py-2 text-xs text-ink-soft">Jahresdividende</td>
                {deltaCell(result.before.annualDividend, result.after.annualDividend, (v) => fmtEur(v))}
              </tr>
            </tbody>
          </table>

          {(result.newFlags.length > 0 || result.resolvedFlags.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {result.newFlags.map((f, i) => (
                <div key={`n${i}`} className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                  ⚠️ Neu durch den Kauf: <span className="font-medium">{f.title}</span>
                </div>
              ))}
              {result.resolvedFlags.map((f, i) => (
                <div key={`r${i}`} className="flex items-center gap-2 rounded-xl border border-gain/40 bg-gain/10 px-3 py-2 text-xs text-gain">
                  ✓ Behoben durch den Kauf: <span className="font-medium">{f.title}</span>
                </div>
              ))}
            </div>
          )}
          {result.newFlags.length === 0 && result.resolvedFlags.length === 0 && summary.positions.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-mute">
              <Badge tone="gain">✓</Badge> Der Kauf erzeugt keine neuen Risiko-Flags.
            </div>
          )}
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Schließen
        </Button>
        <Button disabled={!result} onClick={book}>
          Als Kauf buchen (heute)
        </Button>
      </div>
    </Modal>
  )
}
