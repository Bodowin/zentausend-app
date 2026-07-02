import { describe, expect, it } from 'vitest'
import { runDcf, sensitivity, type DcfInputs } from './dcf'
import { scoreStock } from './score'

const base: DcfInputs = {
  revenue0: 100,
  growthStart: 10,
  growthEnd: 4,
  years: 5,
  fcfMargin: 20,
  wacc: 9,
  terminalGrowth: 2.5,
  exitMultiple: 20,
  netDebt: 0,
  shares: 1,
  price: 300,
}

describe('runDcf', () => {
  it('diskontiert Cashflows und liefert plausiblen Fair Value', () => {
    const r = runDcf(base)
    expect(r.years).toHaveLength(5)
    // FCF Jahr 1: 100 * 1,10 * 0,20 = 22
    expect(r.years[0].fcf).toBeCloseTo(22, 5)
    expect(r.years[0].discountedFcf).toBeCloseTo(22 / 1.09, 5)
    expect(r.fairValue).toBeGreaterThan(100)
    expect(Number.isFinite(r.fairValuePerpetuity)).toBe(true)
  })

  it('höherer WACC senkt den Fair Value', () => {
    const low = runDcf({ ...base, wacc: 7 })
    const high = runDcf({ ...base, wacc: 12 })
    expect(low.fairValue).toBeGreaterThan(high.fairValue)
  })

  it('Gordon-Methode undefiniert wenn Wachstum >= WACC', () => {
    const r = runDcf({ ...base, terminalGrowth: 9.5 })
    expect(Number.isFinite(r.fairValuePerpetuity)).toBe(false)
    // Exit-Multiple-Methode trägt dann allein
    expect(Number.isFinite(r.fairValue)).toBe(true)
  })

  it('Urteil folgt dem Upside', () => {
    expect(runDcf({ ...base, price: 100 }).verdict).toBe('unterbewertet')
    expect(runDcf({ ...base, price: 10000 }).verdict).toBe('überbewertet')
  })
})

describe('sensitivity', () => {
  it('liefert 5×5-Matrix mit monotonem WACC-Effekt', () => {
    const m = sensitivity(base)
    expect(m).toHaveLength(5)
    expect(m[0]).toHaveLength(5)
    // gleiche Spalte (g fix): kleinerer WACC → höherer Fair Value
    expect(m[0][2].fairValue).toBeGreaterThan(m[4][2].fairValue)
  })
})

describe('scoreStock', () => {
  it('starke Qualitätsaktie schlägt schwache', () => {
    const strong = scoreStock(
      {
        pe: 18, peg: 1.2, ps: 4, revenueGrowth5y: 15, epsGrowth5y: 18,
        grossMargin: 65, operatingMargin: 35, fcfMargin: 28, roe: 30, roic: 25,
        debtToEquity: 0.3, netDebtToEbitda: 0.2, interestCoverage: 25,
        dividendYield: 1.5, payoutRatio: 35, dividendGrowthYears: 12, moat: 3,
      },
      'ausgewogen',
    )
    const weak = scoreStock(
      {
        pe: 40, peg: 4, ps: 12, revenueGrowth5y: 1, epsGrowth5y: 0,
        grossMargin: 20, operatingMargin: 4, fcfMargin: 1, roe: 4, roic: 3,
        debtToEquity: 2.8, netDebtToEbitda: 4.5, interestCoverage: 1.5,
        dividendYield: 0, moat: 0,
      },
      'ausgewogen',
    )
    expect(strong.total).toBeGreaterThan(70)
    expect(weak.total).toBeLessThan(30)
    expect(strong.grade < weak.grade || strong.grade.startsWith('A')).toBe(true)
  })

  it('fehlende Kennzahlen werden übersprungen statt bestraft', () => {
    const bankish = scoreStock({ pe: 12, roe: 15, dividendYield: 3, payoutRatio: 40 }, 'defensiv')
    expect(bankish.balance).toBeNull()
    expect(bankish.total).toBeGreaterThan(40)
  })
})
