// Cockpit-Übersicht: Hero-Kennzahl (Depotwert), Stat-Kacheln, Verlaufs-Kurve
// (Wert vs. Einzahlungen), Allokations-Donut, Top/Flop-Positionen und
// Score-Überblick der Watchlist.

import { useMemo } from 'react'
import { compareWithBenchmark, MSCI_WORLD } from '../lib/benchmark'
import { monthlyPlanTotal, valueSeries } from '../lib/calc'
import { fmtEur, fmtEurExact, fmtMonth, fmtPct, fmtSignedEur, todayIso } from '../lib/format'
import { byAssetClass } from '../lib/risk'
import { scoreInstrument } from '../lib/score'
import { useCockpit } from '../state'
import { Donut, foldSlices, HBarList, LegendRow, LineChart, ScoreMeter, Sparkline } from './charts'
import { Badge, Button, Card, Stat, UpDown } from './ui'

export function Dashboard({
  onNavigate,
  onOpenReport,
}: {
  onNavigate: (tab: string) => void
  onOpenReport: () => void
}) {
  const { state, summary } = useCockpit()

  const series = useMemo(
    () => valueSeries(state.snapshots, { invested: summary.invested, value: summary.value }),
    [state.snapshots, summary.invested, summary.value],
  )

  const bench = useMemo(
    () =>
      compareWithBenchmark(state.transactions, state.snapshots, {
        date: todayIso(),
        invested: summary.invested,
        value: summary.value,
      }),
    [state.transactions, state.snapshots, summary.invested, summary.value],
  )

  const sparkValues = series.map((p) => p.value)
  const planTotal = monthlyPlanTotal(state.plans)

  const assetSlices = foldSlices(
    byAssetClass(summary.positions).map((s) => ({ label: s.label, value: s.value })),
  )
  const topPositions = summary.positions.slice(0, 6).map((p, i) => ({
    label: p.instrument.name,
    value: p.value,
    pct: p.weight * 100,
    color: `var(--color-chart-${(i % 8) + 1})`,
  }))

  const movers = [...summary.positions].sort((a, b) => b.gainPct - a.gainPct)
  const top = movers.slice(0, 3)
  const flop = movers.slice(-3).reverse().filter((p) => !top.includes(p))

  const watch = state.watchlist
    .map((id) => state.instruments.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((inst) => ({ inst, score: scoreInstrument(inst, state.settings.riskProfile) }))
    .filter((x) => x.score)
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <div className="text-xs text-ink-mute">Depotwert heute</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {fmtEurExact(summary.value)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={summary.gain >= 0 ? 'font-medium text-gain' : 'font-medium text-loss'}>
              <UpDown value={summary.gain} /> {fmtSignedEur(summary.gain)} ·{' '}
              {fmtPct(summary.gainPct, 1, true)}
            </span>
            <span className="text-ink-mute">seit Einstand</span>
            {state.demo && <Badge tone="warn">Demo-Daten</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Sparkline values={sparkValues} color="var(--color-aurum)" width={140} height={44} />
          <div className="text-[11px] text-ink-mute">Verlauf seit {fmtMonth(series[0]?.date ?? '')}</div>
          <Button small variant="ghost" onClick={onOpenReport}>
            📄 Monats-Report
          </Button>
        </div>
      </div>

      {/* Stat-Kacheln */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Investiert (Einstand)" value={fmtEur(summary.invested)} />
        <Stat
          label="Realisierte Gewinne"
          value={fmtSignedEur(summary.realized)}
          deltaGood={summary.realized >= 0}
          delta="aus Verkäufen"
        />
        <Stat
          label="Ausschüttungsrendite"
          value={fmtPct(summary.dividendYieldPct, 2)}
          delta={`≈ ${fmtEur((summary.dividendYieldPct / 100) * summary.value)} / Jahr`}
        />
        <Stat
          label="Sparrate"
          value={fmtEur(planTotal)}
          delta={`pro Monat · ${state.plans.filter((p) => p.active).length} aktive Sparpläne`}
        />
      </div>

      {/* Verlauf + Allokation */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          title="Depot-Verlauf"
          subtitle="Depotwert vs. eingezahltes Kapital"
          className="lg:col-span-3"
        >
          <LineChart
            labels={series.map((p) => p.date)}
            series={[
              {
                name: 'Depotwert',
                color: 'var(--color-chart-1)',
                values: series.map((p) => p.value),
                area: true,
              },
              {
                name: 'Einzahlungen',
                color: 'var(--color-ink-mute)',
                values: series.map((p) => p.invested),
                dashed: true,
              },
            ]}
            formatY={(v) => fmtEur(v)}
            formatLabel={(l) => fmtMonth(l)}
            yMinZero
          />
          <div className="mt-2">
            <LegendRow
              items={[
                { label: 'Depotwert', color: 'var(--color-chart-1)' },
                { label: 'Einzahlungen', color: 'var(--color-ink-mute)', dashed: true },
              ]}
            />
          </div>
        </Card>
        <Card title="Allokation" subtitle="nach Anlageklasse" className="lg:col-span-2">
          <Donut
            slices={assetSlices}
            centerLabel="Gesamt"
            centerValue={fmtEur(summary.value)}
            format={fmtEur}
          />
          <div className="mt-4 border-t border-edge pt-4">
            <div className="mb-2 text-xs font-medium text-ink-soft">Größte Positionen</div>
            <HBarList items={topPositions} format={fmtEur} maxItems={5} />
          </div>
        </Card>
      </div>

      {/* Benchmark-Vergleich */}
      {bench && (
        <Card
          title={`Depot vs. ${MSCI_WORLD.name}`}
          subtitle="dieselben Einzahlungen und Verkäufe, in den Benchmark gespiegelt"
          action={
            <Badge tone={bench.alphaPct >= 0 ? 'gain' : 'loss'}>
              {bench.alphaPct >= 0 ? 'vor dem Markt: ' : 'hinter dem Markt: '}
              {fmtPct(bench.alphaPct, 1, true)} Pkt.
            </Badge>
          }
        >
          <LineChart
            labels={bench.labels}
            series={[
              { name: 'Depot', color: 'var(--color-chart-1)', values: bench.depot, area: true },
              { name: 'Benchmark', color: 'var(--color-chart-3)', values: bench.benchmark },
              {
                name: 'Einzahlungen',
                color: 'var(--color-ink-mute)',
                values: bench.invested,
                dashed: true,
              },
            ]}
            formatY={(v) => fmtEur(v)}
            formatLabel={(l) => fmtMonth(l)}
            yMinZero
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <LegendRow
              items={[
                { label: 'Depot', color: 'var(--color-chart-1)' },
                { label: 'Benchmark', color: 'var(--color-chart-3)' },
                { label: 'Einzahlungen', color: 'var(--color-ink-mute)', dashed: true },
              ]}
            />
            <div className="text-xs text-ink-soft">
              Depot{' '}
              <span className={`tnum font-semibold ${bench.depotReturnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                {fmtPct(bench.depotReturnPct, 1, true)}
              </span>
              {' · '}Benchmark{' '}
              <span className={`tnum font-semibold ${bench.benchReturnPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                {fmtPct(bench.benchReturnPct, 1, true)}
              </span>
              <span className="ml-2 text-ink-mute">({MSCI_WORLD.note})</span>
            </div>
          </div>
        </Card>
      )}

      {/* Top/Flop + Watchlist */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Top & Flop" subtitle="unrealisierte Performance je Position">
          <div className="space-y-1.5">
            {[...top, ...flop].map((p) => (
              <button
                key={p.instrument.id}
                onClick={() => onNavigate('portfolio')}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-raised"
              >
                <span className="w-12 shrink-0 text-xs font-semibold text-ink-mute">
                  {p.instrument.ticker}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {p.instrument.name}
                </span>
                <span className="tnum text-xs text-ink-mute">{fmtEur(p.value)}</span>
                <span
                  className={`tnum w-20 shrink-0 text-right text-sm font-medium ${
                    p.gain >= 0 ? 'text-gain' : 'text-loss'
                  }`}
                >
                  {fmtPct(p.gainPct, 1, true)}
                </span>
              </button>
            ))}
            {summary.positions.length === 0 && (
              <p className="py-6 text-center text-xs text-ink-mute">
                Noch keine Positionen – lege im Portfolio Käufe an.
              </p>
            )}
          </div>
        </Card>
        <Card
          title="Watchlist-Scores"
          subtitle={`Qualitäts-Score für Profil „${state.settings.riskProfile}“`}
          action={
            <button
              onClick={() => onNavigate('screener')}
              className="text-xs font-medium text-aurum hover:underline"
            >
              Zum Screener →
            </button>
          }
        >
          <div className="space-y-3">
            {watch.map(({ inst, score }) => (
              <div key={inst.id} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-xs font-semibold text-ink-mute">
                  {inst.ticker}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="truncate text-ink">{inst.name}</span>
                    <span className="tnum ml-2 font-semibold text-ink">
                      {score!.total} · {score!.grade}
                    </span>
                  </div>
                  <ScoreMeter value={score!.total} />
                </div>
              </div>
            ))}
            {watch.length === 0 && (
              <p className="py-6 text-center text-xs text-ink-mute">
                Markiere Aktien im Screener mit ☆, um sie hier zu sehen.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
