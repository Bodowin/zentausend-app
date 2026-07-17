export const SCORE_STEP = 50

/**
 * Zehntausend-Wertungen verändern den Spielstand in 50er-Schritten. Eine rein
 * arithmetische Differenz wie 101 ist deshalb kein sinnvoller Spielhinweis:
 * Der kleinste tatsächlich erreichbare Wert ist in diesem Fall 150.
 */
export function playablePointsNeeded(rawPoints: number): number {
  if (!Number.isFinite(rawPoints) || rawPoints <= 0) return 0
  return Math.ceil(rawPoints / SCORE_STEP) * SCORE_STEP
}

/** Kleinster spielbarer Gesamtstand, der einen vorhandenen Stand übertrifft. */
export function nextPlayableScoreAbove(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.ceil((score + 1) / SCORE_STEP) * SCORE_STEP
}
