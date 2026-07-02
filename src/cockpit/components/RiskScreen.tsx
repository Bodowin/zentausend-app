// Risiko-Analyse: Diversifikations-Score, Konzentrations-Aufschlüsselung
// (Sektor/Region/Klasse), Warn-Flags und Stress-Szenarien.

import { fmtEur, fmtPct, fmtSignedEur } from '../lib/format'
import {
  byAssetClass,
  byRegion,
  bySector,
  diversificationScore,
  riskFlags,
  stressTests,
} from '../lib/risk'
import { useCockpit } from '../state'
import { CHART_COLORS, Donut, foldSlices, HBarList, ScoreMeter } from './charts'
import { Card, EmptyState } from './ui'

export function RiskScreen() {
  const { summary } = useCockpit()

  if (summary.positions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="🛡️"
          title="Noch nichts zu analysieren"
          hint="Sobald Positionen im Portfolio liegen, siehst du hier Konzentration, Flags und Stress-Szenarien."
        />
      </Card>
    )
  }

  const divScore = diversificationScore(summary)
  const flags = riskFlags(summary)
  const scenarios = stressTests(summary)
  const sectors = bySector(summary.positions)
  const regions = byRegion(summary.positions)
  const classes = foldSlices(byAssetClass(summary.positions).map((s) => ({ label: s.label, value: s.value })))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Diversifikations-Score" subtitle="Positionszahl, Klumpen, Sektoren, Regionen, ETF-Kern">
          <div className="flex items-center gap-4">
            <div className="text-5xl font-semibold text-ink">{divScore}</div>
            <div className="flex-1">
              <ScoreMeter value={divScore} />
              <div className="mt-1 text-xs text-ink-mute">
                {divScore >= 70 ? 'solide gestreut' : divScore >= 45 ? 'ausbaufähig gestreut' : 'stark konzentriert'}
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-edge pt-4">
            <Donut slices={classes} centerLabel="Depot" centerValue={fmtEur(summary.value)} format={fmtEur} />
          </div>
        </Card>

        <Card title="Sektor-Gewichtung" subtitle="direktes Gewicht; breite ETFs zählen als „Diversifiziert“">
          <HBarList
            items={sectors.map((s, i) => ({
              label: s.label,
              value: s.value,
              pct: s.weight * 100,
              color: CHART_COLORS[i % 8],
            }))}
            format={fmtEur}
          />
        </Card>

        <Card title="Regionen-Gewichtung" subtitle="Welt-ETFs enthalten zusätzlich ~65 % USA">
          <HBarList
            items={regions.map((r, i) => ({
              label: r.label,
              value: r.value,
              pct: r.weight * 100,
              color: CHART_COLORS[i % 8],
            }))}
            format={fmtEur}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Risiko-Flags" subtitle="automatische Prüfung gängiger Richtwerte">
          <div className="space-y-2">
            {flags.map((f, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-edge bg-inset px-3 py-2.5"
              >
                <span className="text-base leading-6">
                  {f.level === 'critical' ? '🔴' : f.level === 'warn' ? '🟡' : '🟢'}
                </span>
                <div>
                  <div className="text-sm font-medium text-ink">{f.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Stress-Szenarien"
          subtitle="grobe Was-wäre-wenn-Schätzung auf Basis von Klasse, Sektor und Beta"
        >
          <div className="space-y-3">
            {scenarios.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  <span className="tnum text-sm font-semibold text-loss">
                    {fmtSignedEur(s.impact)} · {fmtPct(s.impactPct, 1)}
                  </span>
                </div>
                <div className="h-[10px] overflow-hidden rounded-r-[4px] bg-inset">
                  <div
                    className="h-full rounded-r-[4px] bg-loss"
                    style={{ width: `${Math.min(Math.abs(s.impactPct) / 40, 1) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">{s.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-inset px-3 py-2 text-[11px] leading-relaxed text-ink-mute">
            Modellhafte Schätzungen ohne Korrelations-/Zweitrunden-Effekte – als
            Bauchgefühl-Check gedacht, nicht als Prognose. Keine Anlageberatung.
          </p>
        </Card>
      </div>
    </div>
  )
}
