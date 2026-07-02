// Zahlen-/Datumsformatierung (de-DE), zentral für die ganze App.

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const EUR_CENT = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function fmtEur(v: number): string {
  return EUR.format(v)
}

export function fmtEurExact(v: number): string {
  return EUR_CENT.format(v)
}

/** Kompakt: 1,2 Mio. € / 340 T€ */
export function fmtEurCompact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${fmtNum(v / 1_000_000, 2)} Mio. €`
  if (abs >= 100_000) return `${fmtNum(v / 1_000, 0)} T€`
  return EUR.format(v)
}

export function fmtNum(v: number, digits = 1): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v)
}

export function fmtPct(v: number, digits = 1, signed = false): string {
  const s = signed && v > 0 ? '+' : ''
  return `${s}${fmtNum(v, digits)} %`
}

export function fmtSignedEur(v: number): string {
  return `${v > 0 ? '+' : ''}${EUR.format(v)}`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtMonth(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
