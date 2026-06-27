import type { GameRecord, Player, PlayerStats, Turn } from './types'

const HISTORY_KEY = '10k_history_v3'
const MAX_RECORDS = 200

export function getHistory(): GameRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as GameRecord[]
  } catch {
    return []
  }
}

export function saveGame(
  winner: Player,
  allPlayers: Player[],
  event: string,
  turns: Turn[] = [],
): GameRecord {
  const record: GameRecord = {
    id: Date.now(),
    date: new Date().toISOString(),
    event: event.trim(),
    winner: winner.name,
    winnerScore: winner.score,
    players: allPlayers.map((p) => ({ name: p.name, score: p.score, busts: p.busts })),
    turns,
  }
  try {
    const next = [record, ...getHistory()].slice(0, MAX_RECORDS)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('Konnte Spiel nicht speichern', e)
  }
  return record
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    /* ignore */
  }
}

/** Entfernt ein einzelnes Spiel aus dem lokalen Verlauf. */
export function removeGame(id: number): void {
  try {
    const next = getHistory().filter((g) => g.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Liste aller bisher gespielten Event-Tags (für Schnellauswahl). */
export function getEvents(history = getHistory()): string[] {
  const seen = new Set<string>()
  for (const g of history) {
    if (g.event) seen.add(g.event)
  }
  return [...seen]
}

/**
 * Aggregiert die "ewige Bestenliste": pro Spielername Anzahl Spiele, Siege,
 * Bestwert und Pechvogel-Quote. Optional auf ein Event gefiltert.
 */
export function aggregateStats(history = getHistory(), event?: string): PlayerStats[] {
  const games = event ? history.filter((g) => g.event === event) : history
  const map = new Map<string, PlayerStats>()

  for (const game of games) {
    for (const p of game.players) {
      const s =
        map.get(p.name) ??
        {
          name: p.name,
          games: 0,
          wins: 0,
          totalScore: 0,
          bestScore: 0,
          busts: 0,
          bustRate: 0,
          winRate: 0,
        }
      s.games += 1
      s.totalScore += p.score
      s.busts += p.busts ?? 0
      s.bestScore = Math.max(s.bestScore, p.score)
      if (game.winner === p.name) s.wins += 1
      map.set(p.name, s)
    }
  }

  const list = [...map.values()].map((s) => ({
    ...s,
    bustRate: s.games ? s.busts / s.games : 0,
    winRate: s.games ? s.wins / s.games : 0,
  }))

  // Sortierung: meiste Siege, dann beste Siegquote, dann höchster Bestwert.
  list.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.bestScore - a.bestScore)
  return list
}

export interface GamePlayerStat {
  name: string
  total: number
  turns: number
  avg: number
  busts: number
  best: number
}

export interface GameAnalysis {
  hasTurns: boolean
  players: GamePlayerStat[]
  roundNumbers: number[]
  /** round -> spielername -> in dieser Runde gesicherte Punkte */
  roundPoints: Record<number, Record<string, number>>
  bestTurn: { name: string; points: number; round: number } | null
  mostBusts: { name: string; count: number } | null
  roundsCount: number
}

/** Detail-Analyse eines einzelnen Spiels (Zug- und Rundendaten). */
export function computeGameAnalysis(game: GameRecord): GameAnalysis {
  const names = game.players.map((p) => p.name)
  const finalByName = new Map(game.players.map((p) => [p.name, p]))
  const turns: Turn[] = game.turns ?? []
  const hasTurns = turns.length > 0

  const players: GamePlayerStat[] = names
    .map((name) => {
      const ts = turns.filter((t) => t.player === name)
      const final = finalByName.get(name)
      const total = final?.score ?? ts.reduce((s, t) => s + t.points, 0)
      const turnsCount = ts.length
      const busts = final?.busts ?? ts.filter((t) => t.bust).length
      const best = ts.reduce((m, t) => Math.max(m, t.points), 0)
      return { name, total, turns: turnsCount, avg: turnsCount ? Math.round(total / turnsCount) : 0, busts, best }
    })
    .sort((a, b) => b.total - a.total)

  const roundNumbers = [...new Set(turns.map((t) => t.round))].sort((a, b) => a - b)
  const roundPoints: Record<number, Record<string, number>> = {}
  for (const r of roundNumbers) {
    roundPoints[r] = Object.fromEntries(names.map((n) => [n, 0]))
  }
  for (const t of turns) roundPoints[t.round][t.player] += t.points

  let bestTurn: GameAnalysis['bestTurn'] = null
  for (const t of turns) {
    if (t.points > 0 && (!bestTurn || t.points > bestTurn.points)) {
      bestTurn = { name: t.player, points: t.points, round: t.round }
    }
  }

  const mostBusts = [...players].sort((a, b) => b.busts - a.busts)[0]

  return {
    hasTurns,
    players,
    roundNumbers,
    roundPoints,
    bestTurn,
    mostBusts: mostBusts && mostBusts.busts > 0 ? { name: mostBusts.name, count: mostBusts.busts } : null,
    roundsCount: roundNumbers.length,
  }
}

export interface Award {
  key: string
  emoji: string
  title: string
  name: string
  detail: string
}

/** Berechnet Awards & Rekorde aus dem Verlauf (optional auf ein Event gefiltert). */
export function computeAwards(history = getHistory(), event?: string): Award[] {
  const games = event ? history.filter((g) => g.event === event) : history
  if (games.length === 0) return []

  const stats = aggregateStats(games)
  const awards: Award[] = []

  const champ = stats.find((s) => s.wins > 0)
  if (champ) {
    awards.push({
      key: 'wins',
      emoji: '👑',
      title: 'Meiste Siege',
      name: champ.name,
      detail: `${champ.wins} ${champ.wins === 1 ? 'Sieg' : 'Siege'}`,
    })
  }

  const pech = [...stats].sort((a, b) => b.busts - a.busts)[0]
  if (pech && pech.busts > 0) {
    awards.push({
      key: 'busts',
      emoji: '💀',
      title: 'Pechvogel',
      name: pech.name,
      detail: `${pech.busts} Nieten`,
    })
  }

  // Rekord-Endstand = höchster Gewinner-Score über alle Spiele.
  const record = [...games].sort((a, b) => b.winnerScore - a.winnerScore)[0]
  if (record) {
    awards.push({
      key: 'record',
      emoji: '🎯',
      title: 'Rekord-Endstand',
      name: record.winner,
      detail: record.winnerScore.toLocaleString('de-DE'),
    })
  }

  // Bester Schnitt (ab 2 Spielen aussagekräftig, sonst ab 1).
  const minGames = stats.some((s) => s.games >= 2) ? 2 : 1
  const avg = stats
    .filter((s) => s.games >= minGames)
    .map((s) => ({ name: s.name, value: Math.round(s.totalScore / s.games) }))
    .sort((a, b) => b.value - a.value)[0]
  if (avg) {
    awards.push({
      key: 'avg',
      emoji: '📈',
      title: 'Bester Schnitt',
      name: avg.name,
      detail: `Ø ${avg.value.toLocaleString('de-DE')}`,
    })
  }

  // Längste Siegesserie (chronologisch aufeinanderfolgende Siege).
  const byDate = [...games].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  let best = { name: '', len: 0 }
  let cur = { name: '', len: 0 }
  for (const g of byDate) {
    cur = g.winner === cur.name ? { name: cur.name, len: cur.len + 1 } : { name: g.winner, len: 1 }
    if (cur.len > best.len) best = { ...cur }
  }
  if (best.len >= 2) {
    awards.push({
      key: 'streak',
      emoji: '🔥',
      title: 'Längste Serie',
      name: best.name,
      detail: `${best.len} Siege in Folge`,
    })
  }

  return awards
}
