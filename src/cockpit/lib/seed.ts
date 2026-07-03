// Startdaten des Cockpits: eine gepflegte Kennzahlen-Bibliothek bekannter
// Qualitätsaktien + Standard-ETFs sowie ein Demo-Portfolio, damit alle
// Ansichten sofort „leben“. Alle Kennzahlen sind BEISPIELDATEN (Stand ca.
// Mitte 2025), im Screener editierbar und per Live-Update aktualisierbar.

import type {
  CockpitState,
  DividendInfo,
  Instrument,
  Moat,
  Region,
  Sector,
  SavingsPlan,
  Snapshot,
  StockMetrics,
  Transaction,
} from './types'

const AS_OF = 'Beispieldaten · Stand ca. Mitte 2025'

function stock(
  id: string,
  name: string,
  sector: Sector,
  region: Region,
  price: number,
  yahooSymbol: string,
  quoteCurrency: Instrument['quoteCurrency'],
  m: Omit<StockMetrics, 'asOf'> & { moat: Moat },
): Instrument {
  return {
    id,
    ticker: id,
    name,
    assetClass: 'stock',
    sector,
    region,
    price,
    yahooSymbol,
    quoteCurrency,
    metrics: { ...m, asOf: AS_OF },
  }
}

export const SEED_STOCKS: Instrument[] = [
  stock('AAPL', 'Apple', 'Technologie', 'USA', 185, 'AAPL', 'USD', {
    marketCapB: 2900, pe: 29, forwardPe: 27, ps: 7.4, peg: 2.6,
    revenueGrowth5y: 8, epsGrowth5y: 12, grossMargin: 46, operatingMargin: 31,
    fcfMargin: 26, roe: 150, roic: 55, debtToEquity: 1.5, netDebtToEbitda: 0.5,
    interestCoverage: 25, dividendYield: 0.55, payoutRatio: 15,
    dividendGrowthYears: 13, beta: 1.2, moat: 3,
    notes: 'ROE durch Aktienrückkäufe verzerrt (geringes Eigenkapital).',
  }),
  stock('MSFT', 'Microsoft', 'Technologie', 'USA', 430, 'MSFT', 'USD', {
    marketCapB: 3200, pe: 35, forwardPe: 31, ps: 12.5, peg: 2.3,
    revenueGrowth5y: 14, epsGrowth5y: 16, grossMargin: 69, operatingMargin: 45,
    fcfMargin: 30, roe: 35, roic: 28, debtToEquity: 0.3, netDebtToEbitda: -0.2,
    interestCoverage: 40, dividendYield: 0.7, payoutRatio: 25,
    dividendGrowthYears: 22, beta: 0.9, moat: 3,
  }),
  stock('NVDA', 'Nvidia', 'Technologie', 'USA', 150, 'NVDA', 'USD', {
    marketCapB: 3600, pe: 48, forwardPe: 33, ps: 26, peg: 1.1,
    revenueGrowth5y: 60, epsGrowth5y: 75, grossMargin: 75, operatingMargin: 60,
    fcfMargin: 45, roe: 90, roic: 70, debtToEquity: 0.15, netDebtToEbitda: -1,
    interestCoverage: 100, dividendYield: 0.03, payoutRatio: 1,
    dividendGrowthYears: 2, beta: 1.7, moat: 3,
  }),
  stock('GOOGL', 'Alphabet', 'Kommunikation', 'USA', 160, 'GOOGL', 'USD', {
    marketCapB: 2000, pe: 22, forwardPe: 20, ps: 5.8, peg: 1.5,
    revenueGrowth5y: 15, epsGrowth5y: 20, grossMargin: 58, operatingMargin: 32,
    fcfMargin: 25, roe: 30, roic: 26, debtToEquity: 0.1, netDebtToEbitda: -1,
    interestCoverage: 150, dividendYield: 0.5, payoutRatio: 8,
    dividendGrowthYears: 1, beta: 1.05, moat: 3,
  }),
  stock('AMZN', 'Amazon', 'Konsum (zyklisch)', 'USA', 195, 'AMZN', 'USD', {
    marketCapB: 2100, pe: 33, forwardPe: 28, ps: 3.3, peg: 1.4,
    revenueGrowth5y: 15, epsGrowth5y: 30, grossMargin: 48, operatingMargin: 10,
    fcfMargin: 8, roe: 22, roic: 14, debtToEquity: 0.6, netDebtToEbitda: 0.5,
    interestCoverage: 12, dividendYield: 0, beta: 1.2, moat: 3,
  }),
  stock('META', 'Meta Platforms', 'Kommunikation', 'USA', 640, 'META', 'USD', {
    marketCapB: 1600, pe: 26, forwardPe: 23, ps: 9.5, peg: 1.6,
    revenueGrowth5y: 16, epsGrowth5y: 22, grossMargin: 81, operatingMargin: 40,
    fcfMargin: 32, roe: 35, roic: 27, debtToEquity: 0.3, netDebtToEbitda: -0.5,
    interestCoverage: 40, dividendYield: 0.35, payoutRatio: 8,
    dividendGrowthYears: 1, beta: 1.2, moat: 3,
  }),
  stock('TSLA', 'Tesla', 'Konsum (zyklisch)', 'USA', 290, 'TSLA', 'USD', {
    marketCapB: 900, pe: 160, forwardPe: 90, ps: 9, peg: 5,
    revenueGrowth5y: 25, epsGrowth5y: 20, grossMargin: 18, operatingMargin: 7,
    fcfMargin: 3, roe: 10, roic: 8, debtToEquity: 0.2, netDebtToEbitda: -0.8,
    interestCoverage: 20, dividendYield: 0, beta: 2.1, moat: 2,
    notes: 'Bewertung preist sehr viel Zukunft ein – hohe Schwankung.',
  }),
  stock('AVGO', 'Broadcom', 'Technologie', 'USA', 240, 'AVGO', 'USD', {
    marketCapB: 1100, pe: 38, forwardPe: 28, ps: 17, peg: 1.8,
    revenueGrowth5y: 20, epsGrowth5y: 18, grossMargin: 76, operatingMargin: 45,
    fcfMargin: 40, roe: 28, roic: 15, debtToEquity: 1.0, netDebtToEbitda: 1.5,
    interestCoverage: 8, dividendYield: 1.1, payoutRatio: 45,
    dividendGrowthYears: 14, beta: 1.1, moat: 3,
  }),
  stock('V', 'Visa', 'Finanzen', 'USA', 320, 'V', 'USD', {
    marketCapB: 640, pe: 30, forwardPe: 26, ps: 16, peg: 1.9,
    revenueGrowth5y: 10, epsGrowth5y: 14, grossMargin: 80, operatingMargin: 67,
    fcfMargin: 55, roe: 45, roic: 30, debtToEquity: 0.5, netDebtToEbitda: 0.3,
    interestCoverage: 30, dividendYield: 0.75, payoutRatio: 22,
    dividendGrowthYears: 16, beta: 0.95, moat: 3,
  }),
  stock('MA', 'Mastercard', 'Finanzen', 'USA', 510, 'MA', 'USD', {
    marketCapB: 470, pe: 34, forwardPe: 29, ps: 17, peg: 2.0,
    revenueGrowth5y: 11, epsGrowth5y: 15, grossMargin: 76, operatingMargin: 58,
    fcfMargin: 45, roe: 170, roic: 45, debtToEquity: 1.6, netDebtToEbitda: 0.5,
    interestCoverage: 25, dividendYield: 0.55, payoutRatio: 19,
    dividendGrowthYears: 12, beta: 1.0, moat: 3,
    notes: 'ROE durch Rückkäufe verzerrt.',
  }),
  stock('JNJ', 'Johnson & Johnson', 'Gesundheit', 'USA', 140, 'JNJ', 'USD', {
    marketCapB: 340, pe: 15, forwardPe: 14, ps: 3.9, peg: 2.5,
    revenueGrowth5y: 5, epsGrowth5y: 6, grossMargin: 69, operatingMargin: 26,
    fcfMargin: 22, roe: 27, roic: 15, debtToEquity: 0.5, netDebtToEbitda: 0.5,
    interestCoverage: 20, dividendYield: 3.3, payoutRatio: 48,
    dividendGrowthYears: 62, beta: 0.55, moat: 3,
  }),
  stock('PG', 'Procter & Gamble', 'Konsum (defensiv)', 'USA', 150, 'PG', 'USD', {
    marketCapB: 355, pe: 24, forwardPe: 22, ps: 4.2, peg: 3.3,
    revenueGrowth5y: 4, epsGrowth5y: 7, grossMargin: 51, operatingMargin: 24,
    fcfMargin: 18, roe: 32, roic: 17, debtToEquity: 0.7, netDebtToEbitda: 1.2,
    interestCoverage: 25, dividendYield: 2.6, payoutRatio: 62,
    dividendGrowthYears: 68, beta: 0.45, moat: 3,
  }),
  stock('KO', 'Coca-Cola', 'Konsum (defensiv)', 'USA', 63, 'KO', 'USD', {
    marketCapB: 270, pe: 24, forwardPe: 21, ps: 5.8, peg: 3.0,
    revenueGrowth5y: 6, epsGrowth5y: 7, grossMargin: 61, operatingMargin: 30,
    fcfMargin: 22, roe: 40, roic: 16, debtToEquity: 1.6, netDebtToEbitda: 2.1,
    interestCoverage: 12, dividendYield: 3.0, payoutRatio: 70,
    dividendGrowthYears: 63, beta: 0.6, moat: 3,
  }),
  stock('MCD', "McDonald's", 'Konsum (zyklisch)', 'USA', 270, 'MCD', 'USD', {
    marketCapB: 195, pe: 25, forwardPe: 22, ps: 7.5, peg: 2.8,
    revenueGrowth5y: 4, epsGrowth5y: 8, grossMargin: 57, operatingMargin: 45,
    fcfMargin: 28, roic: 20, netDebtToEbitda: 3.2, interestCoverage: 8,
    dividendYield: 2.5, payoutRatio: 58, dividendGrowthYears: 48,
    beta: 0.7, moat: 3,
    notes: 'Negatives Eigenkapital (Rückkäufe) – ROE/D-E nicht sinnvoll.',
  }),
  stock('COST', 'Costco', 'Konsum (defensiv)', 'USA', 880, 'COST', 'USD', {
    marketCapB: 390, pe: 52, forwardPe: 47, ps: 1.5, peg: 4.5,
    revenueGrowth5y: 10, epsGrowth5y: 13, grossMargin: 12.5, operatingMargin: 3.7,
    fcfMargin: 2.5, roe: 30, roic: 20, debtToEquity: 0.35, netDebtToEbitda: -0.3,
    interestCoverage: 30, dividendYield: 0.5, payoutRatio: 27,
    dividendGrowthYears: 20, beta: 0.8, moat: 3,
    notes: 'Dünne Margen sind Geschäftsmodell (Mitgliedsbeiträge tragen den Gewinn).',
  }),
  stock('JPM', 'JPMorgan Chase', 'Finanzen', 'USA', 250, 'JPM', 'USD', {
    marketCapB: 700, pe: 13.5, forwardPe: 13, ps: 4.3, peg: 2.4,
    revenueGrowth5y: 9, epsGrowth5y: 10, operatingMargin: 42, roe: 16,
    dividendYield: 2.2, payoutRatio: 27, dividendGrowthYears: 14,
    beta: 1.1, moat: 2,
    notes: 'Bank: Margen-/Verschuldungs-Kennzahlen nur eingeschränkt vergleichbar.',
  }),
  stock('XOM', 'ExxonMobil', 'Energie', 'USA', 100, 'XOM', 'USD', {
    marketCapB: 430, pe: 14, forwardPe: 13, ps: 1.3,
    revenueGrowth5y: 6, epsGrowth5y: 15, grossMargin: 32, operatingMargin: 13,
    fcfMargin: 9, roe: 15, roic: 12, debtToEquity: 0.2, netDebtToEbitda: 0.4,
    interestCoverage: 30, dividendYield: 3.6, payoutRatio: 50,
    dividendGrowthYears: 42, beta: 0.9, moat: 1,
    notes: 'Zyklisch: Kennzahlen hängen stark am Ölpreis.',
  }),
  stock('O', 'Realty Income', 'Immobilien', 'USA', 52, 'O', 'USD', {
    marketCapB: 46, pe: 50, ps: 10, revenueGrowth5y: 20, epsGrowth5y: 2,
    operatingMargin: 40, fcfMargin: 75, roe: 2.5, debtToEquity: 0.7,
    netDebtToEbitda: 5.5, interestCoverage: 4.5, dividendYield: 5.8,
    payoutRatio: 75, dividendGrowthYears: 30, beta: 0.8, moat: 2,
    notes: 'REIT: KGV wenig aussagekräftig, AFFO-Payout zählt (Monatszahler).',
  }),
  stock('ASML', 'ASML', 'Technologie', 'Europa', 680, 'ASML.AS', 'EUR', {
    marketCapB: 270, pe: 33, forwardPe: 28, ps: 9.5, peg: 1.6,
    revenueGrowth5y: 18, epsGrowth5y: 22, grossMargin: 51, operatingMargin: 32,
    fcfMargin: 25, roe: 47, roic: 35, debtToEquity: 0.3, netDebtToEbitda: -0.5,
    interestCoverage: 50, dividendYield: 1.0, payoutRatio: 32,
    dividendGrowthYears: 12, beta: 1.3, moat: 3,
    notes: 'Monopol bei EUV-Lithografie.',
  }),
  stock('SAP', 'SAP', 'Technologie', 'Deutschland', 260, 'SAP.DE', 'EUR', {
    marketCapB: 300, pe: 45, forwardPe: 32, ps: 8.5, peg: 2.1,
    revenueGrowth5y: 8, epsGrowth5y: 10, grossMargin: 73, operatingMargin: 27,
    fcfMargin: 18, roe: 13, roic: 11, debtToEquity: 0.2, netDebtToEbitda: 0.2,
    interestCoverage: 25, dividendYield: 0.9, payoutRatio: 40,
    dividendGrowthYears: 10, beta: 0.95, moat: 3,
  }),
  stock('SIE', 'Siemens', 'Industrie', 'Deutschland', 220, 'SIE.DE', 'EUR', {
    marketCapB: 175, pe: 18, forwardPe: 16, ps: 2.3, peg: 1.8,
    revenueGrowth5y: 6, epsGrowth5y: 9, grossMargin: 38, operatingMargin: 15,
    fcfMargin: 11, roe: 17, roic: 12, debtToEquity: 0.9, netDebtToEbitda: 1.2,
    interestCoverage: 10, dividendYield: 2.3, payoutRatio: 42,
    dividendGrowthYears: 8, beta: 1.1, moat: 2,
  }),
  stock('ALV', 'Allianz', 'Finanzen', 'Deutschland', 350, 'ALV.DE', 'EUR', {
    marketCapB: 135, pe: 12, forwardPe: 11, ps: 0.85, peg: 2.0,
    operatingMargin: 11, roe: 16, dividendYield: 4.4, payoutRatio: 55,
    dividendGrowthYears: 10, beta: 0.9, moat: 2,
    notes: 'Versicherer: Bewertung über KGV, Dividende und Solvency.',
  }),
  stock('MC', 'LVMH', 'Konsum (zyklisch)', 'Europa', 480, 'MC.PA', 'EUR', {
    marketCapB: 240, pe: 20, forwardPe: 18, ps: 2.8, peg: 2.5,
    revenueGrowth5y: 9, epsGrowth5y: 10, grossMargin: 68, operatingMargin: 25,
    fcfMargin: 15, roe: 20, roic: 14, debtToEquity: 0.5, netDebtToEbitda: 1.0,
    interestCoverage: 15, dividendYield: 2.7, payoutRatio: 50,
    dividendGrowthYears: 5, beta: 1.1, moat: 3,
  }),
  stock('NOVO', 'Novo Nordisk', 'Gesundheit', 'Europa', 60, 'NOVO-B.CO', 'DKK', {
    marketCapB: 260, pe: 17, forwardPe: 14, ps: 5.5, peg: 1.2,
    revenueGrowth5y: 19, epsGrowth5y: 22, grossMargin: 84, operatingMargin: 44,
    fcfMargin: 30, roe: 80, roic: 60, debtToEquity: 0.5, netDebtToEbitda: 0.3,
    interestCoverage: 50, dividendYield: 2.6, payoutRatio: 50,
    dividendGrowthYears: 9, beta: 1.0, moat: 3,
    notes: 'GLP-1-Führer; Kurs 2025 stark zurückgekommen.',
  }),
  stock('NESN', 'Nestlé', 'Konsum (defensiv)', 'Europa', 82, 'NESN.SW', 'CHF', {
    marketCapB: 210, pe: 19, forwardPe: 17, ps: 2.3, peg: 3.5,
    revenueGrowth5y: 2, epsGrowth5y: 4, grossMargin: 47, operatingMargin: 17,
    fcfMargin: 12, roe: 30, roic: 13, debtToEquity: 1.6, netDebtToEbitda: 2.8,
    interestCoverage: 12, dividendYield: 3.7, payoutRatio: 70,
    dividendGrowthYears: 29, beta: 0.5, moat: 3,
  }),
]

function etf(
  id: string,
  name: string,
  region: Region,
  price: number,
  yahooSymbol: string,
  info: NonNullable<Instrument['etf']>,
  sector: Sector = 'Diversifiziert',
): Instrument {
  return {
    id,
    ticker: id,
    name,
    assetClass: 'etf',
    sector,
    region,
    price,
    yahooSymbol,
    quoteCurrency: 'EUR',
    etf: info,
  }
}

export const SEED_ETFS: Instrument[] = [
  etf('EUNL', 'iShares Core MSCI World', 'Welt', 110, 'EUNL.DE', {
    ter: 0.2, accumulating: true, holdings: 1400, index: 'MSCI World',
  }),
  etf('VWCE', 'Vanguard FTSE All-World', 'Welt', 130, 'VWCE.DE', {
    ter: 0.22, accumulating: true, holdings: 3650, index: 'FTSE All-World',
  }),
  etf('IS3N', 'iShares Core MSCI EM IMI', 'Schwellenländer', 36, 'IS3N.DE', {
    ter: 0.18, accumulating: true, holdings: 3100, index: 'MSCI EM IMI',
  }),
  etf('SXR8', 'iShares Core S&P 500', 'USA', 590, 'SXR8.DE', {
    ter: 0.07, accumulating: true, holdings: 500, index: 'S&P 500',
  }),
  etf('SXRV', 'iShares Nasdaq 100', 'USA', 1150, 'SXRV.DE', {
    ter: 0.33, accumulating: true, holdings: 100, index: 'Nasdaq-100',
  }, 'Technologie'),
  etf('EXSA', 'iShares STOXX Europe 600', 'Europa', 55, 'EXSA.DE', {
    ter: 0.2, accumulating: false, distributionYield: 2.9, holdings: 600,
    index: 'STOXX Europe 600',
  }),
  etf('ISPA', 'iShares STOXX Global Select Dividend 100', 'Welt', 32, 'ISPA.DE', {
    ter: 0.46, accumulating: false, distributionYield: 5.2, holdings: 100,
    index: 'STOXX Global Select Dividend 100',
  }),
]

// --- Dividenden-Profile (EUR je Anteil/Jahr + typische Zahlungsmonate) -------
// Beispieldaten für den Dividenden-Kalender, pro Titel editierbar.

export const SEED_DIVIDENDS: Record<string, DividendInfo> = {
  AAPL: { perShare: 0.95, months: [2, 5, 8, 11] },
  MSFT: { perShare: 3.0, months: [3, 6, 9, 12] },
  NVDA: { perShare: 0.04, months: [3, 6, 9, 12] },
  GOOGL: { perShare: 0.78, months: [3, 6, 9, 12] },
  META: { perShare: 1.95, months: [3, 6, 9, 12] },
  AVGO: { perShare: 2.6, months: [3, 6, 9, 12] },
  V: { perShare: 2.35, months: [3, 6, 9, 12] },
  MA: { perShare: 2.8, months: [2, 5, 8, 11] },
  JNJ: { perShare: 4.6, months: [3, 6, 9, 12] },
  PG: { perShare: 3.9, months: [2, 5, 8, 11] },
  KO: { perShare: 1.9, months: [4, 7, 10, 12] },
  MCD: { perShare: 6.7, months: [3, 6, 9, 12] },
  COST: { perShare: 4.4, months: [2, 5, 8, 11] },
  JPM: { perShare: 5.5, months: [1, 4, 7, 10] },
  XOM: { perShare: 3.6, months: [3, 6, 9, 12] },
  O: { perShare: 3.0, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ASML: { perShare: 6.8, months: [2, 5, 8, 11] },
  SAP: { perShare: 2.35, months: [5] },
  SIE: { perShare: 5.2, months: [2] },
  ALV: { perShare: 15.4, months: [5] },
  MC: { perShare: 13.0, months: [4, 12] },
  NOVO: { perShare: 1.55, months: [3, 8] },
  NESN: { perShare: 3.05, months: [4] },
  EXSA: { perShare: 1.6, months: [3, 6, 9, 12] },
  ISPA: { perShare: 1.65, months: [1, 4, 7, 10] },
}

function withDividends(instruments: Instrument[]): Instrument[] {
  return instruments.map((i) =>
    SEED_DIVIDENDS[i.id] ? { ...i, dividend: SEED_DIVIDENDS[i.id] } : i,
  )
}

// --- Demo-Portfolio ---------------------------------------------------------
// 18 Monate ETF-Sparplan + einige Einzelkäufe, deterministisch erzeugt.

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Monate seit Jan 2025 (0-basiert) → {y, m} */
function monthAt(i: number): { y: number; m: number } {
  return { y: 2025 + Math.floor(i / 12), m: (i % 12) + 1 }
}

const DEMO_MONTHS = 18 // Jan 2025 – Jun 2026

function demoTransactions(): Transaction[] {
  const txs: Transaction[] = []
  // Sparplan-Käufe mit leicht schwankendem, tendenziell steigendem Kurs
  for (let i = 0; i < DEMO_MONTHS; i++) {
    const { y, m } = monthAt(i)
    const eunlPrice = 96 * Math.pow(1.008, i) * (1 + 0.03 * Math.sin(i * 1.1))
    const is3nPrice = 33 * Math.pow(1.004, i) * (1 + 0.04 * Math.sin(i * 0.9 + 1))
    txs.push({
      id: `demo-eunl-${i}`, instrumentId: 'EUNL', type: 'buy', date: iso(y, m, 1),
      shares: round3(300 / eunlPrice), price: round2(eunlPrice), fees: 0, note: 'Sparplan',
    })
    txs.push({
      id: `demo-is3n-${i}`, instrumentId: 'IS3N', type: 'buy', date: iso(y, m, 1),
      shares: round3(100 / is3nPrice), price: round2(is3nPrice), fees: 0, note: 'Sparplan',
    })
  }
  // Einzelkäufe/-verkäufe
  txs.push(
    { id: 'demo-nvda', instrumentId: 'NVDA', type: 'buy', date: '2025-02-14', shares: 12, price: 105, fees: 1 },
    { id: 'demo-aapl', instrumentId: 'AAPL', type: 'buy', date: '2025-03-10', shares: 10, price: 168, fees: 1 },
    { id: 'demo-msft', instrumentId: 'MSFT', type: 'buy', date: '2025-05-06', shares: 5, price: 395, fees: 1 },
    { id: 'demo-alv', instrumentId: 'ALV', type: 'buy', date: '2025-09-15', shares: 8, price: 320, fees: 1 },
    { id: 'demo-novo', instrumentId: 'NOVO', type: 'buy', date: '2025-11-20', shares: 40, price: 78, fees: 1 },
    { id: 'demo-nvda-sell', instrumentId: 'NVDA', type: 'sell', date: '2026-01-12', shares: 4, price: 140, fees: 1, note: 'Teilgewinn mitgenommen' },
    { id: 'demo-asml', instrumentId: 'ASML', type: 'buy', date: '2026-02-02', shares: 3, price: 640, fees: 1 },
  )
  return txs.sort((a, b) => a.date.localeCompare(b.date))
}

function demoSnapshots(txs: Transaction[]): Snapshot[] {
  const snaps: Snapshot[] = []
  for (let i = 0; i < DEMO_MONTHS; i++) {
    const { y, m } = monthAt(i)
    const endOfMonth = iso(y, m, 28)
    let invested = 0
    for (const t of txs) {
      if (t.date > endOfMonth) continue
      const amount = t.shares * t.price + (t.fees ?? 0)
      invested += t.type === 'buy' ? amount : -amount
    }
    // Marktentwicklung: moderater Aufwärtstrend mit Dellen (deterministisch)
    const factor = 1 + 0.005 * i + 0.035 * Math.sin(i * 0.8 - 0.5)
    snaps.push({
      date: endOfMonth,
      invested: Math.round(invested),
      totalValue: Math.round(invested * factor),
    })
  }
  return snaps
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

const DEMO_PLANS: SavingsPlan[] = [
  { id: 'plan-eunl', instrumentId: 'EUNL', monthlyAmount: 300, dayOfMonth: 1, active: true },
  { id: 'plan-is3n', instrumentId: 'IS3N', monthlyAmount: 100, dayOfMonth: 1, active: true },
]

export const DEFAULT_SETTINGS: CockpitState['settings'] = {
  riskProfile: 'wachstum',
  monthlyBudget: 500,
  horizonYears: 20,
  expectedReturnPct: 6.5,
  cashReserve: 5000,
  taxAllowance: 1000,
  taxAllowanceUsedElsewhere: 0,
  churchTaxPct: 0,
  basiszinsPct: 2.5,
  foreignBroker: true,
  autoRefreshQuotes: true,
}

export function buildSeed(): CockpitState {
  const txs = demoTransactions()
  return {
    version: 1,
    demo: true,
    instruments: withDividends([...SEED_ETFS, ...SEED_STOCKS]),
    transactions: txs,
    plans: DEMO_PLANS,
    snapshots: demoSnapshots(txs),
    incomes: [
      { id: 'demo-inc-alv', instrumentId: 'ALV', date: '2026-05-12', amount: 123.2, note: 'Hauptversammlung' },
      { id: 'demo-inc-novo', instrumentId: 'NOVO', date: '2026-03-25', amount: 31.0 },
      { id: 'demo-inc-msft', instrumentId: 'MSFT', date: '2026-03-12', amount: 3.75 },
      { id: 'demo-inc-msft2', instrumentId: 'MSFT', date: '2026-06-11', amount: 3.75 },
      { id: 'demo-inc-asml', instrumentId: 'ASML', date: '2026-05-06', amount: 5.1 },
    ],
    watchlist: ['NVDA', 'ASML', 'MC', 'V', 'COST', 'GOOGL'],
    targets: {},
    settings: { ...DEFAULT_SETTINGS },
  }
}
