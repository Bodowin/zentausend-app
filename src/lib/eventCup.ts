import type { GameRecord, RiskAttempt } from './types'
import {
  identityNameMap,
  playerIdentityKey,
  turnIdentityKey,
  winnerIdentityKey,
} from './playerIdentity'
import { summarizeRiskAttempts } from './probabilityPerformance'

export interface EventCupStanding {
  rank: number
  id: string
  name: string
  games: number
  wins: number
  winRate: number
  averagePlacement: number
  bestScore: number
  totalScore: number
  busts: number
  bustRate: number
  headToHeadPoints: number
  riskAttempts: number
  riskSuccesses: number
  riskExpected: number
  riskBalance: number
}

export interface EventCupRecord {
  key: 'score' | 'risk' | 'streak'
  emoji: string
  title: string
  name: string
  detail: string
}

export interface EventCupDuel {
  key: string
  aId: string
  aName: string
  bId: string
  bName: string
  games: number
  aAhead: number
  bAhead: number
  ties: number
}

export interface EventCupProgressEntry {
  gameId: number
  number: number
  date: string
  winner: string
  leaders: string[]
  leaderChanged: boolean
}

export interface EventCupSummary {
  event: string
  games: GameRecord[]
  from: string
  to: string
  standings: EventCupStanding[]
  champions: EventCupStanding[]
  records: EventCupRecord[]
  duels: EventCupDuel[]
  progress: EventCupProgressEntry[]
  unassignedGames: GameRecord[]
  hasRiskData: boolean
}

interface MutableStanding extends Omit<EventCupStanding, 'rank' | 'winRate' | 'averagePlacement' | 'bustRate'> {
  placementTotal: number
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9
const pairKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`)

function playersById(game: GameRecord): Map<string, GameRecord['players'][number]> {
  return new Map(game.players.map((player) => [playerIdentityKey(player), player]))
}

function placementFor(score: number, players: GameRecord['players']): number {
  return 1 + players.filter((player) => player.score > score).length
}

function directPoints(group: MutableStanding[], games: GameRecord[]): Map<string, number> {
  const ids = new Set(group.map((standing) => standing.id))
  const points = new Map(group.map((standing) => [standing.id, 0]))

  for (const game of games) {
    const present = [...playersById(game).entries()].filter(([id]) => ids.has(id))
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        const [aId, a] = present[i]
        const [bId, b] = present[j]
        if (a.score > b.score) points.set(aId, (points.get(aId) ?? 0) + 1)
        else if (b.score > a.score) points.set(bId, (points.get(bId) ?? 0) + 1)
        else {
          points.set(aId, (points.get(aId) ?? 0) + 0.5)
          points.set(bId, (points.get(bId) ?? 0) + 0.5)
        }
      }
    }
  }

  return points
}

function samePrimaryRank(a: MutableStanding, b: MutableStanding): boolean {
  const aRate = a.games ? a.wins / a.games : 0
  const bRate = b.games ? b.wins / b.games : 0
  const aPlacement = a.games ? a.placementTotal / a.games : 0
  const bPlacement = b.games ? b.placementTotal / b.games : 0
  return a.wins === b.wins && close(aRate, bRate) && close(aPlacement, bPlacement)
}

function buildStandings(eventGames: GameRecord[], allHistory: GameRecord[]): EventCupStanding[] {
  const names = identityNameMap(allHistory)
  const standings = new Map<string, MutableStanding>()
  const riskById = new Map<string, RiskAttempt[]>()

  for (const game of eventGames) {
    const winnerId = winnerIdentityKey(game)
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      const current = standings.get(id) ?? {
        id,
        name: names.get(id) ?? player.name,
        games: 0,
        wins: 0,
        bestScore: 0,
        totalScore: 0,
        busts: 0,
        headToHeadPoints: 0,
        riskAttempts: 0,
        riskSuccesses: 0,
        riskExpected: 0,
        riskBalance: 0,
        placementTotal: 0,
      }
      current.name = names.get(id) ?? current.name
      current.games += 1
      current.wins += winnerId === id ? 1 : 0
      current.bestScore = Math.max(current.bestScore, player.score)
      current.totalScore += player.score
      current.busts += player.busts ?? 0
      current.placementTotal += placementFor(player.score, game.players)
      standings.set(id, current)
    }

    for (const turn of game.turns ?? []) {
      const id = turnIdentityKey(turn, game)
      const attempts = riskById.get(id) ?? []
      attempts.push(...(turn.riskAttempts ?? []))
      riskById.set(id, attempts)
    }
  }

  for (const standing of standings.values()) {
    const risk = summarizeRiskAttempts(standing.name, riskById.get(standing.id) ?? [])
    if (!risk) continue
    standing.riskAttempts = risk.attempts
    standing.riskSuccesses = risk.successes
    standing.riskExpected = risk.expectedSuccesses
    standing.riskBalance = risk.balance
  }

  const base = [...standings.values()].sort((a, b) => {
    const aRate = a.games ? a.wins / a.games : 0
    const bRate = b.games ? b.wins / b.games : 0
    const aPlacement = a.games ? a.placementTotal / a.games : Number.POSITIVE_INFINITY
    const bPlacement = b.games ? b.placementTotal / b.games : Number.POSITIVE_INFINITY
    return b.wins - a.wins || bRate - aRate || aPlacement - bPlacement || a.name.localeCompare(b.name, 'de')
  })

  const ranked: MutableStanding[] = []
  for (let index = 0; index < base.length; ) {
    let end = index + 1
    while (end < base.length && samePrimaryRank(base[index], base[end])) end += 1
    const group = base.slice(index, end)
    const points = directPoints(group, eventGames)
    group.forEach((standing) => {
      standing.headToHeadPoints = points.get(standing.id) ?? 0
    })
    group.sort(
      (a, b) =>
        b.headToHeadPoints - a.headToHeadPoints ||
        b.bestScore - a.bestScore ||
        a.name.localeCompare(b.name, 'de'),
    )
    ranked.push(...group)
    index = end
  }

  let previous: MutableStanding | null = null
  let previousRank = 0
  return ranked.map((standing, index) => {
    const tiedWithPrevious =
      previous !== null &&
      samePrimaryRank(previous, standing) &&
      close(previous.headToHeadPoints, standing.headToHeadPoints) &&
      previous.bestScore === standing.bestScore
    const rank = tiedWithPrevious ? previousRank : index + 1
    previous = standing
    previousRank = rank
    return {
      rank,
      id: standing.id,
      name: standing.name,
      games: standing.games,
      wins: standing.wins,
      winRate: standing.games ? standing.wins / standing.games : 0,
      averagePlacement: standing.games ? standing.placementTotal / standing.games : 0,
      bestScore: standing.bestScore,
      totalScore: standing.totalScore,
      busts: standing.busts,
      bustRate: standing.games ? standing.busts / standing.games : 0,
      headToHeadPoints: standing.headToHeadPoints,
      riskAttempts: standing.riskAttempts,
      riskSuccesses: standing.riskSuccesses,
      riskExpected: standing.riskExpected,
      riskBalance: standing.riskBalance,
    }
  })
}

function buildDuels(games: GameRecord[], names: Map<string, string>): EventCupDuel[] {
  const ids = new Set<string>()
  games.forEach((game) => game.players.forEach((player) => ids.add(playerIdentityKey(player))))
  const list = [...ids]
  const duels: EventCupDuel[] = []

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const aId = list[i]
      const bId = list[j]
      let aAhead = 0
      let bAhead = 0
      let ties = 0
      let shared = 0
      for (const game of games) {
        const byId = playersById(game)
        const a = byId.get(aId)
        const b = byId.get(bId)
        if (!a || !b) continue
        shared += 1
        if (a.score > b.score) aAhead += 1
        else if (b.score > a.score) bAhead += 1
        else ties += 1
      }
      if (shared === 0) continue
      duels.push({
        key: pairKey(aId, bId),
        aId,
        aName: names.get(aId) ?? aId,
        bId,
        bName: names.get(bId) ?? bId,
        games: shared,
        aAhead,
        bAhead,
        ties,
      })
    }
  }

  return duels
    .sort(
      (a, b) =>
        b.games - a.games ||
        Math.abs(a.aAhead - a.bAhead) - Math.abs(b.aAhead - b.bAhead) ||
        b.aAhead + b.bAhead - (a.aAhead + a.bAhead) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 3)
}

function longestLosingStreak(games: GameRecord[], names: Map<string, string>): { name: string; count: number } | null {
  const current = new Map<string, number>()
  const best = new Map<string, number>()

  for (const game of games) {
    const winnerId = winnerIdentityKey(game)
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      const next = winnerId === id ? 0 : (current.get(id) ?? 0) + 1
      current.set(id, next)
      best.set(id, Math.max(best.get(id) ?? 0, next))
    }
  }

  const ranked = [...best.entries()].sort(
    ([aId, a], [bId, b]) => b - a || (names.get(aId) ?? aId).localeCompare(names.get(bId) ?? bId, 'de'),
  )
  if (!ranked[0] || ranked[0][1] === 0) return null
  return { name: names.get(ranked[0][0]) ?? ranked[0][0], count: ranked[0][1] }
}

function recordNames(ids: string[], names: Map<string, string>): string {
  return ids.map((id) => names.get(id) ?? id).join(' & ')
}

function buildRecords(games: GameRecord[], standings: EventCupStanding[], names: Map<string, string>): EventCupRecord[] {
  const records: EventCupRecord[] = []
  let highest = Number.NEGATIVE_INFINITY
  let highestIds: string[] = []
  for (const game of games) {
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      if (player.score > highest) {
        highest = player.score
        highestIds = [id]
      } else if (player.score === highest && !highestIds.includes(id)) highestIds.push(id)
    }
  }
  if (Number.isFinite(highest)) {
    records.push({
      key: 'score',
      emoji: '🚀',
      title: 'Höchster Endstand',
      name: recordNames(highestIds, names),
      detail: `${highest.toLocaleString('de-DE')} Punkte`,
    })
  }

  const risk = standings
    .filter((standing) => standing.riskAttempts > 0)
    .sort(
      (a, b) =>
        b.riskBalance - a.riskBalance ||
        b.riskAttempts - a.riskAttempts ||
        a.name.localeCompare(b.name, 'de'),
    )[0]
  if (risk) {
    const sign = risk.riskBalance >= 0 ? '+' : ''
    records.push({
      key: 'risk',
      emoji: '🎲',
      title: 'Stärkste Risiko-Bilanz',
      name: risk.name,
      detail: `${sign}${risk.riskBalance.toFixed(1).replace('.', ',')} Würfe · ${risk.riskSuccesses}/${risk.riskAttempts} geschafft`,
    })
  }

  const streak = longestLosingStreak(games, names)
  if (streak) {
    records.push({
      key: 'streak',
      emoji: '🌧️',
      title: 'Größte Pechsträhne',
      name: streak.name,
      detail: `${streak.count} ${streak.count === 1 ? 'Spiel' : 'Spiele'} ohne Sieg`,
    })
  }

  return records
}

function sameLeaders(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function buildProgress(games: GameRecord[], allHistory: GameRecord[]): EventCupProgressEntry[] {
  const chronological = [...games].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const names = identityNameMap(allHistory)
  let previous: string[] = []
  return chronological.map((game, index) => {
    const standings = buildStandings(chronological.slice(0, index + 1), allHistory)
    const leaders = standings.filter((standing) => standing.rank === 1).map((standing) => standing.name)
    const winnerId = winnerIdentityKey(game)
    const winner = winnerId ? names.get(winnerId) ?? game.winner : game.winner
    const entry = {
      gameId: game.id,
      number: index + 1,
      date: game.date,
      winner,
      leaders,
      leaderChanged: index > 0 && !sameLeaders(previous, leaders),
    }
    previous = leaders
    return entry
  })
}

export function computeEventCup(history: GameRecord[], event: string): EventCupSummary | null {
  const trimmed = event.trim()
  if (!trimmed) return null
  const games = history
    .filter((game) => game.event === trimmed)
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  if (games.length === 0) return null

  const names = identityNameMap(history)
  const standings = buildStandings(games, history)
  const timestamps = games.map((game) => Date.parse(game.date)).filter(Number.isFinite)
  const from = new Date(Math.min(...timestamps)).toISOString()
  const to = new Date(Math.max(...timestamps)).toISOString()

  return {
    event: trimmed,
    games,
    from,
    to,
    standings,
    champions: standings.filter((standing) => standing.rank === 1),
    records: buildRecords(games, standings, names),
    duels: buildDuels(games, names),
    progress: buildProgress(games, history),
    unassignedGames: history
      .filter((game) => !game.event.trim())
      .slice()
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    hasRiskData: standings.some((standing) => standing.riskAttempts > 0),
  }
}
