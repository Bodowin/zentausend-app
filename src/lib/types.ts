export interface Player {
  id: string
  name: string
  score: number
  /** Anzahl der Nieten ("Pechvogel-Quote") in diesem Spiel. */
  busts: number
}

export type GameState = 'setup' | 'active' | 'lastChance' | 'finished'

export interface ScoreResult {
  /** Punkte der aktuell eingetippten Würfel. */
  score: number
  /** Kurzlabel für eine besondere Kombination (z. B. "Straße!", "4er-Pasch!"). */
  label: string
  /** true, wenn alle eingetippten Würfel werten (keine ungültigen Augen). */
  isValid: boolean
  /** Augenzahlen, die keine Punkte bringen und rot markiert werden. */
  invalidDice: number[]
  /** true, wenn ein Drilling+ dabei ist (aktiviert den Pasch-Risiko-Modus). */
  hasTriple: boolean
}

/** Ein gespeichertes Spiel-Ergebnis (localStorage-Schema v3). */
export interface GameRecord {
  id: number
  date: string
  /** Optionales Event-Tag, z. B. "Skiurlaub 2025". Leer = kein Tag. */
  event: string
  winner: string
  winnerScore: number
  players: { name: string; score: number; busts: number }[]
}

/** Aggregierter Eintrag der ewigen Bestenliste. */
export interface PlayerStats {
  name: string
  games: number
  wins: number
  totalScore: number
  bestScore: number
  busts: number
  /** Nieten pro Spiel. */
  bustRate: number
  winRate: number
}
