export interface DiceThrowSeedContext {
  values: number[]
  round: number
  playerIndex: number
  turnCount: number
  keptCount: number
  accumulated: number
}

function hashInt(hash: number, value: number): number {
  let h = hash >>> 0
  let v = Math.trunc(value) >>> 0
  for (let i = 0; i < 4; i++) {
    h ^= v & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    v >>>= 8
  }
  return h
}

/** Stable seed for the same saved throw context, including after reload. */
export function diceThrowSeed(context: DiceThrowSeedContext): number {
  let hash = 0x811c9dc5
  for (const value of context.values) hash = hashInt(hash, value)
  hash = hashInt(hash, context.round)
  hash = hashInt(hash, context.playerIndex)
  hash = hashInt(hash, context.turnCount)
  hash = hashInt(hash, context.keptCount)
  hash = hashInt(hash, context.accumulated)
  return hash || 0x6d2b79f5
}

export function mixSeed(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x85ebca6b) >>> 0
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

/** Small deterministic PRNG for animation/physics only, never for game results. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededSignedNoise(seed: number, frame: number, axis: number): number {
  return createSeededRandom(mixSeed(seed, Math.imul(frame + 1, 17) + axis))() - 0.5
}
