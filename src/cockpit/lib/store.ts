// Offline-first Persistenz: kompletter Cockpit-Zustand in localStorage,
// gleiche Philosophie wie die Spiel-App (kein Backend nötig, Export/Import
// als Backup).

import { buildSeed } from './seed'
import type { CockpitState } from './types'

const KEY = 'invest-cockpit-v1'

export function loadState(): CockpitState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return buildSeed()
    const parsed = JSON.parse(raw) as CockpitState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.instruments)) {
      return buildSeed()
    }
    return parsed
  } catch {
    return buildSeed()
  }
}

export function saveState(state: CockpitState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Speicher voll o. ä. – App bleibt benutzbar, nur ohne Persistenz.
  }
}

export function exportStateJson(state: CockpitState): string {
  return JSON.stringify(state, null, 2)
}

export function parseImportedState(json: string): CockpitState | null {
  try {
    const parsed = JSON.parse(json) as CockpitState
    if (
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.instruments) &&
      Array.isArray(parsed.transactions) &&
      parsed.settings
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/** Demo-Portfolio entfernen, Kennzahlen-Bibliothek behalten. */
export function withoutDemoData(state: CockpitState): CockpitState {
  return {
    ...state,
    demo: false,
    transactions: [],
    plans: [],
    snapshots: [],
  }
}

export function resetToSeed(): CockpitState {
  return buildSeed()
}
