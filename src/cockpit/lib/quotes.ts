// Live-Kurse über die Vercel-Function /api/quote (Yahoo Finance).
// Kurse werden in EUR umgerechnet (über EURUSD=X usw.). Lokal ohne
// Deployment schlägt der Fetch fehl – die App fällt dann sauber auf
// manuelle Kurspflege zurück.

import type { Instrument } from './types'

interface ApiQuote {
  symbol: string
  price?: number
  currency?: string
  prevClose?: number
  changePct?: number
  error?: boolean
}

export interface QuoteUpdate {
  instrumentId: string
  priceEur: number
  dayChangePct?: number
}

export interface QuoteResult {
  updates: QuoteUpdate[]
  failed: string[] // Ticker ohne Kurs
}

const FX_SYMBOLS: Record<string, string> = {
  USD: 'EURUSD=X',
  CHF: 'EURCHF=X',
  DKK: 'EURDKK=X',
  GBP: 'EURGBP=X',
}

export async function fetchQuotes(instruments: Instrument[]): Promise<QuoteResult> {
  const withSymbol = instruments.filter((i) => i.yahooSymbol)
  const fxNeeded = new Set<string>()
  for (const i of withSymbol) {
    const cur = i.quoteCurrency ?? 'EUR'
    if (cur !== 'EUR') fxNeeded.add(FX_SYMBOLS[cur])
  }
  const symbols = [
    ...withSymbol.map((i) => i.yahooSymbol as string),
    ...[...fxNeeded].filter(Boolean),
  ]
  if (symbols.length === 0) return { updates: [], failed: [] }

  const res = await fetch(`/api/quote?symbols=${encodeURIComponent(symbols.join(','))}`)
  if (!res.ok) throw new Error(`Kurs-API nicht erreichbar (${res.status})`)
  const data = (await res.json()) as { quotes: ApiQuote[] }
  const bySymbol = new Map(data.quotes.map((q) => [q.symbol, q]))

  // Wechselkurse: EURUSD=X = USD je 1 EUR → EUR-Preis = Fremdpreis / Kurs
  const fxRate = (cur: string): number | null => {
    if (cur === 'EUR') return 1
    const q = bySymbol.get(FX_SYMBOLS[cur] ?? '')
    return q && !q.error && q.price ? q.price : null
  }

  const updates: QuoteUpdate[] = []
  const failed: string[] = []
  for (const inst of withSymbol) {
    const q = bySymbol.get(inst.yahooSymbol as string)
    const cur = inst.quoteCurrency ?? 'EUR'
    const rate = fxRate(cur)
    if (!q || q.error || !q.price || rate === null) {
      failed.push(inst.ticker)
      continue
    }
    // Sonderfall Londoner Börse: Kurse in Pence
    const raw = q.currency === 'GBp' ? q.price / 100 : q.price
    updates.push({
      instrumentId: inst.id,
      priceEur: Math.round((raw / rate) * 100) / 100,
      dayChangePct: q.changePct,
    })
  }
  return { updates, failed }
}
