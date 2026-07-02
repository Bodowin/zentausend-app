// Vercel Serverless Function: Live-Kurse (Proxy auf Yahoo Finance, keine Auth nötig).
// Aufruf: /api/quote?symbols=AAPL,SAP.DE,EURUSD=X
// Antwort: { quotes: [{ symbol, price, currency, prevClose, changePct } | { symbol, error }] }
// Läuft nur im Vercel-Deployment – lokal fällt das Cockpit auf manuelle Kurspflege zurück.

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/'

async function fetchQuote(symbol: string) {
  try {
    const url = `${YAHOO}${encodeURIComponent(symbol)}?range=5d&interval=1d`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestCockpit/1.0)' },
    })
    if (!r.ok) return { symbol, error: true }
    const j: any = await r.json()
    const meta = j?.chart?.result?.[0]?.meta
    const price = meta?.regularMarketPrice
    if (typeof price !== 'number') return { symbol, error: true }
    const prevClose =
      typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : undefined
    return {
      symbol,
      price,
      currency: meta.currency ?? 'USD',
      prevClose,
      changePct:
        prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : undefined,
    }
  } catch {
    return { symbol, error: true }
  }
}

export default async function handler(req: any, res: any) {
  const raw = String(req.query?.symbols ?? '')
  const symbols = raw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
    .slice(0, 48)
  if (symbols.length === 0) {
    res.status(400).json({ error: 'symbols fehlt' })
    return
  }
  const quotes = await Promise.all(symbols.map(fetchQuote))
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
  res.status(200).json({ quotes })
}
