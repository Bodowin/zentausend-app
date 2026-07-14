import { getPrefs } from './prefs'

/** Dezentes haptisches Feedback (HTML5 Vibration API), wo verfügbar und aktiviert. */
export function buzz(pattern: number | number[] = 8): void {
  try {
    if (!getPrefs().haptics) return
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    /* nicht unterstützt – ignorieren */
  }
}
