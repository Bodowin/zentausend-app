import type { GameRecord, Player, PlayerStats, Turn } from './types'
import {
  validateGameRecordArray,
  type GameRecordSource,
  type GameRecordValidationBatch,
  type QuarantinedGameRecord,
} from './gameRecordValidation'
import {
  identityNameMap,
  playerIdentityKey,
  resolveIdentitySelector,
  turnIdentityKey,
  winnerIdentityKey,
} from './playerIdentity'

const HISTORY_KEY = '10k_history_v3'
const QUARANTINE_KEY = '10k_history_quarantine_v1'
const RECOVERY_KEY = '10k_history_recovery_v1'
const INTEGRITY_REPORT_KEY = '10k_history_integrity_report_v1'
const MAX_RECORDS = 200
const MAX_QUARANTINE_RECORDS = 100
const MAX_RECOVERY_SNAPSHOTS = 3

interface StoredQuarantineRecord extends QuarantinedGameRecord {
  capturedAt: string
}

interface HistoryRecoverySnapshot {
  capturedAt: string
  source: GameRecordSource
  raw: string
}

export interface HistoryIntegrityReport {
  checkedAt: string
  source: GameRecordSource
  repaired: number
  quarantined: number
  quarantineTotal: number
  recoverySaved: boolean
  quarantineStored: boolean
}

export interface HistoryIntegrityBundle {
  report: HistoryIntegrityReport | null
  quarantine: StoredQuarantineRecord[]
  recovery: HistoryRecoverySnapshot[]
}

function readArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]') as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function serialise(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function quarantineSignature(entry: QuarantinedGameRecord): string {
  return [entry.source, entry.id ?? '', entry.reasons.join('|'), serialise(entry.raw)].join('::')
}

export function recordHistoryValidation(
  source: GameRecordSource,
  validation: GameRecordValidationBatch,
  recoveryRaw?: string,
): HistoryIntegrityReport | null {
  if (validation.repaired === 0 && validation.quarantined.length === 0) return null

  const checkedAt = new Date().toISOString()
  let recoverySaved = false
  if (recoveryRaw !== undefined) {
    try {
      const recovery = readArray<HistoryRecoverySnapshot>(RECOVERY_KEY)
      if (recovery[0]?.raw !== recoveryRaw) {
        recovery.unshift({ capturedAt: checkedAt, source, raw: recoveryRaw })
      }
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery.slice(0, MAX_RECOVERY_SNAPSHOTS)))
      recoverySaved = true
    } catch {
      recoverySaved = false
    }
  }

  const existing = readArray<StoredQuarantineRecord>(QUARANTINE_KEY)
  const known = new Set(existing.map(quarantineSignature))
  const additions = validation.quarantined
    .filter((entry) => !known.has(quarantineSignature(entry)))
    .map((entry) => ({ ...entry, capturedAt: checkedAt }))
  const quarantine = [...additions, ...existing].slice(0, MAX_QUARANTINE_RECORDS)
  let quarantineStored = true
  try {
    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(quarantine))
  } catch {
    quarantineStored = false
  }

  const report: HistoryIntegrityReport = {
    checkedAt,
    source,
    repaired: validation.repaired,
    quarantined: validation.quarantined.length,
    quarantineTotal: quarantine.length,
    recoverySaved,
    quarantineStored,
  }
  try {
    localStorage.setItem(INTEGRITY_REPORT_KEY, JSON.stringify(report))
  } catch {
    /* Bericht bleibt über den Rückgabewert verfügbar. */
  }
  return report
}

export function getHistoryIntegrityReport(): HistoryIntegrityReport | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(INTEGRITY_REPORT_KEY) || 'null') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as HistoryIntegrityReport
  } catch {
    return null
  }
}

export function clearHistoryIntegrityReport(): void {
  try {
    localStorage.removeItem(INTEGRITY_REPORT_KEY)
  } catch {
    /* ignore */
  }
}

export function getHistoryIntegrityBundle(): HistoryIntegrityBundle {
  return {
    report: getHistoryIntegrityReport(),
    quarantine: readArray<StoredQuarantineRecord>(QUARANTINE_KEY),
    recovery: readArray<HistoryRecoverySnapshot>(RECOVERY_KEY),
  }
}

export function getHistory(): GameRecord[] {
  let raw = '[]'
  try {
    raw = localStorage.getItem(HISTORY_KEY) || '[]'
  } catch {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const invalidRoot = validateGameRecordArray(raw, 'local')
    recordHistoryValidation('local', invalidRoot, raw)
    return []
  }

  const validation = validateGameRecordArray(parsed, 'local')
  if (validation.repaired > 0 || validation.quarantined.length > 0) {
    recordHistoryValidation('local', validation, raw)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(validation.games.slice(0, MAX_RECORDS)))
    } catch {
      /* Recovery und Quarantäne bleiben erhalten. */
    }
  }
  return validation.games.slice(0, MAX_RECORDS)
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
    players: allPlayers.map((p) => ({ playerId: p.id, name: p.name, score: p.score, busts: p.busts })),
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

/** Ersetzt den lokalen Verlauf vollständig (z. B. nach einem Cloud-Merge). */
export function replaceHistory(games: GameRecord[]): void {
  const validation = validateGameRecordArray(games, 'local')
  if (validation.repaired > 0 || validation.quarantined.length > 0) {
    let previous: string | undefined
    try {
      previous = localStorage.getItem(HISTORY_KEY) ?? undefined
    } catch {
      previous = undefined
    }
    recordHistoryValidation('local', validation, previous)
  }
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(validation.games.slice(0, MAX_RECORDS)))
  } catch {
    /* ignore */
  }
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

/** Setzt nachträglich den Anlass eines einzelnen gespeicherten Spiels. */
export function setGameEvent(id: number, event: string): void {
  try {
    const next = getHistory().map((g) => (g.id === id ? { ...g, event: event.trim() } : g))
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
  const names = identityNameMap(games)
  const map = new Map<string, PlayerStats>()

  for (const game of games) {
    const winnerId = winnerIdentityKey(game)
    for (const p of game.players) {
      const id = playerIdentityKey(p)
      const s =
        map.get(id) ??
        {
          id,
          name: names.get(id) ?? p.name,
          games: 0,
          wins: 0,
          totalScore: 0,
          bestScore: 0,
          busts: 0,
          bustRate: 0,
          winRate: 0,
        }
      s.name = names.get(id) ?? s.name
      s.games += 1
      s.totalScore += p.score
      s.busts += p.busts ?? 0
      s.bestScore = Math.max(s.bestScore, p.score)
      if (winnerId === id) s.wins += 1
      map.set(id, s)
    }
  }

  const list = [...map.values()].map((s) => ({
    ...s,
    bustRate: s.games ? s.busts / s.games : 0,
    winRate: s.games ? s.wins / s.games : 0,
  }))

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

export interface PlayerForm {
  id: string
  name: string
  /** Letzte Spiele (neuestes zuerst): true = gewonnen, false = mitgespielt, verloren. */
  results: boolean[]
  games: number
}

/**
 * „Aktuelle Form": pro Spieler die Ergebnisse der letzten `limit` Spiele
 * (neuestes zuerst). Nur Spieler mit mindestens zwei Spielen, sortiert nach
 * den meisten Siegen im betrachteten Fenster. Optional auf ein Event gefiltert.
 */
export function computeForm(history = getHistory(), event?: string, limit = 5): PlayerForm[] {
  const games = (event ? history.filter((g) => g.event === event) : history)
    .slice()
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const names = identityNameMap(games)
  const map = new Map<string, boolean[]>()

  for (const game of games) {
    const winnerId = winnerIdentityKey(game)
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      const results = map.get(id) ?? []
      if (results.length < limit) results.push(winnerId === id)
      map.set(id, results)
    }
  }

  return [...map.entries()]
    .map(([id, results]) => ({ id, name: names.get(id) ?? id, results, games: results.length }))
    .filter((form) => form.games >= 2)
    .sort(
      (a, b) =>
        b.results.filter(Boolean).length - a.results.filter(Boolean).length || b.games - a.games,
    )
}

export interface HeadToHead {
  a: string
  b: string
  /** Spiele, in denen beide mitgespielt haben. */
  games: number
  /** Spiele, in denen A vor B landete (höherer Endstand). */
  aAhead: number
  bAhead: number
  /** Gesamtsiege im direkten Vergleich (A bzw. B war Spielsieger). */
  aWins: number
  bWins: number
  aBest: number
  bBest: number
  aAvg: number
  bAvg: number
}

/**
 * Direkter Vergleich zweier Spieler über alle Spiele, in denen beide dabei
 * waren. „Ahead" = wer im jeweiligen Spiel den höheren Endstand hatte.
 */
export function computeHeadToHead(
  a: string,
  b: string,
  history = getHistory(),
  event?: string,
): HeadToHead {
  const games = event ? history.filter((g) => g.event === event) : history
  const names = identityNameMap(games)
  const aId = resolveIdentitySelector(a, games)
  const bId = resolveIdentitySelector(b, games)
  const h: HeadToHead = {
    a: names.get(aId) ?? a,
    b: names.get(bId) ?? b,
    games: 0,
    aAhead: 0,
    bAhead: 0,
    aWins: 0,
    bWins: 0,
    aBest: 0,
    bBest: 0,
    aAvg: 0,
    bAvg: 0,
  }
  if (aId === bId) return h

  let aSum = 0
  let bSum = 0
  for (const game of games) {
    const pa = game.players.find((player) => playerIdentityKey(player) === aId)
    const pb = game.players.find((player) => playerIdentityKey(player) === bId)
    if (!pa || !pb) continue
    h.games += 1
    aSum += pa.score
    bSum += pb.score
    h.aBest = Math.max(h.aBest, pa.score)
    h.bBest = Math.max(h.bBest, pb.score)
    if (pa.score > pb.score) h.aAhead += 1
    else if (pb.score > pa.score) h.bAhead += 1
    const winnerId = winnerIdentityKey(game)
    if (winnerId === aId) h.aWins += 1
    if (winnerId === bId) h.bWins += 1
  }
  h.aAvg = h.games ? Math.round(aSum / h.games) : 0
  h.bAvg = h.games ? Math.round(bSum / h.games) : 0
  return h
}

/**
 * „Angstgegner" eines Spielers: der Gegenspieler, der in gemeinsamen Spielen
 * am häufigsten vor ihm landete (mindestens zwei Duelle). null, wenn es keinen
 * solchen Gegner gibt.
 */
export function computeNemesis(
  selector: string,
  history = getHistory(),
  event?: string,
): { id: string; name: string; ahead: number; of: number } | null {
  const allGames = event ? history.filter((g) => g.event === event) : history
  const targetId = resolveIdentitySelector(selector, allGames)
  const names = identityNameMap(allGames)
  const games = allGames.filter((game) => game.players.some((player) => playerIdentityKey(player) === targetId))
  const tally = new Map<string, { ahead: number; of: number }>()

  for (const game of games) {
    const me = game.players.find((player) => playerIdentityKey(player) === targetId)
    if (!me) continue
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      if (id === targetId) continue
      const result = tally.get(id) ?? { ahead: 0, of: 0 }
      result.of += 1
      if (player.score > me.score) result.ahead += 1
      tally.set(id, result)
    }
  }

  let best: { id: string; name: string; ahead: number; of: number } | null = null
  for (const [id, result] of tally) {
    if (result.of < 2 || result.ahead === 0) continue
    if (
      !best ||
      result.ahead / result.of > best.ahead / best.of ||
      (result.ahead / result.of === best.ahead / best.of && result.ahead > best.ahead)
    ) {
      best = { id, name: names.get(id) ?? id, ahead: result.ahead, of: result.of }
    }
  }
  return best
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

  const names = identityNameMap(games)
  const stats = aggregateStats(games)
  const awards: Award[] = []

  const champ = stats.find((s) => s.wins > 0)
  if (champ) {
    awards.push({
      key: 'wins',
      emoji: '👑',
      title: event ? `${event}-Champion` : 'Meiste Siege',
      name: champ.name,
      detail: `${champ.wins} ${champ.wins === 1 ? 'Sieg' : 'Siege'}`,
    })
  }

  const pech = [...stats].sort((a, b) => b.busts - a.busts)[0]
  if (pech && pech.busts > 0) {
    awards.push({ key: 'busts', emoji: '💀', title: 'Pechvogel', name: pech.name, detail: `${pech.busts} Nieten` })
  }

  const record = [...games].sort((a, b) => b.winnerScore - a.winnerScore)[0]
  if (record) {
    const winnerId = winnerIdentityKey(record)
    awards.push({
      key: 'record',
      emoji: '🎯',
      title: 'Rekord-Endstand',
      name: winnerId ? names.get(winnerId) ?? record.winner : record.winner,
      detail: record.winnerScore.toLocaleString('de-DE'),
    })
  }

  const minGames = stats.some((s) => s.games >= 2) ? 2 : 1
  const avg = stats
    .filter((s) => s.games >= minGames)
    .map((s) => ({ name: s.name, value: Math.round(s.totalScore / s.games) }))
    .sort((a, b) => b.value - a.value)[0]
  if (avg) {
    awards.push({ key: 'avg', emoji: '📈', title: 'Bester Schnitt', name: avg.name, detail: `Ø ${avg.value.toLocaleString('de-DE')}` })
  }

  let bestTurn = { id: '', name: '', points: 0 }
  for (const game of games) {
    for (const turn of game.turns ?? []) {
      if (turn.points <= bestTurn.points) continue
      const id = turnIdentityKey(turn, game)
      bestTurn = { id, name: names.get(id) ?? turn.player, points: turn.points }
    }
  }
  if (bestTurn.points > 0) {
    awards.push({
      key: 'bestturn',
      emoji: '🚀',
      title: 'Bester Einzelzug',
      name: bestTurn.name,
      detail: bestTurn.points.toLocaleString('de-DE'),
    })
  }

  let fastest = { id: '', name: '', rounds: Infinity }
  for (const game of games) {
    const turns = game.turns ?? []
    if (!turns.length) continue
    const rounds = Math.max(...turns.map((turn) => turn.round))
    if (rounds >= fastest.rounds) continue
    const id = winnerIdentityKey(game) ?? ''
    fastest = { id, name: (id && names.get(id)) ?? game.winner, rounds }
  }
  if (fastest.rounds !== Infinity && fastest.rounds > 0) {
    awards.push({
      key: 'fastest',
      emoji: '⚡',
      title: 'Schnellster Sieg',
      name: fastest.name,
      detail: `${fastest.rounds} ${fastest.rounds === 1 ? 'Runde' : 'Runden'}`,
    })
  }

  const byDate = [...games].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  let best = { id: '', name: '', len: 0 }
  let current = { id: '', name: '', len: 0 }
  for (const game of byDate) {
    const id = winnerIdentityKey(game) ?? `winner:${game.winner}`
    const name = names.get(id) ?? game.winner
    current = id === current.id ? { id, name, len: current.len + 1 } : { id, name, len: 1 }
    if (current.len > best.len) best = { ...current }
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
