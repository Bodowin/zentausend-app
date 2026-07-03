// Vercel Serverless Function: historische Kurse (Yahoo Finance Chart-API).
// Aufruf: /api/history?symbol=AAPL&range=1y
// Antwort: { symbol, currency, points: [{ t: "2025-01-03", c: 243.3 }] }

const RANGES: Record<string, { range: string; interval: string }> = {
  '6m': { range: '6mo', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
  '5y': { range: '5y', interval: '1wk' },
  max: { range: 'max', interval: '1mo' },
}

export default async function handler(req: any, res: any) {
  const symbol = String(req.query?.symbol ?? '').trim()
  const rangeKey = String(req.query?.range ?? '1y')
  const cfg = RANGES[rangeKey] ?? RANGES['1y']
  if (!symbol) {
    res.status(400).json({ error: 'symbol fehlt' })
    return
  }
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${cfg.range}&interval=${cfg.interval}&events=div`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InvestCockpit/1.0)' },
    })
    if (!r.ok) {
      res.status(502).json({ error: `Yahoo antwortet ${r.status}` })
      return
    }
    const j: any = await r.json()
    const result = j?.chart?.result?.[0]
    const ts: number[] = result?.timestamp ?? []
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
    const points = ts
      .map((t, i) => ({
        t: new Date(t * 1000).toISOString().slice(0, 10),
        c: closes[i],
      }))
      .filter((p): p is { t: string; c: number } => typeof p.c === 'number')
      .map((p) => ({ t: p.t, c: Math.round(p.c * 100) / 100 }))
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.status(200).json({
      symbol,
      currency: result?.meta?.currency ?? 'USD',
      points,
    })
  } catch {
    res.status(502).json({ error: 'Kurshistorie nicht verfügbar' })
  }
}
