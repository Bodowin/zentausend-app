import type { DiceMode, GameState, Player, Turn } from './types'

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
  diceMode: DiceMode
  kept: number[]
  dice: number[]
  accumulated: number
  turns: Turn[]
  rolled: number[]
  savedAt: string
}

export function saveActiveGame(game: ActiveGame): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(game))
  } catch {
    /* ignore */
  }
}

const isDie = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6

export function loadActiveGame(): ActiveGame | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const g = JSON.parse(raw) as ActiveGame
    // Nur fortsetzbar, wenn ein laufendes Spiel mit Spielern vorliegt.
    if (!g.players?.length || (g.phase !== 'active' && g.phase !== 'lastChance')) return null
    // Verteidigung gegen beschädigten Speicher: Index, Würfel und Hand prüfen.
    if (typeof g.idx !== 'number' || g.idx < 0 || g.idx >= g.players.length) return null
    const kept = g.kept ?? []
    const dice = g.dice ?? []
    const rolled = g.rolled ?? []
    if (![...kept, ...dice, ...rolled].every(isDie)) return null
    if (kept.length + dice.length > 6) return null
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
