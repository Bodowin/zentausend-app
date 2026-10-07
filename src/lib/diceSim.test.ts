import { describe, expect, it } from 'vitest'
import {
  CUBE_ROTATIONS,
  DEFAULT_TUNING,
  SLOT_NORMALS,
  chooseBodySymmetry,
  createThrowJob,
  handPose,
  qMul,
  quatAngleDeg,
  rotV,
  rotateThrow,
  simulateThrow,
  topSlotFromQuat,
  trimRestTail,
  type DiceSimConfig,
  type Quat,
} from './diceSim'
import { createSeededRandom } from './diceThrowSeed'

function cfgFor(n: number): DiceSimConfig {
  const Rb = 1.7 + n * 0.26
  return { h: 0.44, Rb, y0: Rb * 0.5 + 2.2, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 720 }
}

const AWAY = { direction: 0, energy: 1 }

describe('diceSim hand pose', () => {
  it('depends only on the seed and never starts with intersecting dice', () => {
    const cfg = cfgFor(6)
    const a = handPose(6, cfg, 4242)
    expect(handPose(6, cfg, 4242)).toEqual(a)
    expect(handPose(6, cfg, 4243)).not.toEqual(a)
    const minimum = 2 * Math.sqrt(3) * cfg.h
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const [p, q] = [a.pos[i], a.pos[j]]
        expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])).toBeGreaterThan(minimum)
      }
    }
  })

  it('starts the recorded path exactly at the visible hand pose', () => {
    const cfg = cfgFor(3)
    const pose = handPose(3, cfg, 77)
    const t = simulateThrow(3, cfg, 77, { direction: 1.2, energy: 1.2 })
    for (let i = 0; i < 3; i++) {
      expect(t.pos[i][0]).toEqual(pose.pos[i])
      expect(t.quat[i][0]).toEqual(pose.quat[i])
    }
  })
})

describe('diceSim throw', () => {
  it('replays identical physics for an identical seed and gesture', () => {
    const cfg = cfgFor(4)
    const first = simulateThrow(4, cfg, 8675309, AWAY)
    const second = simulateThrow(4, cfg, 8675309, AWAY)
    expect(second).toEqual(first)
  })

  it('uses the gesture: another direction produces another path', () => {
    const cfg = cfgFor(2)
    const away = simulateThrow(2, cfg, 99, AWAY)
    const left = simulateThrow(2, cfg, 99, { direction: Math.PI / 2, energy: 1 })
    expect(left.pos[0][20]).not.toEqual(away.pos[0][20])
  })

  it('throws in the requested direction', () => {
    // Mittlere Verschiebung nach 0,15 s, gemessen über mehrere Würfe.
    for (const direction of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      let dx = 0, dz = 0
      for (let seed = 1; seed <= 6; seed++) {
        const t = simulateThrow(1, cfgFor(1), seed, { direction, energy: 1 })
        const k = Math.min(18, t.frames - 1)
        dx += t.pos[0][k][0] - t.pos[0][0][0]
        dz += t.pos[0][k][2] - t.pos[0][0][2]
      }
      const angle = Math.atan2(-dx, -dz)
      const error = Math.abs(Math.atan2(Math.sin(angle - direction), Math.cos(angle - direction)))
      expect(error, `direction ${direction}`).toBeLessThan(0.35)
    }
  })

  it('a stronger gesture carries the dice further in the first moment', () => {
    let soft = 0, strong = 0
    for (let seed = 1; seed <= 6; seed++) {
      const a = simulateThrow(1, cfgFor(1), seed, { direction: 0, energy: 0.8 })
      const b = simulateThrow(1, cfgFor(1), seed, { direction: 0, energy: 1.2 })
      soft += a.pos[0][0][2] - a.pos[0][12][2]
      strong += b.pos[0][0][2] - b.pos[0][12][2]
    }
    expect(strong).toBeGreaterThan(soft * 1.2)
  })

  it('settles six dice flat inside the bowl within a few attempts', () => {
    const cfg = cfgFor(6)
    let attempts = 0
    for (let seed = 1; seed <= 12; seed++) {
      const t = simulateThrow(6, cfg, (seed * 2654435761) >>> 0, { direction: (seed % 5 - 2) * 0.5, energy: 1 })
      expect(t.cocked, `seed ${seed}`).toBe(false)
      attempts += t.attempts
      for (let i = 0; i < 6; i++) {
        const p = t.pos[i][t.frames - 1]
        expect(Math.hypot(p[0], p[2])).toBeLessThan(cfg.Rb)
        expect(p[1]).toBeLessThan(cfg.h * 1.2)
        expect(topSlotFromQuat(t.quat[i][t.frames - 1]).dot).toBeGreaterThan(0.93)
      }
    }
    expect(attempts / 12).toBeLessThan(3)
  })

  it('the bowl broadphase gives bit-identical results to the naive one', () => {
    const cfg = cfgFor(3)
    for (const seed of [11, 12, 13]) {
      const fast = simulateThrow(3, cfg, seed, AWAY)
      const naive = simulateThrow(3, cfg, seed, AWAY, { ...DEFAULT_TUNING, broadphase: 'naive' })
      expect(fast).toEqual(naive)
    }
  })

  it('can be computed in small time slices with the same result', () => {
    const cfg = cfgFor(3)
    const job = createThrowJob(3, cfg, 5150, AWAY)
    let slices = 0
    let result = null
    while (!(result = job.advance(0))) slices++
    expect(slices).toBeGreaterThan(3)
    expect(result).toEqual(simulateThrow(3, cfg, 5150, AWAY))
  })
})

describe('diceSim rest tail', () => {
  it('shortens the invisible creep but keeps the exact resting pose', () => {
    let shortened = 0
    for (let seed = 1; seed <= 6; seed++) {
      const t = simulateThrow(3, cfgFor(3), seed, AWAY)
      const trimmed = trimRestTail(t)
      expect(trimmed.frames).toBeLessThanOrEqual(t.frames)
      if (trimmed.frames < t.frames) shortened++
      for (let i = 0; i < 3; i++) {
        expect(trimmed.pos[i][trimmed.frames - 1]).toEqual(t.pos[i][t.frames - 1])
        expect(quatAngleDeg(trimmed.quat[i][trimmed.frames - 1], t.quat[i][t.frames - 1])).toBeLessThan(1e-6)
      }
      expect(trimmed.impacts.every((im) => im.frame < trimmed.frames)).toBe(true)
    }
    expect(shortened).toBeGreaterThan(3)
  })
})

describe('diceSim cube symmetry', () => {
  it('has exactly the 24 proper rotations of a cube', () => {
    expect(CUBE_ROTATIONS).toHaveLength(24)
    for (const g of CUBE_ROTATIONS) {
      // Jede Flächennormale landet wieder auf einer Flächennormale.
      for (const nrm of SLOT_NORMALS) {
        const r = rotV(nrm, g)
        expect(Math.max(...r.map(Math.abs))).toBeCloseTo(1, 6)
      }
    }
  })

  it('puts the wanted face on top for every resting face and keeps the start continuous', () => {
    const random = createSeededRandom(31337)
    const randomQuat = (): Quat => {
      const q: Quat = [random() - 0.5, random() - 0.5, random() - 0.5, random() - 0.5]
      const l = Math.hypot(...q)
      return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
    }
    for (let trial = 0; trial < 40; trial++) {
      // Eine flach liegende Endlage: irgendeine Würfeldrehung, um die Senkrechte gedreht.
      const yaw = random() * Math.PI * 2
      const final = qMul([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], CUBE_ROTATIONS[trial % 24])
      const start = randomQuat()
      const visible = randomQuat()
      for (let wanted = 0; wanted < 6; wanted++) {
        const g = chooseBodySymmetry(final, wanted, start, visible)
        const rendered = qMul(final, g)
        expect(topSlotFromQuat(rendered).slot).toBe(wanted)
        // Unter allen passenden Drehungen die mit dem kleinsten Startsprung.
        const chosen = quatAngleDeg(visible, qMul(start, g))
        for (const other of CUBE_ROTATIONS) {
          if (topSlotFromQuat(qMul(final, other)).slot === wanted) {
            expect(chosen).toBeLessThanOrEqual(quatAngleDeg(visible, qMul(start, other)) + 1e-9)
          }
        }
      }
    }
  })
})

describe('diceSim rotation', () => {
  it('rotating a finished throw keeps the resting faces and the dice inside the bowl', () => {
    const cfg = cfgFor(4)
    const t = simulateThrow(4, cfg, 2024, AWAY)
    for (const steps of [1, -1, 3, 6]) {
      const r = rotateThrow(t, (steps * Math.PI * 2) / 12)
      for (let i = 0; i < 4; i++) {
        const last = t.frames - 1
        expect(topSlotFromQuat(r.quat[i][last]).slot).toBe(topSlotFromQuat(t.quat[i][last]).slot)
        const p = r.pos[i][last], q = t.pos[i][last]
        expect(Math.hypot(p[0], p[2])).toBeCloseTo(Math.hypot(q[0], q[2]), 9)
        expect(p[1]).toBeCloseTo(q[1], 9)
      }
      // Hin- und Rückdrehung ergibt wieder den Ausgangswurf.
      const back = rotateThrow(r, (-steps * Math.PI * 2) / 12)
      expect(back.pos[0][10][0]).toBeCloseTo(t.pos[0][10][0], 9)
      expect(back.pos[0][10][2]).toBeCloseTo(t.pos[0][10][2], 9)
    }
  })
})
