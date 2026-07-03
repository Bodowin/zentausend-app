// Client für historische Kurse über /api/history (nur im Vercel-Deployment
// verfügbar; lokal liefert der Fetch einen Fehler und die UI zeigt den Hinweis).

export type HistoryRange = '6m' | '1y' | '5y' | 'max'

export interface HistoryPoint {
  t: string // ISO-Datum
  c: number // Schlusskurs (Heimatwährung)
}

export interface HistoryData {
  symbol: string
  currency: string
  points: HistoryPoint[]
}

const cache = new Map<string, HistoryData>()

export async function fetchHistory(
  symbol: string,
  range: HistoryRange,
): Promise<HistoryData> {
  const key = `${symbol}:${range}`
  const cached = cache.get(key)
  if (cached) return cached
  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
  )
  if (!res.ok) throw new Error(`Historie nicht verfügbar (${res.status})`)
  const data = (await res.json()) as HistoryData
  if (!Array.isArray(data.points) || data.points.length < 2) {
    throw new Error('Zu wenige Datenpunkte')
  }
  cache.set(key, data)
  return data
}

/** Performance über den Zeitraum in % (erster → letzter Punkt). */
export function performancePct(points: HistoryPoint[]): number {
  const first = points[0]?.c
  const last = points[points.length - 1]?.c
  return first && last ? ((last - first) / first) * 100 : 0
}
