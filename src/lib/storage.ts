import type { GameRecord, Player, PlayerStats } from './types'

const HISTORY_KEY = '10k_history_v3'
const MAX_RECORDS = 200

export function getHistory(): GameRecord[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as GameRecord[]
  } catch {
    return []
  }
}

export function saveGame(winner: Player, allPlayers: Player[], event: string): GameRecord {
  const record: GameRecord = {
    id: Date.now(),
    date: new Date().toISOString(),
    event: event.trim(),
    winner: winner.name,
    winnerScore: winner.score,
    players: allPlayers.map((p) => ({ name: p.name, score: p.score, busts: p.busts })),
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
