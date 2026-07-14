import type { DiceMode, GameState, Player, Turn } from './types'

const KEY = '10k_active_game'
const RECOVERY_KEY = '10k_active_game_recovery_v1'
const CORRUPT_KEY = '10k_active_game_corrupt_v1'
const RECOVERY_LIMIT = 3

/** Vollständiger Zustand eines laufenden Spiels, um es später fortzusetzen. */
export interface ActiveGame {
  /** Stabile Identität der laufenden Partie – bleibt über Reloads und Gerätewechsel gleich. */
  sessionId: string
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
  /** Nur zur Anzeige: Der Hauptstand war beschädigt und wurde aus einer Sicherung repariert. */
  recoveredFromBackup?: boolean
}

const isDie = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6
const isNonNegativeInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0
const isPositiveInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0

function hashText(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function createActiveGameSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* fallback below */
  }
  return `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

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

function readRecoveryRaws(): string[] {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function persistable(game: ActiveGame): Omit<ActiveGame, 'recoveredFromBackup'> {
  const { recoveredFromBackup: _recovered, ...stored } = game
  return stored
}

/**
 * Speichert den aktuellen Stand und rotiert vorherige, gültige Versionen als
 * lokale Sicherheitskopien. Maximal drei Stände bleiben erhalten.
 */
export function saveActiveGame(game: ActiveGame): void {
  const nextRaw = JSON.stringify(persistable(game))

  try {
    const previousRaw = localStorage.getItem(KEY)
    if (previousRaw && previousRaw !== nextRaw && parseActiveGame(previousRaw)) {
      const backups = [previousRaw, ...readRecoveryRaws().filter((raw) => raw !== previousRaw)]
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(backups.slice(0, RECOVERY_LIMIT)))
    }
  } catch {
    /* Sicherungsrotation darf den primären Autosave nie verhindern. */
  }

  try {
    localStorage.setItem(KEY, nextRaw)
  } catch {
    /* ignore */
  }
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
      sessionId:
        typeof value.sessionId === 'string' && value.sessionId.trim()
          ? value.sessionId
          : `legacy-${hashText(raw)}`,
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

/**
 * Liest den Hauptstand. Ist er beschädigt, wird das Original separat gesichert
 * und die jüngste gültige Sicherheitskopie automatisch wiederhergestellt.
 * Ohne Hauptstand erfolgt bewusst keine Wiederherstellung, damit ein absichtlich
 * verworfenes Spiel nicht erneut auftaucht.
 */
export function loadActiveGame(): ActiveGame | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const current = parseActiveGame(raw)
    if (current) return current

    try {
      localStorage.setItem(CORRUPT_KEY, raw)
    } catch {
      /* Diagnosekopie ist best effort. */
    }

    for (const candidate of readRecoveryRaws()) {
      const restored = parseActiveGame(candidate)
      if (!restored) continue
      try {
        localStorage.setItem(KEY, candidate)
      } catch {
        /* Anzeige ist auch möglich, wenn das Zurückschreiben fehlschlägt. */
      }
      return { ...restored, recoveredFromBackup: true }
    }
    return null
  } catch {
    return null
  }
}

/** Bewusstes Verwerfen entfernt Hauptstand, Sicherungen und Diagnosekopie. */
export function clearActiveGame(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(RECOVERY_KEY)
    localStorage.removeItem(CORRUPT_KEY)
  } catch {
    /* ignore */
  }
}
