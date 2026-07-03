// Dividenden-Kalender: erwartete Ausschüttungen je Monat (Säulen-Chart),
// Ist-Erfassung erhaltener Zahlungen (Soll/Ist-Vergleich), Zahlungsliste je
// Monat und Kennzahlen. Ausschüttungsprofil je Titel editierbar.

import { useMemo, useState } from 'react'
import {
  buildDividendCalendar,
  expectedUntilMonth,
  MONTH_NAMES,
  receivedByMonth,
} from '../lib/dividends'
import { fmtDate, fmtEur, fmtEurExact, fmtPct, fmtSignedEur, todayIso, uid } from '../lib/format'
import type { DividendReceipt, Instrument } from '../lib/types'
import { useCockpit } from '../state'
import { ColumnChart } from './charts'
import { Badge, Button, Card, EmptyState, Field, inputClass, Modal, NumberInput, Stat } from './ui'

export function DividendsScreen() {
  const { state, summary, upsertInstrument, addIncome, deleteIncome, notify } = useCockpit()
  const currentMonth = new Date().getMonth() // 0-basiert
  const year = new Date().getFullYear()
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [addingReceipt, setAddingReceipt] = useState(false)

  const calendar = useMemo(() => buildDividendCalendar(summary.positions), [summary.positions])
  const monthPayments = calendar.payments.filter((p) => p.month === selectedMonth + 1)
  const received = useMemo(() => receivedByMonth(state.incomes, year), [state.incomes, year])
  const expectedYtd = expectedUntilMonth(calendar, currentMonth + 1)
  const receiptsThisYear = state.incomes
    .filter((r) => r.date.startsWith(String(year)))
    .sort((a, b) => b.date.localeCompare(a.date))

  if (summary.positions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="💶"
          title="Noch keine Positionen"
          hint="Sobald Positionen im Portfolio liegen, entsteht hier dein Ausschüttungs-Kalender."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Erwartete Jahresdividende" value={fmtEur(calendar.yearTotal)} delta="brutto, vor Steuern" />
        <Stat
          label={`Erhalten ${year}`}
          value={fmtEur(received.total)}
          delta={`Soll bis ${MONTH_NAMES[currentMonth]}: ${fmtEur(expectedYtd)} (${fmtSignedEur(received.total - expectedYtd)})`}
          deltaGood={received.total >= expectedYtd * 0.95}
        />
        <Stat
          label="Yield on Cost"
          value={fmtPct(calendar.yieldOnCostPct, 2)}
          delta="Dividende / Einstand"
        />
        <Stat
          label="Ausschüttungsrendite"
          value={fmtPct(calendar.yieldPct, 2)}
          delta="Dividende / Depotwert"
        />
      </div>

      <Card
        title="Dividenden-Kalender"
        subtitle="erwartete Zahlungen je Monat · Klick auf einen Monat zeigt die Details"
      >
        <ColumnChart
          labels={[...MONTH_NAMES]}
          values={calendar.monthTotals}
          format={fmtEur}
          color="var(--color-chart-2)"
          highlightIndex={selectedMonth}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MONTH_NAMES.map((m, i) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(i)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedMonth === i
                  ? 'bg-aurum text-abyss'
                  : i === currentMonth
                    ? 'bg-raised text-aurum'
                    : 'bg-raised text-ink-soft hover:text-ink'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={`Zahlungen im ${MONTH_NAMES[selectedMonth]}`}
          subtitle={`${monthPayments.length} erwartete Ausschüttungen · ${fmtEur(
            calendar.monthTotals[selectedMonth],
          )}`}
        >
          <div className="space-y-1.5">
            {monthPayments.map((p) => (
              <div
                key={`${p.instrumentId}-${p.month}`}
                className="flex items-center gap-3 rounded-xl bg-inset px-3 py-2.5"
              >
                <span className="w-12 shrink-0 text-xs font-semibold text-ink-mute">{p.ticker}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                <span className="tnum text-xs text-ink-mute">{fmtEurExact(p.perShare)}/Stk.</span>
                <span className="tnum w-20 text-right text-sm font-semibold text-gain">
                  {fmtEur(p.amount)}
                </span>
              </div>
            ))}
            {monthPayments.length === 0 && (
              <p className="py-6 text-center text-xs text-ink-mute">
                In diesem Monat werden keine Ausschüttungen erwartet.
              </p>
            )}
          </div>
        </Card>

        <Card
          title="Ausschüttungsprofile"
          subtitle="Jahresdividende je Anteil + Zahlungsmonate · Beispieldaten, editierbar"
        >
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {summary.positions.map((p) => {
              const div = p.instrument.dividend
              return (
                <button
                  key={p.instrument.id}
                  onClick={() => setEditing(p.instrument)}
                  className="flex w-full items-center gap-3 rounded-xl border border-edge bg-inset px-3 py-2 text-left hover:border-aurum/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {p.instrument.name}
                  </span>
                  {div && div.perShare > 0 ? (
                    <>
                      <span className="tnum text-xs text-ink-soft">
                        {fmtEurExact(div.perShare)}/Jahr
                      </span>
                      <Badge tone="gain">{div.months.length}× p. a.</Badge>
                    </>
                  ) : (
                    <Badge>keine Dividende</Badge>
                  )}
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      <Card
        title={`Erhaltene Zahlungen ${year}`}
        subtitle="Ist-Erfassung: fließt in den Soll/Ist-Vergleich und in die Steuer-Schätzung ein"
        action={
          <Button small onClick={() => setAddingReceipt(true)}>
            + Zahlung erfassen
          </Button>
        }
      >
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {receiptsThisYear.map((r) => {
            const inst = state.instruments.find((i) => i.id === r.instrumentId)
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-inset px-3 py-2">
                <span className="w-20 shrink-0 text-xs text-ink-mute">{fmtDate(r.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {inst?.name ?? r.instrumentId}
                  {r.note && <span className="ml-1 text-[11px] text-ink-mute">· {r.note}</span>}
                </span>
                <span className="tnum text-sm font-semibold text-gain">{fmtEurExact(r.amount)}</span>
                <button
                  onClick={() => deleteIncome(r.id)}
                  className="rounded p-1 text-ink-mute hover:bg-loss/15 hover:text-loss"
                  aria-label="Zahlung löschen"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4h10M6 4V3h4v1m-6 0l.7 9h6.6l.7-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )
          })}
          {receiptsThisYear.length === 0 && (
            <p className="py-5 text-center text-xs text-ink-mute">
              Noch keine Zahlungen erfasst – „+ Zahlung erfassen“, sobald eine Dividende eingeht.
            </p>
          )}
        </div>
      </Card>

      <p className="text-[11px] leading-relaxed text-ink-mute">
        Erwartungswerte auf Basis der hinterlegten Jahresdividende (gleichmäßig auf die
        Zahlungsmonate verteilt) – tatsächliche Termine/Beträge können abweichen. Brutto
        vor Abgeltungsteuer und Quellensteuer; Details im Steuer-Tab.
      </p>

      {editing && (
        <DividendEditor
          instrument={editing}
          onClose={() => setEditing(null)}
          onSave={(inst) => {
            upsertInstrument(inst)
            setEditing(null)
            notify(`Ausschüttungsprofil von ${inst.name} gespeichert.`)
          }}
        />
      )}
      {addingReceipt && (
        <ReceiptModal
          onClose={() => setAddingReceipt(false)}
          onSave={(receipt) => {
            addIncome(receipt)
            setAddingReceipt(false)
            notify('Zahlung erfasst.')
          }}
        />
      )}
    </div>
  )
}

function ReceiptModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (receipt: DividendReceipt) => void
}) {
  const { summary } = useCockpit()
  // Positionen mit Dividende zuerst, dann übrige Instrumente
  const options = [
    ...summary.positions
      .filter((p) => p.instrument.dividend && p.instrument.dividend.perShare > 0)
      .map((p) => p.instrument),
    ...summary.positions
      .filter((p) => !p.instrument.dividend || p.instrument.dividend.perShare === 0)
      .map((p) => p.instrument),
  ]
  const [instrumentId, setInstrumentId] = useState(options[0]?.id ?? '')
  const [date, setDate] = useState(todayIso())
  const expectedFor = (id: string): number => {
    const p = summary.positions.find((x) => x.instrument.id === id)
    const div = p?.instrument.dividend
    if (!p || !div || div.months.length === 0) return 0
    return Math.round(((div.perShare * p.shares) / div.months.length) * 100) / 100
  }
  const [amount, setAmount] = useState(() => expectedFor(options[0]?.id ?? ''))
  const [note, setNote] = useState('')

  return (
    <Modal title="Erhaltene Ausschüttung erfassen" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Wertpapier">
          <select
            className={inputClass}
            value={instrumentId}
            onChange={(e) => {
              setInstrumentId(e.target.value)
              setAmount(expectedFor(e.target.value))
            }}
          >
            {options.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zahltag">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Betrag (brutto)" hint="Vorschlag = erwartete Zahlung">
            <NumberInput value={amount} onChange={setAmount} step={0.01} min={0} suffix="€" />
          </Field>
        </div>
        <Field label="Notiz (optional)">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!instrumentId || !(amount > 0) || !date}
            onClick={() =>
              onSave({ id: uid(), instrumentId, date, amount, note: note || undefined })
            }
          >
            Erfassen
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DividendEditor({
  instrument,
  onClose,
  onSave,
}: {
  instrument: Instrument
  onClose: () => void
  onSave: (inst: Instrument) => void
}) {
  const [perShare, setPerShare] = useState(instrument.dividend?.perShare ?? 0)
  const [months, setMonths] = useState<number[]>(instrument.dividend?.months ?? [])

  const toggleMonth = (m: number) =>
    setMonths((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => a - b)))

  return (
    <Modal title={`Dividende: ${instrument.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Jahresdividende je Anteil" hint="Summe aller Zahlungen eines Jahres, in EUR">
          <NumberInput value={perShare} onChange={setPerShare} step={0.05} min={0} suffix="€" />
        </Field>
        <Field label="Zahlungsmonate">
          <div className="grid grid-cols-6 gap-1.5">
            {MONTH_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleMonth(i + 1)}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
                  months.includes(i + 1)
                    ? 'bg-aurum text-abyss'
                    : 'bg-inset text-ink-soft hover:bg-raised'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </Field>
        <div className="rounded-xl bg-inset px-3 py-2 text-xs text-ink-soft">
          {months.length > 0 && perShare > 0
            ? `${months.length} Zahlungen à ${fmtEurExact(perShare / months.length)} je Anteil`
            : 'Keine Dividende hinterlegt.'}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...instrument,
                dividend: perShare > 0 && months.length > 0 ? { perShare, months } : undefined,
              })
            }
          >
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  )
}
