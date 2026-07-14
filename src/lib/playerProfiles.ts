import type { GameRecord } from './types'
import {
  identityNameMap,
  playerIdentityKey,
  resolveIdentitySelector,
  turnIdentityKey,
  winnerIdentityKey,
} from './playerIdentity'

export interface PlayerProfileResult {
  gameId: number
  date: string
  event: string
  won: boolean
  score: number
  rank: number
  playerCount: number
}

export interface PlayerProfileEvent {
  event: string
  games: number
  wins: number
  winRate: number
  avgScore: number
}

export interface PlayerProfile {
  id: string
  name: string
  games: number
  wins: number
  winRate: number
  totalScore: number
  avgScore: number
  bestScore: number
  busts: number
  bustsPerGame: number
  longestWinStreak: number
  currentWinStreak: number
  gamesWithTurnData: number
  successfulTurns: number
  bustTurns: number
  avgSuccessfulTurn: number | null
  bestTurn: { points: number; round: number; date: string; event: string } | null
  avgRounds: number | null
  fastestWinRounds: number | null
  nemesis: { id: string; name: string; ahead: number; games: number } | null
  recentResults: PlayerProfileResult[]
  events: PlayerProfileEvent[]
}

interface EventTally {
  games: number
  wins: number
  score: number
}

interface NemesisTally {
  ahead: number
  games: number
}

const byDateAsc = (a: GameRecord, b: GameRecord) => Date.parse(a.date) - Date.parse(b.date)
const byDateDesc = (a: GameRecord, b: GameRecord) => Date.parse(b.date) - Date.parse(a.date)

function playerRank(game: GameRecord, score: number): number {
  return 1 + game.players.filter((player) => player.score > score).length
}

/**
 * Erstellt ein persönliches, identitätsbasiertes Profil. Ältere Spiele ohne
 * Zugverlauf bleiben vollständig in Endstand, Siegquote und Nieten enthalten;
 * zugbasierte Kennzahlen weisen ihre eigene Datenabdeckung aus.
 */
export function computePlayerProfile(
  selector: string,
  history: GameRecord[],
  event?: string,
  recentLimit = 8,
): PlayerProfile | null {
  const id = resolveIdentitySelector(selector, history)
  const scoped = event ? history.filter((game) => game.event === event) : history
  const games = scoped
    .filter((game) => game.players.some((player) => playerIdentityKey(player) === id))
    .slice()
    .sort(byDateAsc)
  if (games.length === 0) return null

  const names = identityNameMap(history)
  let wins = 0
  let totalScore = 0
  let bestScore = 0
  let busts = 0
  let currentRun = 0
  let longestWinStreak = 0
  let gamesWithTurnData = 0
  let successfulTurns = 0
  let successfulTurnPoints = 0
  let bustTurns = 0
  let roundsTotal = 0
  let bestTurn: PlayerProfile['bestTurn'] = null
  let fastestWinRounds: number | null = null
  const eventTallies = new Map<string, EventTally>()
  const nemesisTallies = new Map<string, NemesisTally>()

  for (const game of games) {
    const player = game.players.find((candidate) => playerIdentityKey(candidate) === id)!
    const won = winnerIdentityKey(game) === id
    totalScore += player.score
    bestScore = Math.max(bestScore, player.score)
    busts += player.busts ?? 0
    if (won) {
      wins += 1
      currentRun += 1
      longestWinStreak = Math.max(longestWinStreak, currentRun)
    } else {
      currentRun = 0
    }

    const eventName = game.event.trim() || 'Ohne Anlass'
    const eventTally = eventTallies.get(eventName) ?? { games: 0, wins: 0, score: 0 }
    eventTally.games += 1
    eventTally.score += player.score
    if (won) eventTally.wins += 1
    eventTallies.set(eventName, eventTally)

    for (const opponent of game.players) {
      const opponentId = playerIdentityKey(opponent)
      if (opponentId === id) continue
      const tally = nemesisTallies.get(opponentId) ?? { ahead: 0, games: 0 }
      tally.games += 1
      if (opponent.score > player.score) tally.ahead += 1
      nemesisTallies.set(opponentId, tally)
    }

    const turns = game.turns ?? []
    if (turns.length === 0) continue
    gamesWithTurnData += 1
    const rounds = Math.max(...turns.map((turn) => turn.round))
    roundsTotal += rounds
    if (won && (fastestWinRounds === null || rounds < fastestWinRounds)) fastestWinRounds = rounds

    for (const turn of turns) {
      if (turnIdentityKey(turn, game) !== id) continue
      if (turn.bust) bustTurns += 1
      if (turn.points <= 0 || turn.bust) continue
      successfulTurns += 1
      successfulTurnPoints += turn.points
      if (!bestTurn || turn.points > bestTurn.points) {
        bestTurn = { points: turn.points, round: turn.round, date: game.date, event: game.event }
      }
    }
  }

  let currentWinStreak = 0
  for (let index = games.length - 1; index >= 0; index -= 1) {
    if (winnerIdentityKey(games[index]) !== id) break
    currentWinStreak += 1
  }

  let nemesis: PlayerProfile['nemesis'] = null
  for (const [opponentId, tally] of nemesisTallies) {
    if (tally.games < 2 || tally.ahead === 0) continue
    if (
      !nemesis ||
      tally.ahead / tally.games > nemesis.ahead / nemesis.games ||
      (tally.ahead / tally.games === nemesis.ahead / nemesis.games && tally.ahead > nemesis.ahead)
    ) {
      nemesis = {
        id: opponentId,
        name: names.get(opponentId) ?? opponentId,
        ahead: tally.ahead,
        games: tally.games,
      }
    }
  }

  const recentResults = games
    .slice()
    .sort(byDateDesc)
    .slice(0, recentLimit)
    .map((game) => {
      const player = game.players.find((candidate) => playerIdentityKey(candidate) === id)!
      return {
        gameId: game.id,
        date: game.date,
        event: game.event,
        won: winnerIdentityKey(game) === id,
        score: player.score,
        rank: playerRank(game, player.score),
        playerCount: game.players.length,
      }
    })

  const events = [...eventTallies.entries()]
    .map(([eventName, tally]) => ({
      event: eventName,
      games: tally.games,
      wins: tally.wins,
      winRate: tally.games ? tally.wins / tally.games : 0,
      avgScore: tally.games ? Math.round(tally.score / tally.games) : 0,
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.event.localeCompare(b.event, 'de'))

  return {
    id,
    name: names.get(id) ?? games[games.length - 1].players.find((player) => playerIdentityKey(player) === id)?.name ?? selector,
    games: games.length,
    wins,
    winRate: wins / games.length,
    totalScore,
    avgScore: Math.round(totalScore / games.length),
    bestScore,
    busts,
    bustsPerGame: busts / games.length,
    longestWinStreak,
    currentWinStreak,
    gamesWithTurnData,
    successfulTurns,
    bustTurns,
    avgSuccessfulTurn: successfulTurns ? Math.round(successfulTurnPoints / successfulTurns) : null,
    bestTurn,
    avgRounds: gamesWithTurnData ? Math.round((roundsTotal / gamesWithTurnData) * 10) / 10 : null,
    fastestWinRounds,
    nemesis,
    recentResults,
    events,
  }
}
