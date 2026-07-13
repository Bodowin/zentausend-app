import { describe, expect, it } from 'vitest'
import { emptyPlayerIdentityState, mergePlayerIdentityStates } from './playerIdentityState'

const empty = emptyPlayerIdentityState()

describe('player identity three-way merge', () => {
  it('accepts a cloud-only change when local stayed at the base', () => {
    const result = mergePlayerIdentityStates(empty, empty, {
      ...empty,
      aliases: { gabi: 'player-gabi' },
    })
    expect(result.state.aliases).toEqual({ gabi: 'player-gabi' })
    expect(result.conflicts).toBe(0)
  })

  it('keeps a local-only change', () => {
    const result = mergePlayerIdentityStates(
      empty,
      { ...empty, redirects: { 'player-gabriela': 'player-gabi' } },
      empty,
    )
    expect(result.state.redirects).toEqual({ 'player-gabriela': 'player-gabi' })
    expect(result.conflicts).toBe(0)
  })

  it('combines independent edits from two devices', () => {
    const result = mergePlayerIdentityStates(
      empty,
      { ...empty, aliases: { gabi: 'player-gabi' } },
      { ...empty, preferredNames: { 'player-dana': 'Dana' } },
    )
    expect(result.state).toEqual({
      aliases: { gabi: 'player-gabi' },
      redirects: {},
      preferredNames: { 'player-dana': 'Dana' },
    })
    expect(result.conflicts).toBe(0)
  })

  it('keeps the local value and counts a same-key conflict', () => {
    const result = mergePlayerIdentityStates(
      empty,
      { ...empty, aliases: { gabi: 'player-local' } },
      { ...empty, aliases: { gabi: 'player-cloud' } },
    )
    expect(result.state.aliases.gabi).toBe('player-local')
    expect(result.conflicts).toBe(1)
  })

  it('propagates a deliberate local deletion against an unchanged cloud base', () => {
    const base = { ...empty, redirects: { duplicate: 'target' } }
    const result = mergePlayerIdentityStates(base, empty, base)
    expect(result.state.redirects).toEqual({})
    expect(result.conflicts).toBe(0)
  })

  it('does not count an identical concurrent edit as a conflict', () => {
    const changed = { ...empty, preferredNames: { player: 'Gabi' } }
    const result = mergePlayerIdentityStates(empty, changed, changed)
    expect(result.state).toEqual(changed)
    expect(result.conflicts).toBe(0)
  })
})
