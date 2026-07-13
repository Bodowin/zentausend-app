import type { PlayerIdentityState } from './playerIdentity'

export interface PlayerIdentityMergeResult {
  state: PlayerIdentityState
  conflicts: number
}

export function emptyPlayerIdentityState(): PlayerIdentityState {
  return { aliases: {}, redirects: {}, preferredNames: {} }
}

function cleanRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => Boolean(key.trim()) && typeof entry === 'string' && entry.trim())
      .map(([key, entry]) => [key.trim(), (entry as string).trim()]),
  )
}

export function sanitizePlayerIdentityState(value: unknown): PlayerIdentityState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyPlayerIdentityState()
  const candidate = value as Partial<PlayerIdentityState>
  return {
    aliases: cleanRecord(candidate.aliases),
    redirects: cleanRecord(candidate.redirects),
    preferredNames: cleanRecord(candidate.preferredNames),
  }
}

export function playerIdentityStatesEqual(a: PlayerIdentityState, b: PlayerIdentityState): boolean {
  return JSON.stringify(sanitizePlayerIdentityState(a)) === JSON.stringify(sanitizePlayerIdentityState(b))
}

function mergeRecord(
  base: Record<string, string>,
  local: Record<string, string>,
  cloud: Record<string, string>,
): { record: Record<string, string>; conflicts: number } {
  const record: Record<string, string> = {}
  let conflicts = 0
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)])

  for (const key of keys) {
    const baseValue = base[key]
    const localValue = local[key]
    const cloudValue = cloud[key]
    const localChanged = localValue !== baseValue
    const cloudChanged = cloudValue !== baseValue

    if (localChanged && cloudChanged && localValue !== cloudValue) conflicts += 1
    const chosen = localChanged ? localValue : cloudValue
    if (chosen !== undefined) record[key] = chosen
  }

  return { record, conflicts }
}

/**
 * Drei-Wege-Merge:
 * - unveränderte lokale Felder übernehmen die Cloud,
 * - lokale Änderungen (auch Löschungen) bleiben erhalten,
 * - bei gleichzeitiger abweichender Änderung gewinnt lokal und der Konflikt wird gezählt.
 */
export function mergePlayerIdentityStates(
  baseInput: PlayerIdentityState,
  localInput: PlayerIdentityState,
  cloudInput: PlayerIdentityState,
): PlayerIdentityMergeResult {
  const base = sanitizePlayerIdentityState(baseInput)
  const local = sanitizePlayerIdentityState(localInput)
  const cloud = sanitizePlayerIdentityState(cloudInput)
  const aliases = mergeRecord(base.aliases, local.aliases, cloud.aliases)
  const redirects = mergeRecord(base.redirects, local.redirects, cloud.redirects)
  const preferredNames = mergeRecord(base.preferredNames, local.preferredNames, cloud.preferredNames)

  return {
    state: {
      aliases: aliases.record,
      redirects: redirects.record,
      preferredNames: preferredNames.record,
    },
    conflicts: aliases.conflicts + redirects.conflicts + preferredNames.conflicts,
  }
}
