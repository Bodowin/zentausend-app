export type DiceImpactKind = 'felt' | 'rim' | 'dice'

export type DiceImpact = {
  die: number
  frame: number
  intensity: number
  kind: DiceImpactKind
}

export type ClassifiedImpactBody = {
  kind: DiceImpactKind
  otherDie?: number
}

/** Classifies a cannon body by object identity; body ids are not persisted. */
export function classifyImpactBody<T extends object>(
  other: T | undefined,
  feltBody: T,
  rimBodies: ReadonlySet<T>,
  diceByBody: ReadonlyMap<T, number>,
): ClassifiedImpactBody | null {
  if (!other) return null
  if (other === feltBody) return { kind: 'felt' }
  if (rimBodies.has(other)) return { kind: 'rim' }
  const otherDie = diceByBody.get(other)
  return otherDie === undefined ? null : { kind: 'dice', otherDie }
}

/** Merges the two callbacks cannon emits for the same dice-pair collision. */
export function upsertDicePairImpact(
  impacts: DiceImpact[],
  pairIndices: Map<string, number>,
  leftDie: number,
  rightDie: number,
  frame: number,
  intensity: number,
): void {
  const first = Math.min(leftDie, rightDie)
  const second = Math.max(leftDie, rightDie)
  const key = `${frame}:${first}:${second}`
  const existingIndex = pairIndices.get(key)
  if (existingIndex !== undefined) {
    impacts[existingIndex].intensity = Math.max(impacts[existingIndex].intensity, intensity)
    return
  }
  pairIndices.set(key, impacts.length)
  impacts.push({ die: first, frame, intensity, kind: 'dice' })
}

export type PlaybackImpactSelection = {
  nextIndex: number
  impact: DiceImpact | null
}

/** Consumes all due events and returns at most one fresh, strongest impact. */
export function selectPlaybackImpact(
  impacts: readonly DiceImpact[],
  startIndex: number,
  currentFrame: number,
  lastSoundFrame: number,
): PlaybackImpactSelection {
  let nextIndex = startIndex
  let selected: DiceImpact | null = null

  while (nextIndex < impacts.length && impacts[nextIndex].frame <= currentFrame) {
    const candidate = impacts[nextIndex]
    nextIndex += 1
    if (currentFrame - candidate.frame > 6 || candidate.frame - lastSoundFrame < 4) continue
    if (
      !selected
      || candidate.intensity > selected.intensity
      || (candidate.intensity === selected.intensity && candidate.frame < selected.frame)
      || (candidate.intensity === selected.intensity && candidate.frame === selected.frame && candidate.die < selected.die)
    ) {
      selected = candidate
    }
  }

  return { nextIndex, impact: selected }
}
