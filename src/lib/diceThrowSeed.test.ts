import { describe, expect, it } from 'vitest'
import { createSeededRandom, diceThrowSeed, mixSeed } from './diceThrowSeed'

const base = { values: [1, 2, 5, 6], round: 3, playerIndex: 1, turnCount: 7, keptCount: 2, accumulated: 450 }

describe('natural dice motion seeds', () => {
  it('stays stable for the same saved throw context', () => {
    expect(diceThrowSeed(base)).toBe(diceThrowSeed({ ...base, values: [...base.values] }))
  })

  it('changes when the throw context changes', () => {
    expect(diceThrowSeed(base)).not.toBe(diceThrowSeed({ ...base, accumulated: 500 }))
    expect(diceThrowSeed(base)).not.toBe(diceThrowSeed({ ...base, values: [1, 2, 5, 5] }))
  })

  it('replays the same pseudo-random motion sequence from a seed', () => {
    const a = createSeededRandom(mixSeed(12345, 2))
    const b = createSeededRandom(mixSeed(12345, 2))
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()])
  })
})
