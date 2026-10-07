import { describe, expect, it } from 'vitest'
import {
  classifyImpactBody,
  selectPlaybackImpact,
  selectPlaybackImpacts,
  type DiceImpact,
  upsertDicePairImpact,
} from './diceImpact'

describe('dice impact handling', () => {
  it('classifies felt, rim and dice bodies by identity', () => {
    const felt = {}, rim = {}, die = {}, unknown = {}
    const rims = new Set([rim])
    const dice = new Map([[die, 3]])

    expect(classifyImpactBody(felt, felt, rims, dice)).toEqual({ kind: 'felt' })
    expect(classifyImpactBody(rim, felt, rims, dice)).toEqual({ kind: 'rim' })
    expect(classifyImpactBody(die, felt, rims, dice)).toEqual({ kind: 'dice', otherDie: 3 })
    expect(classifyImpactBody(unknown, felt, rims, dice)).toBeNull()
    expect(classifyImpactBody(undefined, felt, rims, dice)).toBeNull()
  })

  it('merges both callbacks for a dice pair and keeps the stronger intensity', () => {
    const impacts: DiceImpact[] = []
    const pairs = new Map<string, number>()

    upsertDicePairImpact(impacts, pairs, 4, 1, 20, 0.4)
    upsertDicePairImpact(impacts, pairs, 1, 4, 20, 0.8)

    expect(impacts).toEqual([{ die: 1, frame: 20, intensity: 0.8, kind: 'dice' }])
  })

  it('selects one strongest fresh due impact with stable tie breaking', () => {
    const impacts: DiceImpact[] = [
      { die: 4, frame: 10, intensity: 0.7, kind: 'felt' },
      { die: 2, frame: 11, intensity: 0.9, kind: 'rim' },
      { die: 1, frame: 11, intensity: 0.9, kind: 'dice' },
      { die: 0, frame: 15, intensity: 1, kind: 'rim' },
    ]

    expect(selectPlaybackImpact(impacts, 0, 12, 0)).toEqual({
      nextIndex: 3,
      impact: { die: 1, frame: 11, intensity: 0.9, kind: 'dice' },
    })
  })

  it('drops stale and cooldown-blocked impacts without queueing them', () => {
    const impacts: DiceImpact[] = [
      { die: 0, frame: 2, intensity: 1, kind: 'rim' },
      { die: 1, frame: 9, intensity: 0.8, kind: 'felt' },
      { die: 2, frame: 12, intensity: 0.7, kind: 'dice' },
    ]

    expect(selectPlaybackImpact(impacts, 0, 12, 7)).toEqual({
      nextIndex: 3,
      impact: { die: 2, frame: 12, intensity: 0.7, kind: 'dice' },
    })
    expect(selectPlaybackImpact(impacts, 0, 20, 0)).toEqual({ nextIndex: 3, impact: null })
  })
  it('lets several dice be heard together, strongest first, one voice per die', () => {
    const impacts: DiceImpact[] = [
      { die: 0, frame: 10, intensity: 0.5, kind: 'felt' },
      { die: 1, frame: 10, intensity: 0.9, kind: 'felt' },
      { die: 1, frame: 11, intensity: 0.95, kind: 'dice' },
      { die: 2, frame: 11, intensity: 0.7, kind: 'rim' },
      { die: 3, frame: 11, intensity: 0.6, kind: 'felt' },
      { die: 4, frame: 2, intensity: 1, kind: 'rim' },
      { die: 5, frame: 14, intensity: 1, kind: 'rim' },
    ]
    expect(selectPlaybackImpacts(impacts, 0, 12)).toEqual({
      nextIndex: 6,
      impacts: [
        { die: 1, frame: 11, intensity: 0.95, kind: 'dice' },
        { die: 2, frame: 11, intensity: 0.7, kind: 'rim' },
        { die: 3, frame: 11, intensity: 0.6, kind: 'felt' },
      ],
    })
    // Veraltete Ereignisse werden verworfen, nicht nachgeholt.
    expect(selectPlaybackImpacts(impacts, 0, 30)).toEqual({ nextIndex: 7, impacts: [] })
  })
})
