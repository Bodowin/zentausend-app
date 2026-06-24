import type { ScoreResult } from './types'

export const WINNING_SCORE = 10000

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
    return { score: 0, label: '', isValid: true, invalidDice: [], hasTriple: false }
  }

  const counts: Record<number, number> = {}
  dice.forEach((d) => (counts[d] = (counts[d] || 0) + 1))
  const distinctNumbers = Object.keys(counts).length

  // Sonderfälle nur bei einem vollen 6er-Wurf.
  if (dice.length === 6 && distinctNumbers === 6) {
    return { score: 1500, label: 'Straße!', isValid: true, invalidDice: [], hasTriple: false }
  }

  const pairsCount = Object.values(counts).filter((c) => c === 2).length
  if (dice.length === 6 && pairsCount === 3) {
    return { score: 1500, label: '3 Paare!', isValid: true, invalidDice: [], hasTriple: false }
  }

  let score = 0
  let label = ''
  let hasTriple = false
  const invalidDice: number[] = []

  for (let num = 1; num <= 6; num++) {
    const count = counts[num] || 0
    if (count === 0) continue

    if (count >= 3) {
      hasTriple = true
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

  return { score, label, isValid: invalidDice.length === 0, invalidDice, hasTriple }
}
