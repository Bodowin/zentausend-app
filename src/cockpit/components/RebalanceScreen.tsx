// Rebalancing-Rechner: Ziel-Allokation je Position pflegen, Abweichung sehen
// und konkrete Orders berechnen – steuerschonend mit frischem Geld (keine
// Verkäufe) oder als komplette Umschichtung inkl. Steuerkosten-Schätzung.

import { useMemo, useState } from 'react'
import { fmtEur, fmtPct, fmtSignedEur } from '../lib/format'
import {
  normalizeTargets,
  planFreshMoney,
  planRebalance,
  targetsFromCurrent,
} from '../lib/rebalance'
import { effectiveTaxRatePct } from '../lib/tax'
import { useCockpit } from '../state'
import { Badge, Button, Card, EmptyState, NumberInput } from './ui'

type Mode = 'fresh' | 'full'

export function RebalanceScreen() {
  const { state, summary, setTargets, notify } = useCockpit()
  const [mode, setMode] = useState<Mode>('fresh')
  const [freshAmount, setFreshAmount] = useState(state.settings.monthlyBudget * 3)

  const targets = state.targets
  const hasTargets = summary.positions.some((p) => targets[p.instrument.id] !== undefined)

  const plan = useMemo(
    () =>
      mode === 'fresh'
        ? planFreshMoney(summary.positions, targets, Math.max(0, freshAmount || 0))
        : planRebalance(summary.positions, targets),
    [mode, summary.positions, targets, freshAmount],
  )

  const ratePct = effectiveTaxRatePct(state.settings.churchTaxPct)
  const sumWarning = hasTargets && Math.abs(plan.targetSum - 100) > 0.75

  if (summary.positions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="⚖️"
          title="Noch nichts zu balancieren"
          hint="Lege zuerst Positionen im Portfolio an – dann kannst du hier Zielgewichte setzen."
        />
      </Card>
    )
  }

  const setTarget = (id: string, v: number) =>
    setTargets({ ...targets, [id]: Number.isFinite(v) ? Math.max(0, v) : 0 })

  return (
    <div className="space-y-4">
      <Card
        title="Ziel-Allokation"
        subtitle="Zielgewicht je Position in % · Grundlage für die Order-Vorschläge"
        action={
          <div className="flex gap-2">
            <Button
              small
              variant="ghost"
              onClick={() => {
                setTargets(targetsFromCurrent(summary.positions))
                notify('Ziele mit aktuellen Gewichten vorbelegt.')
              }}
            >
              Ist übernehmen
            </Button>
            <Button
              small
              variant="ghost"
              onClick={() => {
                setTargets(normalizeTargets(targets))
                notify('Ziele auf 100 % normiert.')
              }}
            >
              Auf 100 % normieren
            </Button>
          </div>
        }
      >
        {sumWarning && (
          <div className="mb-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
            Die Ziele summieren sich auf {fmtPct(plan.targetSum, 1)} –
            „Auf 100 % normieren“ korrigiert das proportional.
          </div>
        )}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-edge text-[11px] uppercase tracking-wide text-ink-mute">
                <th className="pb-2 text-left font-medium">Position</th>
                <th className="pb-2 text-right font-medium">Wert</th>
                <th className="pb-2 text-right font-medium">Ist</th>
                <th className="w-28 pb-2 text-right font-medium">Ziel %</th>
                <th className="pb-2 text-right font-medium">Abweichung</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {summary.positions.map((p) => {
                const row = plan.rows.find((r) => r.position.instrument.id === p.instrument.id)
                const drift = row?.driftPct ?? 0
                return (
                  <tr key={p.instrument.id} className="border-b border-edge/50 last:border-0">
                    <td className="py-2 pr-2" style={{ fontVariantNumeric: 'normal' }}>
                      <div className="font-medium text-ink">{p.instrument.name}</div>
                      <div className="text-[11px] text-ink-mute">
                        {p.instrument.assetClass === 'etf' ? 'ETF' : 'Aktie'} · {p.instrument.ticker}
                      </div>
                    </td>
                    <td className="py-2 text-right text-ink-soft">{fmtEur(p.value)}</td>
                    <td className="py-2 text-right text-ink">{fmtPct(p.weight * 100, 1)}</td>
                    <td className="py-2 pl-4">
                      <NumberInput
                        value={targets[p.instrument.id] ?? NaN}
                        onChange={(v) => setTarget(p.instrument.id, v)}
                        step={0.5}
                        min={0}
                        max={100}
                        suffix="%"
                      />
                    </td>
                    <td
                      className={`py-2 text-right font-medium ${
                        Math.abs(drift) < 1
                          ? 'text-ink-mute'
                          : drift > 0
                            ? 'text-warn'
                            : 'text-chart-1'
                      }`}
                    >
                      {targets[p.instrument.id] !== undefined ? fmtPct(drift, 1, true) : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Order-Vorschläge"
        subtitle={
          mode === 'fresh'
            ? 'steuerschonend: nur Käufe mit frischem Geld, keine Verkäufe'
            : 'komplette Umschichtung: Verkäufe lösen ggf. Steuern aus (Schätzung unten)'
        }
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-edge bg-inset p-0.5">
              {(
                [
                  ['fresh', 'Frisches Geld'],
                  ['full', 'Umschichten'],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    mode === m ? 'bg-aurum text-abyss' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'fresh' && (
              <div className="w-32">
                <NumberInput value={freshAmount} onChange={setFreshAmount} step={100} min={0} suffix="€" />
              </div>
            )}
          </div>
        }
      >
        {!hasTargets ? (
          <p className="py-6 text-center text-xs text-ink-mute">
            Setze oben Zielgewichte (oder „Ist übernehmen“ und dann anpassen), um Vorschläge zu sehen.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {plan.rows
                .filter((r) => Math.abs(r.trade) >= 1)
                .map((r) => {
                  const isBuy = r.trade > 0
                  const p = r.position
                  // grobe Steuer auf den Gewinnanteil des Verkaufs
                  const gainShare = p.value > 0 ? Math.max(0, p.gain) / p.value : 0
                  const teilfrei = p.instrument.assetClass === 'etf' ? 0.7 : 1
                  const taxCost = !isBuy ? -r.trade * gainShare * teilfrei * (ratePct / 100) : 0
                  const shares = p.instrument.price > 0 ? Math.abs(r.trade) / p.instrument.price : 0
                  return (
                    <div
                      key={p.instrument.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl bg-inset px-3 py-2.5"
                    >
                      <Badge tone={isBuy ? 'gain' : 'loss'}>{isBuy ? 'Kaufen' : 'Verkaufen'}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {p.instrument.name}
                      </span>
                      <span className="tnum text-xs text-ink-mute">
                        ≈ {shares.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Stk.
                      </span>
                      {taxCost > 1 && (
                        <span className="tnum text-xs text-warn" title="geschätzte Steuer auf den Gewinnanteil">
                          Steuer ≈ {fmtEur(taxCost)}
                        </span>
                      )}
                      <span
                        className={`tnum w-24 text-right text-sm font-semibold ${
                          isBuy ? 'text-gain' : 'text-loss'
                        }`}
                      >
                        {fmtSignedEur(r.trade)}
                      </span>
                    </div>
                  )
                })}
              {plan.rows.every((r) => Math.abs(r.trade) < 1) && (
                <p className="py-6 text-center text-xs text-ink-mute">
                  Alles im Lot – keine Orders nötig. 🎯
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-edge pt-3 text-xs text-ink-soft">
              <span>
                Käufe: <span className="tnum font-semibold text-gain">{fmtEur(plan.totalBuys)}</span>
              </span>
              {mode === 'full' && (
                <span>
                  Verkäufe: <span className="tnum font-semibold text-loss">{fmtEur(plan.totalSells)}</span>
                </span>
              )}
              <span>
                Größte Abweichung:{' '}
                <span className="tnum font-semibold text-ink">{fmtPct(plan.maxDrift, 1)}</span>
              </span>
              <span className="text-ink-mute">
                Faustregel: Rebalancing ab ~5 %-Punkten Abweichung oder 1–2× pro Jahr.
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
