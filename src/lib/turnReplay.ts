import type { GameState, Player, Turn } from './types'

const MAX_CORRECTED_POINTS = 1_000_000

export interface TurnReplayResult {
  players: Player[]
  turns: Turn[]
  idx: number
  round: number
  phase: GameState
  target: number
  winner: Player | null
}

export class TurnReplayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TurnReplayError'
  }
}

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('de-DE')

function matchesPlayer(turn: Turn, player: Player): boolean {
  if (turn.playerId) return turn.playerId === player.id
  return normalizeName(turn.player) === normalizeName(player.name)
}

function winnerOf(players: Player[]): Player {
  return [...players].sort((a, b) => b.score - a.score)[0]
}

/**
 * Spielt alle abgeschlossenen Züge vom unveränderten Kader aus erneut ab.
 * Dadurch werden nach einer Korrektur Punktestände, Nieten, Runden, Zielphase
 * und der aktuell nächste Spieler aus einer einzigen Quelle rekonstruiert.
 */
export function replayCompletedTurns(
  roster: Pick<Player, 'id' | 'name'>[],
  sourceTurns: Turn[],
  goalScore: number,
  entryMin: number,
): TurnReplayResult {
  if (roster.length < 2) throw new TurnReplayError('Mindestens zwei Spieler sind erforderlich.')
  if (!Number.isInteger(goalScore) || goalScore <= 0) throw new TurnReplayError('Ungültige Zielpunktzahl.')
  if (!Number.isInteger(entryMin) || entryMin < 0) throw new TurnReplayError('Ungültige Einstiegsgrenze.')

  const players: Player[] = roster.map((player) => ({ ...player, score: 0, busts: 0 }))
  const turns: Turn[] = []
  let idx = 0
  let round = 1
  let phase: GameState = 'active'
  let target = 0
  let winner: Player | null = null

  for (let turnIndex = 0; turnIndex < sourceTurns.length; turnIndex += 1) {
    if (phase === 'finished') {
      throw new TurnReplayError('Die Korrektur würde das Spiel vor späteren, bereits erfassten Zügen beenden.')
    }

    const source = sourceTurns[turnIndex]
    const current = players[idx]
    if (!current || !matchesPlayer(source, current)) {
      throw new TurnReplayError(`Zug ${turnIndex + 1} passt nicht mehr zur Spielerreihenfolge.`)
    }

    const bust = source.bust === true
    const points = bust ? 0 : source.points
    if (
      !bust &&
      (!Number.isInteger(points) || points <= 0 || points > MAX_CORRECTED_POINTS || points % 50 !== 0)
    ) {
      throw new TurnReplayError('Punkte müssen positiv und in 50er-Schritten eingegeben werden.')
    }
    if (!bust && current.score === 0 && points < entryMin) {
      throw new TurnReplayError(`Der erste gesicherte Zug muss mindestens ${entryMin.toLocaleString('de-DE')} Punkte haben.`)
    }

    const normalizedTurn: Turn = {
      round,
      player: current.name,
      playerId: current.id,
      points,
      bust,
    }
    turns.push(normalizedTurn)

    if (bust) current.busts += 1
    else current.score += points

    const lastPlayer = players.length - 1
    if (phase === 'lastChance') {
      target = Math.max(target, current.score)
      if (idx === lastPlayer) {
        phase = 'finished'
        winner = winnerOf(players)
      } else {
        idx += 1
      }
      continue
    }

    if (current.score >= goalScore) {
      if (idx === lastPlayer) {
        phase = 'finished'
        winner = winnerOf(players)
      } else {
        phase = 'lastChance'
        target = current.score
        idx += 1
      }
      continue
    }

    idx = (idx + 1) % players.length
    if (idx === 0) round += 1
  }

  return { players, turns, idx, round, phase, target, winner }
}
