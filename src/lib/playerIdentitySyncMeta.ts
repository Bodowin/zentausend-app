import type { PlayerIdentityState } from './playerIdentity'
import {
  emptyPlayerIdentityState,
  playerIdentityStatesEqual,
  sanitizePlayerIdentityState,
} from './playerIdentityState'

const KEY = '10k_player_identity_sync_v1'

export interface PlayerIdentitySyncMeta {
  baseVersion: number
  baseState: PlayerIdentityState
  dirty: boolean
}

function validVersion(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function getPlayerIdentitySyncMeta(currentState: PlayerIdentityState): PlayerIdentitySyncMeta {
  if (typeof localStorage !== 'undefined') {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null') as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const candidate = parsed as Partial<PlayerIdentitySyncMeta>
        return {
          baseVersion: validVersion(candidate.baseVersion),
          baseState: sanitizePlayerIdentityState(candidate.baseState),
          dirty: candidate.dirty === true,
        }
      }
    } catch {
      /* Unterhalb wird ein sicherer Erstzustand gebildet. */
    }
  }

  const empty = emptyPlayerIdentityState()
  return {
    baseVersion: 0,
    baseState: empty,
    dirty: !playerIdentityStatesEqual(currentState, empty),
  }
}

export function setPlayerIdentitySyncMeta(meta: PlayerIdentitySyncMeta): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        baseVersion: validVersion(meta.baseVersion),
        baseState: sanitizePlayerIdentityState(meta.baseState),
        dirty: meta.dirty === true,
      }),
    )
  } catch {
    /* Der lokale Zustand bleibt erhalten und wird beim nächsten Start erneut als dirty erkannt. */
  }
}

export function markPlayerIdentityDirty(): void {
  const current = getPlayerIdentitySyncMeta(emptyPlayerIdentityState())
  setPlayerIdentitySyncMeta({ ...current, dirty: true })
}

export function setPlayerIdentitySyncBase(version: number, state: PlayerIdentityState, dirty = false): void {
  setPlayerIdentitySyncMeta({
    baseVersion: validVersion(version),
    baseState: sanitizePlayerIdentityState(state),
    dirty,
  })
}

export function playerIdentitySyncPendingCount(currentState: PlayerIdentityState): number {
  return getPlayerIdentitySyncMeta(currentState).dirty ? 1 : 0
}
