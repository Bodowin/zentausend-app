export interface Player {
  id: string
  name: string
  score: number
  /** Anzahl der Nieten ("Pechvogel-Quote") in diesem Spiel. */
  busts: number
}

export type GameState = 'setup' | 'active' | 'lastChance' | 'finished'

/** Spielmodus: echte Würfel (Zahlen-Pad) oder virtuelle Würfel (antippen). */
export type DiceMode = 'real' | 'virtual'

export interface ScoreResult {
  /** Punkte der aktuell eingetippten Würfel. */
  score: number
  /** Kurzlabel für eine besondere Kombination (z. B. "Straße!", "4er-Pasch!"). */
  label: string
  /** true, wenn alle eingetippten Würfel werten (keine ungültigen Augen). */
  isValid: boolean
  /** Augenzahlen, die keine Punkte bringen und rot markiert werden. */
  invalidDice: number[]
  /** true, wenn ein Drilling+ dabei ist. */
  hasTriple: boolean
  /**
   * true nur bei einem Drilling+ einer Augenzahl aus {2,3,4,6}. Nur DANN gilt
   * Risiko-Szenario B – ein Pasch aus 1ern/5ern bringt keine neue Rettungs-
   * augenzahl (1 und 5 retten ohnehin) und bleibt Szenario A.
   */
  hasJokerTriple: boolean
}

/** Ein bewusst eingegangenes Weiterwurf-Risiko und sein tatsächliches Ergebnis. */
export interface RiskAttempt {
  /** Exakte Erfolgswahrscheinlichkeit des nächsten Wurfs in Prozent. */
  successPct: number
  /** Anzahl der Würfel im Risiko-Wurf. */
  dice: number
  /** Aktive zusätzliche Pasch-Rettungszahl? */
  scenarioB: boolean
  /** Punkte, die beim Eingehen des Risikos im Zug standen. */
  pot: number
  /** true = mindestens ein wertbarer Würfel; false = Niete. */
  success: boolean
}

export type PendingRiskAttempt = Omit<RiskAttempt, 'success'>

/** Ein einzelner abgeschlossener Zug (für die Runden-Analyse). */
export interface Turn {
  /** Spielrunde, in der der Zug stattfand. */
  round: number
  player: string
  /** Stabile Identität; bei Altspielen ohne ID optional. */
  playerId?: string
  /** Gesicherte Punkte dieses Zugs (0 bei Niete). */
  points: number
  bust: boolean
  /** Bewusste Weiterwürfe dieses Zugs; ältere Spiele haben dieses Feld nicht. */
  riskAttempts?: RiskAttempt[]
}

/** Ein gespeichertes Spiel-Ergebnis (localStorage-Schema v3). */
export interface GameRecord {
  id: number
  date: string
  /** Optionales Event-Tag, z. B. "Skiurlaub 2025". Leer = kein Tag. */
  event: string
  winner: string
  winnerScore: number
  players: { playerId?: string; name: string; score: number; busts: number }[]
  /** Zug-für-Zug-Verlauf (ab v3.1; bei älteren Spielen nicht vorhanden). */
  turns?: Turn[]
}

/** Aggregierter Eintrag der ewigen Bestenliste. */
export interface PlayerStats {
  /** Stabile Identität für Duelle, Filter und React-Keys. */
  id: string
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
