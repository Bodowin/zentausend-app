import { describe, expect, it } from 'vitest'
import { chooseLabeling, handLabelings, DICE_MAX_PLAYBACK_SECONDS, dicePlaybackSpeed } from './DiceArena'
import { simulateThrow, trimRestTail } from '../lib/diceSim'
import { ThrowPlanner, choiceInput, defaultChoice, gestureChoice, DIRECTION_STEPS } from '../lib/diceThrowPlanner'

const CFG = { h: 0.44, Rb: 3.26, y0: 3.83, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 720 }

describe('DiceArena physics', () => {
  it('can label every natural resting face with every requested value', () => {
    for (let slot = 0; slot < 6; slot += 1) {
      for (let value = 1; value <= 6; value += 1) {
        expect(chooseLabeling(slot, value)[slot]).toBe(value)
      }
    }
  })

  it('gives every die in the hand a complete, valid and stable labelling', () => {
    const a = handLabelings(6, 1234)
    expect(handLabelings(6, 1234)).toEqual(a)
    for (const labels of a) {
      expect([...labels].sort()).toEqual([1, 2, 3, 4, 5, 6])
      // Gegenüberliegende Flächen ergeben 7 (Slots 0/1, 2/3, 4/5).
      expect(labels[0] + labels[1]).toBe(7)
      expect(labels[2] + labels[3]).toBe(7)
      expect(labels[4] + labels[5]).toBe(7)
    }
  })

  it('settles representative six-die throws inside the intended playback window', () => {
    const durations: number[] = []

    for (let seed = 1; seed <= 16; seed += 1) {
      const t = trimRestTail(simulateThrow(6, CFG, seed, choiceInput(defaultChoice(seed))))
      expect(t.cocked, `seed ${seed} remained cocked after retries`).toBe(false)
      const recordedSeconds = (t.frames - 1) * CFG.FIXED_DT
      durations.push(recordedSeconds / dicePlaybackSpeed(t.frames, CFG.FIXED_DT))
    }

    durations.sort((left, right) => left - right)
    const median = durations[Math.floor(durations.length / 2)]
    // Kürzer als früher (1,4–2,2 s): das unsichtbare Auskriechen am Ende entfällt.
    expect(median).toBeGreaterThanOrEqual(0.7)
    expect(median).toBeLessThanOrEqual(1.6)
    expect(durations[durations.length - 1]).toBeLessThanOrEqual(DICE_MAX_PLAYBACK_SECONDS)
  })
})

describe('throw gestures', () => {
  it('maps swipe directions on screen to throw directions in the bowl', () => {
    expect(gestureChoice(0, -900).dir).toBe(0) // nach oben: vom Spieler weg
    expect(gestureChoice(0, 900).dir).toBe(DIRECTION_STEPS / 2) // nach unten: zum Spieler
    expect(gestureChoice(900, 0).dir).toBe((DIRECTION_STEPS * 3) / 4) // nach rechts
    expect(gestureChoice(-900, 0).dir).toBe(DIRECTION_STEPS / 4) // nach links
    expect(choiceInput({ dir: DIRECTION_STEPS / 4, energy: 1 }).direction).toBeCloseTo(Math.PI / 2)
    expect(choiceInput({ dir: (DIRECTION_STEPS * 3) / 4, energy: 1 }).direction).toBeCloseTo(-Math.PI / 2)
  })

  it('turns a faster swipe into a stronger throw', () => {
    expect(gestureChoice(0, -300).energy).toBe(0)
    expect(gestureChoice(0, -900).energy).toBe(1)
    expect(gestureChoice(0, -2000).energy).toBe(2)
  })

  it('throws a plain tap away from the player, gently varied per throw', () => {
    const seen = new Set<number>()
    for (let seed = 1; seed <= 60; seed++) {
      const c = defaultChoice(seed)
      expect(defaultChoice(seed)).toEqual(c)
      expect(c.energy).toBe(1)
      const signed = c.dir > DIRECTION_STEPS / 2 ? c.dir - DIRECTION_STEPS : c.dir
      expect(Math.abs(signed)).toBeLessThanOrEqual(2)
      seen.add(c.dir)
    }
    expect(seen.size).toBe(5)
  })

  it('prepares throws in small slices without ever blocking long', () => {
    const planner = new ThrowPlanner(6, CFG, 777)
    const choice = defaultChoice(777)
    planner.request(choice, true)
    let slices = 0
    while (!planner.get(choice)) {
      const start = performance.now()
      planner.pump(4)
      // Eine Scheibe darf ihr Budget nur um einen Simulationsschritt-Block überziehen.
      expect(performance.now() - start).toBeLessThan(40)
      slices++
      expect(slices).toBeLessThan(2000)
    }
    expect(slices).toBeGreaterThan(1)
    expect(planner.get(choice)?.cocked).toBe(false)
  })
})

describe('throw planner fallback', () => {
  it('serves a finished neighbouring throw, rotated into the requested direction', () => {
    const planner = new ThrowPlanner(3, { ...CFG, Rb: 2.48, y0: 3.44 }, 4711)
    const prepared = { dir: 0, energy: 1 }
    planner.request(prepared, true)
    while (!planner.get(prepared)) planner.pump(50)
    // Ein Schritt daneben: sofort da, ohne neu zu rechnen.
    const neighbour = planner.getNearest({ dir: 1, energy: 1 })
    expect(neighbour).not.toBeNull()
    const base = planner.get(prepared)!
    const last = base.frames - 1
    // In Wurfrichtung (nach links gedreht) liegen die Würfel weiter links.
    const meanX = (t: typeof base) => t.pos.reduce((sum, path) => sum + path[last][0], 0) / t.pos.length
    expect(meanX(neighbour!)).toBeLessThan(meanX(base))
    // Zwei Schritte daneben ist zu weit: dann wird exakt gerechnet.
    expect(planner.getNearest({ dir: 2, energy: 1 })).toBeNull()
  })
})
