// Discounted-Cashflow-Engine: 5–10-Jahres-FCF-Projektion mit linear
// auslaufendem Wachstum, Terminal Value nach Gordon-Growth UND Exit-Multiple,
// dazu eine WACC×Wachstum-Sensitivitätsmatrix.

import type { Instrument } from './types'

export interface DcfInputs {
  /** Umsatz zuletzt, Mrd. EUR */
  revenue0: number
  /** Wachstum im 1. Jahr, % */
  growthStart: number
  /** Wachstum im letzten Projektionsjahr, % (läuft linear dorthin aus) */
  growthEnd: number
  years: number
  /** Free-Cashflow-Marge, % */
  fcfMargin: number
  /** Diskontsatz (WACC), % */
  wacc: number
  /** ewiges Wachstum nach der Projektion, % */
  terminalGrowth: number
  /** Exit-Multiple auf den FCF des letzten Jahres (EV/FCF) */
  exitMultiple: number
  /** Nettoverschuldung, Mrd. EUR (negativ = Netto-Cash) */
  netDebt: number
  /** Aktienanzahl, Mrd. Stück */
  shares: number
  /** aktueller Kurs, EUR */
  price: number
}

export interface DcfYear {
  year: number
  revenue: number
  fcf: number
  discountedFcf: number
}

export interface DcfResult {
  years: DcfYear[]
  pvExplicit: number // Barwert der Projektionsjahre, Mrd.
  tvPerpetuity: number // Terminal Value (Gordon), diskontiert, Mrd.
  tvExitMultiple: number // Terminal Value (Exit-Multiple), diskontiert, Mrd.
  fairValuePerpetuity: number // je Aktie, EUR
  fairValueExit: number // je Aktie, EUR
  fairValue: number // Mittelwert beider Methoden, EUR
  upsidePct: number // Fair Value vs. Kurs
  verdict: 'unterbewertet' | 'fair bewertet' | 'überbewertet'
}

function equityPerShare(ev: number, inputs: DcfInputs): number {
  const equity = ev - inputs.netDebt
  return inputs.shares > 0 ? equity / inputs.shares : 0
}

export function runDcf(inputs: DcfInputs): DcfResult {
  const { years, revenue0, growthStart, growthEnd, fcfMargin, wacc, terminalGrowth } = inputs
  const r = wacc / 100
  const g = terminalGrowth / 100

  const rows: DcfYear[] = []
  let revenue = revenue0
  let pvExplicit = 0
  for (let y = 1; y <= years; y++) {
    const t = years > 1 ? (y - 1) / (years - 1) : 0
    const growth = (growthStart + (growthEnd - growthStart) * t) / 100
    revenue = revenue * (1 + growth)
    const fcf = revenue * (fcfMargin / 100)
    const discounted = fcf / Math.pow(1 + r, y)
    pvExplicit += discounted
    rows.push({ year: y, revenue, fcf, discountedFcf: discounted })
  }

  const lastFcf = rows[rows.length - 1]?.fcf ?? 0
  const discountLast = Math.pow(1 + r, years)

  // Gordon-Growth nur definiert, wenn WACC > ewiges Wachstum
  const tvPerpetuity = r > g ? (lastFcf * (1 + g)) / (r - g) / discountLast : NaN
  const tvExitMultiple = (lastFcf * inputs.exitMultiple) / discountLast

  const fairValuePerpetuity = Number.isFinite(tvPerpetuity)
    ? equityPerShare(pvExplicit + tvPerpetuity, inputs)
    : NaN
  const fairValueExit = equityPerShare(pvExplicit + tvExitMultiple, inputs)

  const candidates = [fairValuePerpetuity, fairValueExit].filter((v) => Number.isFinite(v))
  const fairValue =
    candidates.length > 0 ? candidates.reduce((s, v) => s + v, 0) / candidates.length : 0

  const upsidePct = inputs.price > 0 ? ((fairValue - inputs.price) / inputs.price) * 100 : 0
  const verdict =
    upsidePct > 15 ? 'unterbewertet' : upsidePct < -15 ? 'überbewertet' : 'fair bewertet'

  return {
    years: rows,
    pvExplicit,
    tvPerpetuity,
    tvExitMultiple,
    fairValuePerpetuity,
    fairValueExit,
    fairValue,
    upsidePct,
    verdict,
  }
}

export interface SensitivityCell {
  wacc: number
  terminalGrowth: number
  fairValue: number
  upsidePct: number
}

/** Fair Value (Gordon-Methode) über ein Raster aus WACC × ewigem Wachstum. */
export function sensitivity(inputs: DcfInputs): SensitivityCell[][] {
  const waccSteps = [-2, -1, 0, 1, 2].map((d) => inputs.wacc + d)
  const growthSteps = [-1, -0.5, 0, 0.5, 1].map((d) => inputs.terminalGrowth + d)
  return waccSteps.map((w) =>
    growthSteps.map((tg) => {
      const res = runDcf({ ...inputs, wacc: w, terminalGrowth: tg, exitMultiple: 0 })
      const fv = Number.isFinite(res.fairValuePerpetuity) ? res.fairValuePerpetuity : NaN
      return {
        wacc: w,
        terminalGrowth: tg,
        fairValue: fv,
        upsidePct:
          Number.isFinite(fv) && inputs.price > 0
            ? ((fv - inputs.price) / inputs.price) * 100
            : NaN,
      }
    }),
  )
}

/** Sinnvolle Startwerte aus den Screener-Kennzahlen eines Instruments ableiten. */
export function defaultInputsFor(instrument: Instrument | null): DcfInputs {
  const m = instrument?.metrics
  const price = instrument?.price ?? 100
  const marketCap = m?.marketCapB ?? 100
  const revenue0 = m?.ps && m.ps > 0 ? marketCap / m.ps : marketCap * 0.4
  const growth = m?.revenueGrowth5y ?? 8
  return {
    revenue0: round1(revenue0),
    growthStart: round1(Math.min(growth, 35)),
    growthEnd: round1(Math.min(Math.max(growth * 0.45, 2), 12)),
    years: 5,
    fcfMargin: round1(m?.fcfMargin ?? 15),
    wacc: 9,
    terminalGrowth: 2.5,
    exitMultiple: 22,
    netDebt: 0,
    shares: price > 0 ? round2(marketCap / price) : 1,
    price,
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
function round2(v: number): number {
  return Math.round(v * 100) / 100
}
