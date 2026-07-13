import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPlayerIdentitySyncMeta,
  markPlayerIdentityDirty,
  playerIdentitySyncPendingCount,
  setPlayerIdentitySyncBase,
} from './playerIdentitySyncMeta'
import { emptyPlayerIdentityState } from './playerIdentityState'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()))

describe('player identity sync metadata', () => {
  it('marks a non-empty first local state as pending', () => {
    const current = { ...emptyPlayerIdentityState(), aliases: { gabi: 'player-gabi' } }
    expect(getPlayerIdentitySyncMeta(current)).toMatchObject({ baseVersion: 0, dirty: true })
    expect(playerIdentitySyncPendingCount(current)).toBe(1)
  })

  it('stores a confirmed cloud base and clears pending state', () => {
    const state = { ...emptyPlayerIdentityState(), preferredNames: { p: 'Gabi' } }
    setPlayerIdentitySyncBase(4, state)
    expect(getPlayerIdentitySyncMeta(state)).toEqual({ baseVersion: 4, baseState: state, dirty: false })
    expect(playerIdentitySyncPendingCount(state)).toBe(0)
  })

  it('preserves the confirmed base when a later local edit becomes dirty', () => {
    const base = { ...emptyPlayerIdentityState(), aliases: { gabi: 'player-gabi' } }
    setPlayerIdentitySyncBase(2, base)
    markPlayerIdentityDirty()
    expect(getPlayerIdentitySyncMeta(base)).toEqual({ baseVersion: 2, baseState: base, dirty: true })
  })
})
