import type { GameState, Player } from './types'

const KEY = '10k_active_game'

/** Vollständiger Zustand eines laufenden Spiels, um es später fortzusetzen. */
export interface ActiveGame {
  players: Player[]
  idx: number
  round: number
  phase: GameState
  target: number
  event: string
  testMode: boolean
  dice: number[]
  accumulated: number
  inHand: number
  turnHasPasch: boolean
  savedAt: string
}

export function saveActiveGame(game: ActiveGame): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(game))
  } catch {
    /* ignore */
  }
}

export function loadActiveGame(): ActiveGame | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as ActiveGame
    // Nur fortsetzbar, wenn ein laufendes Spiel mit Spielern vorliegt.
    if (!g.players?.length || (g.phase !== 'active' && g.phase !== 'lastChance')) return null
    return g
  } catch {
    return null
  }
}

export function clearActiveGame(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
