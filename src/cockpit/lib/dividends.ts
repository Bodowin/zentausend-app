// Dividenden-Kalender: erwartete Ausschüttungen je Monat aus den offenen
// Positionen (Jahresdividende je Anteil, gleichmäßig auf die Zahlungsmonate
// verteilt). Beispieldaten – je Titel editierbar.

import type { DividendReceipt, Position } from './types'

export interface DividendPayment {
  month: number // 1–12
  instrumentId: string
  name: string
  ticker: string
  amount: number // EUR (erwartet)
  perShare: number // EUR je Anteil und Zahlung
}

export interface DividendCalendar {
  payments: DividendPayment[]
  /** Summe je Monat, Index 0 = Januar */
  monthTotals: number[]
  yearTotal: number
  /** Yield on Cost: Jahresdividende / Einstand */
  yieldOnCostPct: number
  /** Ausschüttungsrendite auf aktuellen Depotwert */
  yieldPct: number
}

export function buildDividendCalendar(positions: Position[]): DividendCalendar {
  const payments: DividendPayment[] = []
  const monthTotals = Array.from({ length: 12 }, () => 0)
  let yearTotal = 0
  let invested = 0
  let value = 0

  for (const p of positions) {
    invested += p.invested
    value += p.value
    const div = p.instrument.dividend
    if (!div || div.perShare <= 0 || div.months.length === 0) continue
    const perPayment = div.perShare / div.months.length
    for (const month of div.months) {
      if (month < 1 || month > 12) continue
      const amount = perPayment * p.shares
      payments.push({
        month,
        instrumentId: p.instrument.id,
        name: p.instrument.name,
        ticker: p.instrument.ticker,
        amount,
        perShare: perPayment,
      })
      monthTotals[month - 1] += amount
      yearTotal += amount
    }
  }

  payments.sort((a, b) => a.month - b.month || b.amount - a.amount)
  return {
    payments,
    monthTotals,
    yearTotal,
    yieldOnCostPct: invested > 0 ? (yearTotal / invested) * 100 : 0,
    yieldPct: value > 0 ? (yearTotal / value) * 100 : 0,
  }
}

/** Erhaltene Ausschüttungen eines Jahres: Summe je Monat + Gesamt. */
export function receivedByMonth(
  receipts: DividendReceipt[],
  year: number,
): { monthTotals: number[]; total: number } {
  const monthTotals = Array.from({ length: 12 }, () => 0)
  let total = 0
  for (const r of receipts) {
    if (!r.date.startsWith(String(year))) continue
    const month = parseInt(r.date.slice(5, 7), 10)
    if (month >= 1 && month <= 12) {
      monthTotals[month - 1] += r.amount
      total += r.amount
    }
  }
  return { monthTotals, total }
}

/** Erwartete Summe der Monate 1..asOfMonth (einschließlich) – für Soll/Ist-Vergleich. */
export function expectedUntilMonth(calendar: DividendCalendar, asOfMonth: number): number {
  return calendar.monthTotals.slice(0, Math.max(0, Math.min(12, asOfMonth))).reduce((s, v) => s + v, 0)
}

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const
