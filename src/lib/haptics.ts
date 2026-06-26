/** Dezentes haptisches Feedback (HTML5 Vibration API), wo verfügbar. */
export function buzz(pattern: number | number[] = 8): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    /* nicht unterstützt – ignorieren */
  }
}
