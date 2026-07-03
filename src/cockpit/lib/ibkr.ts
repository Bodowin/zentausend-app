// IBKR-Trade-Import: parst Interactive-Brokers-Exporte (Activity Statement
// und Flex Query, CSV) sowie generische Kauf/Verkauf-CSVs (auch deutsches
// Format). Ergebnis sind Roh-Trades, die im Import-Assistenten in EUR
// umgerechnet, Instrumenten zugeordnet und als Transaktionen gebucht werden.

export interface ParsedTrade {
  symbol: string
  date: string // ISO yyyy-mm-dd
  /** Stückzahl, immer positiv */
  shares: number
  /** Kurs je Stück in Handelswährung */
  price: number
  currency: string
  fees: number
  type: 'buy' | 'sell'
}

export interface ParseResult {
  trades: ParsedTrade[]
  source: 'ibkr-activity' | 'ibkr-flex' | 'generisch' | null
  skippedLines: number
}

// --- CSV-Grundlagen ----------------------------------------------------------

/** Eine CSV-Zeile inkl. Anführungszeichen ("a,b",c) zerlegen. */
export function parseCsvLine(line: string, sep = ','): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/** Trennzeichen erraten: Komma vs. Semikolon (deutsche Exporte). */
function detectSeparator(text: string): ',' | ';' {
  const head = text.slice(0, 2000)
  const commas = (head.match(/,/g) ?? []).length
  const semis = (head.match(/;/g) ?? []).length
  return semis > commas ? ';' : ','
}

/**
 * Zahl aus US- ("1,234.56") oder DE-Format ("1.234,56") lesen.
 * Heuristik: das letzte Trennzeichen ist das Dezimaltrennzeichen.
 */
export function parseLocaleNumber(raw: string): number {
  const s = raw.replace(/[€$\s"']/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized = s
  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.') // 1.234,56
        : s.replace(/,/g, '') // 1,234.56
  } else if (lastComma > -1) {
    // nur Komma: Dezimal, wenn 1–2 Nachkommastellen oder einzeln
    const decimals = s.length - lastComma - 1
    normalized =
      decimals <= 2 || s.indexOf(',') === lastComma
        ? s.replace(',', '.')
        : s.replace(/,/g, '')
  }
  return parseFloat(normalized)
}

/** Datum aus ISO, "yyyy-mm-dd, hh:mm", "yyyymmdd" oder "dd.mm.yyyy" lesen. */
export function parseFlexDate(raw: string): string | null {
  const s = raw.trim().replace(/"/g, '')
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// --- Spalten-Erkennung -------------------------------------------------------

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.toLowerCase().replace(/[\s._/-]/g, ''))
  for (const cand of candidates) {
    const idx = lower.indexOf(cand)
    if (idx !== -1) return idx
  }
  // Teilstring-Fallback
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand))
    if (idx !== -1) return idx
  }
  return -1
}

const COLS = {
  symbol: ['symbol', 'ticker', 'wertpapier', 'instrument'],
  date: ['datetime', 'tradedate', 'datum', 'date', 'zeitpunkt'],
  quantity: ['quantity', 'stück', 'stueck', 'anzahl', 'menge', 'qty'],
  price: ['tprice', 'tradeprice', 'price', 'kurs', 'preis'],
  fees: ['commfee', 'ibcommission', 'commission', 'fee', 'gebühren', 'gebuehren', 'gebühr'],
  currency: ['currencyprimary', 'currency', 'währung', 'waehrung'],
  buySell: ['buysell', 'typ', 'type', 'side', 'art'],
  discriminator: ['datadiscriminator'],
  assetCategory: ['assetcategory', 'assetclass'],
}

function rowToTrade(row: string[], idx: Record<string, number>): ParsedTrade | null {
  const symbol = idx.symbol >= 0 ? row[idx.symbol]?.trim() : ''
  const date = idx.date >= 0 ? parseFlexDate(row[idx.date] ?? '') : null
  const qtyRaw = idx.quantity >= 0 ? parseLocaleNumber(row[idx.quantity] ?? '') : NaN
  const price = idx.price >= 0 ? parseLocaleNumber(row[idx.price] ?? '') : NaN
  if (!symbol || !date || !Number.isFinite(qtyRaw) || qtyRaw === 0 || !Number.isFinite(price) || price <= 0) {
    return null
  }
  const feesRaw = idx.fees >= 0 ? parseLocaleNumber(row[idx.fees] ?? '') : 0
  const currency = (idx.currency >= 0 ? row[idx.currency] : '') || 'EUR'

  let type: 'buy' | 'sell' = qtyRaw < 0 ? 'sell' : 'buy'
  if (idx.buySell >= 0) {
    const v = (row[idx.buySell] ?? '').toLowerCase()
    if (v.includes('sell') || v.includes('verkauf')) type = 'sell'
    else if (v.includes('buy') || v.includes('kauf')) type = 'buy'
  }

  return {
    symbol: symbol.toUpperCase(),
    date,
    shares: Math.abs(qtyRaw),
    price,
    currency: currency.toUpperCase(),
    fees: Number.isFinite(feesRaw) ? Math.abs(feesRaw) : 0,
    type,
  }
}

// --- Die drei Formate --------------------------------------------------------

/** IBKR Activity Statement: Sektionszeilen "Trades,Header,…" / "Trades,Data,…". */
function parseActivityStatement(rows: string[][]): ParsedTrade[] | null {
  const headerRow = rows.find((r) => r[0] === 'Trades' && r[1] === 'Header')
  if (!headerRow) return null
  const header = headerRow.slice(2)
  const idx: Record<string, number> = {}
  for (const [key, candidates] of Object.entries(COLS)) idx[key] = findColumn(header, candidates)

  const trades: ParsedTrade[] = []
  for (const r of rows) {
    if (r[0] !== 'Trades' || r[1] !== 'Data') continue
    const data = r.slice(2)
    // Nur echte Orders (keine Zwischensummen/SubTotals)
    if (idx.discriminator >= 0 && data[idx.discriminator] !== 'Order') continue
    const trade = rowToTrade(data, idx)
    if (trade) trades.push(trade)
  }
  return trades
}

/** Flex Query oder generische CSV: eine Kopfzeile, dann Datenzeilen. */
function parseFlat(rows: string[][]): { trades: ParsedTrade[]; header: string[] } | null {
  // Kopfzeile suchen (erste Zeile, die Symbol- und Mengen-Spalte enthält)
  for (let h = 0; h < Math.min(rows.length, 5); h++) {
    const header = rows[h]
    const idx: Record<string, number> = {}
    for (const [key, candidates] of Object.entries(COLS)) idx[key] = findColumn(header, candidates)
    if (idx.symbol === -1 || idx.quantity === -1 || idx.price === -1 || idx.date === -1) continue
    const trades: ParsedTrade[] = []
    for (const r of rows.slice(h + 1)) {
      const trade = rowToTrade(r, idx)
      if (trade) trades.push(trade)
    }
    return { trades, header }
  }
  return null
}

export function parseTradesCsv(text: string): ParseResult {
  const sep = detectSeparator(text)
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const rows = lines.map((l) => parseCsvLine(l, sep))

  const activity = parseActivityStatement(rows)
  if (activity && activity.length > 0) {
    return { trades: activity, source: 'ibkr-activity', skippedLines: 0 }
  }

  const flat = parseFlat(rows)
  if (flat && flat.trades.length > 0) {
    const isFlex = flat.header.some((c) =>
      /tradeprice|ibcommission|currencyprimary|buy\/sell/i.test(c),
    )
    return {
      trades: flat.trades,
      source: isFlex ? 'ibkr-flex' : 'generisch',
      skippedLines: rows.length - 1 - flat.trades.length,
    }
  }

  return { trades: [], source: null, skippedLines: rows.length }
}

/** Standard-Umrechnungskurse EUR je 1 Fremdwährungseinheit (editierbar im UI). */
export const DEFAULT_FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  CHF: 1.06,
  GBP: 1.17,
  DKK: 0.134,
}
