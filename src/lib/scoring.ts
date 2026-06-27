import type { ScoreResult } from './types'

export const WINNING_SCORE = 10000

/** Mindestpunkte, um das erste Mal aufs Konto zu kommen ("Einstieg"). */
export const ENTRY_MIN = 350

/**
 * Bewertet die eingetippten Würfel nach dem High-Stakes-Regelwerk aus der
 * Produktspezifikation:
 *
 *  - Einzelne 1 = 100, einzelne 5 = 50
 *  - Straße (1–6 bei 6 Würfeln) = 1500
 *  - Drei Paare (bei 6 Würfeln) = 1500
 *  - Drilling: 1er = 1000, 5er = 500, sonst Augenzahl × 100
 *  - "Plus-1000"-Regel: jeder weitere gleiche Würfel über den Drilling hinaus
 *    bringt pauschal +1000 Punkte (4er-Pasch = Basis + 1000, 5er = +2000, …)
 *  - Würfel ohne Wertung (2/3/4/6 unter dem Drilling) machen die Eingabe
 *    ungültig und werden markiert.
 */
export function calculateScore(dice: number[]): ScoreResult {
  if (dice.length === 0) {
    return { score: 0, label: '', isValid: true, invalidDice: [], hasTriple: false, hasJokerTriple: false }
  }

  // Verteidigung gegen kaputte Daten (manipuliertes localStorage, künftige Imports):
  // nur echte Würfelaugen 1–6 sind zulässig.
  if (dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) {
    return { score: 0, label: '', isValid: false, invalidDice: [...dice], hasTriple: false, hasJokerTriple: false }
  }

  const counts: Record<number, number> = {}
  dice.forEach((d) => (counts[d] = (counts[d] || 0) + 1))
  const distinctNumbers = Object.keys(counts).length

  // Sonderfälle nur bei einem vollen 6er-Wurf.
  if (dice.length === 6 && distinctNumbers === 6) {
    return {
      score: 1500,
      label: 'Straße!',
      isValid: true,
      invalidDice: [],
      hasTriple: false,
      hasJokerTriple: false,
    }
  }

  const pairsCount = Object.values(counts).filter((c) => c === 2).length
  if (dice.length === 6 && pairsCount === 3) {
    return {
      score: 1500,
      label: '3 Paare!',
      isValid: true,
      invalidDice: [],
      hasTriple: false,
      hasJokerTriple: false,
    }
  }

  let score = 0
  let label = ''
  let hasTriple = false
  let hasJokerTriple = false
  const invalidDice: number[] = []

  for (let num = 1; num <= 6; num++) {
    const count = counts[num] || 0
    if (count === 0) continue

    if (count >= 3) {
      hasTriple = true
      // Nur Drillinge aus {2,3,4,6} bringen eine neue Rettungsaugenzahl (Szenario B).
      if (num !== 1 && num !== 5) hasJokerTriple = true
      const baseValue = num === 1 ? 1000 : num === 5 ? 500 : num * 100
      score += baseValue + (count - 3) * 1000
      if (count > 3) label = `${count}er-Pasch!`
    } else if (num === 1) {
      score += count * 100
    } else if (num === 5) {
      score += count * 50
    } else {
      // 2/3/4/6 unterhalb eines Drillings werten nicht → ungültig.
      for (let i = 0; i < count; i++) invalidDice.push(num)
    }
  }

  return { score, label, isValid: invalidDice.length === 0, invalidDice, hasTriple, hasJokerTriple }
}

/**
 * Gibt es in diesem Wurf überhaupt etwas Wertbares (1, 5, Drilling, Straße,
 * 3 Paare)? Falls nein → Niete. Für den virtuellen Würfel-Modus.
 */
export function rollHasScore(dice: number[]): boolean {
  if (dice.length === 0) return false
  const counts: Record<number, number> = {}
  dice.forEach((d) => (counts[d] = (counts[d] || 0) + 1))
  if (counts[1] || counts[5]) return true
  for (const v of [2, 3, 4, 6]) if ((counts[v] || 0) >= 3) return true
  if (dice.length === 6) {
    if (Object.keys(counts).length === 6) return true // Straße
    if (Object.values(counts).filter((n) => n === 2).length === 3) return true // 3 Paare
  }
  return false
}
