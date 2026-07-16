import type { Player, Turn } from './types'

export type GameAwardTone = 'gold' | 'mint' | 'coral'
export type GameAwardId = 'high-roller' | 'efficiency' | 'pechvogel'

export interface GameAward {
  id: GameAwardId
  title: string
  names: string[]
  detail: string
  tone: GameAwardTone
}

const fmt = (value: number) => value.toLocaleString('de-DE')

function orderedNames(names: string[], players: Player[]): string[] {
  const rank = new Map([...players].sort((a, b) => b.score - a.score).map((player, index) => [player.name, index]))
  return [...new Set(names)].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b, 'de'))
}

function awardNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

export function gameAwardNames(award: GameAward): string {
  return awardNames(award.names)
}

/**
 * Kleine, rein deterministische Auszeichnungen für das Spielende und das
 * teilbare Ergebnisbild. Gleichstände werden bewusst gemeinsam ausgezeichnet.
 */
export function computeGameAwards(players: Player[], turns: Turn[]): GameAward[] {
  const awards: GameAward[] = []
  const completedTurns = turns.filter((turn) => players.some((player) => player.name === turn.player))

  const bestTurn = completedTurns.reduce((best, turn) => Math.max(best, turn.points), 0)
  if (bestTurn > 0) {
    const names = orderedNames(
      completedTurns.filter((turn) => turn.points === bestTurn).map((turn) => turn.player),
      players,
    )
    awards.push({
      id: 'high-roller',
      title: 'High Roller',
      names,
      detail: `${fmt(bestTurn)} Punkte in einem Zug`,
      tone: 'gold',
    })
  }

  const turnStats = players
    .map((player) => {
      const playerTurns = completedTurns.filter((turn) => turn.player === player.name)
      return {
        name: player.name,
        turns: playerTurns.length,
        average: playerTurns.length ? playerTurns.reduce((sum, turn) => sum + turn.points, 0) / playerTurns.length : 0,
      }
    })
    .filter((entry) => entry.turns > 0)

  if (turnStats.length > 0) {
    const bestAverage = Math.max(...turnStats.map((entry) => entry.average))
    const names = orderedNames(
      turnStats.filter((entry) => Math.abs(entry.average - bestAverage) < 0.001).map((entry) => entry.name),
      players,
    )
    awards.push({
      id: 'efficiency',
      title: 'Effizienz',
      names,
      detail: `${fmt(Math.round(bestAverage))} Punkte Ø pro Zug`,
      tone: 'mint',
    })
  }

  const mostBusts = players.reduce((max, player) => Math.max(max, player.busts), 0)
  if (mostBusts > 0) {
    const names = orderedNames(
      players.filter((player) => player.busts === mostBusts).map((player) => player.name),
      players,
    )
    awards.push({
      id: 'pechvogel',
      title: 'Pechvogel',
      names,
      detail: `${mostBusts} ${mostBusts === 1 ? 'Niete' : 'Nieten'}`,
      tone: 'coral',
    })
  }

  return awards
}
