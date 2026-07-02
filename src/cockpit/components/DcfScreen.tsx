// Interaktiver DCF-Rechner: Annahmen per Slider, Fair Value nach zwei
// Terminal-Value-Methoden, Sensitivitätsmatrix (WACC × ewiges Wachstum)
// und Jahres-Tabelle der diskontierten Cashflows.

import { useEffect, useMemo, useState } from 'react'
import { defaultInputsFor, runDcf, sensitivity, type DcfInputs } from '../lib/dcf'
import { fmtEurExact, fmtNum, fmtPct } from '../lib/format'
import { useCockpit } from '../state'
import { Badge, Button, Card, Field, NumberInput, selectCompactClass, SliderField } from './ui'

export function DcfScreen({
  instrumentId,
  onSelect,
}: {
  instrumentId: string | null
  onSelect: (id: string) => void
}) {
  const { state } = useCockpit()
  const stocks = state.instruments.filter((i) => i.assetClass === 'stock')
  const instrument = stocks.find((i) => i.id === instrumentId) ?? stocks[0] ?? null

  const [inputs, setInputs] = useState<DcfInputs>(() => defaultInputsFor(instrument))
  // Bei Titelwechsel Annahmen neu aus den Kennzahlen ableiten
  useEffect(() => {
    setInputs(defaultInputsFor(instrument))
  }, [instrument?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => runDcf(inputs), [inputs])
  const matrix = useMemo(() => sensitivity(inputs), [inputs])

  const set = (patch: Partial<DcfInputs>) => setInputs((s) => ({ ...s, ...patch }))

  const verdictTone =
    result.verdict === 'unterbewertet' ? 'gain' : result.verdict === 'überbewertet' ? 'loss' : 'warn'

  return (
    <div className="space-y-4">
      <Card
        title="DCF-Bewertung"
        subtitle="Discounted Cashflow: Was ist die Aktie bei deinen Annahmen wert?"
        action={
          <select
            className={selectCompactClass}
            value={instrument?.id ?? ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.ticker})
              </option>
            ))}
          </select>
        }
      >
        {!instrument ? (
          <p className="py-8 text-center text-sm text-ink-mute">Keine Aktien in der Bibliothek.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Annahmen */}
            <div className="space-y-4 lg:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Umsatz zuletzt" hint="Mrd. EUR">
                  <NumberInput value={inputs.revenue0} onChange={(v) => set({ revenue0: v })} step={1} />
                </Field>
                <Field label="Aktienanzahl" hint="Mrd. Stück">
                  <NumberInput value={inputs.shares} onChange={(v) => set({ shares: v })} step={0.01} />
                </Field>
                <Field label="Nettoschulden" hint="Mrd. EUR, negativ = Netto-Cash">
                  <NumberInput value={inputs.netDebt} onChange={(v) => set({ netDebt: v })} step={1} />
                </Field>
                <Field label="Aktueller Kurs">
                  <NumberInput value={inputs.price} onChange={(v) => set({ price: v })} step={0.01} suffix="€" />
                </Field>
              </div>
              <SliderField label="Wachstum Jahr 1" value={inputs.growthStart} onChange={(v) => set({ growthStart: v })} min={-5} max={40} step={0.5} format={(v) => fmtPct(v, 1)} />
              <SliderField label={`Wachstum Jahr ${inputs.years} (läuft linear aus)`} value={inputs.growthEnd} onChange={(v) => set({ growthEnd: v })} min={-5} max={25} step={0.5} format={(v) => fmtPct(v, 1)} />
              <SliderField label="FCF-Marge" value={inputs.fcfMargin} onChange={(v) => set({ fcfMargin: v })} min={0} max={50} step={0.5} format={(v) => fmtPct(v, 1)} />
              <SliderField label="Projektionsjahre" value={inputs.years} onChange={(v) => set({ years: Math.round(v) })} min={5} max={10} step={1} format={(v) => `${v} Jahre`} />
              <SliderField label="Diskontsatz (WACC)" value={inputs.wacc} onChange={(v) => set({ wacc: v })} min={5} max={15} step={0.25} format={(v) => fmtPct(v, 2)} />
              <SliderField label="Ewiges Wachstum" value={inputs.terminalGrowth} onChange={(v) => set({ terminalGrowth: v })} min={0} max={4} step={0.25} format={(v) => fmtPct(v, 2)} />
              <SliderField label="Exit-Multiple (EV/FCF)" value={inputs.exitMultiple} onChange={(v) => set({ exitMultiple: v })} min={8} max={40} step={1} format={(v) => `${fmtNum(v, 0)}×`} />
              <Button
                small
                variant="ghost"
                onClick={() => setInputs(defaultInputsFor(instrument))}
              >
                ↺ Auf Kennzahlen zurücksetzen
              </Button>
            </div>

            {/* Ergebnis */}
            <div className="space-y-4 lg:col-span-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="card bg-inset p-4">
                  <div className="text-xs text-ink-mute">Fairer Wert (Ø beider Methoden)</div>
                  <div className="mt-1 text-3xl font-semibold text-ink">
                    {fmtEurExact(result.fairValue)}
                  </div>
                  <div className="mt-1 text-xs text-ink-soft">
                    Gordon: {Number.isFinite(result.fairValuePerpetuity) ? fmtEurExact(result.fairValuePerpetuity) : 'n. def.'} · Exit-Multiple: {fmtEurExact(result.fairValueExit)}
                  </div>
                </div>
                <div className="card bg-inset p-4">
                  <div className="text-xs text-ink-mute">vs. Kurs {fmtEurExact(inputs.price)}</div>
                  <div
                    className={`mt-1 text-3xl font-semibold ${result.upsidePct >= 0 ? 'text-gain' : 'text-loss'}`}
                  >
                    {fmtPct(result.upsidePct, 1, true)}
                  </div>
                  <div className="mt-1.5">
                    <Badge tone={verdictTone}>
                      {result.verdict === 'unterbewertet' ? '✓ ' : result.verdict === 'überbewertet' ? '⚠ ' : '≈ '}
                      {result.verdict}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
                  Sensitivität: Fair Value je WACC × ewiges Wachstum
                </h3>
                <div className="overflow-x-auto">
                  <table className="tnum w-full min-w-[420px] text-center text-xs">
                    <thead>
                      <tr className="text-ink-mute">
                        <th className="p-1.5 text-left font-medium">WACC ↓ / g →</th>
                        {matrix[0].map((cell) => (
                          <th key={cell.terminalGrowth} className="p-1.5 font-medium">
                            {fmtPct(cell.terminalGrowth, 1)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((rowCells) => (
                        <tr key={rowCells[0].wacc}>
                          <td className="p-1.5 text-left text-ink-mute">{fmtPct(rowCells[0].wacc, 2)}</td>
                          {rowCells.map((cell) => {
                            const up = cell.upsidePct
                            const invalid = !Number.isFinite(up)
                            // Status-Färbung (Bedeutung gut/schlecht), Wert steht sichtbar in der Zelle
                            const bg = invalid
                              ? 'transparent'
                              : up > 15
                                ? 'color-mix(in oklab, var(--color-gain) 22%, transparent)'
                                : up < -15
                                  ? 'color-mix(in oklab, var(--color-loss) 22%, transparent)'
                                  : 'color-mix(in oklab, var(--color-ink-mute) 14%, transparent)'
                            return (
                              <td key={cell.terminalGrowth} className="p-0.5">
                                <div className="rounded-md px-1.5 py-1.5" style={{ background: bg }}>
                                  {invalid ? (
                                    <span className="text-ink-mute">–</span>
                                  ) : (
                                    <>
                                      <div className="font-medium text-ink">{Math.round(cell.fairValue)} €</div>
                                      <div className={up >= 0 ? 'text-gain' : 'text-loss'}>
                                        {fmtPct(up, 0, true)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
                  Cashflow-Projektion (Mrd. EUR)
                </h3>
                <div className="overflow-x-auto">
                  <table className="tnum w-full min-w-[420px] text-right text-xs">
                    <thead>
                      <tr className="border-b border-edge text-ink-mute">
                        <th className="p-1.5 text-left font-medium">Jahr</th>
                        <th className="p-1.5 font-medium">Umsatz</th>
                        <th className="p-1.5 font-medium">FCF</th>
                        <th className="p-1.5 font-medium">Barwert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.years.map((y) => (
                        <tr key={y.year} className="border-b border-edge/40 last:border-0">
                          <td className="p-1.5 text-left text-ink-soft">+{y.year}</td>
                          <td className="p-1.5 text-ink-soft">{fmtNum(y.revenue, 1)}</td>
                          <td className="p-1.5 text-ink">{fmtNum(y.fcf, 1)}</td>
                          <td className="p-1.5 text-ink">{fmtNum(y.discountedFcf, 1)}</td>
                        </tr>
                      ))}
                      <tr className="text-ink-soft">
                        <td className="p-1.5 text-left">Terminal (Gordon, diskontiert)</td>
                        <td />
                        <td />
                        <td className="p-1.5 font-medium text-ink">
                          {Number.isFinite(result.tvPerpetuity) ? fmtNum(result.tvPerpetuity, 1) : '–'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl bg-inset px-4 py-3 text-xs leading-relaxed text-ink-soft">
                <span className="font-semibold text-warn">Was das Modell bricht:</span> zu
                optimistische Wachstums-/Margen-Annahmen, WACC nahe am ewigen Wachstum
                (Terminal Value explodiert) und einmalige Sondereffekte im Ausgangsumsatz.
                Nutze die Matrix: Ist die Aktie nur in der optimistischsten Ecke „günstig“,
                ist die Sicherheitsmarge dünn. Keine Anlageberatung.
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
