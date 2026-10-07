/**
 * Headless Würfel-Physik für die DiceArena (cannon-es, kein Rendering).
 *
 * Ein Wurf besteht aus zwei getrennten Teilen:
 *  1) der HANDLAGE: wo und wie die Würfel vor dem Wurf in der Hand liegen. Sie
 *     hängt nur am Bewegungs-Seed und ist sofort bekannt (keine Simulation), damit
 *     die Arena ohne Rechenpause erscheint.
 *  2) dem ABWURF: Richtung und Kraft kommen aus der Geste des Spielers. Erst
 *     daraus wird die Bahn bis zur Ruhe simuliert und aufgezeichnet.
 *
 * Die Simulation läuft als Job in kleinen Zeitscheiben (advance), damit sie den
 * Main-Thread nie spürbar blockiert. Augenzahlen entstehen hier NIE: sie kommen
 * aus dem Spielzustand und werden erst danach auf die oben liegende Fläche
 * gelegt (siehe DiceArena).
 */
import * as CANNON from 'cannon-es'
import { createSeededRandom, mixSeed } from './diceThrowSeed'
import { classifyImpactBody, upsertDicePairImpact, type DiceImpact } from './diceImpact'

export type V3 = [number, number, number]
export type Quat = [number, number, number, number]

export type DiceSimConfig = {
  /** Halbe Kantenlänge eines Würfels. */
  h: number
  /** Radius der Schale. */
  Rb: number
  /** Referenzhöhe der Hand. */
  y0: number
  G: number
  FIXED_DT: number
  MAX_STEPS: number
}

/**
 * Materialien und Wurfkräfte. Plastik auf Plastik prallt hörbar ab, der Filz
 * bremst und lässt die Würfel eher rollen als rutschen, der Rand federt.
 */
export type DicePhysicsTuning = {
  rimSegments: number
  /** Neigung der Schalenwand (0 = senkrecht). */
  rimSlope: number
  feltFriction: number
  feltRestitution: number
  rimFriction: number
  rimRestitution: number
  diceFriction: number
  diceRestitution: number
  linearDamping: number
  angularDamping: number
  /** Grundgeschwindigkeit in Wurfrichtung (min, max). */
  forward: [number, number]
  lift: [number, number]
  /** Vorwärts-Rotation in rad/s (min, max). */
  spin: [number, number]
  /** Auffächern der Würfel um die Wurfrichtung (rad je Würfelabstand). */
  fan: number
  /** Mittelpunkt der Hand als Anteil des Schalenradius (Richtung Spieler positiv). */
  handZ: number
  maxAttempts: number
}

export const DEFAULT_TUNING: DicePhysicsTuning = {
  rimSegments: 24,
  rimSlope: 0.22,
  feltFriction: 0.16,
  feltRestitution: 0.24,
  rimFriction: 0.16,
  rimRestitution: 0.24,
  diceFriction: 0.09,
  diceRestitution: 0.18,
  linearDamping: 0.025,
  angularDamping: 0.045,
  forward: [5.1, 5.9],
  lift: [1.25, 1.7],
  spin: [19, 27],
  fan: 0,
  handZ: 0.15,
  maxAttempts: 8,
}

/** Geste des Spielers: Richtung (0 = vom Spieler weg, im Uhrzeigersinn von oben) und Kraft. */
export type ThrowInput = {
  /** Wurfrichtung in rad. 0 = weg vom Spieler (Bildschirm oben), +π/2 = nach links, −π/2 = nach rechts. */
  direction: number
  /** Kraftfaktor, 1 = normaler Wurf. Wird auf [0.65, 1.35] begrenzt. */
  energy: number
}

export type HandPose = { pos: V3[]; quat: Quat[] }

export type DiceThrow = {
  pos: V3[][]
  quat: Quat[][]
  impacts: DiceImpact[]
  topSlots: number[]
  frames: number
  /** true, wenn auch der letzte Versuch noch auf Kante/Ecke oder gestapelt endete. */
  cocked: boolean
  attempts: number
}

/* ============================== Mathe ================================== */
// Slots (Body-lokal): 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
export const SLOT_NORMALS: V3[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]

export function rotV(v: V3, q: Quat): V3 {
  const [vx, vy, vz] = v
  const [qx, qy, qz, qw] = q
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx)
  return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)]
}

export function topSlotFromQuat(q: Quat): { slot: number; dot: number } {
  let slot = 2, dot = -Infinity
  for (let s = 0; s < 6; s++) { const d = rotV(SLOT_NORMALS[s], q)[1]; if (d > dot) { dot = d; slot = s } }
  return { slot, dot }
}

export function qSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  let bb: Quat = b
  if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d }
  if (d > 0.9995) {
    const r: Quat = [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]
    const l = Math.hypot(r[0], r[1], r[2], r[3]) || 1
    return [r[0] / l, r[1] / l, r[2] / l, r[3] / l]
  }
  const th0 = Math.acos(d), th = th0 * t
  const s0 = Math.sin(th0 - th) / Math.sin(th0), s1 = Math.sin(th) / Math.sin(th0)
  return [a[0] * s0 + bb[0] * s1, a[1] * s0 + bb[1] * s1, a[2] * s0 + bb[2] * s1, a[3] * s0 + bb[3] * s1]
}

/** Winkel zwischen zwei Orientierungen in Grad. */
export function quatAngleDeg(a: Quat, b: Quat): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])
  return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Dreht einen horizontalen Vektor aus dem Wurf-Rahmen (vorwärts = −z) in die Welt. */
function toWorld(x: number, z: number, direction: number): [number, number] {
  const c = Math.cos(direction), s = Math.sin(direction)
  return [x * c + z * s, -x * s + z * c]
}

/* ============================== Handlage =============================== */

/**
 * Wo die Würfel vor dem Wurf liegen. Hängt nur am Seed (nicht an Richtung,
 * Kraft oder Wiederholungsversuch), damit die sichtbare Hand und der Start der
 * Flugbahn exakt übereinstimmen.
 */
export function handPose(n: number, cfg: DiceSimConfig, seed: number, tuning: DicePhysicsTuning = DEFAULT_TUNING): HandPose {
  const { h, Rb, y0 } = cfg
  const random = createSeededRandom(mixSeed(seed, 0))
  const handX = (random() - 0.5) * Rb * 0.18
  // Bounding spheres cannot intersect, even with arbitrary initial rotations.
  const minimumSeparation = 2 * Math.sqrt(3) * h
  const releaseAngle = random() * Math.PI * 2
  const flat: Array<[number, number]> = []
  if (n === 1) {
    flat.push([0, 0])
  } else if (n <= 4) {
    // A rotated, lightly irregular polygon reads as dice cupped in one hand.
    const radius = minimumSeparation / (2 * Math.sin(Math.PI / n)) + 0.08
    for (let i = 0; i < n; i++) {
      const angle = releaseAngle + (i / n) * Math.PI * 2 + (random() - 0.5) * 0.03
      const r = radius + (random() - 0.5) * minimumSeparation * 0.04
      flat.push([Math.cos(angle) * r, Math.sin(angle) * r])
    }
  } else {
    // One centre die plus a loose ring resembles a compact handful.
    flat.push([(random() - 0.5) * minimumSeparation * 0.025, (random() - 0.5) * minimumSeparation * 0.025])
    const ringCount = n - 1
    const radius = minimumSeparation * 1.08
    for (let i = 0; i < ringCount; i++) {
      const angle = releaseAngle + (i / ringCount) * Math.PI * 2 + (random() - 0.5) * 0.045
      const r = radius + (random() - 0.5) * minimumSeparation * 0.045
      flat.push([Math.cos(angle) * r, Math.sin(angle) * r])
    }
  }
  const pos: V3[] = []
  const quat: Quat[] = []
  const q = new CANNON.Quaternion()
  for (let i = 0; i < n; i++) {
    pos.push([handX + flat[i][0], y0 * 0.5 + i * 0.02 + random() * 0.14, Rb * tuning.handZ + flat[i][1]])
    q.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2)
    quat.push([q.x, q.y, q.z, q.w])
  }
  return { pos, quat }
}

/* ============================== Simulation ============================= */

type AttemptResult = Omit<DiceThrow, 'attempts'>

function* simulateAttempt(
  n: number,
  cfg: DiceSimConfig,
  pose: HandPose,
  input: ThrowInput,
  random: () => number,
  tuning: DicePhysicsTuning,
): Generator<void, AttemptResult> {
  const { h, Rb, G, FIXED_DT, MAX_STEPS } = cfg
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) })
  world.allowSleep = true
  ;(world.solver as CANNON.GSSolver).iterations = 14
  world.broadphase = new CANNON.NaiveBroadphase()
  const felt = new CANNON.Material('felt'), rim = new CANNON.Material('rim'), dieM = new CANNON.Material('die')
  world.addContactMaterial(new CANNON.ContactMaterial(felt, dieM, { friction: tuning.feltFriction, restitution: tuning.feltRestitution }))
  world.addContactMaterial(new CANNON.ContactMaterial(rim, dieM, { friction: tuning.rimFriction, restitution: tuning.rimRestitution }))
  world.addContactMaterial(new CANNON.ContactMaterial(dieM, dieM, { friction: tuning.diceFriction, restitution: tuning.diceRestitution }))
  world.defaultContactMaterial.friction = 0.14

  const floor = new CANNON.Body({ mass: 0, material: felt, shape: new CANNON.Plane() })
  floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(floor)
  // Gleichmäßiges Vieleck: jede Richtung trifft auf dieselbe Schale.
  const rimBodies = new Set<CANNON.Body>()
  for (let i = 0; i < tuning.rimSegments; i++) {
    const a = (i / tuning.rimSegments) * Math.PI * 2
    const nrm = new CANNON.Vec3(-Math.cos(a), tuning.rimSlope, -Math.sin(a)); nrm.normalize()
    const w = new CANNON.Body({ mass: 0, material: rim, shape: new CANNON.Plane() })
    w.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), nrm)
    w.position.set(Math.cos(a) * Rb, 0, Math.sin(a) * Rb)
    rimBodies.add(w)
    world.addBody(w)
  }

  const energy = clamp(input.energy, 0.65, 1.35)
  const between = (range: [number, number]) => range[0] + random() * (range[1] - range[0])
  const commonSide = (random() - 0.5) * 0.8
  const commonLift = between(tuning.lift) * (0.85 + 0.15 * energy)
  const commonForward = between(tuning.forward) * energy
  const commonSpin = between(tuning.spin) * (0.7 + 0.3 * energy)

  let curFrame = 0
  const impacts: DiceImpact[] = []
  const diceByBody = new Map<CANNON.Body, number>()
  const pairImpactIndices = new Map<string, number>()
  const bodies: CANNON.Body[] = []
  const minimumSeparation = 2 * Math.sqrt(3) * h
  let centerX = 0, centerZ = 0
  for (const p of pose.pos) { centerX += p[0] / n; centerZ += p[2] / n }
  for (let i = 0; i < n; i++) {
    const b = new CANNON.Body({ mass: 1, material: dieM, shape: new CANNON.Box(new CANNON.Vec3(h, h, h)), allowSleep: true })
    b.sleepSpeedLimit = 0.12; b.sleepTimeLimit = 0.42
    b.linearDamping = tuning.linearDamping; b.angularDamping = tuning.angularDamping
    const p = pose.pos[i], q = pose.quat[i]
    b.position.set(p[0], p[1], p[2])
    b.quaternion.set(q[0], q[1], q[2], q[3])
    // Seitliche Lage des Würfels in der Hand, gemessen quer zur Wurfrichtung.
    const [across] = toWorld(p[0] - centerX, p[2] - centerZ, -input.direction)
    const lane = across / minimumSeparation
    // Auffächern: Würfel weiter außen fliegen etwas weiter nach außen.
    const spread = lane * tuning.fan + (random() - 0.5) * tuning.fan * 0.5
    const forward = commonForward + (random() - 0.5) * 0.7
    const side = commonSide + lane * 0.22 + (random() - 0.5) * 0.75 + Math.sin(spread) * forward
    const [vx, vz] = toWorld(side, -Math.cos(spread) * forward, input.direction)
    b.velocity.set(vx, commonLift + (random() - 0.5) * 0.35, vz)
    // Vorwärts überschlagen um die Querachse, plus individuelles Trudeln.
    const spinX = -(commonSpin + (random() - 0.5) * 7)
    const spinY = (random() - 0.5) * 8 + lane * 0.7
    const spinZ = (random() - 0.5) * 9
    const [wx, wz] = toWorld(spinX, spinZ, input.direction)
    b.angularVelocity.set(wx, spinY, wz)
    const idx = i
    let lastImpactFrame = -10
    diceByBody.set(b, idx)
    b.addEventListener('collide', (e: { body?: CANNON.Body; contact?: { getImpactVelocityAlongNormal?: () => number } }) => {
      const v = Math.abs(e?.contact?.getImpactVelocityAlongNormal?.() ?? 0)
      if (v <= 1.2 || curFrame - lastImpactFrame < 5) return
      const classified = classifyImpactBody(e.body, floor, rimBodies, diceByBody)
      if (!classified) return
      lastImpactFrame = curFrame
      const intensity = clamp(v / 8, 0, 1)
      if (classified.kind === 'dice' && classified.otherDie !== undefined) {
        upsertDicePairImpact(impacts, pairImpactIndices, idx, classified.otherDie, curFrame, intensity)
      } else {
        impacts.push({ die: idx, frame: curFrame, intensity, kind: classified.kind })
      }
    })
    bodies.push(b); world.addBody(b)
  }

  const pos: V3[][] = bodies.map(() => [])
  const quat: Quat[][] = bodies.map(() => [])
  // Exakte Startlage = Handlage, vor dem ersten Integrationsschritt.
  for (let i = 0; i < n; i++) {
    pos[i].push([...pose.pos[i]])
    quat[i].push([...pose.quat[i]])
  }
  let restFrames = 0
  let settled = false
  for (curFrame = 1; curFrame <= MAX_STEPS; curFrame++) {
    world.step(FIXED_DT)
    for (let i = 0; i < n; i++) {
      const b = bodies[i]
      pos[i].push([b.position.x, b.position.y, b.position.z])
      quat[i].push([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w])
    }
    const allSlow = bodies.every(
      (b) => b.sleepState === CANNON.Body.SLEEPING || (b.velocity.lengthSquared() < 0.02 && b.angularVelocity.lengthSquared() < 0.05),
    )
    if (allSlow) {
      if (++restFrames > 16) { settled = true; break }
    } else restFrames = 0
    if (curFrame % 24 === 0) yield
  }

  let cocked = !settled
  const topSlots: number[] = []
  for (let i = 0; i < n; i++) {
    const last = quat[i].length - 1
    const { slot, dot } = topSlotFromQuat(quat[i][last])
    topSlots.push(slot)
    // Auf Kante/Ecke oder an einem anderen Würfel angelehnt.
    if (dot < 0.93) cocked = true
    // Auf einem anderen Würfel gestapelt.
    if (pos[i][last][1] > h * 1.7) cocked = true
  }
  impacts.sort((a, b) => a.frame - b.frame || a.die - b.die)
  return { pos, quat, impacts, topSlots, cocked, frames: pos[0]?.length ?? 0 }
}

function* simulateThrowGen(
  n: number,
  cfg: DiceSimConfig,
  seed: number,
  input: ThrowInput,
  tuning: DicePhysicsTuning,
): Generator<void, DiceThrow> {
  const pose = handPose(n, cfg, seed, tuning)
  // Geste geht in den Zufallsstrom ein: andere Richtung/Kraft → anderer Wurf.
  const gestureSalt = Math.round((input.direction + Math.PI * 4) * 1000) * 7 + Math.round(clamp(input.energy, 0.65, 1.35) * 100)
  let result: AttemptResult | null = null
  let attempts = 0
  for (let k = 0; k < tuning.maxAttempts; k++) {
    attempts = k + 1
    result = yield* simulateAttempt(n, cfg, pose, input, createSeededRandom(mixSeed(mixSeed(seed, 1000 + k), gestureSalt)), tuning)
    if (!result.cocked) break
  }
  return { ...(result as AttemptResult), attempts }
}

export type ThrowJob = {
  /** Rechnet höchstens budgetMs weiter. Liefert den fertigen Wurf oder null. */
  advance(budgetMs?: number): DiceThrow | null
  readonly result: DiceThrow | null
}

/** Startet einen Wurf als in Zeitscheiben abarbeitbaren Job. */
export function createThrowJob(
  n: number,
  cfg: DiceSimConfig,
  seed: number,
  input: ThrowInput,
  tuning: DicePhysicsTuning = DEFAULT_TUNING,
): ThrowJob {
  const gen = simulateThrowGen(n, cfg, seed, input, tuning)
  let result: DiceThrow | null = null
  return {
    advance(budgetMs = Infinity) {
      if (result) return result
      const start = performance.now()
      for (;;) {
        const step = gen.next()
        if (step.done) { result = step.value; return result }
        if (performance.now() - start >= budgetMs) return null
      }
    },
    get result() { return result },
  }
}

/** Ganzer Wurf auf einmal (Tests, Notfall-Fertigstellung). */
export function simulateThrow(
  n: number,
  cfg: DiceSimConfig,
  seed: number,
  input: ThrowInput,
  tuning: DicePhysicsTuning = DEFAULT_TUNING,
): DiceThrow {
  return createThrowJob(n, cfg, seed, input, tuning).advance() as DiceThrow
}

/* ============================== Nachlauf =============================== */

/**
 * Kürzt das unsichtbare Auskriechen am Ende: Sobald kein Würfel mehr sichtbar
 * von seiner Ruhelage abweicht, endet die Bahn. Die letzten Frames gleiten
 * weich in die exakte Ruhelage, damit kein Sprung entsteht. Die Ruhelage (und
 * damit die oben liegende Fläche) bleibt unverändert.
 */
export function trimRestTail(t: DiceThrow, opts: { posEps?: number; angleEps?: number; blendFrames?: number } = {}): DiceThrow {
  const posEps = opts.posEps ?? 0.012
  const angleEps = opts.angleEps ?? 1.5
  const blendFrames = opts.blendFrames ?? 8
  const n = t.pos.length
  if (!n) return t
  const F = t.frames - 1
  let visibleEnd = 0
  for (let f = F; f >= 0 && !visibleEnd; f--) {
    for (let i = 0; i < n; i++) {
      const p = t.pos[i][f], pe = t.pos[i][F]
      if (Math.hypot(p[0] - pe[0], p[1] - pe[1], p[2] - pe[2]) > posEps || quatAngleDeg(t.quat[i][f], t.quat[i][F]) > angleEps) {
        visibleEnd = f + 1
        break
      }
    }
  }
  const end = Math.min(F, visibleEnd + blendFrames)
  if (end >= F) return t
  const pos = t.pos.map((path) => path.slice(0, end + 1))
  const quat = t.quat.map((path) => path.slice(0, end + 1))
  const start = Math.max(0, end - blendFrames)
  for (let i = 0; i < n; i++) {
    const pe = t.pos[i][F], qe = t.quat[i][F]
    for (let f = start + 1; f <= end; f++) {
      const w = (f - start) / (end - start)
      const s = w * w * (3 - 2 * w)
      const p = t.pos[i][f]
      pos[i][f] = [p[0] + (pe[0] - p[0]) * s, p[1] + (pe[1] - p[1]) * s, p[2] + (pe[2] - p[2]) * s]
      quat[i][f] = qSlerp(t.quat[i][f], qe, s)
    }
  }
  return { ...t, pos, quat, frames: end + 1, impacts: t.impacts.filter((im) => im.frame <= end) }
}
