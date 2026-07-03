// Dividenden-Kalender: erwartete Ausschüttungen je Monat (Säulen-Chart),
// Zahlungsliste je Monat und Kennzahlen (Jahressumme, Ø/Monat, Yield on Cost).
// Ausschüttungsprofil je Titel editierbar.

import { useMemo, useState } from 'react'
import { buildDividendCalendar, MONTH_NAMES } from '../lib/dividends'
import { fmtEur, fmtEurExact, fmtPct } from '../lib/format'
import type { Instrument } from '../lib/types'
import { useCockpit } from '../state'
import { ColumnChart } from './charts'
import { Badge, Button, Card, EmptyState, Field, Modal, NumberInput, Stat } from './ui'

export function DividendsScreen() {
  const { summary, upsertInstrument, notify } = useCockpit()
  const currentMonth = new Date().getMonth() // 0-basiert
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [editing, setEditing] = useState<Instrument | null>(null)

  const calendar = useMemo(() => buildDividendCalendar(summary.positions), [summary.positions])
  const monthPayments = calendar.payments.filter((p) => p.month === selectedMonth + 1)

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
        <Stat label="Ø pro Monat" value={fmtEur(calendar.yearTotal / 12)} />
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
    </div>
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
