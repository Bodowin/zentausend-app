// Steuer-Engine (Deutschland, Privatdepot): Abgeltungsteuer + Soli
// (+ optional Kirchensteuer), Sparer-Pauschbetrag, Teilfreistellung für
// Aktien-ETFs, Verlusttöpfe (Aktien vs. Sonstige), Vorabpauschale für
// thesaurierende ETFs und daraus abgeleitete Optimierungs-Tipps.
// Alles Schätzungen zur Orientierung – KEINE Steuerberatung.

import { buildDividendCalendar } from './dividends'
import type { Instrument, Position, Settings, Transaction } from './types'

/** Effektiver Steuersatz auf Kapitalerträge in % (KapSt + Soli + KiSt). */
export function effectiveTaxRatePct(churchTaxPct: 0 | 8 | 9): number {
  // Kirchensteuer mindert die KapSt-Bemessung (§ 32d EStG):
  // KapSt = 25 % / (1 + KiSt·0,25) → 8 %: 24,51 %, 9 %: 24,45 %
  if (churchTaxPct === 0) return 26.375
  const kapSt = 25 / (1 + (churchTaxPct / 100) * 0.25)
  return Math.round(kapSt * (1 + 0.055 + churchTaxPct / 100) * 100) / 100
}

export interface RealizedEvent {
  date: string
  instrumentId: string
  assetClass: 'stock' | 'etf' | 'other'
  gain: number // EUR, negativ = Verlust
}

/** Realisierte Gewinne/Verluste je Verkauf (Durchschnittskosten-Methode). */
export function realizedEvents(
  transactions: Transaction[],
  instruments: Instrument[],
): RealizedEvent[] {
  const byId = new Map(instruments.map((i) => [i.id, i]))
  const lots = new Map<string, { shares: number; cost: number }>()
  const events: RealizedEvent[] = []
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sorted) {
    const lot = lots.get(t.instrumentId) ?? { shares: 0, cost: 0 }
    const fees = t.fees ?? 0
    if (t.type === 'buy') {
      lot.shares += t.shares
      lot.cost += t.shares * t.price + fees
    } else {
      const sellShares = Math.min(t.shares, lot.shares)
      const avg = lot.shares > 0 ? lot.cost / lot.shares : 0
      const gain = sellShares * (t.price - avg) - fees
      lot.cost -= sellShares * avg
      lot.shares -= sellShares
      const cls = byId.get(t.instrumentId)?.assetClass
      events.push({
        date: t.date,
        instrumentId: t.instrumentId,
        assetClass: cls === 'stock' ? 'stock' : cls === 'etf' ? 'etf' : 'other',
        gain,
      })
    }
    lots.set(t.instrumentId, lot)
  }
  return events
}

export interface TaxTip {
  level: 'action' | 'info' | 'warn'
  title: string
  detail: string
}

export interface TaxReport {
  year: number
  ratePct: number
  // Realisiert (dieses Jahr)
  aktienGains: number // Netto Aktien-Topf (kann negativ sein)
  fondsGainsRaw: number
  fondsGainsTaxable: number // nach 30 % Teilfreistellung
  // Laufende Erträge (erwartet, ganzes Jahr)
  dividendsStocks: number
  dividendsFundsRaw: number
  dividendsFundsTaxable: number
  // Vorabpauschale (thesaurierende ETFs, Schätzung fürs Folgejahr)
  vorabRaw: number
  vorabTaxable: number
  // Zusammenfassung
  taxableBeforeAllowance: number
  allowanceTotal: number
  allowanceAvailable: number // nach externem Verbrauch
  allowanceRemaining: number // nach Verrechnung mit Erträgen
  taxableAfterAllowance: number
  estimatedTax: number
  aktienLossCarry: number // Aktien-Verlusttopf (Vortrag), > 0 = Verlust
  tips: TaxTip[]
}

const TEILFREISTELLUNG = 0.3 // Aktienfonds ≥ 51 % Aktienquote

export function buildTaxReport(
  positions: Position[],
  transactions: Transaction[],
  instruments: Instrument[],
  settings: Settings,
  year: number,
): TaxReport {
  const ratePct = effectiveTaxRatePct(settings.churchTaxPct)

  // 1) Realisierte Gewinne/Verluste dieses Jahr, getrennt nach Töpfen
  const events = realizedEvents(transactions, instruments).filter((e) =>
    e.date.startsWith(String(year)),
  )
  const aktienGains = events
    .filter((e) => e.assetClass === 'stock')
    .reduce((s, e) => s + e.gain, 0)
  const fondsGainsRaw = events
    .filter((e) => e.assetClass !== 'stock')
    .reduce((s, e) => s + e.gain, 0)
  const fondsGainsTaxable = fondsGainsRaw * (1 - TEILFREISTELLUNG)

  // 2) Erwartete Dividenden/Ausschüttungen (Kalender, ganzes Jahr)
  const calendar = buildDividendCalendar(positions)
  let dividendsStocks = 0
  let dividendsFundsRaw = 0
  for (const p of positions) {
    const div = p.instrument.dividend
    if (!div || div.perShare <= 0) continue
    const annual = div.perShare * p.shares
    if (p.instrument.assetClass === 'etf') dividendsFundsRaw += annual
    else dividendsStocks += annual
  }
  void calendar
  const dividendsFundsTaxable = dividendsFundsRaw * (1 - TEILFREISTELLUNG)

  // 3) Vorabpauschale: thesaurierende ETFs, Basisertrag = Wert × Basiszins × 70 %
  //    (vereinfachend: aktueller Wert statt Jahresanfangswert, volle Haltedauer)
  let vorabRaw = 0
  for (const p of positions) {
    if (p.instrument.assetClass !== 'etf' || !p.instrument.etf?.accumulating) continue
    vorabRaw += p.value * (settings.basiszinsPct / 100) * 0.7
  }
  const vorabTaxable = vorabRaw * (1 - TEILFREISTELLUNG)

  // 4) Verlusttopf-Logik: Aktienverluste nur gegen Aktiengewinne;
  //    sonstige Verluste (ETF) mindern alles.
  const aktienPot = Math.max(0, aktienGains)
  const aktienLossCarry = Math.max(0, -aktienGains)
  const sonstige =
    fondsGainsTaxable + dividendsStocks + dividendsFundsTaxable + vorabTaxable
  const taxableBeforeAllowance = Math.max(0, aktienPot + sonstige)

  const allowanceAvailable = Math.max(
    0,
    settings.taxAllowance - settings.taxAllowanceUsedElsewhere,
  )
  const taxableAfterAllowance = Math.max(0, taxableBeforeAllowance - allowanceAvailable)
  const allowanceRemaining = Math.max(0, allowanceAvailable - taxableBeforeAllowance)
  const estimatedTax = (taxableAfterAllowance * ratePct) / 100

  const tips = buildTips({
    positions,
    settings,
    allowanceRemaining,
    aktienLossCarry,
    vorabTaxable,
    estimatedTax,
    ratePct,
  })

  return {
    year,
    ratePct,
    aktienGains,
    fondsGainsRaw,
    fondsGainsTaxable,
    dividendsStocks,
    dividendsFundsRaw,
    dividendsFundsTaxable,
    vorabRaw,
    vorabTaxable,
    taxableBeforeAllowance,
    allowanceTotal: settings.taxAllowance,
    allowanceAvailable,
    allowanceRemaining,
    taxableAfterAllowance,
    estimatedTax,
    aktienLossCarry,
    tips,
  }
}

function eur(v: number): string {
  return `${Math.round(v).toLocaleString('de-DE')} €`
}

function buildTips(ctx: {
  positions: Position[]
  settings: Settings
  allowanceRemaining: number
  aktienLossCarry: number
  vorabTaxable: number
  estimatedTax: number
  ratePct: number
}): TaxTip[] {
  const tips: TaxTip[] = []
  const { positions, settings } = ctx

  // Pauschbetrag ausschöpfen: Gewinne steuerfrei „waschen“ (verkaufen + zurückkaufen)
  if (ctx.allowanceRemaining > 50) {
    const winner = positions
      .filter((p) => p.gain > 0)
      .sort((a, b) => b.gain - a.gain)[0]
    const extra = winner
      ? ` Kandidat: ${winner.instrument.name} (+${eur(winner.gain)} unrealisiert) – Verkauf von ca. ${eur(
          Math.min(winner.value, (ctx.allowanceRemaining / winner.gain) * winner.value),
        )} realisiert ungefähr den freien Betrag.`
      : ''
    tips.push({
      level: 'action',
      title: `${eur(ctx.allowanceRemaining)} Sparer-Pauschbetrag ungenutzt`,
      detail:
        `Bis Jahresende Gewinne in dieser Höhe steuerfrei realisieren und sofort zurückkaufen („Step-up“): erhöht den Einstand und spart später ~${Math.round((ctx.allowanceRemaining * ctx.ratePct) / 100)} € Steuern.` +
        extra,
    })
  }

  // Verlust-Ernte
  const losers = positions
    .filter((p) => p.gain < -200)
    .sort((a, b) => a.gain - b.gain)
  if (losers.length > 0) {
    const l = losers[0]
    const cls = l.instrument.assetClass === 'stock' ? 'Aktien-Verlusttopf' : 'sonstigen Verlusttopf'
    tips.push({
      level: 'action',
      title: `Verlust-Ernte möglich: ${l.instrument.name} (${eur(l.gain)})`,
      detail: `Realisierte Verluste wandern in den ${cls} und verrechnen sich mit ${
        l.instrument.assetClass === 'stock'
          ? 'Aktien-Gewinnen (nur!)'
          : 'allen Kapitalerträgen'
      }. Rückkauf ist möglich – identischer Sofort-Rückkauf kann aber als Gestaltungsmissbrauch gewertet werden; etwas Zeit oder ein ähnliches Instrument dazwischenlegen.`,
    })
  }

  if (ctx.aktienLossCarry > 0) {
    tips.push({
      level: 'info',
      title: `Aktien-Verlusttopf: ${eur(ctx.aktienLossCarry)}`,
      detail:
        'Dieses Jahr realisierte Aktienverluste. Sie verrechnen sich ausschließlich mit Aktien-Gewinnen (nicht mit ETF-Erträgen oder Dividenden) und werden sonst vorgetragen. Idee: passende Aktien-Gewinne noch im selben Jahr realisieren.',
    })
  }

  // Auslands-Broker (IBKR)
  if (settings.foreignBroker) {
    tips.push({
      level: 'warn',
      title: 'Interactive Brokers: Steuer selbst abführen (Anlage KAP)',
      detail: `Ausländische Broker führen keine Abgeltungsteuer ab – Erträge in der Steuererklärung (Anlage KAP) angeben und Rücklage bilden (aktuell geschätzt ${eur(
        ctx.estimatedTax,
      )}). US-Quellensteuer: W-8BEN hinterlegen, dann 15 % statt 30 % – die 15 % sind auf die deutsche Steuer anrechenbar. Der Sparer-Pauschbetrag wirkt hier erst über die Steuererklärung, nicht automatisch.`,
    })
  }

  // Vorabpauschale-Liquidität
  if (ctx.vorabTaxable > 10) {
    tips.push({
      level: 'info',
      title: `Vorabpauschale: Anfang Januar ca. ${eur((ctx.vorabTaxable * ctx.ratePct) / 100)} Steuer`,
      detail:
        'Für thesaurierende ETFs wird die Vorabpauschale Anfang Januar fällig (beim Auslands-Broker über die Steuererklärung). Sie erhöht später den steuerlichen Einstand – keine Doppelbesteuerung, aber Liquidität einplanen.',
    })
  }

  tips.push({
    level: 'info',
    title: 'Teilfreistellung nutzen',
    detail:
      'Aktien-ETFs (≥ 51 % Aktienquote) sind zu 30 % steuerfrei – Gewinne, Ausschüttungen und Vorabpauschale. Für langfristige Buy-and-Hold-Erträge sind Aktien-ETFs dadurch oft steuerlich attraktiver als Einzelaktien.',
  })

  return tips
}
