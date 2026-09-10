import { describe, expect, it } from 'vitest'
import { chooseLabeling, DICE_PLAYBACK_SPEED, runAttempt } from './DiceArena'
import { createSeededRandom, mixSeed } from '../lib/diceThrowSeed'

const CFG = { h: 0.44, Rb: 3.26, y0: 3.83, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 720 }

describe('DiceArena physics', () => {
  it('starts a six-die throw without intersecting dice', () => {
    const attempt = runAttempt(6, CFG, createSeededRandom(12345))
    const starts = attempt.pos.map((path) => path[0])
    const minimumDistance = 2 * Math.sqrt(3) * CFG.h

    for (let left = 0; left < starts.length; left += 1) {
      for (let right = left + 1; right < starts.length; right += 1) {
        const distance = Math.hypot(
          starts[left][0] - starts[right][0],
          starts[left][1] - starts[right][1],
          starts[left][2] - starts[right][2],
        )
        expect(distance).toBeGreaterThan(minimumDistance)
      }
    }
  })

  it('replays identical physics for an identical motion seed', () => {
    const first = runAttempt(4, CFG, createSeededRandom(8675309))
    const second = runAttempt(4, CFG, createSeededRandom(8675309))

    expect(first.frames).toBe(second.frames)
    expect(first.pos).toEqual(second.pos)
    expect(first.quat).toEqual(second.quat)
  })

  it('can label every natural resting face with every requested value', () => {
    for (let slot = 0; slot < 6; slot += 1) {
      for (let value = 1; value <= 6; value += 1) {
        expect(chooseLabeling(slot, value)[slot]).toBe(value)
      }
    }
  })

  it('settles representative six-die throws inside the intended playback window', () => {
    const durations: number[] = []

    for (let seed = 1; seed <= 16; seed += 1) {
      let attempt = runAttempt(6, CFG, createSeededRandom(mixSeed(seed, 0)))
      for (let retry = 1; retry < 8 && attempt.cocked; retry += 1) {
        attempt = runAttempt(6, CFG, createSeededRandom(mixSeed(seed, retry)))
      }
      expect(attempt.cocked, `seed ${seed} remained cocked after retries`).toBe(false)
      durations.push(attempt.frames * CFG.FIXED_DT / DICE_PLAYBACK_SPEED)
    }

    durations.sort((left, right) => left - right)
    const median = durations[Math.floor(durations.length / 2)]
    expect(median).toBeGreaterThanOrEqual(1.4)
    expect(median).toBeLessThanOrEqual(2.2)
  })
})
