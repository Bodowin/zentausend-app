// Portfolio-Verwaltung: Positions-Tabelle, Kauf/Verkauf erfassen,
// Transaktions-Historie, Sparpläne mit interaktiver Zinseszins-Projektion.

import { useMemo, useState } from 'react'
import { monthlyPlanTotal, projectSavings } from '../lib/calc'
import { fmtDate, fmtEur, fmtEurExact, fmtNum, fmtPct, fmtSignedEur, todayIso, uid } from '../lib/format'
import type { Instrument, SavingsPlan, Transaction, TxType } from '../lib/types'
import { useCockpit } from '../state'
import { LegendRow, LineChart } from './charts'
import { ImportModal } from './ImportModal'
import { SimulatorModal } from './SimulatorModal'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  inputClass,
  Modal,
  NumberInput,
  SliderField,
} from './ui'

export function PortfolioScreen() {
  const { state, summary, addTransaction, deleteTransaction, addPlan, updatePlan, deletePlan } =
    useCockpit()
  const [txModal, setTxModal] = useState<null | { type: TxType; instrumentId?: string }>(null)
  const [planModal, setPlanModal] = useState<null | SavingsPlan>(null)
  const [showTxs, setShowTxs] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)

  const planTotal = monthlyPlanTotal(state.plans)
  const [projReturn, setProjReturn] = useState(state.settings.expectedReturnPct)
  const [projYears, setProjYears] = useState(state.settings.horizonYears)

  const projection = useMemo(
    () => projectSavings(summary.value, planTotal + 0, projYears, projReturn),
    [summary.value, planTotal, projYears, projReturn],
  )
  const endValue = projection[projection.length - 1]

  return (
    <div className="space-y-4">
      <Card
        title="Positionen"
        subtitle={`${summary.positions.length} offene Positionen · Bewertung zu gepflegten Kursen`}
        action={
          <div className="flex gap-2">
            <Button small onClick={() => setTxModal({ type: 'buy' })}>
              + Kauf
            </Button>
            <Button small variant="ghost" onClick={() => setTxModal({ type: 'sell' })}>
              Verkauf
            </Button>
            <Button small variant="ghost" onClick={() => setShowImport(true)}>
              ⬇ IBKR-Import
            </Button>
            <Button small variant="ghost" onClick={() => setShowSimulator(true)}>
              ⚖ Simulator
            </Button>
          </div>
        }
      >
        {summary.positions.length === 0 ? (
          <EmptyState
            icon="📥"
            title="Noch keine Positionen"
            hint="Erfasse deinen ersten Kauf – ETFs und Aktien aus der Bibliothek stehen bereit."
            action={<Button onClick={() => setTxModal({ type: 'buy' })}>Ersten Kauf erfassen</Button>}
          />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wide text-ink-mute">
                  <th className="pb-2 font-medium">Position</th>
                  <th className="pb-2 text-right font-medium">Stück</th>
                  <th className="pb-2 text-right font-medium">Einstand</th>
                  <th className="pb-2 text-right font-medium">Kurs</th>
                  <th className="pb-2 text-right font-medium">Wert</th>
                  <th className="pb-2 text-right font-medium">G/V</th>
                  <th className="pb-2 text-right font-medium">Gewicht</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {summary.positions.map((p) => (
                  <tr key={p.instrument.id} className="border-b border-edge/50 last:border-0">
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                            p.instrument.assetClass === 'etf'
                              ? 'bg-chart-1/15 text-chart-1'
                              : 'bg-aurum/15 text-aurum'
                          }`}
                        >
                          {p.instrument.assetClass === 'etf' ? 'ETF' : 'AK'}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink" style={{ fontVariantNumeric: 'normal' }}>
                            {p.instrument.name}
                          </div>
                          <div className="text-[11px] text-ink-mute">{p.instrument.ticker}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-ink-soft">{fmtNum(p.shares, p.shares % 1 === 0 ? 0 : 3)}</td>
                    <td className="py-2.5 text-right text-ink-soft">{fmtEurExact(p.avgCost)}</td>
                    <td className="py-2.5 text-right text-ink">
                      {fmtEurExact(p.instrument.price)}
                      {typeof p.instrument.dayChangePct === 'number' && (
                        <div
                          className={`text-[10px] ${p.instrument.dayChangePct >= 0 ? 'text-gain' : 'text-loss'}`}
                        >
                          {fmtPct(p.instrument.dayChangePct, 1, true)} heute
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-medium text-ink">{fmtEur(p.value)}</td>
                    <td
                      className={`py-2.5 text-right font-medium ${p.gain >= 0 ? 'text-gain' : 'text-loss'}`}
                    >
                      {fmtSignedEur(p.gain)}
                      <div className="text-[10px] opacity-80">{fmtPct(p.gainPct, 1, true)}</div>
                    </td>
                    <td className="py-2.5 text-right text-ink-soft">{fmtPct(p.weight * 100, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sparpläne + Projektion */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          title="Sparpläne"
          subtitle={`${fmtEur(planTotal)} pro Monat automatisch investiert`}
          className="lg:col-span-2"
          action={
            <Button
              small
              variant="ghost"
              onClick={() =>
                setPlanModal({
                  id: uid(),
                  instrumentId: state.instruments.find((i) => i.assetClass === 'etf')?.id ?? '',
                  monthlyAmount: 100,
                  dayOfMonth: 1,
                  active: true,
                })
              }
            >
              + Sparplan
            </Button>
          }
        >
          <div className="space-y-2">
            {state.plans.map((plan) => {
              const inst = state.instruments.find((i) => i.id === plan.instrumentId)
              return (
                <button
                  key={plan.id}
                  onClick={() => setPlanModal(plan)}
                  className="flex w-full items-center gap-3 rounded-xl border border-edge bg-inset px-3 py-2.5 text-left hover:border-aurum/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {inst?.name ?? plan.instrumentId}
                    </div>
                    <div className="text-[11px] text-ink-mute">
                      jeweils am {plan.dayOfMonth}. des Monats
                    </div>
                  </div>
                  {!plan.active && <Badge>pausiert</Badge>}
                  <span className="tnum text-sm font-semibold text-aurum">
                    {fmtEur(plan.monthlyAmount)}
                  </span>
                </button>
              )
            })}
            {state.plans.length === 0 && (
              <p className="py-4 text-center text-xs text-ink-mute">
                Noch keine Sparpläne angelegt.
              </p>
            )}
          </div>
        </Card>

        <Card
          title="Vermögens-Projektion"
          subtitle="Depot + Sparrate mit Zinseszins (monatliche Verzinsung)"
          className="lg:col-span-3"
        >
          <div className="mb-4 grid grid-cols-2 gap-4">
            <SliderField
              label="Erwartete Rendite p. a."
              value={projReturn}
              onChange={setProjReturn}
              min={0}
              max={12}
              step={0.5}
              format={(v) => fmtPct(v, 1)}
            />
            <SliderField
              label="Anlagehorizont"
              value={projYears}
              onChange={setProjYears}
              min={5}
              max={40}
              step={1}
              format={(v) => `${v} Jahre`}
            />
          </div>
          <LineChart
            labels={projection.map((p) => `${p.year}`)}
            series={[
              {
                name: 'Depotwert',
                color: 'var(--color-chart-2)',
                values: projection.map((p) => p.value),
                area: true,
              },
              {
                name: 'Einzahlungen',
                color: 'var(--color-ink-mute)',
                values: projection.map((p) => p.contributions),
                dashed: true,
              },
            ]}
            formatY={(v) => fmtEur(v)}
            formatLabel={(l) => (l === '0' ? 'heute' : `+${l} J.`)}
            yMinZero
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <LegendRow
              items={[
                { label: 'Depotwert', color: 'var(--color-chart-2)' },
                { label: 'Einzahlungen', color: 'var(--color-ink-mute)', dashed: true },
              ]}
            />
            {endValue && (
              <div className="text-xs text-ink-soft">
                In {projYears} Jahren: <span className="tnum font-semibold text-gain">{fmtEur(endValue.value)}</span>{' '}
                <span className="text-ink-mute">
                  (davon {fmtEur(endValue.value - endValue.contributions)} Kursgewinn)
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Transaktionen */}
      <Card
        title="Transaktionen"
        subtitle={`${state.transactions.length} Buchungen`}
        action={
          <button
            className="text-xs font-medium text-aurum hover:underline"
            onClick={() => setShowTxs((v) => !v)}
          >
            {showTxs ? 'Ausblenden' : 'Anzeigen'}
          </button>
        }
      >
        {showTxs && (
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {[...state.transactions]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => {
                const inst = state.instruments.find((i) => i.id === t.instrumentId)
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-raised"
                  >
                    <Badge tone={t.type === 'buy' ? 'gain' : 'loss'}>
                      {t.type === 'buy' ? 'Kauf' : 'Verkauf'}
                    </Badge>
                    <span className="w-20 shrink-0 text-xs text-ink-mute">{fmtDate(t.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {inst?.name ?? t.instrumentId}
                      {t.note && <span className="ml-1 text-[11px] text-ink-mute">· {t.note}</span>}
                    </span>
                    <span className="tnum text-xs text-ink-soft">
                      {fmtNum(t.shares, t.shares % 1 === 0 ? 0 : 3)} × {fmtEurExact(t.price)}
                    </span>
                    <span className="tnum w-24 text-right font-medium text-ink">
                      {fmtEur(t.shares * t.price)}
                    </span>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="rounded p-1 text-ink-mute hover:bg-loss/15 hover:text-loss"
                      aria-label="Buchung löschen"
                      title="Buchung löschen"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M6 4V3h4v1m-6 0l.7 9h6.6l.7-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )
              })}
          </div>
        )}
      </Card>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showSimulator && <SimulatorModal onClose={() => setShowSimulator(false)} />}
      {txModal && (
        <TransactionModal
          type={txModal.type}
          instruments={state.instruments}
          presetId={txModal.instrumentId}
          onClose={() => setTxModal(null)}
          onSave={(tx) => {
            addTransaction(tx)
            setTxModal(null)
          }}
        />
      )}
      {planModal && (
        <PlanModal
          plan={planModal}
          isNew={!state.plans.some((p) => p.id === planModal.id)}
          instruments={state.instruments}
          onClose={() => setPlanModal(null)}
          onSave={(plan, isNew) => {
            if (isNew) addPlan(plan)
            else updatePlan(plan)
            setPlanModal(null)
          }}
          onDelete={(id) => {
            deletePlan(id)
            setPlanModal(null)
          }}
        />
      )}
    </div>
  )
}

function TransactionModal({
  type,
  instruments,
  presetId,
  onClose,
  onSave,
}: {
  type: TxType
  instruments: Instrument[]
  presetId?: string
  onClose: () => void
  onSave: (tx: Transaction) => void
}) {
  const sorted = [...instruments].sort((a, b) =>
    `${a.assetClass}${a.name}`.localeCompare(`${b.assetClass}${b.name}`),
  )
  const [instrumentId, setInstrumentId] = useState(presetId ?? sorted[0]?.id ?? '')
  const instrument = instruments.find((i) => i.id === instrumentId)
  const [date, setDate] = useState(todayIso())
  const [shares, setShares] = useState(1)
  const [price, setPrice] = useState(instrument?.price ?? 100)
  const [fees, setFees] = useState(1)

  const valid = instrumentId && shares > 0 && price > 0 && date
  return (
    <Modal title={type === 'buy' ? 'Kauf erfassen' : 'Verkauf erfassen'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Wertpapier">
          <select
            className={inputClass}
            value={instrumentId}
            onChange={(e) => {
              setInstrumentId(e.target.value)
              const inst = instruments.find((i) => i.id === e.target.value)
              if (inst) setPrice(inst.price)
            }}
          >
            <optgroup label="ETFs">
              {sorted.filter((i) => i.assetClass === 'etf').map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.ticker})
                </option>
              ))}
            </optgroup>
            <optgroup label="Aktien">
              {sorted.filter((i) => i.assetClass === 'stock').map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.ticker})
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Stückzahl">
            <NumberInput value={shares} onChange={setShares} step={0.001} min={0} />
          </Field>
          <Field label="Kurs je Stück" hint="in EUR">
            <NumberInput value={price} onChange={setPrice} step={0.01} min={0} suffix="€" />
          </Field>
          <Field label="Gebühren">
            <NumberInput value={fees} onChange={setFees} step={0.5} min={0} suffix="€" />
          </Field>
        </div>
        <div className="rounded-xl bg-inset px-3 py-2 text-sm text-ink-soft">
          Gesamt:{' '}
          <span className="tnum font-semibold text-ink">
            {fmtEurExact(shares * price + (type === 'buy' ? fees : -fees))}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave({
                id: uid(),
                instrumentId,
                type,
                date,
                shares,
                price,
                fees,
              })
            }
          >
            {type === 'buy' ? 'Kauf buchen' : 'Verkauf buchen'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function PlanModal({
  plan,
  isNew,
  instruments,
  onClose,
  onSave,
  onDelete,
}: {
  plan: SavingsPlan
  isNew: boolean
  instruments: Instrument[]
  onClose: () => void
  onSave: (plan: SavingsPlan, isNew: boolean) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState(plan)
  const etfsFirst = [...instruments].sort((a, b) =>
    `${a.assetClass === 'etf' ? 0 : 1}${a.name}`.localeCompare(`${b.assetClass === 'etf' ? 0 : 1}${b.name}`),
  )
  return (
    <Modal title={isNew ? 'Sparplan anlegen' : 'Sparplan bearbeiten'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Wertpapier">
          <select
            className={inputClass}
            value={draft.instrumentId}
            onChange={(e) => setDraft({ ...draft, instrumentId: e.target.value })}
          >
            {etfsFirst.map((i) => (
              <option key={i.id} value={i.id}>
                {i.assetClass === 'etf' ? 'ETF · ' : 'Aktie · '}
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monatliche Rate">
            <NumberInput
              value={draft.monthlyAmount}
              onChange={(v) => setDraft({ ...draft, monthlyAmount: v })}
              step={25}
              min={1}
              suffix="€"
            />
          </Field>
          <Field label="Ausführungstag" hint="1–28">
            <NumberInput
              value={draft.dayOfMonth}
              onChange={(v) => setDraft({ ...draft, dayOfMonth: Math.min(28, Math.max(1, Math.round(v))) })}
              step={1}
              min={1}
              max={28}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Sparplan aktiv
        </label>
        <div className="flex justify-between gap-2">
          {!isNew ? (
            <Button variant="danger" onClick={() => onDelete(draft.id)}>
              Löschen
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              disabled={!draft.instrumentId || !(draft.monthlyAmount > 0)}
              onClick={() => onSave(draft, isNew)}
            >
              Speichern
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
