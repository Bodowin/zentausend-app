/**
 * Risiko-Rechner (Wahrscheinlichkeits-Engine).
 *
 * Berechnet die Chance, dass der NÄCHSTE Wurf keine Niete wird (also mindestens
 * ein wertbarer Würfel fällt), abhängig von der Zahl verbleibender Würfel.
 *
 * Szenario A – Basis-Wurf: Es liegt kein aktiver Drilling. Rettungsanker sind
 *   nur die 1 und die 5 (plus zufällige neue Drillinge). Wir nutzen die exakten
 *   Farkle-Erfolgswahrscheinlichkeiten (Gegenwahrscheinlichkeit eines Busts),
 *   die neue Drillinge bereits berücksichtigen.
 *
 * Szenario B – Pasch-Wurf: Es wurde bereits ein Drilling gelegt, dessen
 *   Augenzahl x nun zusätzlich wertet. Rettungsanker sind 1, 5 und x. Werte
 *   gemäß Produktspezifikation.
 */

// Exakte Farkle-Erfolgswahrscheinlichkeiten (Szenario A), in Prozent.
const SUCCESS_A: Record<number, number> = {
  1: 33.33,
  2: 55.56,
  3: 72.22,
  4: 84.26,
  5: 92.28,
  6: 97.69,
}

// Szenario B (aktiver Pasch / Joker-Augenzahl), in Prozent.
const SUCCESS_B: Record<number, number> = {
  1: 50.0,
  2: 75.0,
  3: 88.89,
  4: 95.83,
  5: 98.84,
  6: 100.0,
}

export interface RiskInfo {
  /** Erfolgswahrscheinlichkeit in Prozent (0–100). */
  pct: number
  /** Anzahl der Würfel, die geworfen würden. */
  dice: number
  /** Aktiver Pasch-Modus? */
  scenarioB: boolean
  label: string
  /** Tailwind-Textklasse für die Einfärbung. */
  color: string
  /** Tailwind-Hintergrundklasse für den Balken. */
  bar: string
}

function classify(pct: number): Pick<RiskInfo, 'label' | 'color' | 'bar'> {
  if (pct >= 99.5) return { label: 'Garantiert', color: 'text-mint-300', bar: 'bg-risk-6' }
  if (pct >= 96) return { label: 'Fast garantiert', color: 'text-mint-400', bar: 'bg-risk-6' }
  if (pct >= 88) return { label: 'Sehr sicher', color: 'text-mint-400', bar: 'bg-risk-5' }
  if (pct >= 72) return { label: 'Gute Chance', color: 'text-risk-4', bar: 'bg-risk-4' }
  if (pct >= 55) return { label: 'Moderates Risiko', color: 'text-risk-3', bar: 'bg-risk-3' }
  if (pct >= 45) return { label: 'Neutral (50:50)', color: 'text-risk-2', bar: 'bg-risk-2' }
  return { label: 'Extremes Risiko', color: 'text-coral-400', bar: 'bg-risk-1' }
}

/**
 * @param remainingDice Würfel, die im nächsten Wurf geworfen würden (1–6).
 * @param scenarioB     true, wenn ein Drilling/Pasch aktiv ist (Joker-Augenzahl).
 */
export function computeRisk(remainingDice: number, scenarioB: boolean): RiskInfo | null {
  if (remainingDice < 1 || remainingDice > 6) return null
  const table = scenarioB ? SUCCESS_B : SUCCESS_A
  const pct = table[remainingDice]
  return { pct, dice: remainingDice, scenarioB, ...classify(pct) }
}

export type CoachTone = 'good' | 'ok' | 'warn' | 'danger'
export interface CoachAdvice {
  text: string
  tone: CoachTone
}

// Ab diesen Topf-Höhen wiegt ein Bust schwer genug, um trotz hoher Erfolgschance
// zur Vorsicht zu raten.
const POT_BIG = 1500
const POT_HUGE = 2500

/**
 * Empfehlung des Risiko-Coaches.
 *
 * Anders als die reine Bust-Chance berücksichtigt sie, WIE VIEL im Topf steht:
 * Ein Bust bei großem Topf schmerzt mehr, deshalb wird selbst bei hoher
 * Erfolgswahrscheinlichkeit nie pauschal „sicher" geraten, wenn viel auf dem
 * Spiel steht.
 *
 * @param pct      Erfolgschance des nächsten Wurfs (0–100).
 * @param pot      Punkte, die bei einem Bust verloren gingen (aktueller Topf).
 * @param canBank  Ist Sichern derzeit erlaubt (Einstiegsregel erfüllt)?
 * @param bankWins Würde Sichern jetzt das Spiel gewinnen?
 */
export function recommendAction(
  pct: number,
  pot: number,
  canBank: boolean,
  bankWins: boolean,
): CoachAdvice {
  if (bankWins && canBank) return { text: 'Sichern = Sieg!', tone: 'good' }
  // Einstieg noch nicht geschafft → man MUSS weiterwürfeln, Sichern geht nicht.
  if (!canBank) return { text: 'Für den Einstieg weiterwürfeln', tone: 'ok' }

  const bust = 100 - pct
  const bigPot = pot >= POT_BIG
  const hugePot = pot >= POT_HUGE

  if (bust <= 5) {
    return hugePot
      ? { text: 'Sehr sicher – aber viel im Topf', tone: 'ok' }
      : { text: 'Weiter ist sicher', tone: 'good' }
  }
  if (bust <= 15) {
    return bigPot
      ? { text: 'Gut – aber viel steht auf dem Spiel', tone: 'warn' }
      : { text: 'Weiter ist gut', tone: 'good' }
  }
  if (bust <= 35) {
    return bigPot
      ? { text: 'Riskant – lieber sichern', tone: 'danger' }
      : { text: 'Geht noch', tone: 'warn' }
  }
  return { text: 'Lieber sichern', tone: 'danger' }
}
