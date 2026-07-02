import { describe, expect, it } from 'vitest'
import { computeLots, computePortfolio, projectSavings } from './calc'
import type { Instrument, Transaction } from './types'

const inst = (id: string, price: number): Instrument => ({
  id,
  ticker: id,
  name: id,
  assetClass: 'stock',
  sector: 'Technologie',
  region: 'USA',
  price,
})

const tx = (
  id: string,
  instrumentId: string,
  type: 'buy' | 'sell',
  date: string,
  shares: number,
  price: number,
  fees = 0,
): Transaction => ({ id, instrumentId, type, date, shares, price, fees })

describe('computeLots', () => {
  it('führt Durchschnittskosten über mehrere Käufe', () => {
    const lots = computeLots([
      tx('1', 'A', 'buy', '2025-01-01', 10, 100),
      tx('2', 'A', 'buy', '2025-02-01', 10, 200),
    ])
    const lot = lots.get('A')!
    expect(lot.shares).toBe(20)
    expect(lot.cost).toBe(3000) // Ø 150
  })

  it('realisiert Gewinn beim Verkauf zum Durchschnittskurs', () => {
    const lots = computeLots([
      tx('1', 'A', 'buy', '2025-01-01', 10, 100),
      tx('2', 'A', 'sell', '2025-03-01', 5, 150),
    ])
    const lot = lots.get('A')!
    expect(lot.shares).toBe(5)
    expect(lot.cost).toBe(500)
    expect(lot.realized).toBe(250)
  })

  it('rechnet Gebühren in die Kostenbasis ein', () => {
    const lots = computeLots([tx('1', 'A', 'buy', '2025-01-01', 10, 100, 10)])
    expect(lots.get('A')!.cost).toBe(1010)
  })
})

describe('computePortfolio', () => {
  it('summiert Wert, Einstand und Gewichte', () => {
    const summary = computePortfolio(
      [inst('A', 120), inst('B', 50)],
      [
        tx('1', 'A', 'buy', '2025-01-01', 10, 100),
        tx('2', 'B', 'buy', '2025-01-02', 20, 50),
      ],
    )
    expect(summary.value).toBe(10 * 120 + 20 * 50) // 2200
    expect(summary.invested).toBe(2000)
    expect(summary.gain).toBe(200)
    const a = summary.positions.find((p) => p.instrument.id === 'A')!
    expect(a.weight).toBeCloseTo(1200 / 2200)
  })

  it('ignoriert vollständig verkaufte Positionen, behält realisierte Gewinne', () => {
    const summary = computePortfolio(
      [inst('A', 120)],
      [
        tx('1', 'A', 'buy', '2025-01-01', 10, 100),
        tx('2', 'A', 'sell', '2025-02-01', 10, 110),
      ],
    )
    expect(summary.positions).toHaveLength(0)
    expect(summary.realized).toBe(100)
  })
})

describe('projectSavings', () => {
  it('ohne Rendite = reine Einzahlungssumme', () => {
    const proj = projectSavings(1000, 100, 2, 0)
    const last = proj[proj.length - 1]
    expect(last.value).toBe(1000 + 24 * 100)
    expect(last.contributions).toBe(last.value)
  })

  it('mit Rendite liegt der Wert über den Einzahlungen', () => {
    const proj = projectSavings(0, 100, 10, 6)
    const last = proj[proj.length - 1]
    expect(last.contributions).toBe(12000)
    expect(last.value).toBeGreaterThan(15000)
    expect(last.value).toBeLessThan(18000)
  })
})
