import type { GameRecord, Turn } from './types'
import { markPlayerIdentityDirty } from './playerIdentitySyncMeta'
import { sanitizePlayerIdentityState } from './playerIdentityState'

const ALIAS_KEY = '10k_player_aliases_v1'
const REDIRECT_KEY = '10k_player_redirects_v1'
const PREFERRED_NAME_KEY = '10k_player_preferred_names_v1'
const RECOVERY_KEY = '10k_player_identity_recovery_v1'
const HISTORY_KEY = '10k_history_v3'
const MAX_RECOVERY_SNAPSHOTS = 5

export interface PlayerIdentityState {
  aliases: Record<string, string>
  redirects: Record<string, string>
  preferredNames: Record<string, string>
}

export interface PlayerIdentityImportResult {
  imported: number
  conflicts: number
}

interface PlayerIdentityRecoverySnapshot extends PlayerIdentityState {
  capturedAt: string
}

/** Namen nur für Identitätsabgleich normalisieren, niemals für die Anzeige. */
export function normalizePlayerName(name: string): string {
  return name.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

function readRecord(key: string): Record<string, string> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}') as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([entryKey, value]) => Boolean(entryKey.trim()) && typeof value === 'string' && value.trim(),
      ),
    ) as Record<string, string>
  } catch {
    return {}
  }
}

function writeRecord(key: string, value: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Der deterministische Namens-Fallback bleibt weiterhin verfügbar. */
  }
}

function readStoredState(): PlayerIdentityState {
  return {
    aliases: readRecord(ALIAS_KEY),
    redirects: readRecord(REDIRECT_KEY),
    preferredNames: readRecord(PREFERRED_NAME_KEY),
  }
}

function writeState(state: PlayerIdentityState, markDirty = true): void {
  const clean = sanitizePlayerIdentityState(state)
  writeRecord(ALIAS_KEY, clean.aliases)
  writeRecord(REDIRECT_KEY, clean.redirects)
  writeRecord(PREFERRED_NAME_KEY, clean.preferredNames)
  if (markDirty) markPlayerIdentityDirty()
}

function resolveRedirect(id: string, redirects: Record<string, string>): string {
  let current = id.trim()
  const seen = new Set<string>()
  while (current && redirects[current] && !seen.has(current)) {
    seen.add(current)
    current = redirects[current].trim()
  }
  return current || id.trim()
}

export function resolvePlayerId(id: string): string {
  return resolveRedirect(id, readStoredState().redirects)
}

/**
 * Cloud- und Backup-Spiele tragen ihre stabile ID bereits im Spieler-JSON. Ein
 * neues Gerät darf diese Zuordnung lernen, aber nur wenn ein Name im gesamten
 * lokalen Verlauf eindeutig genau einer ID zugeordnet ist.
 */
function inferAliasesFromHistory(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return {}
    const candidates = new Map<string, Set<string>>()
    for (const game of parsed) {
      if (!game || typeof game !== 'object' || Array.isArray(game)) continue
      const players = (game as { players?: unknown }).players
      if (!Array.isArray(players)) continue
      for (const player of players) {
        if (!player || typeof player !== 'object' || Array.isArray(player)) continue
        const name = (player as { name?: unknown }).name
        const playerId = (player as { playerId?: unknown }).playerId
        if (typeof name !== 'string' || typeof playerId !== 'string' || !playerId.trim()) continue
        const normalized = normalizePlayerName(name)
        if (!normalized) continue
        const ids = candidates.get(normalized) ?? new Set<string>()
        ids.add(playerId.trim())
        candidates.set(normalized, ids)
      }
    }
    return Object.fromEntries(
      [...candidates.entries()]
        .filter(([, ids]) => ids.size === 1)
        .map(([name, ids]) => [name, [...ids][0]]),
    )
  } catch {
    return {}
  }
}

function readAliases(): Record<string, string> {
  const state = readStoredState()
  const combined = { ...inferAliasesFromHistory(), ...state.aliases }
  return Object.fromEntries(
    Object.entries(combined).map(([name, id]) => [name, resolveRedirect(id, state.redirects)]),
  )
}

function readRecovery(): PlayerIdentityRecoverySnapshot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(RECOVERY_KEY) || '[]') as unknown
    return Array.isArray(parsed) ? (parsed as PlayerIdentityRecoverySnapshot[]) : []
  } catch {
    return []
  }
}

function writeRecovery(recovery: PlayerIdentityRecoverySnapshot[]): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery.slice(0, MAX_RECOVERY_SNAPSHOTS)))
    return true
  } catch {
    return false
  }
}

function snapshotState(state = readStoredState()): void {
  const recovery = readRecovery()
  recovery.unshift({ capturedAt: new Date().toISOString(), ...state })
  if (!writeRecovery(recovery)) {
    throw new Error('Sicherung konnte nicht gespeichert werden. Bitte Gerätespeicher freigeben.')
  }
}

/**
 * Deterministische Altformat-ID: gleiche Schreibweise (ohne Groß-/Kleinschreibung
 * und Mehrfach-Leerzeichen) ergibt auf jedem Gerät dieselbe Identität.
 */
export function legacyPlayerId(name: string): string {
  return `player:name:${encodeURIComponent(normalizePlayerName(name))}`
}

export function playerIdForName(name: string): string {
  const normalized = normalizePlayerName(name)
  return resolvePlayerId(readAliases()[normalized] ?? legacyPlayerId(name))
}

/**
 * Explizite Kader-Umbenennung: alter und neuer Name zeigen danach auf dieselbe ID.
 * Historische Spiele werden nicht verändert; die Zuordnung bleibt reversibel.
 */
export function linkPlayerNames(oldName: string, newName: string): string {
  const oldKey = normalizePlayerName(oldName)
  const newKey = normalizePlayerName(newName)
  const state = readStoredState()
  const id = resolveRedirect(readAliases()[oldKey] ?? legacyPlayerId(oldName), state.redirects)
  if (oldKey) state.aliases[oldKey] = id
  if (newKey) state.aliases[newKey] = id
  if (newName.trim()) state.preferredNames[id] = newName.trim()
  writeState(state)
  return id
}

export function playerIdentityKey(player: { playerId?: string; name: string }): string {
  return resolvePlayerId(player.playerId?.trim() || playerIdForName(player.name))
}

export function winnerIdentityKey(game: GameRecord): string | null {
  const winnerName = normalizePlayerName(game.winner)
  const named = game.players.find((player) => normalizePlayerName(player.name) === winnerName)
  if (named) return playerIdentityKey(named)

  const best = Math.max(...game.players.map((player) => player.score))
  const leaders = game.players.filter((player) => player.score === best)
  return leaders.length === 1 ? playerIdentityKey(leaders[0]) : null
}

/** Neueste bekannte Anzeige je Identität; ein expliziter Zielname hat Vorrang. */
export function identityNameMap(history: GameRecord[]): Map<string, string> {
  const state = readStoredState()
  const names = new Map<string, string>()
  for (const [id, name] of Object.entries(state.preferredNames)) {
    names.set(resolveRedirect(id, state.redirects), name)
  }
  const newestFirst = [...history].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  for (const game of newestFirst) {
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      if (!names.has(id)) names.set(id, player.name)
    }
  }
  return names
}

/** Akzeptiert sowohl eine stabile ID als auch einen historischen Anzeigenamen. */
export function resolveIdentitySelector(selector: string, history: GameRecord[]): string {
  const canonicalSelector = resolvePlayerId(selector)
  for (const game of history) {
    for (const player of game.players) {
      if (playerIdentityKey(player) === canonicalSelector) return canonicalSelector
    }
  }
  const normalized = normalizePlayerName(selector)
  for (const game of history) {
    const player = game.players.find((candidate) => normalizePlayerName(candidate.name) === normalized)
    if (player) return playerIdentityKey(player)
  }
  return playerIdForName(selector)
}

export function turnIdentityKey(turn: Turn, game: GameRecord): string {
  if (turn.playerId?.trim()) return resolvePlayerId(turn.playerId)
  const normalized = normalizePlayerName(turn.player)
  const player = game.players.find((candidate) => normalizePlayerName(candidate.name) === normalized)
  return player ? playerIdentityKey(player) : playerIdForName(turn.player)
}

export function aliasesForIdentity(id: string, history: GameRecord[]): string[] {
  const canonical = resolvePlayerId(id)
  const names = new Set<string>()
  for (const game of history) {
    for (const player of game.players) {
      if (playerIdentityKey(player) === canonical) names.add(player.name)
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'de'))
}

export function mergePlayerIdentities(
  sourceId: string,
  targetId: string,
  history: GameRecord[],
): { sourceNames: string[]; targetName: string } {
  const state = readStoredState()
  const source = resolveRedirect(sourceId, state.redirects)
  const target = resolveRedirect(targetId, state.redirects)
  if (!source || !target || source === target) throw new Error('Bitte zwei unterschiedliche Spieler auswählen.')

  const namesBefore = identityNameMap(history)
  const sourceNames = aliasesForIdentity(source, history)
  const targetName = namesBefore.get(target) ?? aliasesForIdentity(target, history)[0] ?? target
  snapshotState(state)

  state.redirects[source] = target
  for (const [id, destination] of Object.entries(state.redirects)) {
    if (id !== source && resolveRedirect(destination, { ...state.redirects, [source]: target }) === source) {
      state.redirects[id] = target
    }
  }
  for (const [name, id] of Object.entries(state.aliases)) {
    if (resolveRedirect(id, state.redirects) === source) state.aliases[name] = target
  }
  for (const name of sourceNames) state.aliases[normalizePlayerName(name)] = target
  state.preferredNames[target] = targetName
  delete state.preferredNames[source]
  writeState(state)

  return { sourceNames, targetName }
}

export function undoLastPlayerIdentityMerge(): boolean {
  const recovery = readRecovery()
  const snapshot = recovery.shift()
  if (!snapshot) return false
  writeState({
    aliases: snapshot.aliases ?? {},
    redirects: snapshot.redirects ?? {},
    preferredNames: snapshot.preferredNames ?? {},
  })
  writeRecovery(recovery)
  return true
}

export function getPlayerIdentityRecoveryCount(): number {
  return readRecovery().length
}

export function exportPlayerIdentityState(): PlayerIdentityState {
  return sanitizePlayerIdentityState(readStoredState())
}

/** Ersetzt den lokalen Zustand; Cloud-Anwendungen können Dirty-Tracking abschalten. */
export function replacePlayerIdentityState(state: PlayerIdentityState, markDirty = true): void {
  writeState(sanitizePlayerIdentityState(state), markDirty)
}

export function importPlayerIdentityState(input: unknown): PlayerIdentityImportResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { imported: 0, conflicts: 0 }
  const raw = input as Partial<PlayerIdentityState>
  const incoming: PlayerIdentityState = {
    aliases: raw.aliases && typeof raw.aliases === 'object' && !Array.isArray(raw.aliases) ? raw.aliases : {},
    redirects: raw.redirects && typeof raw.redirects === 'object' && !Array.isArray(raw.redirects) ? raw.redirects : {},
    preferredNames:
      raw.preferredNames && typeof raw.preferredNames === 'object' && !Array.isArray(raw.preferredNames)
        ? raw.preferredNames
        : {},
  }
  const state = readStoredState()
  let imported = 0
  let conflicts = 0

  const addValue = (bucket: Record<string, string>, key: string, value: unknown) => {
    if (!key.trim() || typeof value !== 'string' || !value.trim()) return
    if (bucket[key] && bucket[key] !== value.trim()) {
      conflicts += 1
      return
    }
    if (!bucket[key]) {
      bucket[key] = value.trim()
      imported += 1
    }
  }

  for (const [name, id] of Object.entries(incoming.aliases)) addValue(state.aliases, normalizePlayerName(name), id)
  for (const [source, target] of Object.entries(incoming.redirects)) {
    if (source === target || resolveRedirect(target, { ...state.redirects, [source]: target }) === source) {
      conflicts += 1
      continue
    }
    addValue(state.redirects, source, target)
  }
  for (const [id, name] of Object.entries(incoming.preferredNames)) addValue(state.preferredNames, id, name)

  if (imported > 0) {
    snapshotState(readStoredState())
    writeState(state)
  }
  return { imported, conflicts }
}
