import { describe, expect, it } from 'vitest'
import { nextPlayableScoreAbove, playablePointsNeeded } from './scoreSteps'

describe('playable score steps', () => {
  it('rounds arithmetic gaps up to the next playable 50-point step', () => {
    expect(playablePointsNeeded(1)).toBe(50)
    expect(playablePointsNeeded(50)).toBe(50)
    expect(playablePointsNeeded(51)).toBe(100)
    expect(playablePointsNeeded(101)).toBe(150)
  })

  it('keeps reached targets at zero', () => {
    expect(playablePointsNeeded(0)).toBe(0)
    expect(playablePointsNeeded(-250)).toBe(0)
  })

  it('returns the smallest playable total that beats a leader', () => {
    expect(nextPlayableScoreAbove(10_000)).toBe(10_050)
    expect(nextPlayableScoreAbove(10_050)).toBe(10_100)
  })
})
