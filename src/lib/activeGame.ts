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
  /** Konfiguriertes Ziel + Einstiegsgrenze (ältere Stände: undefined → Standard). */
  goalScore?: number
  entryMin?: number
  kept: number[]
  dice: number[]
  accumulated: number
  turns: Turn[]
  /** Im virtuellen Modus: noch nicht ausgewählte Würfel des aktuellen Wurfs. */
  rolled: number[]
  /** Unveränderliches Ergebnis des aktuellen virtuellen Wurfs. */
  thrown?: number[]
  /** Sequenznummer zum frischen Mounten der Würfelschale. */
  throwSeq?: number
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
const isNonNegativeInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0
const isPositiveInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0

function isPlayer(p: unknown): p is Player {
  if (!p || typeof p !== 'object') return false
  const v = p as Partial<Player>
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    v.name.trim().length > 0 &&
    typeof v.score === 'number' &&
    Number.isFinite(v.score) &&
    v.score >= 0 &&
    isNonNegativeInt(v.busts)
  )
}

function isTurn(t: unknown): t is Turn {
  if (!t || typeof t !== 'object') return false
  const v = t as Partial<Turn>
  return (
    isPositiveInt(v.round) &&
    typeof v.player === 'string' &&
    v.player.trim().length > 0 &&
    typeof v.points === 'number' &&
    Number.isFinite(v.points) &&
    v.points >= 0 &&
    typeof v.bust === 'boolean'
  )
}

function sameDiceBag(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sort = (xs: number[]) => [...xs].sort((x, y) => x - y)
  const aa = sort(a)
  const bb = sort(b)
  return aa.every((v, i) => v === bb[i])
}

/**
 * Parst und validiert einen gespeicherten Spielstand. Als eigene pure Funktion
 * exportiert, damit beschädigte/alte Speicherstände ohne Browser getestet werden
 * können. Legacy-Stände ohne `thrown` bleiben gültig und werden beim Fortsetzen
 * aus `dice + rolled` rekonstruiert.
 */
export function parseActiveGame(raw: string | null): ActiveGame | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ActiveGame>
    const phase = value.phase
    if (phase !== 'active' && phase !== 'lastChance') return null

    const players = value.players
    if (!Array.isArray(players) || players.length < 2 || !players.every(isPlayer)) return null
    if (!isNonNegativeInt(value.idx) || value.idx >= players.length) return null
    if (!isPositiveInt(value.round)) return null
    if (typeof value.target !== 'number' || !Number.isFinite(value.target) || value.target < 0) return null
    if (typeof value.accumulated !== 'number' || !Number.isFinite(value.accumulated) || value.accumulated < 0) return null

    const diceMode: DiceMode = value.diceMode === 'virtual' ? 'virtual' : 'real'
    const kept = Array.isArray(value.kept) ? value.kept : []
    const dice = Array.isArray(value.dice) ? value.dice : []
    const rolled = Array.isArray(value.rolled) ? value.rolled : []
    const thrown = Array.isArray(value.thrown) ? value.thrown : []
    if (![...kept, ...dice, ...rolled, ...thrown].every(isDie)) return null
    if (kept.length + dice.length > 6 || kept.length > 6) return null

    // Neue virtuelle Stände müssen exakt denselben Würfel-Multiset in der Schale,
    // Auswahl und Restmenge enthalten. So kann kein beschädigter Speicherstand
    // beim Fortsetzen Würfel duplizieren oder verschwinden lassen.
    if (thrown.length > 0) {
      if (diceMode !== 'virtual' || thrown.length !== 6 - kept.length) return null
      if (!sameDiceBag(thrown, [...dice, ...rolled])) return null
    }

    const turns = Array.isArray(value.turns) ? value.turns : []
    if (!turns.every(isTurn)) return null
    if (value.goalScore !== undefined && (!isPositiveInt(value.goalScore) || value.goalScore > 1_000_000)) return null
    if (value.entryMin !== undefined && (!isNonNegativeInt(value.entryMin) || value.entryMin > 100_000)) return null

    return {
      players,
      idx: value.idx,
      round: value.round,
      phase,
      target: value.target,
      event: typeof value.event === 'string' ? value.event : '',
      testMode: value.testMode === true,
      diceMode,
      goalScore: value.goalScore,
      entryMin: value.entryMin,
      kept,
      dice,
      accumulated: value.accumulated,
      turns,
      rolled,
      thrown,
      throwSeq: isNonNegativeInt(value.throwSeq) ? value.throwSeq : 0,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function loadActiveGame(): ActiveGame | null {
  try {
    return parseActiveGame(localStorage.getItem(KEY))
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
