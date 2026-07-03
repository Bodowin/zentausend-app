// Aktien-Screener: sortier- und filterbare Kennzahlen-Tabelle mit
// Qualitäts-Score, Detail-Ansicht (Score-Zerlegung + alle Kennzahlen),
// Kennzahlen-Editor und Side-by-Side-Vergleich (Radar) für bis zu 4 Titel.

import { useMemo, useState } from 'react'
import { fmtEurExact, fmtNum, fmtPct, uid } from '../lib/format'
import { MOAT_LABELS, SCORE_AXES, scoreInstrument, type ScoreBreakdown } from '../lib/score'
import type { Instrument, Moat, Region, Sector, StockMetrics } from '../lib/types'
import { useCockpit } from '../state'
import { CHART_COLORS, Radar, ScoreMeter } from './charts'
import { HistoryChart } from './HistoryChart'
import { SimulatorModal } from './SimulatorModal'
import { Badge, Button, Card, Field, inputClass, Modal, NumberInput, selectCompactClass } from './ui'

const SECTORS: Sector[] = [
  'Technologie', 'Kommunikation', 'Gesundheit', 'Finanzen', 'Konsum (zyklisch)',
  'Konsum (defensiv)', 'Industrie', 'Energie', 'Versorger', 'Rohstoffe',
  'Immobilien', 'Diversifiziert',
]
const REGIONS: Region[] = ['USA', 'Europa', 'Deutschland', 'Welt', 'Schwellenländer', 'Asien', 'Andere']

type SortKey = 'score' | 'name' | 'pe' | 'growth' | 'margin' | 'dividend' | 'marketCap'

interface Row {
  inst: Instrument
  score: ScoreBreakdown | null
}

export function ScreenerScreen({ onOpenDcf }: { onOpenDcf: (id: string) => void }) {
  const { state, toggleWatch, upsertInstrument, deleteInstrument, notify } = useCockpit()
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState('')
  const [region, setRegion] = useState('')
  const [onlyWatch, setOnlyWatch] = useState(false)
  const [maxPe, setMaxPe] = useState('')
  const [minDiv, setMinDiv] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDesc, setSortDesc] = useState(true)
  const [detail, setDetail] = useState<Instrument | null>(null)
  const [editing, setEditing] = useState<Instrument | null>(null)
  const [isNewEdit, setIsNewEdit] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [simulateId, setSimulateId] = useState<string | null>(null)

  const rows: Row[] = useMemo(() => {
    const profile = state.settings.riskProfile
    return state.instruments
      .filter((i) => i.assetClass === 'stock')
      .map((inst) => ({ inst, score: scoreInstrument(inst, profile) }))
  }, [state.instruments, state.settings.riskProfile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows.filter(({ inst }) => {
      if (q && !`${inst.name} ${inst.ticker}`.toLowerCase().includes(q)) return false
      if (sector && inst.sector !== sector) return false
      if (region && inst.region !== region) return false
      if (onlyWatch && !state.watchlist.includes(inst.id)) return false
      const pe = inst.metrics?.pe
      if (maxPe && pe !== undefined && pe > parseFloat(maxPe)) return false
      if (maxPe && pe === undefined) return false
      const dy = inst.metrics?.dividendYield ?? 0
      if (minDiv && dy < parseFloat(minDiv)) return false
      return true
    })
    const dir = sortDesc ? -1 : 1
    const val = (r: Row): number | string => {
      switch (sortKey) {
        case 'score': return r.score?.total ?? -1
        case 'name': return r.inst.name.toLowerCase()
        case 'pe': return r.inst.metrics?.pe ?? Number.POSITIVE_INFINITY * dir
        case 'growth': return r.inst.metrics?.revenueGrowth5y ?? -999
        case 'margin': return r.inst.metrics?.operatingMargin ?? -999
        case 'dividend': return r.inst.metrics?.dividendYield ?? -1
        case 'marketCap': return r.inst.metrics?.marketCapB ?? -1
      }
    }
    out = out.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'string' || typeof vb === 'string')
        return dir * String(va).localeCompare(String(vb))
      return dir * ((va as number) - (vb as number))
    })
    return out
  }, [rows, query, sector, region, onlyWatch, maxPe, minDiv, sortKey, sortDesc, state.watchlist])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((d) => !d)
    else {
      setSortKey(key)
      setSortDesc(key !== 'name' && key !== 'pe')
    }
  }

  const toggleCompare = (id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id)
      if (ids.length >= 4) {
        notify('Maximal 4 Titel im Vergleich.', 'error')
        return ids
      }
      return [...ids, id]
    })
  }

  const th = (label: string, key: SortKey, align: 'left' | 'right' = 'right') => (
    <th
      className={`cursor-pointer select-none pb-2 font-medium hover:text-ink ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey === key && <span className="ml-0.5 text-aurum">{sortDesc ? '▾' : '▴'}</span>}
    </th>
  )

  return (
    <div className="space-y-4">
      {/* Filterzeile – gilt für die ganze Tabelle */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <input
              className={inputClass}
              placeholder="Suche: Name oder Ticker…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className={selectCompactClass} value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Alle Sektoren</option>
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className={selectCompactClass} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Alle Regionen</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <div className="w-24">
            <input
              className={`${inputClass} tnum`}
              placeholder="max. KGV"
              inputMode="decimal"
              value={maxPe}
              onChange={(e) => setMaxPe(e.target.value)}
            />
          </div>
          <div className="w-24">
            <input
              className={`${inputClass} tnum`}
              placeholder="min. Div %"
              inputMode="decimal"
              value={minDiv}
              onChange={(e) => setMinDiv(e.target.value)}
            />
          </div>
          <label className="flex h-9 items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" checked={onlyWatch} onChange={(e) => setOnlyWatch(e.target.checked)} />
            nur ☆ Watchlist
          </label>
          <Button
            small
            variant="ghost"
            onClick={() => {
              setIsNewEdit(true)
              setEditing(emptyStock())
            }}
          >
            + Aktie anlegen
          </Button>
        </div>
      </Card>

      <Card
        title={`Screener · ${filtered.length} Titel`}
        subtitle={`Score gewichtet für Profil „${state.settings.riskProfile}“ · Kennzahlen editierbar (Beispieldaten)`}
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-edge text-[11px] uppercase tracking-wide text-ink-mute">
                <th className="w-8 pb-2" />
                {th('Titel', 'name', 'left')}
                {th('Mkt-Kap', 'marketCap')}
                {th('KGV', 'pe')}
                {th('Wachstum 5J', 'growth')}
                {th('Op. Marge', 'margin')}
                {th('Div.', 'dividend')}
                <th className="pb-2 text-right font-medium">Moat</th>
                {th('Score', 'score')}
                <th className="w-14 pb-2 text-right font-medium">Vgl.</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {filtered.map(({ inst, score }) => {
                const m = inst.metrics
                const watched = state.watchlist.includes(inst.id)
                return (
                  <tr
                    key={inst.id}
                    className="cursor-pointer border-b border-edge/50 last:border-0 hover:bg-raised/60"
                    onClick={() => setDetail(inst)}
                  >
                    <td className="py-2.5 pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleWatch(inst.id)
                        }}
                        className={watched ? 'text-aurum' : 'text-ink-mute hover:text-aurum'}
                        aria-label="Watchlist umschalten"
                      >
                        {watched ? '★' : '☆'}
                      </button>
                    </td>
                    <td className="py-2.5 pr-2" style={{ fontVariantNumeric: 'normal' }}>
                      <div className="font-medium text-ink">{inst.name}</div>
                      <div className="text-[11px] text-ink-mute">
                        {inst.ticker} · {inst.sector}
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-ink-soft">
                      {m?.marketCapB ? `${fmtNum(m.marketCapB, 0)} Mrd.` : '–'}
                    </td>
                    <td className="py-2.5 text-right text-ink">{m?.pe ? fmtNum(m.pe, 1) : '–'}</td>
                    <td className="py-2.5 text-right">
                      <span className={(m?.revenueGrowth5y ?? 0) >= 10 ? 'text-gain' : 'text-ink-soft'}>
                        {m?.revenueGrowth5y !== undefined ? fmtPct(m.revenueGrowth5y, 0) : '–'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-ink-soft">
                      {m?.operatingMargin !== undefined ? fmtPct(m.operatingMargin, 0) : '–'}
                    </td>
                    <td className="py-2.5 text-right text-ink-soft">
                      {m?.dividendYield ? fmtPct(m.dividendYield, 1) : '–'}
                    </td>
                    <td className="py-2.5 text-right">
                      <MoatDots moat={m?.moat} />
                    </td>
                    <td className="py-2.5 pl-3">
                      {score ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14">
                            <ScoreMeter value={score.total} />
                          </div>
                          <span className="w-10 text-right font-semibold text-ink">
                            {score.total}
                          </span>
                          <span className="w-6 text-right text-xs text-ink-soft">{score.grade}</span>
                        </div>
                      ) : (
                        <span className="text-ink-mute">–</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(inst.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleCompare(inst.id)}
                        aria-label="Zum Vergleich hinzufügen"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vergleichs-Leiste */}
      {compareIds.length > 0 && (
        <div className="sticky bottom-20 z-30 flex items-center justify-between gap-3 rounded-2xl border border-aurum/40 bg-raised px-4 py-3 shadow-xl sm:bottom-4">
          <div className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">{compareIds.length}</span> Titel ausgewählt:{' '}
            {compareIds
              .map((id) => state.instruments.find((i) => i.id === id)?.ticker)
              .filter(Boolean)
              .join(', ')}
          </div>
          <div className="flex gap-2">
            <Button small variant="ghost" onClick={() => setCompareIds([])}>
              Leeren
            </Button>
            <Button small disabled={compareIds.length < 2} onClick={() => setShowCompare(true)}>
              Vergleichen
            </Button>
          </div>
        </div>
      )}

      {detail && (
        <StockDetailModal
          instrument={detail}
          score={scoreInstrument(detail, state.settings.riskProfile)}
          watched={state.watchlist.includes(detail.id)}
          onWatch={() => toggleWatch(detail.id)}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setIsNewEdit(false)
            setEditing(detail)
            setDetail(null)
          }}
          onDcf={() => {
            onOpenDcf(detail.id)
            setDetail(null)
          }}
          onSimulate={() => {
            setSimulateId(detail.id)
            setDetail(null)
          }}
        />
      )}
      {simulateId && (
        <SimulatorModal presetInstrumentId={simulateId} onClose={() => setSimulateId(null)} />
      )}
      {editing && (
        <InstrumentEditor
          instrument={editing}
          isNew={isNewEdit}
          onClose={() => setEditing(null)}
          onSave={(inst) => {
            upsertInstrument(inst)
            setEditing(null)
            notify(`${inst.name} gespeichert.`)
          }}
          onDelete={
            isNewEdit
              ? undefined
              : (id) => {
                  deleteInstrument(id)
                  setEditing(null)
                  notify('Titel inkl. Transaktionen entfernt.', 'error')
                }
          }
        />
      )}
      {showCompare && (
        <CompareModal
          instruments={compareIds
            .map((id) => state.instruments.find((i) => i.id === id))
            .filter((i): i is Instrument => Boolean(i))}
          profile={state.settings.riskProfile}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  )
}

function MoatDots({ moat }: { moat?: Moat }) {
  if (moat === undefined) return <span className="text-ink-mute">–</span>
  return (
    <span title={`Burggraben: ${MOAT_LABELS[moat]}`} className="inline-flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: i <= moat ? 'var(--color-aurum)' : 'var(--color-edge)' }}
        />
      ))}
    </span>
  )
}

// --- Detail-Ansicht ---------------------------------------------------------

function metricRow(label: string, value: string | undefined) {
  return value === undefined ? null : (
    <div className="flex items-baseline justify-between gap-3 border-b border-edge/40 py-1.5 last:border-0">
      <span className="text-xs text-ink-mute">{label}</span>
      <span className="tnum text-sm text-ink">{value}</span>
    </div>
  )
}

function StockDetailModal({
  instrument,
  score,
  watched,
  onWatch,
  onClose,
  onEdit,
  onDcf,
  onSimulate,
}: {
  instrument: Instrument
  score: ScoreBreakdown | null
  watched: boolean
  onWatch: () => void
  onClose: () => void
  onEdit: () => void
  onDcf: () => void
  onSimulate: () => void
}) {
  const m = instrument.metrics
  const opt = (v: number | undefined, fmt: (x: number) => string) =>
    v === undefined ? undefined : fmt(v)
  return (
    <Modal title={`${instrument.name} (${instrument.ticker})`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="aurum">{instrument.sector}</Badge>
        <Badge>{instrument.region}</Badge>
        <Badge>Kurs {fmtEurExact(instrument.price)}</Badge>
        {m?.moat !== undefined && <Badge>Moat: {MOAT_LABELS[m.moat]}</Badge>}
        {m?.asOf && <span className="text-[11px] text-ink-mute">{m.asOf}</span>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
            Score-Zerlegung
          </h3>
          {score ? (
            <div className="space-y-2.5">
              {SCORE_AXES.map((axis) => {
                const v = score[axis.key]
                return (
                  <div key={axis.key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-ink-soft">{axis.label}</span>
                      <span className="tnum text-ink">{v === null ? 'k. A.' : v}</span>
                    </div>
                    <ScoreMeter value={v ?? 0} />
                  </div>
                )
              })}
              <div className="mt-3 flex items-baseline justify-between rounded-xl bg-inset px-3 py-2">
                <span className="text-sm text-ink-soft">Gesamt-Score</span>
                <span className="text-xl font-semibold text-aurum">
                  {score.total} <span className="text-sm">· {score.grade}</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-mute">Keine Kennzahlen hinterlegt.</p>
          )}
          {m?.notes && (
            <p className="mt-3 rounded-xl bg-inset px-3 py-2 text-xs text-ink-soft">💡 {m.notes}</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
            Kennzahlen
          </h3>
          {metricRow('Marktkapitalisierung', opt(m?.marketCapB, (v) => `${fmtNum(v, 0)} Mrd. €`))}
          {metricRow('KGV / KGV erwartet', m?.pe !== undefined ? `${fmtNum(m.pe, 1)} / ${m.forwardPe !== undefined ? fmtNum(m.forwardPe, 1) : '–'}` : undefined)}
          {metricRow('KUV', opt(m?.ps, (v) => fmtNum(v, 1)))}
          {metricRow('PEG', opt(m?.peg, (v) => fmtNum(v, 1)))}
          {metricRow('Umsatzwachstum 5J p. a.', opt(m?.revenueGrowth5y, (v) => fmtPct(v, 1)))}
          {metricRow('Gewinnwachstum 5J p. a.', opt(m?.epsGrowth5y, (v) => fmtPct(v, 1)))}
          {metricRow('Bruttomarge', opt(m?.grossMargin, (v) => fmtPct(v, 1)))}
          {metricRow('Operative Marge', opt(m?.operatingMargin, (v) => fmtPct(v, 1)))}
          {metricRow('FCF-Marge', opt(m?.fcfMargin, (v) => fmtPct(v, 1)))}
          {metricRow('ROE / ROIC', m?.roe !== undefined || m?.roic !== undefined ? `${m?.roe !== undefined ? fmtPct(m.roe, 0) : '–'} / ${m?.roic !== undefined ? fmtPct(m.roic, 0) : '–'}` : undefined)}
          {metricRow('Debt/Equity', opt(m?.debtToEquity, (v) => fmtNum(v, 2)))}
          {metricRow('Nettoschulden/EBITDA', opt(m?.netDebtToEbitda, (v) => fmtNum(v, 1)))}
          {metricRow('Zinsdeckung', opt(m?.interestCoverage, (v) => fmtNum(v, 0)))}
          {metricRow('Dividendenrendite', opt(m?.dividendYield, (v) => fmtPct(v, 2)))}
          {metricRow('Ausschüttungsquote', opt(m?.payoutRatio, (v) => fmtPct(v, 0)))}
          {metricRow('Dividende erhöht seit', opt(m?.dividendGrowthYears, (v) => `${v} Jahren`))}
          {metricRow('Beta', opt(m?.beta, (v) => fmtNum(v, 2)))}
        </div>
      </div>

      <div className="mt-5 border-t border-edge pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">
          Kurs-Chart
        </h3>
        <HistoryChart instrument={instrument} />
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onWatch}>
          {watched ? '★ Von Watchlist entfernen' : '☆ Auf Watchlist'}
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          Kennzahlen bearbeiten
        </Button>
        <Button variant="ghost" onClick={onSimulate}>
          ⚖ Kauf simulieren
        </Button>
        <Button onClick={onDcf}>DCF-Bewertung →</Button>
      </div>
    </Modal>
  )
}

// --- Vergleich ---------------------------------------------------------------

function CompareModal({
  instruments,
  profile,
  onClose,
}: {
  instruments: Instrument[]
  profile: 'defensiv' | 'ausgewogen' | 'wachstum' | 'aggressiv'
  onClose: () => void
}) {
  const scored = instruments.map((inst, i) => ({
    inst,
    color: CHART_COLORS[i],
    score: scoreInstrument(inst, profile),
  }))
  const row = (
    label: string,
    get: (inst: Instrument) => string,
    highlight?: (inst: Instrument) => number | undefined,
    higherBetter = true,
  ) => {
    const values = highlight ? scored.map(({ inst }) => highlight(inst)) : []
    const definedVals = values.filter((v): v is number => v !== undefined)
    const best =
      definedVals.length > 1
        ? higherBetter
          ? Math.max(...definedVals)
          : Math.min(...definedVals)
        : undefined
    return (
      <tr className="border-b border-edge/40 last:border-0">
        <td className="py-2 pr-3 text-xs text-ink-mute">{label}</td>
        {scored.map(({ inst }, i) => (
          <td
            key={inst.id}
            className={`tnum py-2 text-right text-sm ${
              best !== undefined && values[i] === best ? 'font-semibold text-gain' : 'text-ink'
            }`}
          >
            {get(inst)}
          </td>
        ))}
      </tr>
    )
  }
  const f = (v: number | undefined, fmt: (x: number) => string) => (v === undefined ? '–' : fmt(v))
  return (
    <Modal title="Aktien-Vergleich" onClose={onClose} wide>
      <Radar
        axes={SCORE_AXES.map((a) => a.label)}
        series={scored.map(({ inst, color, score }) => ({
          name: inst.ticker,
          color,
          values: SCORE_AXES.map((a) => score?.[a.key] ?? 0),
        }))}
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-edge text-right text-xs text-ink-soft">
              <th className="pb-2 text-left font-medium text-ink-mute">Kennzahl</th>
              {scored.map(({ inst, color }) => (
                <th key={inst.id} className="pb-2 pl-3 font-semibold">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                  {inst.ticker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row('Score gesamt', (i) => String(scoreInstrument(i, profile)?.total ?? '–'), (i) => scoreInstrument(i, profile)?.total)}
            {row('KGV', (i) => f(i.metrics?.pe, (v) => fmtNum(v, 1)), (i) => i.metrics?.pe, false)}
            {row('PEG', (i) => f(i.metrics?.peg, (v) => fmtNum(v, 1)), (i) => i.metrics?.peg, false)}
            {row('Umsatzwachstum 5J', (i) => f(i.metrics?.revenueGrowth5y, (v) => fmtPct(v, 0)), (i) => i.metrics?.revenueGrowth5y)}
            {row('Op. Marge', (i) => f(i.metrics?.operatingMargin, (v) => fmtPct(v, 0)), (i) => i.metrics?.operatingMargin)}
            {row('FCF-Marge', (i) => f(i.metrics?.fcfMargin, (v) => fmtPct(v, 0)), (i) => i.metrics?.fcfMargin)}
            {row('ROIC', (i) => f(i.metrics?.roic, (v) => fmtPct(v, 0)), (i) => i.metrics?.roic)}
            {row('Debt/Equity', (i) => f(i.metrics?.debtToEquity, (v) => fmtNum(v, 2)), (i) => i.metrics?.debtToEquity, false)}
            {row('Dividendenrendite', (i) => f(i.metrics?.dividendYield, (v) => fmtPct(v, 2)), (i) => i.metrics?.dividendYield)}
            {row('Moat', (i) => (i.metrics?.moat !== undefined ? MOAT_LABELS[i.metrics.moat] : '–'), (i) => i.metrics?.moat)}
            {row('Beta', (i) => f(i.metrics?.beta, (v) => fmtNum(v, 2)), (i) => i.metrics?.beta, false)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-ink-mute">
        Grün = bester Wert der Runde (je Kennzahl). Score gewichtet nach deinem Risikoprofil.
      </p>
    </Modal>
  )
}

// --- Editor -------------------------------------------------------------------

function emptyStock(): Instrument {
  return {
    id: uid(),
    ticker: '',
    name: '',
    assetClass: 'stock',
    sector: 'Technologie',
    region: 'USA',
    price: 100,
    quoteCurrency: 'USD',
    metrics: { moat: 1, asOf: 'eigene Daten' },
  }
}

function InstrumentEditor({
  instrument,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  instrument: Instrument
  isNew: boolean
  onClose: () => void
  onSave: (inst: Instrument) => void
  onDelete?: (id: string) => void
}) {
  const [draft, setDraft] = useState<Instrument>({
    ...instrument,
    metrics: { ...instrument.metrics },
  })
  const setM = (patch: Partial<StockMetrics>) =>
    setDraft((d) => ({ ...d, metrics: { ...d.metrics, ...patch } }))
  const num = (v: number) => (Number.isFinite(v) ? v : undefined)

  const numField = (label: string, key: keyof StockMetrics, step = 0.1, suffix?: string) => (
    <Field label={label}>
      <NumberInput
        value={(draft.metrics?.[key] as number | undefined) ?? NaN}
        onChange={(v) => setM({ [key]: num(v) } as Partial<StockMetrics>)}
        step={step}
        suffix={suffix}
      />
    </Field>
  )

  return (
    <Modal title={isNew ? 'Aktie anlegen' : `${instrument.name} bearbeiten`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Ticker">
          <input className={inputClass} value={draft.ticker} onChange={(e) => setDraft({ ...draft, ticker: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Kurs (EUR)">
          <NumberInput value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} step={0.01} suffix="€" />
        </Field>
        <Field label="Sektor">
          <select className={inputClass} value={draft.sector} onChange={(e) => setDraft({ ...draft, sector: e.target.value as Sector })}>
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select className={inputClass} value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value as Region })}>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Yahoo-Symbol" hint="für Live-Kurse, z. B. SAP.DE">
          <input className={inputClass} value={draft.yahooSymbol ?? ''} onChange={(e) => setDraft({ ...draft, yahooSymbol: e.target.value || undefined })} />
        </Field>
        <Field label="Handelswährung">
          <select
            className={inputClass}
            value={draft.quoteCurrency ?? 'EUR'}
            onChange={(e) => setDraft({ ...draft, quoteCurrency: e.target.value as Instrument['quoteCurrency'] })}
          >
            {['EUR', 'USD', 'CHF', 'DKK', 'GBP'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Burggraben (Moat)">
          <select
            className={inputClass}
            value={draft.metrics?.moat ?? 0}
            onChange={(e) => setM({ moat: parseInt(e.target.value, 10) as Moat })}
          >
            {MOAT_LABELS.map((l, i) => (
              <option key={l} value={i}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {numField('Marktkap. (Mrd. €)', 'marketCapB', 1)}
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-mute">
        Bewertung & Wachstum
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numField('KGV', 'pe')}
        {numField('KGV erwartet', 'forwardPe')}
        {numField('KUV', 'ps')}
        {numField('PEG', 'peg')}
        {numField('Umsatz-Wachstum 5J', 'revenueGrowth5y', 0.5, '%')}
        {numField('EPS-Wachstum 5J', 'epsGrowth5y', 0.5, '%')}
        {numField('Beta', 'beta', 0.05)}
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-mute">
        Profitabilität & Bilanz
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numField('Bruttomarge', 'grossMargin', 0.5, '%')}
        {numField('Op. Marge', 'operatingMargin', 0.5, '%')}
        {numField('FCF-Marge', 'fcfMargin', 0.5, '%')}
        {numField('ROE', 'roe', 0.5, '%')}
        {numField('ROIC', 'roic', 0.5, '%')}
        {numField('Debt/Equity', 'debtToEquity', 0.05)}
        {numField('NetDebt/EBITDA', 'netDebtToEbitda')}
        {numField('Zinsdeckung', 'interestCoverage', 1)}
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-mute">
        Dividende & Notizen
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numField('Dividendenrendite', 'dividendYield', 0.05, '%')}
        {numField('Ausschüttungsquote', 'payoutRatio', 1, '%')}
        {numField('Erhöht seit (Jahre)', 'dividendGrowthYears', 1)}
        <Field label="Datenstand">
          <input className={inputClass} value={draft.metrics?.asOf ?? ''} onChange={(e) => setM({ asOf: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notiz">
          <input className={inputClass} value={draft.metrics?.notes ?? ''} onChange={(e) => setM({ notes: e.target.value || undefined })} />
        </Field>
      </div>

      <div className="mt-5 flex justify-between gap-2">
        {onDelete ? (
          <Button variant="danger" onClick={() => onDelete(draft.id)}>
            Titel löschen
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!draft.name || !draft.ticker || !(draft.price > 0)} onClick={() => onSave(draft)}>
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  )
}
