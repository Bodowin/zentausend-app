import { useEffect, useMemo, useRef, useState } from 'react'
import * as CANNON from 'cannon-es'

/**
 * Virtuelle Würfel mit ECHTER 3D-Starrkörper-Physik (cannon-es, reines JS – kein
 * WebGL) und CSS-3D-Rendering (matrix3d). Basiert auf dem Entwurf von ChatGPT,
 * an dieses Projekt angepasst.
 *
 * Trick gegen das sichtbare „Einrasten": Bevor der erste sichtbare Frame läuft,
 * wird dieselbe Physik deterministisch im Dry-Run durchgerechnet → wir wissen
 * vorab, welche Fläche oben landet, und weisen die vorbestimmte Augenzahl von
 * Anfang an genau dieser Fläche zu (Face-Relabeling). Ergebnis: natürlicher
 * Fall, echte Kollisionen, kein Slerp, kein End-Snap.
 */

export interface DiceArenaProps {
  values: number[]
  onSettle: () => void
}

type DieValue = 1 | 2 | 3 | 4 | 5 | 6
type FaceId = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
type FaceLabels = Record<FaceId, DieValue>

interface DieConfig {
  position: CANNON.Vec3
  quaternion: CANNON.Quaternion
  velocity: CANNON.Vec3
  angularVelocity: CANNON.Vec3
}

interface PhysicsSetup {
  seed: number
  values: DieValue[]
  configs: DieConfig[]
  labels: FaceLabels[]
  predictedTopFaces: FaceId[]
}

const FIXED_STEP = 1 / 60
const MAX_STEPS_PER_FRAME = 3
const PRE_SIM_STEPS = 280
const MIN_VISIBLE_MS = 1150
const FORCE_FINISH_MS = 4600

const DIE_SIZE = 0.72
const DIE_HALF = DIE_SIZE / 2
const DIE_PX = 58
const SCALE = DIE_PX / DIE_SIZE
const TRAY_W = 5.35
const TRAY_D = 3.75
const WALL_H = 0.9
const WALL_THICKNESS = 0.18
const GRAVITY = 13.5

const FACE_IDS: FaceId[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
const OPPOSITE: Record<FaceId, FaceId> = { px: 'nx', nx: 'px', py: 'ny', ny: 'py', pz: 'nz', nz: 'pz' }

const FACE_NORMALS: Record<FaceId, CANNON.Vec3> = {
  px: new CANNON.Vec3(1, 0, 0),
  nx: new CANNON.Vec3(-1, 0, 0),
  py: new CANNON.Vec3(0, 1, 0),
  ny: new CANNON.Vec3(0, -1, 0),
  pz: new CANNON.Vec3(0, 0, 1),
  nz: new CANNON.Vec3(0, 0, -1),
}

// DOM-Achsen-Mapping: DOM X = Physik X, DOM Y = Physik Z, DOM Z = Physik Y.
const FACE_TRANSFORMS: Record<FaceId, string> = {
  py: `translateZ(${DIE_PX / 2}px)`,
  ny: `rotateY(180deg) translateZ(${DIE_PX / 2}px)`,
  px: `rotateY(90deg) translateZ(${DIE_PX / 2}px)`,
  nx: `rotateY(-90deg) translateZ(${DIE_PX / 2}px)`,
  pz: `rotateX(90deg) translateZ(${DIE_PX / 2}px)`,
  nz: `rotateX(-90deg) translateZ(${DIE_PX / 2}px)`,
}

const PIPS: Record<DieValue, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

const css = `
.diceArena {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(120% 85% at 50% 0%, rgba(124, 139, 255, 0.16), transparent 56%),
    radial-gradient(100% 80% at 20% 100%, rgba(245, 184, 61, 0.11), transparent 60%),
    #060910;
  perspective: 920px;
  contain: layout paint size;
  touch-action: none;
}
.diceArena::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), transparent 28%, rgba(0,0,0,0.2));
  pointer-events: none;
}
.diceArena__world {
  --tray-w: ${TRAY_W * SCALE}px;
  --tray-d: ${TRAY_D * SCALE}px;
  position: absolute;
  left: 50%;
  top: 52%;
  width: var(--tray-w);
  height: var(--tray-d);
  transform-style: preserve-3d;
  transform: translate(-50%, -50%) scale(var(--fit, 1)) rotateX(61deg) rotateZ(-3deg);
}
.diceArena__felt {
  position: absolute;
  inset: 0;
  border-radius: 30px;
  background:
    radial-gradient(90% 75% at 50% 50%, rgba(47, 211, 165, 0.09), transparent 62%),
    radial-gradient(70% 45% at 50% 6%, rgba(255, 203, 92, 0.12), transparent 60%),
    repeating-radial-gradient(circle at 48% 45%, rgba(255,255,255,.025) 0 1px, transparent 1px 4px),
    linear-gradient(135deg, #0b332e, #061b1c 72%);
  box-shadow:
    inset 0 0 0 2px rgba(245, 184, 61, 0.18),
    inset 0 0 36px rgba(0, 0, 0, 0.72),
    0 22px 60px rgba(0, 0, 0, 0.55);
  transform: translateZ(0px);
}
.diceArena__wall {
  position: absolute;
  border-radius: 999px;
  background: linear-gradient(180deg, #1f1720, #08090f);
  box-shadow:
    inset 0 2px 0 rgba(255, 203, 92, 0.18),
    inset 0 -10px 16px rgba(0,0,0,.62),
    0 10px 22px rgba(0,0,0,.42);
  transform: translateZ(24px);
}
.diceArena__wall--top, .diceArena__wall--bottom { left: -18px; width: calc(100% + 36px); height: 38px; }
.diceArena__wall--top { top: -27px; }
.diceArena__wall--bottom { bottom: -27px; }
.diceArena__wall--left, .diceArena__wall--right { top: -14px; height: calc(100% + 28px); width: 38px; }
.diceArena__wall--left { left: -27px; }
.diceArena__wall--right { right: -27px; }
.diceArena__shadow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 30px;
  margin-left: -26px;
  margin-top: -15px;
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.62), rgba(0,0,0,.2) 46%, transparent 72%);
  filter: blur(2px);
  opacity: .5;
  transform-style: preserve-3d;
  will-change: transform, opacity;
  pointer-events: none;
}
.diceArena__die {
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${DIE_PX}px;
  height: ${DIE_PX}px;
  margin-left: ${-DIE_PX / 2}px;
  margin-top: ${-DIE_PX / 2}px;
  transform-style: preserve-3d;
  transform-origin: 50% 50%;
  will-change: transform;
  pointer-events: none;
}
.diceArena__face {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0;
  padding: 8px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 23%, rgba(255,255,255,.95), rgba(255,255,255,0) 32%),
    linear-gradient(145deg, #fffaf0, #ece4d3 54%, #d5c7ae);
  box-shadow:
    inset 0 0 0 1px rgba(10, 14, 22, .14),
    inset 0 -8px 13px rgba(10, 14, 22, .18),
    inset 0 5px 8px rgba(255, 255, 255, .68);
  backface-visibility: hidden;
}
.diceArena__face::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,.16), transparent 45%, rgba(0,0,0,.08));
  pointer-events: none;
}
.diceArena__pip {
  width: 9px;
  height: 9px;
  align-self: center;
  justify-self: center;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 32%, #38445d, #0a0e16 72%);
  box-shadow: inset 0 1px 1px rgba(255,255,255,.16);
}
@media (prefers-reduced-motion: reduce) {
  .diceArena__world { transform: translate(-50%, -50%) scale(var(--fit, 1)) rotateX(58deg) rotateZ(-3deg); }
}
`

export default function DiceArena({ values, onSettle }: DiceArenaProps) {
  const seedRef = useRef<number>(makeSeed())
  const arenaRef = useRef<HTMLDivElement | null>(null)
  const dieRefs = useRef<(HTMLDivElement | null)[]>([])
  const shadowRefs = useRef<(HTMLSpanElement | null)[]>([])
  const onSettleRef = useRef(onSettle)
  onSettleRef.current = onSettle

  const valuesKey = values.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setup = useMemo(() => createSetup(normalizeValues(values), seedRef.current), [valuesKey])
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (setup.values.length === 0) {
      const t = window.setTimeout(() => onSettleRef.current(), 0)
      return () => window.clearTimeout(t)
    }

    // Tray responsiv an die Arena-Breite anpassen (sonst läuft er auf schmalen Phones über).
    const arena = arenaRef.current
    if (arena) {
      const fit = Math.min(1, (arena.clientWidth * 0.94) / (TRAY_W * SCALE + 70))
      arena.style.setProperty('--fit', String(fit))
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const { world, bodies } = createWorld(setup.configs)

    let raf = 0
    let last = performance.now()
    let acc = 0
    let stableFrames = 0
    let frameCount = 0
    const startedAt = last
    let done = false

    const finish = () => {
      if (done) return
      done = true
      setSettled(true)
      updateDom(bodies, dieRefs.current, shadowRefs.current)
      window.setTimeout(() => onSettleRef.current(), reduceMotion ? 80 : 180)
    }

    if (reduceMotion) {
      for (let i = 0; i < bodies.length; i++) {
        bodies[i].position.set(-1.55 + i * 0.62, DIE_HALF + 0.015, i % 2 ? 0.32 : -0.32)
        bodies[i].velocity.set(0, 0, 0)
        bodies[i].angularVelocity.set(0, 0, 0)
      }
      updateDom(bodies, dieRefs.current, shadowRefs.current)
      finish()
      return () => undefined
    }

    updateDom(bodies, dieRefs.current, shadowRefs.current)

    const tick = (now: number) => {
      if (done) return
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      acc += dt

      let subSteps = 0
      while (acc >= FIXED_STEP && subSteps < MAX_STEPS_PER_FRAME) {
        world.step(FIXED_STEP)
        acc -= FIXED_STEP
        subSteps += 1
        frameCount += 1
      }
      if (subSteps === MAX_STEPS_PER_FRAME) acc = 0

      updateDom(bodies, dieRefs.current, shadowRefs.current)

      const elapsed = now - startedAt
      const sameTopAsPreSim = bodies.every((body, i) => topFaceFromBody(body) === setup.predictedTopFaces[i])
      const slowEnough = allBodiesSlow(bodies)
      if (elapsed > MIN_VISIBLE_MS && sameTopAsPreSim && slowEnough) stableFrames += 1
      else stableFrames = 0

      if (stableFrames >= 14 || elapsed > FORCE_FINISH_MS || frameCount > PRE_SIM_STEPS + 90) {
        finish()
        return
      }
      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      done = true
      window.cancelAnimationFrame(raf)
    }
  }, [setup])

  return (
    <div ref={arenaRef} className={`diceArena${settled ? ' diceArena--settled' : ''}`} aria-label="Virtueller 3D-Würfelwurf">
      <style>{css}</style>
      <div className="diceArena__world">
        <div className="diceArena__felt" />
        <span className="diceArena__wall diceArena__wall--top" />
        <span className="diceArena__wall diceArena__wall--right" />
        <span className="diceArena__wall diceArena__wall--bottom" />
        <span className="diceArena__wall diceArena__wall--left" />

        {setup.values.map((_, i) => (
          <span
            key={`shadow-${i}-${setup.seed}`}
            ref={(el) => {
              shadowRefs.current[i] = el
            }}
            className="diceArena__shadow"
          />
        ))}

        {setup.values.map((_, i) => (
          <div
            key={`die-${i}-${setup.seed}`}
            ref={(el) => {
              dieRefs.current[i] = el
            }}
            className="diceArena__die"
          >
            {FACE_IDS.map((face) => (
              <DiceFace key={face} value={setup.labels[i][face]} transform={FACE_TRANSFORMS[face]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DiceFace({ value, transform }: { value: DieValue; transform: string }) {
  return (
    <div className="diceArena__face" style={{ transform }} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) =>
        PIPS[value].includes(i) ? <span key={i} className="diceArena__pip" /> : <span key={i} />,
      )}
    </div>
  )
}

function normalizeValues(input: number[]): DieValue[] {
  return input
    .slice(0, 6)
    .map((v) => Math.round(v))
    .filter((v): v is DieValue => v >= 1 && v <= 6)
}

function createSetup(values: DieValue[], seed: number): PhysicsSetup {
  const rng = mulberry32(seed)
  const configs = createInitialConfigs(values.length, rng)

  // Dry-Run derselben Physik vor dem ersten sichtbaren Frame → obenliegende
  // Fläche vorhersagen und die gewünschte Augenzahl dort zuweisen.
  const { world, bodies } = createWorld(configs)
  for (let i = 0; i < PRE_SIM_STEPS; i += 1) {
    world.step(FIXED_STEP)
    if (i > 90 && allBodiesSlow(bodies)) break
  }

  const predictedTopFaces = bodies.map(topFaceFromBody)
  const labels = predictedTopFaces.map((topFace, i) => labelsForTargetTop(topFace, values[i]))
  return { seed, values, configs, labels, predictedTopFaces }
}

function createInitialConfigs(count: number, rng: () => number): DieConfig[] {
  const configs: DieConfig[] = []
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))))

  for (let i = 0; i < count; i += 1) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = -TRAY_W * 0.33 + col * 0.62 + randRange(rng, -0.1, 0.1)
    const z = -TRAY_D * 0.28 + row * 0.56 + randRange(rng, -0.12, 0.12)
    const y = 2.1 + i * 0.13 + randRange(rng, -0.08, 0.12)

    const quaternion = new CANNON.Quaternion()
    quaternion.setFromEuler(randRange(rng, 0, Math.PI * 2), randRange(rng, 0, Math.PI * 2), randRange(rng, 0, Math.PI * 2), 'XYZ')

    configs.push({
      position: new CANNON.Vec3(x, y, z),
      quaternion,
      velocity: new CANNON.Vec3(randRange(rng, 1.8, 3.4), randRange(rng, 0.15, 1.2), randRange(rng, 1.1, 2.7)),
      angularVelocity: new CANNON.Vec3(randRange(rng, -12, 12), randRange(rng, -16, 16), randRange(rng, -13, 13)),
    })
  }
  return configs
}

function createWorld(configs: DieConfig[]) {
  const world = new CANNON.World()
  world.gravity.set(0, -GRAVITY, 0)
  world.allowSleep = true
  world.broadphase = new CANNON.NaiveBroadphase()
  const solver = world.solver as CANNON.GSSolver
  solver.iterations = 12
  solver.tolerance = 0.001

  const diceMat = new CANNON.Material('bone-dice')
  const trayMat = new CANNON.Material('felt-tray')

  world.addContactMaterial(
    new CANNON.ContactMaterial(diceMat, trayMat, {
      friction: 0.62,
      restitution: 0.31,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 4,
    }),
  )
  world.addContactMaterial(
    new CANNON.ContactMaterial(diceMat, diceMat, {
      friction: 0.45,
      restitution: 0.38,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 4,
    }),
  )

  const floor = new CANNON.Body({ mass: 0, material: trayMat })
  floor.addShape(new CANNON.Box(new CANNON.Vec3(TRAY_W / 2, 0.05, TRAY_D / 2)))
  floor.position.set(0, -0.05, 0)
  world.addBody(floor)

  addWall(world, trayMat, 0, WALL_H / 2, -TRAY_D / 2 - WALL_THICKNESS / 2, TRAY_W / 2 + WALL_THICKNESS, WALL_H / 2, WALL_THICKNESS / 2)
  addWall(world, trayMat, 0, WALL_H / 2, TRAY_D / 2 + WALL_THICKNESS / 2, TRAY_W / 2 + WALL_THICKNESS, WALL_H / 2, WALL_THICKNESS / 2)
  addWall(world, trayMat, -TRAY_W / 2 - WALL_THICKNESS / 2, WALL_H / 2, 0, WALL_THICKNESS / 2, WALL_H / 2, TRAY_D / 2)
  addWall(world, trayMat, TRAY_W / 2 + WALL_THICKNESS / 2, WALL_H / 2, 0, WALL_THICKNESS / 2, WALL_H / 2, TRAY_D / 2)

  const diceShape = new CANNON.Box(new CANNON.Vec3(DIE_HALF, DIE_HALF, DIE_HALF))
  const bodies = configs.map((cfg) => {
    const body = new CANNON.Body({ mass: 1, material: diceMat })
    body.addShape(diceShape)
    body.position.copy(cfg.position)
    body.quaternion.copy(cfg.quaternion)
    body.velocity.copy(cfg.velocity)
    body.angularVelocity.copy(cfg.angularVelocity)
    body.linearDamping = 0.18
    body.angularDamping = 0.32
    body.sleepSpeedLimit = 0.12
    body.sleepTimeLimit = 0.28
    world.addBody(body)
    return body
  })

  return { world, bodies }
}

function addWall(
  world: CANNON.World,
  material: CANNON.Material,
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
) {
  const wall = new CANNON.Body({ mass: 0, material })
  wall.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)))
  wall.position.set(x, y, z)
  world.addBody(wall)
}

function labelsForTargetTop(topFace: FaceId, target: DieValue): FaceLabels {
  const labels = {} as FaceLabels
  labels[topFace] = target

  const oppositeFace = OPPOSITE[topFace]
  const oppositeValue = (7 - target) as DieValue
  labels[oppositeFace] = oppositeValue

  const remainingFaces = FACE_IDS.filter((f) => labels[f] === undefined)
  const remainingValues = ([1, 2, 3, 4, 5, 6] as DieValue[]).filter((v) => v !== target && v !== oppositeValue)

  for (let i = 0; i < remainingFaces.length; i += 1) labels[remainingFaces[i]] = remainingValues[i]
  return labels
}

function topFaceFromBody(body: CANNON.Body): FaceId {
  let best: FaceId = 'py'
  let bestDot = -Infinity
  for (const face of FACE_IDS) {
    const normal = body.quaternion.vmult(FACE_NORMALS[face])
    const dot = normal.y
    if (dot > bestDot) {
      best = face
      bestDot = dot
    }
  }
  return best
}

function allBodiesSlow(bodies: CANNON.Body[]): boolean {
  return bodies.every(
    (body) =>
      body.sleepState === CANNON.Body.SLEEPING ||
      (body.velocity.lengthSquared() < 0.015 && body.angularVelocity.lengthSquared() < 0.12 && body.position.y < DIE_HALF + 0.09),
  )
}

function updateDom(
  bodies: CANNON.Body[],
  dieEls: Array<HTMLDivElement | null>,
  shadowEls: Array<HTMLSpanElement | null>,
) {
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i]
    const die = dieEls[i]
    if (die) die.style.transform = physicsToCssMatrix(body.position, body.quaternion)

    const shadow = shadowEls[i]
    if (shadow) {
      const height = Math.max(0, body.position.y - DIE_HALF)
      const scale = clamp(1.08 - height * 0.34, 0.34, 1.08)
      const opacity = clamp(0.76 - height * 0.26, 0.16, 0.76)
      shadow.style.opacity = String(opacity)
      shadow.style.transform = `translate3d(${round3(body.position.x * SCALE)}px, ${round3(body.position.z * SCALE)}px, 1px) scale(${round3(scale)})`
    }
  }
}

function physicsToCssMatrix(position: CANNON.Vec3, q: CANNON.Quaternion): string {
  const x = q.x
  const y = q.y
  const z = q.z
  const w = q.w
  const xx = x * x
  const yy = y * y
  const zz = z * z
  const xy = x * y
  const xz = x * z
  const yz = y * z
  const wx = w * x
  const wy = w * y
  const wz = w * z

  const r00 = 1 - 2 * (yy + zz)
  const r01 = 2 * (xy - wz)
  const r02 = 2 * (xz + wy)
  const r10 = 2 * (xy + wz)
  const r11 = 1 - 2 * (xx + zz)
  const r12 = 2 * (yz - wx)
  const r20 = 2 * (xz - wy)
  const r21 = 2 * (yz + wx)
  const r22 = 1 - 2 * (xx + yy)

  // Achsen-Remap A*R*A^T mit CSS-Achsen [Physik X, Physik Z, Physik Y].
  const c00 = r00
  const c01 = r02
  const c02 = r01
  const c10 = r20
  const c11 = r22
  const c12 = r21
  const c20 = r10
  const c21 = r12
  const c22 = r11

  const tx = position.x * SCALE
  const ty = position.z * SCALE
  const tz = position.y * SCALE

  return `matrix3d(${round5(c00)},${round5(c10)},${round5(c20)},0,${round5(c01)},${round5(c11)},${round5(c21)},0,${round5(c02)},${round5(c12)},${round5(c22)},0,${round3(tx)},${round3(ty)},${round3(tz)},1)`
}

function makeSeed(): number {
  try {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0] || Date.now()
  } catch {
    return Date.now()
  }
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function rng() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng()
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function round3(v: number): string {
  return Number.isFinite(v) ? v.toFixed(3) : '0'
}

function round5(v: number): string {
  return Number.isFinite(v) ? v.toFixed(5) : '0'
}
