// Steuer-Cockpit (Deutschland / Interactive Brokers): Pauschbetrag-Tracker,
// geschätzte Steuerlast, Aufschlüsselung nach Ertragsarten (inkl.
// Teilfreistellung & Vorabpauschale) und konkrete Optimierungs-Tipps.
// Alles Schätzungen – keine Steuerberatung.

import { useMemo } from 'react'
import { fmtEur, fmtPct } from '../lib/format'
import { buildTaxReport } from '../lib/tax'
import { useCockpit } from '../state'
import { Badge, Card, Field, NumberInput, Stat, inputClass } from './ui'

export function TaxScreen() {
  const { state, summary, updateSettings } = useCockpit()
  const year = new Date().getFullYear()
  const s = state.settings

  const report = useMemo(
    () =>
      buildTaxReport(summary.positions, state.transactions, state.instruments, s, year, {
        receipts: state.incomes,
      }),
    [summary.positions, state.transactions, state.instruments, state.incomes, s, year],
  )

  const allowanceUsedPct =
    report.allowanceAvailable > 0
      ? Math.min(
          100,
          ((report.allowanceAvailable - report.allowanceRemaining) / report.allowanceAvailable) * 100,
        )
      : 100

  const row = (label: string, value: number, hint?: string, strong = false) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-edge/40 py-1.5 last:border-0">
      <div>
        <span className={strong ? 'text-sm font-semibold text-ink' : 'text-xs text-ink-soft'}>
          {label}
        </span>
        {hint && <span className="ml-1.5 text-[10px] text-ink-mute">{hint}</span>}
      </div>
      <span className={`tnum ${strong ? 'text-sm font-semibold text-ink' : 'text-sm text-ink'}`}>
        {fmtEur(value)}
      </span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={`Steuerpflichtig ${year} (geschätzt)`}
          value={fmtEur(report.taxableBeforeAllowance)}
          delta="nach Teilfreistellung & Töpfen"
        />
        <Stat
          label="Pauschbetrag übrig"
          value={fmtEur(report.allowanceRemaining)}
          delta={`von ${fmtEur(report.allowanceAvailable)} verfügbar`}
          deltaGood={report.allowanceRemaining > 0}
        />
        <Stat
          label="Geschätzte Steuer"
          value={fmtEur(report.estimatedTax)}
          delta={`Satz ${fmtPct(report.ratePct, 2)}`}
          deltaGood={report.estimatedTax === 0}
        />
        <Stat
          label="Vorabpauschale (Januar)"
          value={fmtEur((report.vorabTaxable * report.ratePct) / 100)}
          delta="Steuer auf thesaurierende ETFs"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={`Steuer-Rechnung ${year}`}
          subtitle="realisierte Verkäufe + erwartete Dividenden + Vorabpauschale"
        >
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-soft">Sparer-Pauschbetrag ausgeschöpft</span>
              <span className="tnum text-ink">
                {fmtEur(report.allowanceAvailable - report.allowanceRemaining)} / {fmtEur(report.allowanceAvailable)}
              </span>
            </div>
            <div className="h-[10px] overflow-hidden rounded-r-[4px] bg-inset">
              <div
                className="h-full rounded-r-[4px]"
                style={{
                  width: `${allowanceUsedPct}%`,
                  background:
                    allowanceUsedPct >= 100 ? 'var(--color-warn)' : 'var(--color-chart-2)',
                }}
              />
            </div>
          </div>

          {row('Aktien-Gewinne (realisiert)', Math.max(0, report.aktienGains))}
          {report.aktienLossCarry > 0 &&
            row('Aktien-Verlusttopf', -report.aktienLossCarry, 'nur mit Aktien-Gewinnen verrechenbar')}
          {row('ETF-Gewinne (realisiert)', report.fondsGainsRaw, `→ steuerlich ${fmtEur(report.fondsGainsTaxable)} nach 30 % Teilfreistellung`)}
          {row('Dividenden Einzelaktien', report.dividendsStocks, 'erhalten + noch erwartet')}
          {row('ETF-Ausschüttungen', report.dividendsFundsRaw, `→ steuerlich ${fmtEur(report.dividendsFundsTaxable)}`)}
          {row('Vorabpauschale (Basisertrag)', report.vorabRaw, `→ steuerlich ${fmtEur(report.vorabTaxable)}`)}
          {row('Steuerpflichtig vor Pauschbetrag', report.taxableBeforeAllowance, undefined, true)}
          {row('Steuerpflichtig nach Pauschbetrag', report.taxableAfterAllowance)}
          {row(`Geschätzte Steuer (${fmtPct(report.ratePct, 2)})`, report.estimatedTax, undefined, true)}

          <p className="mt-3 rounded-xl bg-inset px-3 py-2 text-[11px] leading-relaxed text-ink-mute">
            Vereinfachte Schätzung: Dividenden = hinterlegte Jahreswerte, Vorabpauschale auf
            Basis des aktuellen Depotwerts, US-Quellensteuer-Anrechnung nicht abgezogen.
            Keine Steuerberatung.
          </p>
        </Card>

        <Card title="Steuer-Tipps" subtitle="automatisch aus deinem Depot abgeleitet">
          <div className="space-y-2">
            {report.tips.map((t, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-edge bg-inset px-3 py-2.5">
                <span className="text-base leading-6">
                  {t.level === 'action' ? '💡' : t.level === 'warn' ? '⚠️' : 'ℹ️'}
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">{t.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">{t.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Steuer-Einstellungen" subtitle="bestimmen Satz, Pauschbetrag und Vorabpauschale">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Sparer-Pauschbetrag" hint="1.000 € single · 2.000 € zusammen veranlagt">
            <NumberInput
              value={s.taxAllowance}
              onChange={(v) => updateSettings({ taxAllowance: v })}
              step={100}
              min={0}
              suffix="€"
            />
          </Field>
          <Field label="Extern verbraucht" hint="z. B. Zinsen bei anderer Bank">
            <NumberInput
              value={s.taxAllowanceUsedElsewhere}
              onChange={(v) => updateSettings({ taxAllowanceUsedElsewhere: v })}
              step={50}
              min={0}
              suffix="€"
            />
          </Field>
          <Field label="Kirchensteuer">
            <select
              className={inputClass}
              value={s.churchTaxPct}
              onChange={(e) => updateSettings({ churchTaxPct: parseInt(e.target.value, 10) as 0 | 8 | 9 })}
            >
              <option value={0}>keine</option>
              <option value={8}>8 % (BW/BY)</option>
              <option value={9}>9 % (übrige)</option>
            </select>
          </Field>
          <Field label="Basiszins Vorabpauschale" hint="BMF, jährlich neu festgelegt">
            <NumberInput
              value={s.basiszinsPct}
              onChange={(v) => updateSettings({ basiszinsPct: v })}
              step={0.05}
              min={0}
              suffix="%"
            />
          </Field>
          <Field label="Broker">
            <select
              className={inputClass}
              value={s.foreignBroker ? '1' : '0'}
              onChange={(e) => updateSettings({ foreignBroker: e.target.value === '1' })}
            >
              <option value="1">Ausland (z. B. IBKR)</option>
              <option value="0">Deutschland (führt ab)</option>
            </select>
          </Field>
        </div>
        {s.foreignBroker && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
            <Badge tone="warn">IBKR-Modus</Badge>
            Erträge selbst in der Anlage KAP erklären – Rücklage von ca.{' '}
            <span className="tnum font-semibold text-ink">{fmtEur(report.estimatedTax)}</span> einplanen.
          </div>
        )}
      </Card>
    </div>
  )
}
