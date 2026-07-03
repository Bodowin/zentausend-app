// Monats-Report: kompakte, druckbare Zusammenfassung des gesamten Cockpits
// (KPIs, Benchmark, Allokation, Top/Flop, Dividenden-Ausblick, Risiko, Steuer).
// „Drucken/PDF“ nutzt den Browser-Druck (Druck-Styles schalten auf hell),
// „Als Text kopieren“ erzeugt eine Markdown-Zusammenfassung zum Teilen.

import { useMemo } from 'react'
import { compareWithBenchmark, MSCI_WORLD } from '../lib/benchmark'
import { monthlyPlanTotal } from '../lib/calc'
import { buildDividendCalendar, MONTH_NAMES } from '../lib/dividends'
import { fmtEur, fmtEurExact, fmtPct, fmtSignedEur, todayIso } from '../lib/format'
import { byAssetClass, diversificationScore, riskFlags } from '../lib/risk'
import { buildTaxReport } from '../lib/tax'
import { useCockpit } from '../state'
import { Badge, Button } from './ui'

export function ReportView({ onBack }: { onBack: () => void }) {
  const { state, summary, notify } = useCockpit()
  const today = todayIso()
  const year = new Date().getFullYear()
  const monthLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  const bench = useMemo(
    () =>
      compareWithBenchmark(state.transactions, state.snapshots, {
        date: today,
        invested: summary.invested,
        value: summary.value,
      }),
    [state.transactions, state.snapshots, summary.invested, summary.value, today],
  )
  const calendar = useMemo(() => buildDividendCalendar(summary.positions), [summary.positions])
  const tax = useMemo(
    () => buildTaxReport(summary.positions, state.transactions, state.instruments, state.settings, year),
    [summary.positions, state.transactions, state.instruments, state.settings, year],
  )
  const flags = useMemo(() => riskFlags(summary), [summary])
  const divScore = diversificationScore(summary)
  const classes = byAssetClass(summary.positions)
  const planTotal = monthlyPlanTotal(state.plans)

  const currentMonth = new Date().getMonth()
  const next3 = [0, 1, 2].map((offset) => {
    const idx = (currentMonth + offset) % 12
    return { name: MONTH_NAMES[idx], total: calendar.monthTotals[idx] }
  })

  const movers = [...summary.positions].sort((a, b) => b.gainPct - a.gainPct)

  const buildText = (): string => {
    const lines: string[] = [
      `# Invest-Report · ${monthLabel}`,
      '',
      `**Depotwert:** ${fmtEurExact(summary.value)} (Einstand ${fmtEur(summary.invested)}, ${fmtSignedEur(summary.gain)} / ${fmtPct(summary.gainPct, 1, true)})`,
      `**Realisiert:** ${fmtSignedEur(summary.realized)} · **Sparrate:** ${fmtEur(planTotal)}/Monat`,
    ]
    if (bench) {
      lines.push(
        `**Benchmark (${MSCI_WORLD.name}):** Depot ${fmtPct(bench.depotReturnPct, 1, true)} vs. Markt ${fmtPct(bench.benchReturnPct, 1, true)} → ${fmtPct(bench.alphaPct, 1, true)} Pkt.`,
      )
    }
    lines.push('', '## Positionen')
    for (const p of summary.positions) {
      lines.push(
        `- ${p.instrument.name}: ${fmtEur(p.value)} (${fmtPct(p.weight * 100, 1)}) · ${fmtPct(p.gainPct, 1, true)}`,
      )
    }
    lines.push(
      '',
      `## Dividenden: ${fmtEur(calendar.yearTotal)} p. a. erwartet`,
      ...next3.map((m) => `- ${m.name}: ${fmtEur(m.total)}`),
      '',
      `## Risiko: Diversifikations-Score ${divScore}/100`,
      ...flags.slice(0, 3).map((f) => `- ${f.title}`),
      '',
      `## Steuer ${year}`,
      `- Steuerpflichtig (geschätzt): ${fmtEur(tax.taxableBeforeAllowance)} · Pauschbetrag übrig: ${fmtEur(tax.allowanceRemaining)}`,
      `- Geschätzte Steuer: ${fmtEur(tax.estimatedTax)} (Satz ${fmtPct(tax.ratePct, 2)})`,
      '',
      `_Erstellt am ${new Date().toLocaleDateString('de-DE')} · Beispieldaten/Schätzungen · keine Anlage- oder Steuerberatung_`,
    )
    return lines.join('\n')
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildText())
      notify('Report als Text kopiert – z. B. in Notizen oder WhatsApp einfügen.')
    } catch {
      notify('Kopieren nicht möglich.', 'error')
    }
  }

  const section = (title: string) => (
    <h2 className="mb-2 mt-6 border-b border-edge pb-1 text-sm font-semibold text-ink">{title}</h2>
  )

  return (
    <div className="report-root mx-auto max-w-3xl">
      {/* Aktionen (im Druck ausgeblendet) */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button small variant="ghost" onClick={onBack}>
          ← Zurück zum Cockpit
        </Button>
        <div className="flex gap-2">
          <Button small variant="ghost" onClick={copyText}>
            📋 Als Text kopieren
          </Button>
          <Button small onClick={() => window.print()}>
            🖨 Drucken / PDF
          </Button>
        </div>
      </div>

      <div className="card p-6">
        {/* Kopf */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-mute">Invest-Cockpit</div>
            <h1 className="mt-0.5 text-2xl font-semibold text-ink">Monats-Report · {monthLabel}</h1>
          </div>
          <div className="text-right text-xs text-ink-mute">
            erstellt am
            <br />
            {new Date().toLocaleDateString('de-DE')}
          </div>
        </div>

        {/* KPI-Zeile */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Depotwert', fmtEurExact(summary.value)],
            ['Einstand', fmtEur(summary.invested)],
            ['G/V unrealisiert', `${fmtSignedEur(summary.gain)} · ${fmtPct(summary.gainPct, 1, true)}`],
            ['Sparrate', `${fmtEur(planTotal)}/Monat`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-inset px-3 py-2.5">
              <div className="text-[11px] text-ink-mute">{label}</div>
              <div className="tnum mt-0.5 text-sm font-semibold text-ink">{value}</div>
            </div>
          ))}
        </div>

        {/* Benchmark */}
        {bench && (
          <>
            {section(`Performance vs. ${MSCI_WORLD.name}`)}
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <span>
                Depot{' '}
                <span className={`tnum font-semibold ${bench.depotReturnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {fmtPct(bench.depotReturnPct, 1, true)}
                </span>
              </span>
              <span>
                Benchmark{' '}
                <span className={`tnum font-semibold ${bench.benchReturnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {fmtPct(bench.benchReturnPct, 1, true)}
                </span>
              </span>
              <Badge tone={bench.alphaPct >= 0 ? 'gain' : 'loss'}>
                {fmtPct(bench.alphaPct, 1, true)} Punkte {bench.alphaPct >= 0 ? 'vor' : 'hinter'} dem Markt
              </Badge>
            </div>
          </>
        )}

        {/* Allokation & Positionen */}
        {section('Allokation & Positionen')}
        <div className="mb-2 flex flex-wrap gap-2 text-xs text-ink-soft">
          {classes.map((c) => (
            <span key={c.label} className="rounded-full bg-inset px-2.5 py-1">
              {c.label}: <span className="tnum font-semibold text-ink">{Math.round(c.weight * 100)} %</span>
            </span>
          ))}
        </div>
        <table className="tnum w-full text-xs">
          <thead>
            <tr className="border-b border-edge text-left text-[10px] uppercase tracking-wide text-ink-mute">
              <th className="py-1.5 font-medium">Position</th>
              <th className="py-1.5 text-right font-medium">Wert</th>
              <th className="py-1.5 text-right font-medium">Gewicht</th>
              <th className="py-1.5 text-right font-medium">G/V</th>
            </tr>
          </thead>
          <tbody>
            {summary.positions.map((p) => (
              <tr key={p.instrument.id} className="border-b border-edge/40 last:border-0">
                <td className="py-1.5 text-ink" style={{ fontVariantNumeric: 'normal' }}>
                  {p.instrument.name}
                </td>
                <td className="py-1.5 text-right text-ink">{fmtEur(p.value)}</td>
                <td className="py-1.5 text-right text-ink-soft">{fmtPct(p.weight * 100, 1)}</td>
                <td className={`py-1.5 text-right font-medium ${p.gain >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {fmtPct(p.gainPct, 1, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {movers.length >= 2 && (
          <p className="mt-2 text-xs text-ink-soft">
            Bester Wert: <span className="font-medium text-gain">{movers[0].instrument.name} ({fmtPct(movers[0].gainPct, 1, true)})</span>
            {' · '}Schwächster:{' '}
            <span className="font-medium text-loss">
              {movers[movers.length - 1].instrument.name} ({fmtPct(movers[movers.length - 1].gainPct, 1, true)})
            </span>
          </p>
        )}

        {/* Dividenden */}
        {section('Dividenden-Ausblick')}
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <span>
            Erwartet: <span className="tnum font-semibold text-ink">{fmtEur(calendar.yearTotal)}/Jahr</span>
          </span>
          {next3.map((m) => (
            <span key={m.name} className="rounded-full bg-inset px-2.5 py-1 text-xs">
              {m.name}: <span className="tnum font-semibold text-ink">{fmtEur(m.total)}</span>
            </span>
          ))}
        </div>

        {/* Risiko */}
        {section(`Risiko · Diversifikations-Score ${divScore}/100`)}
        <ul className="space-y-1 text-xs text-ink-soft">
          {flags.slice(0, 3).map((f, i) => (
            <li key={i}>
              {f.level === 'critical' ? '🔴' : f.level === 'warn' ? '🟡' : '🟢'} {f.title}
            </li>
          ))}
        </ul>

        {/* Steuer */}
        {section(`Steuer ${year} (Schätzung)`)}
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {[
            ['Steuerpflichtig', fmtEur(tax.taxableBeforeAllowance)],
            ['Pauschbetrag übrig', fmtEur(tax.allowanceRemaining)],
            ['Geschätzte Steuer', fmtEur(tax.estimatedTax)],
            ['Vorabpauschale (Steuer)', fmtEur((tax.vorabTaxable * tax.ratePct) / 100)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-inset px-3 py-2">
              <div className="text-[10px] text-ink-mute">{label}</div>
              <div className="tnum mt-0.5 font-semibold text-ink">{value}</div>
            </div>
          ))}
        </div>

        <p className="mt-6 border-t border-edge pt-3 text-[10px] leading-relaxed text-ink-mute">
          Automatisch erzeugt aus lokalen Cockpit-Daten. Kennzahlen teils Beispieldaten,
          Benchmark auf Basis einer Beispiel-Kursreihe, Steuerwerte vereinfachte Schätzung.
          Keine Anlage- oder Steuerberatung.
        </p>
      </div>
    </div>
  )
}
