import { describe, expect, it } from 'vitest'
import { buildDividendCalendar } from './dividends'
import { normalizeTargets, planFreshMoney, planRebalance } from './rebalance'
import { buildTaxReport, effectiveTaxRatePct, realizedEvents } from './tax'
import { applyMetricsImport, extractJsonArray } from './aiImport'
import { DEFAULT_SETTINGS } from './seed'
import type { Instrument, Position, Transaction } from './types'

const inst = (id: string, price: number, cls: 'stock' | 'etf' = 'stock', acc = false): Instrument => ({
  id,
  ticker: id,
  name: id,
  assetClass: cls,
  sector: 'Technologie',
  region: 'USA',
  price,
  etf: cls === 'etf' ? { accumulating: acc } : undefined,
})

const pos = (instrument: Instrument, shares: number, avgCost: number): Position => ({
  instrument,
  shares,
  invested: shares * avgCost,
  avgCost,
  value: shares * instrument.price,
  gain: shares * (instrument.price - avgCost),
  gainPct: ((instrument.price - avgCost) / avgCost) * 100,
  realized: 0,
  weight: 0,
})

describe('effectiveTaxRatePct', () => {
  it('ohne Kirchensteuer 26,375 %', () => {
    expect(effectiveTaxRatePct(0)).toBeCloseTo(26.375, 3)
  })
  it('mit 9 % Kirchensteuer ~27,99 %', () => {
    expect(effectiveTaxRatePct(9)).toBeGreaterThan(27.9)
    expect(effectiveTaxRatePct(9)).toBeLessThan(28.1)
  })
})

describe('realizedEvents', () => {
  it('ordnet Gewinne dem richtigen Topf zu', () => {
    const txs: Transaction[] = [
      { id: '1', instrumentId: 'A', type: 'buy', date: '2026-01-05', shares: 10, price: 100 },
      { id: '2', instrumentId: 'A', type: 'sell', date: '2026-03-01', shares: 5, price: 130 },
    ]
    const events = realizedEvents(txs, [inst('A', 130)])
    expect(events).toHaveLength(1)
    expect(events[0].gain).toBe(150)
    expect(events[0].assetClass).toBe('stock')
  })
})

describe('buildTaxReport', () => {
  const settings = { ...DEFAULT_SETTINGS, taxAllowance: 1000, taxAllowanceUsedElsewhere: 0 }

  it('Teilfreistellung: ETF-Gewinne nur zu 70 % steuerpflichtig', () => {
    const etf = inst('E', 120, 'etf')
    const txs: Transaction[] = [
      { id: '1', instrumentId: 'E', type: 'buy', date: '2026-01-05', shares: 100, price: 100 },
      { id: '2', instrumentId: 'E', type: 'sell', date: '2026-02-01', shares: 100, price: 120 },
    ]
    const report = buildTaxReport([], txs, [etf], settings, 2026)
    expect(report.fondsGainsRaw).toBe(2000)
    expect(report.fondsGainsTaxable).toBeCloseTo(1400, 5)
  })

  it('Aktienverluste landen im Verlusttopf und mindern sonstige Erträge nicht', () => {
    const a = inst('A', 50)
    const txs: Transaction[] = [
      { id: '1', instrumentId: 'A', type: 'buy', date: '2026-01-05', shares: 10, price: 100 },
      { id: '2', instrumentId: 'A', type: 'sell', date: '2026-02-01', shares: 10, price: 50 },
    ]
    const divStock = inst('D', 100)
    divStock.dividend = { perShare: 5, months: [6] }
    const positions = [pos(divStock, 100, 80)] // 500 € Dividende erwartet
    const report = buildTaxReport(positions, txs, [a, divStock], settings, 2026, { asOfMonth: 0 })
    expect(report.aktienLossCarry).toBe(500)
    expect(report.taxableBeforeAllowance).toBeCloseTo(500, 5) // Dividende bleibt voll
  })

  it('Pauschbetrag deckelt die Steuer auf 0', () => {
    const divStock = inst('D', 100)
    divStock.dividend = { perShare: 5, months: [6] }
    const report = buildTaxReport([pos(divStock, 100, 80)], [], [divStock], settings, 2026, {
      asOfMonth: 0,
    })
    expect(report.taxableAfterAllowance).toBe(0)
    expect(report.estimatedTax).toBe(0)
    expect(report.allowanceRemaining).toBe(500)
  })

  it('Ist-Dividenden ersetzen die Erwartung vergangener Monate', () => {
    const divStock = inst('D', 100)
    divStock.dividend = { perShare: 4, months: [3, 9] } // 2 Zahlungen à 200 €
    const positions = [pos(divStock, 100, 80)]
    // Stand Juli: März wurde tatsächlich mit 180 € gezahlt, September steht aus (200 €)
    const report = buildTaxReport(positions, [], [divStock], settings, 2026, {
      asOfMonth: 7,
      receipts: [{ id: 'r1', instrumentId: 'D', date: '2026-03-15', amount: 180 }],
    })
    expect(report.dividendsStocks).toBeCloseTo(380, 5)
  })

  it('Vorabpauschale nur für thesaurierende ETFs', () => {
    const acc = inst('ACC', 100, 'etf', true)
    const dist = inst('DIST', 100, 'etf', false)
    const report = buildTaxReport(
      [pos(acc, 100, 100), pos(dist, 100, 100)],
      [],
      [acc, dist],
      { ...settings, basiszinsPct: 2.5 },
      2026,
    )
    // 10.000 € × 2,5 % × 0,7 = 175 € Basisertrag, steuerlich 122,50 €
    expect(report.vorabRaw).toBeCloseTo(175, 2)
    expect(report.vorabTaxable).toBeCloseTo(122.5, 2)
  })
})

describe('rebalance', () => {
  const a = pos(inst('A', 100), 60, 100) // 6.000
  const b = pos(inst('B', 100), 40, 100) // 4.000

  it('Umschichten gleicht auf Zielgewichte aus', () => {
    const plan = planRebalance([a, b], { A: 50, B: 50 })
    const rowA = plan.rows.find((r) => r.position.instrument.id === 'A')!
    expect(rowA.trade).toBeCloseTo(-1000, 5)
    expect(plan.totalBuys).toBeCloseTo(1000, 5)
    expect(plan.totalSells).toBeCloseTo(1000, 5)
  })

  it('Frisches Geld kauft nur Untergewichtete, keine Verkäufe', () => {
    const plan = planFreshMoney([a, b], { A: 50, B: 50 }, 2000)
    const rowB = plan.rows.find((r) => r.position.instrument.id === 'B')!
    expect(plan.totalSells).toBe(0)
    expect(rowB.trade).toBeCloseTo(2000, 5) // ganze Summe in B (Ziel 6.000)
  })

  it('normalizeTargets skaliert auf 100', () => {
    const n = normalizeTargets({ A: 30, B: 30 })
    expect(n.A + n.B).toBeCloseTo(100, 1)
  })
})

describe('dividends', () => {
  it('verteilt die Jahresdividende auf die Zahlungsmonate', () => {
    const d = inst('D', 100)
    d.dividend = { perShare: 4, months: [3, 6, 9, 12] }
    const cal = buildDividendCalendar([pos(d, 10, 80)])
    expect(cal.yearTotal).toBeCloseTo(40, 5)
    expect(cal.monthTotals[2]).toBeCloseTo(10, 5) // März
    expect(cal.monthTotals[0]).toBe(0)
    expect(cal.yieldOnCostPct).toBeCloseTo(5, 5) // 40 / 800
  })
})

describe('simulateBuy', () => {
  it('zeigt die Gewichts- und Dividendenwirkung eines Kaufs', async () => {
    const { simulateBuy } = await import('./simulate')
    const a = inst('A', 100)
    const b = inst('B', 100)
    b.dividend = { perShare: 4, months: [6, 12] }
    const txs: Transaction[] = [
      { id: '1', instrumentId: 'A', type: 'buy', date: '2026-01-05', shares: 90, price: 100 },
      { id: '2', instrumentId: 'B', type: 'buy', date: '2026-01-05', shares: 10, price: 100 },
    ]
    const result = simulateBuy([a, b], txs, 'B', 1000)!
    expect(result).not.toBeNull()
    expect(result.shares).toBeCloseTo(10, 5)
    expect(result.before.positionWeightPct).toBeCloseTo(10, 3)
    expect(result.after.positionWeightPct).toBeCloseTo(2000 / 11000 * 100, 3)
    // Dividende steigt um 10 Stück × 4 € = 40 €
    expect(result.after.annualDividend - result.before.annualDividend).toBeCloseTo(40, 5)
    expect(result.after.totalValue).toBeCloseTo(11000, 5)
  })

  it('null bei ungültigem Betrag', async () => {
    const { simulateBuy } = await import('./simulate')
    expect(simulateBuy([inst('A', 100)], [], 'A', 0)).toBeNull()
  })
})

describe('receivedByMonth', () => {
  it('summiert Zahlungen je Monat im Jahr', async () => {
    const { receivedByMonth } = await import('./dividends')
    const r = receivedByMonth(
      [
        { id: '1', instrumentId: 'A', date: '2026-03-10', amount: 50 },
        { id: '2', instrumentId: 'A', date: '2026-03-25', amount: 25 },
        { id: '3', instrumentId: 'A', date: '2025-03-25', amount: 99 }, // anderes Jahr
      ],
      2026,
    )
    expect(r.monthTotals[2]).toBe(75)
    expect(r.total).toBe(75)
  })
})

describe('aiImport', () => {
  it('extrahiert JSON auch aus Codeblöcken', () => {
    const arr = extractJsonArray('Hier ist das Ergebnis:\n```json\n[{"ticker":"AAPL"}]\n```')
    expect(arr).toEqual([{ ticker: 'AAPL' }])
  })

  it('aktualisiert bestehende Titel und legt neue an', () => {
    const existing = inst('AAPL', 100)
    const answer = JSON.stringify([
      { ticker: 'AAPL', priceEur: 190, pe: 30.5 },
      { ticker: 'NEU', name: 'Neu AG', priceEur: 50, sector: 'Industrie', region: 'Deutschland' },
      { ticker: 'KAPUTT' }, // ohne Name/Kurs → skip
    ])
    const result = applyMetricsImport(answer, [existing])
    expect(result.error).toBeUndefined()
    expect(result.updated).toHaveLength(1)
    expect(result.updated[0].price).toBe(190)
    expect(result.updated[0].metrics?.pe).toBe(30.5)
    expect(result.created).toHaveLength(1)
    expect(result.created[0].sector).toBe('Industrie')
    expect(result.skipped).toHaveLength(1)
  })
})
