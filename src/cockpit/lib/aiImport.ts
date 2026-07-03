// KI-Daten-Import: erzeugt einen Prompt, mit dem Claude/ChatGPT aktuelle
// Kennzahlen als striktes JSON liefert, und parst die Antwort zurück in die
// Kennzahlen-Bibliothek (Update bestehender Titel oder Neuanlage).

import { todayIso, uid } from './format'
import type { Instrument, Moat, Region, Sector } from './types'

export const SECTOR_LIST: Sector[] = [
  'Technologie', 'Kommunikation', 'Gesundheit', 'Finanzen', 'Konsum (zyklisch)',
  'Konsum (defensiv)', 'Industrie', 'Energie', 'Versorger', 'Rohstoffe',
  'Immobilien', 'Diversifiziert',
]
export const REGION_LIST: Region[] = [
  'USA', 'Europa', 'Deutschland', 'Welt', 'Schwellenländer', 'Asien', 'Andere',
]

const SCHEMA_EXAMPLE = `[
  {
    "ticker": "AAPL",
    "name": "Apple",
    "priceEur": 185.20,
    "sector": "Technologie",
    "region": "USA",
    "yahooSymbol": "AAPL",
    "quoteCurrency": "USD",
    "marketCapB": 2900,
    "pe": 29.1, "forwardPe": 27.0, "ps": 7.4, "peg": 2.6,
    "revenueGrowth5y": 8.0, "epsGrowth5y": 12.0,
    "grossMargin": 46.0, "operatingMargin": 31.0, "fcfMargin": 26.0,
    "roe": 150.0, "roic": 55.0,
    "debtToEquity": 1.5, "netDebtToEbitda": 0.5, "interestCoverage": 25,
    "dividendYield": 0.55, "payoutRatio": 15, "dividendGrowthYears": 13,
    "beta": 1.2, "moat": 3,
    "dividendPerShareEur": 0.95, "dividendMonths": [2, 5, 8, 11],
    "notes": "kurze Einordnung, max. 1 Satz"
  }
]`

/** Prompt, der eine KI um frische Kennzahlen im Import-Format bittet. */
export function buildMetricsPrompt(tickers: string[]): string {
  return `Du bist ein präziser Finanzdaten-Assistent. Ich pflege ein privates Aktien-Screening-Tool und brauche aktuelle Fundamentalkennzahlen.

Recherchiere für folgende Unternehmen die aktuellsten verfügbaren Kennzahlen (TTM bzw. letztes Geschäftsjahr):

${tickers.map((t) => `- ${t}`).join('\n')}

Antworte AUSSCHLIESSLICH mit einem JSON-Array in exakt diesem Format (keine Erklärungen davor oder danach, kein Markdown-Codeblock nötig aber erlaubt):

${SCHEMA_EXAMPLE}

Regeln:
- Alle Geldwerte in EUR umrechnen ("priceEur" = aktueller Kurs in EUR, "marketCapB" = Marktkapitalisierung in Mrd. EUR, "dividendPerShareEur" = Jahresdividende je Aktie in EUR).
- Prozentwerte als Zahl ohne %-Zeichen (z. B. 31.0 für 31 %).
- "moat": 0 = kein Burggraben, 1 = schwach, 2 = mittel, 3 = stark.
- "sector" exakt einer aus: ${SECTOR_LIST.join(', ')}.
- "region" exakt einer aus: ${REGION_LIST.join(', ')}.
- "dividendMonths": typische Zahlungsmonate (1–12); leeres Array wenn keine Dividende.
- Unbekannte Kennzahlen weglassen (Feld nicht aufnehmen), NICHT raten oder mit 0 füllen.
- "notes": max. 1 Satz Besonderheit (z. B. "REIT: AFFO statt KGV betrachten").

Nutze so aktuelle Daten wie möglich und nenne im Feld "notes" nichts Erfundenes.`
}

// --- Antwort parsen ----------------------------------------------------------

export interface ImportResult {
  updated: Instrument[]
  created: Instrument[]
  skipped: string[]
  error?: string
}

interface RawEntry {
  ticker?: string
  name?: string
  priceEur?: number
  sector?: string
  region?: string
  yahooSymbol?: string
  quoteCurrency?: string
  dividendPerShareEur?: number
  dividendMonths?: number[]
  notes?: string
  [key: string]: unknown
}

const METRIC_KEYS = [
  'marketCapB', 'pe', 'forwardPe', 'ps', 'peg', 'revenueGrowth5y', 'epsGrowth5y',
  'grossMargin', 'operatingMargin', 'fcfMargin', 'roe', 'roic', 'debtToEquity',
  'netDebtToEbitda', 'interestCoverage', 'dividendYield', 'payoutRatio',
  'dividendGrowthYears', 'beta',
] as const

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** JSON-Array aus einer (evtl. mit Text/Codeblock umgebenen) KI-Antwort ziehen. */
export function extractJsonArray(text: string): RawEntry[] | null {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? (parsed as RawEntry[]) : null
  } catch {
    return null
  }
}

export function applyMetricsImport(
  text: string,
  instruments: Instrument[],
): ImportResult {
  const entries = extractJsonArray(text)
  if (!entries) {
    return {
      updated: [],
      created: [],
      skipped: [],
      error: 'Kein gültiges JSON-Array gefunden – bitte die komplette KI-Antwort einfügen.',
    }
  }
  const updated: Instrument[] = []
  const created: Instrument[] = []
  const skipped: string[] = []

  for (const raw of entries) {
    const ticker = typeof raw.ticker === 'string' ? raw.ticker.trim().toUpperCase() : ''
    if (!ticker) {
      skipped.push('(ohne Ticker)')
      continue
    }
    const existing = instruments.find(
      (i) => i.ticker.toUpperCase() === ticker || i.id.toUpperCase() === ticker,
    )

    const metrics: Record<string, number | string | undefined> = {}
    let hasMetric = false
    for (const key of METRIC_KEYS) {
      const v = num(raw[key])
      if (v !== undefined) {
        metrics[key] = v
        hasMetric = true
      }
    }
    const moat = num(raw['moat'])
    if (moat !== undefined && moat >= 0 && moat <= 3) {
      metrics['moat'] = Math.round(moat)
      hasMetric = true
    }
    if (typeof raw.notes === 'string' && raw.notes.trim()) metrics['notes'] = raw.notes.trim()
    metrics['asOf'] = `KI-Import · ${todayIso()}`

    const dividend =
      num(raw.dividendPerShareEur) !== undefined && Array.isArray(raw.dividendMonths)
        ? {
            perShare: raw.dividendPerShareEur as number,
            months: raw.dividendMonths.filter(
              (m): m is number => typeof m === 'number' && m >= 1 && m <= 12,
            ),
          }
        : undefined

    if (existing) {
      updated.push({
        ...existing,
        price: num(raw.priceEur) ?? existing.price,
        priceUpdatedAt: num(raw.priceEur) !== undefined ? new Date().toISOString() : existing.priceUpdatedAt,
        yahooSymbol: typeof raw.yahooSymbol === 'string' ? raw.yahooSymbol : existing.yahooSymbol,
        metrics: hasMetric
          ? { ...existing.metrics, ...(metrics as object) }
          : existing.metrics,
        dividend: dividend ?? existing.dividend,
      })
    } else {
      if (!raw.name || num(raw.priceEur) === undefined) {
        skipped.push(`${ticker} (Name/Kurs fehlt für Neuanlage)`)
        continue
      }
      created.push({
        id: uid(),
        ticker,
        name: String(raw.name),
        assetClass: 'stock',
        sector: SECTOR_LIST.includes(raw.sector as Sector)
          ? (raw.sector as Sector)
          : 'Technologie',
        region: REGION_LIST.includes(raw.region as Region)
          ? (raw.region as Region)
          : 'Andere',
        price: raw.priceEur as number,
        yahooSymbol: typeof raw.yahooSymbol === 'string' ? raw.yahooSymbol : undefined,
        quoteCurrency: ['EUR', 'USD', 'CHF', 'DKK', 'GBP'].includes(String(raw.quoteCurrency))
          ? (raw.quoteCurrency as Instrument['quoteCurrency'])
          : 'USD',
        metrics: { ...(metrics as object), moat: (metrics['moat'] as Moat) ?? 1 },
        dividend,
      })
    }
  }
  return { updated, created, skipped }
}
