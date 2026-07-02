// Gemeinsame Typen des Invest-Cockpits. Alle Geldbeträge und Kurse werden in
// EUR gepflegt (Live-Kurse werden beim Aktualisieren in EUR umgerechnet).

export type AssetClass = 'stock' | 'etf' | 'cash' | 'bond' | 'crypto'

export type Region =
  | 'USA'
  | 'Europa'
  | 'Deutschland'
  | 'Welt'
  | 'Schwellenländer'
  | 'Asien'
  | 'Andere'

export type Sector =
  | 'Technologie'
  | 'Kommunikation'
  | 'Gesundheit'
  | 'Finanzen'
  | 'Konsum (zyklisch)'
  | 'Konsum (defensiv)'
  | 'Industrie'
  | 'Energie'
  | 'Versorger'
  | 'Rohstoffe'
  | 'Immobilien'
  | 'Diversifiziert'

/** 0 = kein Burggraben … 3 = stark */
export type Moat = 0 | 1 | 2 | 3

export interface StockMetrics {
  marketCapB?: number // Marktkapitalisierung in Mrd. EUR
  pe?: number // KGV (trailing)
  forwardPe?: number // KGV (erwartet)
  ps?: number // KUV
  peg?: number
  revenueGrowth5y?: number // Umsatzwachstum % p.a. (5J)
  epsGrowth5y?: number // Gewinnwachstum % p.a. (5J)
  grossMargin?: number // %
  operatingMargin?: number // %
  fcfMargin?: number // Free-Cashflow-Marge %
  roe?: number // %
  roic?: number // %
  debtToEquity?: number // Verhältnis (0.5 = 50 %)
  netDebtToEbitda?: number
  interestCoverage?: number
  dividendYield?: number // %
  payoutRatio?: number // %
  dividendGrowthYears?: number // Jahre in Folge erhöht/gehalten
  beta?: number
  moat?: Moat
  asOf?: string // Datenstand, z. B. "Beispieldaten · Mitte 2025"
  notes?: string
}

export interface EtfInfo {
  ter?: number // Gesamtkostenquote %
  distributionYield?: number // Ausschüttungsrendite %
  accumulating?: boolean
  holdings?: number
  index?: string
}

export interface Instrument {
  id: string
  ticker: string
  name: string
  assetClass: AssetClass
  sector: Sector
  region: Region
  /** aktueller Kurs in EUR (manuell gepflegt oder per Live-Update) */
  price: number
  priceUpdatedAt?: string
  /** Tagesänderung in % (nur nach Live-Update gesetzt) */
  dayChangePct?: number
  /** Symbol für Live-Kurse (Yahoo Finance), z. B. "AAPL", "SAP.DE" */
  yahooSymbol?: string
  /** Handelswährung an der Heimatbörse (für die EUR-Umrechnung) */
  quoteCurrency?: 'EUR' | 'USD' | 'CHF' | 'DKK' | 'GBP'
  metrics?: StockMetrics
  etf?: EtfInfo
}

export type TxType = 'buy' | 'sell'

export interface Transaction {
  id: string
  instrumentId: string
  type: TxType
  date: string // ISO yyyy-mm-dd
  shares: number
  /** Kurs je Anteil in EUR */
  price: number
  fees?: number
  note?: string
}

export interface SavingsPlan {
  id: string
  instrumentId: string
  monthlyAmount: number // EUR
  dayOfMonth: number // 1–28
  active: boolean
  note?: string
}

/** Monatlicher Depot-Schnappschuss für die Verlaufs-Kurve */
export interface Snapshot {
  date: string // ISO yyyy-mm-dd
  totalValue: number
  invested: number
}

export type RiskProfile = 'defensiv' | 'ausgewogen' | 'wachstum' | 'aggressiv'

export interface Settings {
  riskProfile: RiskProfile
  monthlyBudget: number // EUR, frei für Investments
  horizonYears: number
  expectedReturnPct: number // erwartete Rendite p.a. für Projektionen
  cashReserve: number // EUR Notgroschen/Cash außerhalb des Depots
}

export interface CockpitState {
  version: 1
  /** true solange die mitgelieferten Demo-Daten aktiv sind */
  demo: boolean
  instruments: Instrument[]
  transactions: Transaction[]
  plans: SavingsPlan[]
  snapshots: Snapshot[]
  /** Favoriten im Screener */
  watchlist: string[]
  settings: Settings
}

/** Offene Position, abgeleitet aus den Transaktionen (Durchschnittskosten) */
export interface Position {
  instrument: Instrument
  shares: number
  invested: number // aktueller Einstand (Kostenbasis) der offenen Stücke
  avgCost: number
  value: number
  gain: number // unrealisiert, EUR
  gainPct: number
  realized: number // realisiertes Ergebnis aus Verkäufen, EUR
  weight: number // Anteil am Depotwert 0..1
}

export interface PortfolioSummary {
  value: number
  invested: number
  gain: number
  gainPct: number
  realized: number
  dividendYieldPct: number // gewichtete Dividenden-/Ausschüttungsrendite
  positions: Position[]
}
