// Offline-first Persistenz: kompletter Cockpit-Zustand in localStorage,
// gleiche Philosophie wie die Spiel-App (kein Backend nötig, Export/Import
// als Backup).

import { buildSeed, DEFAULT_SETTINGS, SEED_DIVIDENDS } from './seed'
import type { CockpitState } from './types'

const KEY = 'invest-cockpit-v1'

/** Ältere gespeicherte Stände sanft um neue Felder ergänzen. */
function migrate(parsed: CockpitState): CockpitState {
  return {
    ...parsed,
    targets: parsed.targets ?? {},
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    instruments: parsed.instruments.map((i) =>
      !i.dividend && SEED_DIVIDENDS[i.id] ? { ...i, dividend: SEED_DIVIDENDS[i.id] } : i,
    ),
  }
}

export function loadState(): CockpitState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return buildSeed()
    const parsed = JSON.parse(raw) as CockpitState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.instruments)) {
      return buildSeed()
    }
    return migrate(parsed)
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
      return migrate(parsed)
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
