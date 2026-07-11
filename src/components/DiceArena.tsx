/**
 * DiceArena — echter 3D-Schwerkraft-Fall in einer Würfelschale, gerendert OHNE WebGL.
 *
 * Basiert auf dem Entwurf von Claude, an dieses Projekt angepasst (Demo-Wrapper
 * entfernt, Casino-Grün-Optik, Default-Export). Architektur:
 *  1) HEADLESS PRE-ROLL: cannon-es simuliert den kompletten Wurf einmal ohne
 *     Rendering bis zur Ruhe und zeichnet Position/Quaternion pro Schritt auf.
 *  2) RELABELING VOR FRAME 1: Aus der Ruhe-Orientierung wird die obenliegende
 *     Fläche bestimmt und EINE gültige Würfel-Beschriftung (Rotation eines echten
 *     Würfels) gewählt, deren Oberseite values[i] zeigt — bevor etwas sichtbar ist.
 *  3) PLAYBACK: Die aufgezeichnete Bahn wird per CSS-3D abgespielt (matrix3d aus
 *     der Quaternion). Da die Zahlen die ganze Animation gleich bleiben, gibt es
 *     nichts zu verstecken → kein Umspringen der Augenzahl.
 *
 *  Cocked-Rejection: Landet ein Würfel auf Kante/Ecke, wird der Pre-Roll neu
 *  gewürfelt (unsichtbar). Kein WebGL → iOS-stabil, offline.
 */

import * as CANNON from 'cannon-es'
import { useEffect, useRef, useState } from 'react'
import { getPrefs, DICE_THEMES } from '../lib/prefs'

type DiceArenaProps = {
  values: number[]
  /** Optionaler Abschluss-Hook, wenn die Würfel zur Ruhe gekommen sind. */
  onSettle?: () => void
  /** Erlaubt das Antippen der gelandeten Würfel zur Auswahl (Auslegen). */
  selectable?: boolean
  /** Augenzahlen, die aktuell ungültig sind → ausgewählte Würfel rot statt gold. */
  invalidValues?: number[]
  /** Meldet die aktuelle Auswahl (ausgelegte vs. liegengebliebene Augen). */
  onSelectionChange?: (selected: number[], remaining: number[]) => void
  /** Meldet die Wurfphase (ready = kreiselt, rolling = fällt, landed = liegt). */
  onPhaseChange?: (phase: 'ready' | 'rolling' | 'landed') => void
}

/* ============================ Würfel-Logik ============================== */
// Slots (Body-lokal): 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
const SLOT_NORMALS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]
// Ein gültiger Standardwürfel (gegenüberliegend = 7). Falls Augen gespiegelt
// wirken: +X/-X tauschen, z.B. [5,2,3,4,1,6] → kippt die Chiralität.
const BASE = [2, 5, 3, 4, 1, 6]

// CSS-Flächen-Transforms je Slot (kanonischer CSS-Würfel; +Y = optisch oben).
const SLOT_TF = [
  'rotateY(90deg) translateZ(var(--h))',
  'rotateY(-90deg) translateZ(var(--h))',
  'rotateX(90deg) translateZ(var(--h))',
  'rotateX(-90deg) translateZ(var(--h))',
  'translateZ(var(--h))',
  'rotateY(180deg) translateZ(var(--h))',
]

// Augen-Positionen (Spalte, Zeile) im 3×3-Raster – auch für Mini-Würfel in der Ablage.
export const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

// --- die 24 gültigen Beschriftungen (alle = Rotationen von BASE → garantiert gültig) ---
const composePerm = (a: number[], b: number[]) => b.map((x) => a[x])
function buildLabelings(): number[][] {
  const gX = [0, 1, 4, 5, 3, 2], gY = [5, 4, 2, 3, 0, 1], gZ = [2, 3, 1, 0, 4, 5]
  const id = [0, 1, 2, 3, 4, 5]
  const seen = new Map<string, number[]>([[id.join(), id]])
  const queue = [id]
  while (queue.length) {
    const p = queue.shift()!
    for (const g of [gX, gY, gZ]) {
      const np = composePerm(g, p), k = np.join()
      if (!seen.has(k)) { seen.set(k, np); queue.push(np) }
    }
  }
  const out: number[][] = []
  for (const p of seen.values()) {
    const L = new Array(6)
    for (let s = 0; s < 6; s++) L[p[s]] = BASE[s]
    out.push(L)
  }
  return out
}
const LABELINGS = buildLabelings()

function chooseLabeling(topSlot: number, value: number): number[] {
  return LABELINGS.find((L) => L[topSlot] === value) ?? LABELINGS[0]
}

/* ============================ Mathe-Helfer ============================== */
type Q = [number, number, number, number]
type V = [number, number, number]

function rotV(v: V, q: Q): V {
  const [vx, vy, vz] = v
  const [qx, qy, qz, qw] = q
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx)
  return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)]
}
function topSlotFromQuat(q: Q): { slot: number; dot: number } {
  let slot = 2, dot = -Infinity
  for (let s = 0; s < 6; s++) { const d = rotV(SLOT_NORMALS[s], q)[1]; if (d > dot) { dot = d; slot = s } }
  return { slot, dot }
}
function qSlerp(a: Q, b: Q, t: number): Q {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  let bb: Q = b
  if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d }
  if (d > 0.9995) {
    const r: Q = [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]
    const l = Math.hypot(r[0], r[1], r[2], r[3]) || 1
    return [r[0] / l, r[1] / l, r[2] / l, r[3] / l]
  }
  const th0 = Math.acos(d), th = th0 * t
  const s0 = Math.sin(th0 - th) / Math.sin(th0), s1 = Math.sin(th) / Math.sin(th0)
  return [a[0] * s0 + bb[0] * s1, a[1] * s0 + bb[1] * s1, a[2] * s0 + bb[2] * s1, a[3] * s0 + bb[3] * s1]
}

function qAxisAngle(x: number, y: number, z: number, ang: number): Q {
  const s = Math.sin(ang / 2)
  return [x * s, y * s, z * s, Math.cos(ang / 2)]
}

function matrix3dFor(q: Q, p: V, S: number): string {
  const [x, y, z, w] = q
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z
  const r00 = 1 - 2 * (yy + zz), r01 = 2 * (xy - wz), r02 = 2 * (xz + wy)
  const r10 = 2 * (xy + wz), r11 = 1 - 2 * (xx + zz), r12 = 2 * (yz - wx)
  const r20 = 2 * (xz - wy), r21 = 2 * (yz + wx), r22 = 1 - 2 * (xx + yy)
  const m00 = r00, m01 = -r01, m02 = r02
  const m10 = -r10, m11 = r11, m12 = -r12
  const m20 = r20, m21 = -r21, m22 = r22
  const tx = p[0] * S, ty = -p[1] * S, tz = p[2] * S
  return `matrix3d(${m00},${m10},${m20},0,${m01},${m11},${m21},0,${m02},${m12},${m22},0,${tx},${ty},${tz},1)`
}

/* ================================ Audio ================================ */
let audioCtx: AudioContext | null = null
// Sounds nur, wenn in den Einstellungen aktiviert (Standard an). Wird beim
// ersten Antippen entsperrt (iOS verlangt eine User-Geste).
const soundOn = () => getPrefs().sound
/** Muss in einer User-Geste aufgerufen werden, um den Aufprall-Klick zu aktivieren. */
export function unlockDiceAudio() {
  if (typeof window === 'undefined' || !soundOn()) return
  if (!audioCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) audioCtx = new AC()
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
}
function playClick(intensity: number) {
  const ctx = audioCtx
  if (!ctx || ctx.state !== 'running' || !soundOn()) return
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(150 + intensity * 140, t)
  o.frequency.exponentialRampToValueAtTime(70, t + 0.06)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.min(0.16, 0.03 + intensity * 0.16), t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.1)
}
// Heller, kurzer Klick beim Auslegen eines Würfels.
function playTap() {
  const ctx = audioCtx
  if (!ctx || ctx.state !== 'running' || !soundOn()) return
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(660, t)
  o.frequency.exponentialRampToValueAtTime(990, t + 0.05)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.11)
}

/* ===================== Pre-Roll (headless Physik) ====================== */
type Impact = { die: number; frame: number; intensity: number }
type Attempt = { pos: V[][]; quat: Q[][]; impacts: Impact[]; topSlots: number[]; cocked: boolean; frames: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function runAttempt(n: number, cfg: { h: number; Rb: number; y0: number; G: number; FIXED_DT: number; MAX_STEPS: number }): Attempt {
  const { h, Rb, y0, G, FIXED_DT, MAX_STEPS } = cfg
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -G, 0) })
  world.allowSleep = true
  ;(world.solver as CANNON.GSSolver).iterations = 14
  world.broadphase = new CANNON.NaiveBroadphase()
  const ground = new CANNON.Material('g'), dieM = new CANNON.Material('d')
  world.addContactMaterial(new CANNON.ContactMaterial(ground, dieM, { friction: 0.1, restitution: 0.3 }))
  world.addContactMaterial(new CANNON.ContactMaterial(dieM, dieM, { friction: 0.06, restitution: 0.25 }))
  world.defaultContactMaterial.friction = 0.1

  const floor = new CANNON.Body({ mass: 0, material: ground, shape: new CANNON.Plane() })
  floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(floor)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const nrm = new CANNON.Vec3(-Math.cos(a), 0.22, -Math.sin(a)); nrm.normalize()
    const w = new CANNON.Body({ mass: 0, material: ground, shape: new CANNON.Plane() })
    w.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), nrm)
    w.position.set(Math.cos(a) * Rb, 0, Math.sin(a) * Rb)
    world.addBody(w)
  }

  let curFrame = 0
  const impacts: Impact[] = []
  const bodies: CANNON.Body[] = []
  for (let i = 0; i < n; i++) {
    const b = new CANNON.Body({ mass: 1, material: dieM, shape: new CANNON.Box(new CANNON.Vec3(h, h, h)), allowSleep: true })
    b.sleepSpeedLimit = 0.15; b.sleepTimeLimit = 0.3; b.linearDamping = 0.01; b.angularDamping = 0.03
    // Echter Wurf aus der Hand: die Würfel starten als Traube am vorderen Rand
    // (nah beim Spieler, leicht über der Schale) …
    b.position.set(
      (Math.random() - 0.5) * Rb * 0.45,
      y0 * 0.55 + Math.random() * 0.8 + i * 0.3,
      Rb * 0.6 + (Math.random() - 0.5) * 0.4,
    )
    b.quaternion.setFromEuler(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28)
    // … und fliegen in einem flachen Bogen nach vorn in die Schale: Schwung
    // Richtung Mitte, kaum Aufwärts-Toss, kräftiges Vorwärts-Tumbeln. Flach
    // genug, dass sie optisch nie über den hinteren Schalenrand hinausschießen.
    b.velocity.set((Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 0.9, -(4.5 + Math.random() * 2))
    b.angularVelocity.set(
      -(16 + Math.random() * 16),
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
    )
    const idx = i
    b.addEventListener('collide', (e: { contact?: { getImpactVelocityAlongNormal?: () => number } }) => {
      const v = Math.abs(e?.contact?.getImpactVelocityAlongNormal?.() ?? 0)
      if (v > 1.2) impacts.push({ die: idx, frame: curFrame, intensity: clamp(v / 8, 0, 1) })
    })
    bodies.push(b); world.addBody(b)
  }

  const pos: V[][] = bodies.map(() => [])
  const quat: Q[][] = bodies.map(() => [])
  let restFrames = 0
  for (curFrame = 0; curFrame < MAX_STEPS; curFrame++) {
    world.step(FIXED_DT)
    for (let i = 0; i < n; i++) {
      const b = bodies[i]
      pos[i].push([b.position.x, b.position.y, b.position.z])
      quat[i].push([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w])
    }
    const allSlow = bodies.every(
      (b) => b.sleepState === CANNON.Body.SLEEPING || (b.velocity.lengthSquared() < 0.02 && b.angularVelocity.lengthSquared() < 0.05),
    )
    if (allSlow) { if (++restFrames > 10) break } else restFrames = 0
  }

  let cocked = false
  const topSlots: number[] = []
  for (let i = 0; i < n; i++) {
    const last = quat[i].length - 1
    const q = quat[i][last]
    const { slot, dot } = topSlotFromQuat(q)
    topSlots.push(slot)
    if (dot < 0.92) cocked = true
    // Auf einem anderen Würfel gestapelt? Ruht deutlich über dem Boden → neu würfeln.
    if (pos[i][last][1] > h * 1.7) cocked = true
  }
  return { pos, quat, impacts, topSlots, cocked, frames: pos[0]?.length ?? 0 }
}

/* =============================== Komponente ============================= */
type ArenaData = {
  pos: V[][]; quat: Q[][]; impacts: Impact[]; labelings: number[][]
  frames: number; S: number; sizePx: number; feltPx: number; FIXED_DT: number; camTilt: number; perspective: number
}

type Phase = 'ready' | 'rolling' | 'landed'

// Wie weit ein ausgewählter Würfel zum Auslegen aus der Schale steigt (Bowl-Einheiten).
const LIFT = 1.9

export default function DiceArena({
  values,
  onSettle,
  selectable = false,
  invalidValues = [],
  onSelectionChange,
  onPhaseChange,
}: DiceArenaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<HTMLDivElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const dieRefs = useRef<HTMLDivElement[]>([])
  const shadowRefs = useRef<HTMLDivElement[]>([])
  const dataRef = useRef<ArenaData | null>(null)
  const reduceRef = useRef(false)
  const onSettleRef = useRef(onSettle); onSettleRef.current = onSettle
  const onSelRef = useRef(onSelectionChange); onSelRef.current = onSelectionChange
  const onPhaseRef = useRef(onPhaseChange); onPhaseRef.current = onPhaseChange
  const [ready, setReady] = useState(false)
  // ready = Würfel drehen sich „in der Hand", warten auf Tipp;
  // rolling = aufgezeichneter Fall läuft; landed = liegen, antippbar zum Auslegen.
  const [phase, setPhase] = useState<Phase>('ready')
  // Welche gelandeten Würfel sind ausgewählt (ausgelegt)?
  const [sel, setSel] = useState<boolean[]>([])

  // Hilfsfunktion: Würfel + Schatten setzen.
  const writeDie = (d: ArenaData, i: number, p: V, q: Q, pop = 0) => {
    const el = dieRefs.current[i]
    if (el) el.style.transform = `${matrix3dFor(q, p, d.S)} scale(${1 + pop})`
    const sh = shadowRefs.current[i]
    if (sh) {
      const lift = clamp(p[1] / 4, 0, 1)
      sh.style.transform = `translate3d(${p[0] * d.S}px,0,${p[2] * d.S}px) rotateX(90deg) scale(${0.7 + lift * 0.8})`
      sh.style.opacity = `${0.4 * (1 - lift * 0.6)}`
    }
  }

  // Kleiner Staub-Puff auf dem Filz an der Aufprallstelle (imperativ, ohne React-State).
  const spawnDust = (d: ArenaData, x: number, z: number, intensity: number) => {
    const layer = fxRef.current
    if (!layer) return
    const el = document.createElement('div')
    el.className = 'da-dust'
    const s = d.sizePx * (1 + intensity * 1.3)
    el.style.width = `${s}px`
    el.style.height = `${s}px`
    el.style.transform = `translate3d(${x * d.S}px,0,${z * d.S}px) rotateX(90deg)`
    el.addEventListener('animationend', () => el.remove())
    layer.appendChild(el)
  }

  // --- Pre-Roll (einmal, beim Mount) ---
  useEffect(() => {
    const root = rootRef.current; if (!root) return
    const vals = values.map((v) => clamp(Math.round(v), 1, 6))
    const n = vals.length
    if (n === 0) { onSettleRef.current?.(); return }
    setSel(new Array(n).fill(false))

    const W = root.clientWidth || 320, H = root.clientHeight || 360, minD = Math.min(W, H)
    const h = 0.44
    const Rb = 1.9 + n * 0.3
    // Etwas niedrigere Abwurfhöhe: die „in der Hand" kreisenden Würfel bleiben
    // dadurch komplett in der (nach oben gerückten) Schale sichtbar.
    const y0 = Rb * 0.5 + 2.2
    // Maßstab: so groß wie möglich, damit die Würfel am Handy gut antippbar
    // sind — aber die (perspektivisch hohe) Schale muss auf beiden Achsen ins
    // Bild passen. Die Höhe begrenzt am Handy, die Breite am Tablet: dort muss
    // der komplette Filz (2·Rb+1,2 breit, vorn perspektivisch vergrößert) mit
    // Luft hineinpassen. Würfel und Schale skalieren gemeinsam, bleiben bündig.
    const S = Math.min((H * 0.40) / Rb, (W * 0.88) / (2 * Rb + 1.2))
    const sizePx = 2 * h * S
    const feltPx = (2 * Rb + 1.2) * S
    const camTilt = -60, perspective = minD * 1.5
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    reduceRef.current = !!reduce

    if (reduce) {
      const labelings = vals.map((v) => chooseLabeling(2, v))
      const pos: V[][] = vals.map((_, i) => [[(i - (n - 1) / 2) * (2 * h * 1.2), h, 0]])
      const quat: Q[][] = vals.map(() => [[0, 0, 0, 1]])
      dataRef.current = { pos, quat, impacts: [], labelings, frames: 1, S, sizePx, feltPx, FIXED_DT: 1 / 60, camTilt, perspective }
      setReady(true)
      const t = setTimeout(() => onSettleRef.current?.(), 400)
      return () => clearTimeout(t)
    }

    const cfg = { h, Rb, y0, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 600 }
    let attempt = runAttempt(n, cfg)
    for (let k = 0; k < 9 && attempt.cocked; k++) attempt = runAttempt(n, cfg)

    const labelings = attempt.topSlots.map((slot, i) => chooseLabeling(slot, vals[i]))
    attempt.impacts.sort((a, b) => a.frame - b.frame)
    dataRef.current = {
      pos: attempt.pos, quat: attempt.quat, impacts: attempt.impacts, labelings,
      frames: attempt.frames, S, sizePx, feltPx, FIXED_DT: cfg.FIXED_DT, camTilt, perspective,
    }
    setReady(true)
  }, [values])

  // --- „In der Hand": Würfel drehen sich an der Startposition, bis getippt wird. ---
  useEffect(() => {
    if (!ready || phase !== 'ready' || reduceRef.current) return
    const d = dataRef.current; if (!d) return
    const n = d.labelings.length
    const start = performance.now()
    let raf = 0
    const spin = (now: number) => {
      const t = (now - start) / 1000
      for (let i = 0; i < n; i++) {
        const p0 = d.pos[i]?.[0]; if (!p0) continue
        // jeder Würfel um eine eigene, leicht gekippte Achse
        const ax = Math.cos(i * 2.1), az = Math.sin(i * 2.1)
        const len = Math.hypot(ax, 0.7, az) || 1
        const q = qAxisAngle(ax / len, 0.7 / len, az / len, t * (3.4 + i * 0.4))
        writeDie(d, i, p0, q)
      }
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(raf)
  }, [ready, phase])

  // --- Wurf: aufgezeichnete Bahn abspielen (nach Tipp). ---
  useEffect(() => {
    if (phase !== 'rolling') return
    const d = dataRef.current; if (!d) return
    const n = d.labelings.length, dt = d.FIXED_DT, last = d.frames - 1, SPEED = 1.6
    const pulses = new Array(n).fill(0)
    let impactPtr = 0, raf = 0, shake = 0
    const start = performance.now()

    const frame = (now: number) => {
      const f = ((now - start) / 1000) * SPEED / dt
      const i0 = Math.min(Math.floor(f), last), i1 = Math.min(i0 + 1, last)
      const a = i0 === last ? 0 : f - i0
      for (let i = 0; i < n; i++) {
        const arr = d.pos[i], qarr = d.quat[i]
        if (!arr || !arr.length) continue
        const li = arr.length - 1
        const k0 = Math.max(0, Math.min(i0, li)), k1 = Math.max(0, Math.min(i1, li))
        const p0 = arr[k0], p1 = arr[k1]
        const p: V = [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a]
        writeDie(d, i, p, qSlerp(qarr[k0], qarr[k1], a), pulses[i])
      }
      while (impactPtr < d.impacts.length && d.impacts[impactPtr].frame <= i0) {
        const im = d.impacts[impactPtr++]
        pulses[im.die] = Math.min(0.14, pulses[im.die] + im.intensity * 0.13)
        playClick(im.intensity)
        navigator.vibrate?.(Math.round(4 + im.intensity * 10))
        shake = Math.min(5, shake + im.intensity * 3.5)
        // Staub nur bei Bodenkontakt (Würfel ist unten, nicht an der Wand).
        const ip = d.pos[im.die]?.[Math.min(im.frame, (d.pos[im.die]?.length ?? 1) - 1)]
        if (ip && ip[1] < 1.2 && im.intensity > 0.25) spawnDust(d, ip[0], ip[2], im.intensity)
      }
      for (let i = 0; i < n; i++) pulses[i] *= 0.84

      // Kamera-Mikro-Wackeln nach harten Aufprallen, klingt schnell ab.
      const cam = camRef.current
      if (cam) {
        cam.style.transform =
          shake > 0.25
            ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`
            : ''
        shake *= 0.85
      }

      if (i0 >= last) {
        if (cam) cam.style.transform = ''
        setPhase('landed')
        return // liegen lassen, auf Tipp warten
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      if (camRef.current) camRef.current.style.transform = ''
    }
  }, [phase])

  // Wurfphase nach außen melden (z. B. um Overlays erst beim Liegen zu zeigen).
  useEffect(() => { onPhaseRef.current?.(phase) }, [phase])

  // --- Gelandet: Würfel an ihre Ruhepose schreiben, Ausgewählte heben. ---
  useEffect(() => {
    if (phase !== 'landed') return
    const d = dataRef.current; if (!d) return
    for (let i = 0; i < d.labelings.length; i++) {
      const arr = d.pos[i], qarr = d.quat[i]
      if (!arr?.length) continue
      const li = arr.length - 1
      const base = arr[li]
      const p: V = sel[i] ? [base[0], base[1] + LIFT, base[2]] : base
      writeDie(d, i, p, qarr[li])
    }
  }, [phase, sel])

  // --- Schütteln zum Würfeln (DeviceMotion). iOS verlangt eine Erlaubnis, die
  // nur in einer User-Geste angefragt werden darf → beim ersten Wurf-Tipp.
  const [motionOk, setMotionOk] = useState(false)
  const requestMotion = () => {
    try {
      const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
      if (DM?.requestPermission) DM.requestPermission().then((r) => setMotionOk(r === 'granted')).catch(() => {})
      else if ('DeviceMotionEvent' in window) setMotionOk(true)
    } catch {
      /* kein Sensor – ignorieren */
    }
  }
  useEffect(() => {
    if (!motionOk || phase !== 'ready' || reduceRef.current) return
    let lastTrigger = 0
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration
      if (!a) return
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
      const now = performance.now()
      if (mag > 14 && now - lastTrigger > 800) {
        lastTrigger = now
        navigator.vibrate?.(20)
        unlockDiceAudio()
        setPhase('rolling')
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [motionOk, phase])

  const handleTap = () => {
    if (phase === 'ready') {
      unlockDiceAudio() // erste Geste → Sound entsperren
      requestMotion() // ab jetzt geht auch Handy-Schütteln
      setPhase('rolling')
    } else if (phase === 'landed' && !selectable) onSettleRef.current?.()
  }

  // Einen gelandeten Würfel aus-/abwählen und die neue Auswahl melden.
  const toggleDie = (i: number) => {
    if (phase !== 'landed' || !selectable) return
    navigator.vibrate?.(8)
    unlockDiceAudio()
    playTap()
    // Kurzes Aufblitzen des angetippten Würfels.
    const el = dieRefs.current[i]
    if (el) {
      el.classList.remove('flash')
      void el.offsetWidth // Reflow → Animation startet erneut
      el.classList.add('flash')
    }
    setSel((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      const vals = values.map((v) => clamp(Math.round(v), 1, 6))
      const selected: number[] = []
      const remaining: number[] = []
      for (let j = 0; j < vals.length; j++) (next[j] ? selected : remaining).push(vals[j])
      onSelRef.current?.(selected, remaining)
      return next
    })
  }

  const d = dataRef.current
  const vals = values.map((v) => clamp(Math.round(v), 1, 6))
  const tappable = phase === 'landed' && selectable
  // Würfel-Design aus den Einstellungen → als CSS-Variablen an die Wurzel.
  const th = DICE_THEMES[getPrefs().diceTheme] ?? DICE_THEMES.classic
  const themeVars = {
    ['--die-hi' as string]: th.hi,
    ['--die-mid' as string]: th.mid,
    ['--die-lo' as string]: th.lo,
    ['--die-pip-a' as string]: th.pipA,
    ['--die-pip-b' as string]: th.pipB,
  }
  return (
    <div className="da-root" ref={rootRef} style={themeVars}>
      <style>{CSS}</style>
      {ready && d && (
        <div ref={camRef} className="da-cam" style={{ perspective: `${d.perspective}px`, perspectiveOrigin: '50% 30%', ['--tilt' as string]: `${d.camTilt}deg` }}>
          <div className="da-stage">
            <div className="da-floor" style={{ width: d.feltPx, height: d.feltPx }} />
          </div>
          <div className="da-stage" ref={fxRef}>
            {d.labelings.map((_, i) => (
              <div
                key={'s' + i}
                className="da-shadow"
                ref={(el) => { if (el) shadowRefs.current[i] = el }}
                style={{ width: d.sizePx * 1.05, height: d.sizePx * 1.05 }}
              />
            ))}
            {d.labelings.map((L, i) => (
              <div
                key={'d' + i}
                className={`da-die${phase === 'landed' ? ' da-landed' : ''}${
                  sel[i] ? (invalidValues.includes(vals[i]) ? ' invalid' : ' sel') : ''
                }`}
                ref={(el) => { if (el) dieRefs.current[i] = el }}
                onClick={tappable ? () => toggleDie(i) : undefined}
                style={{
                  width: d.sizePx,
                  height: d.sizePx,
                  ['--h' as string]: `${d.sizePx / 2}px`,
                  pointerEvents: tappable ? 'auto' : 'none',
                  cursor: tappable ? 'pointer' : 'default',
                }}
              >
                {SLOT_TF.map((tf, s) => (
                  <div key={s} className="da-face" style={{ transform: tf }}>
                    {PIPS[L[s]].map(([c, r], pi) => (
                      <span key={pi} className="da-pip" style={{ gridColumn: c + 1, gridRow: r + 1 }} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tipp-Fläche zum Werfen (und „weiter" nur im nicht-auswählbaren Alt-Modus). */}
      {(phase === 'ready' || (phase === 'landed' && !selectable)) && (
        <button className="da-tap" onClick={handleTap} aria-label={phase === 'ready' ? 'Würfeln' : 'Weiter'} />
      )}
      {phase === 'ready' && <div className="da-hint">{motionOk ? 'Tippen oder schütteln' : 'Tippen zum Würfeln'}</div>}
      {phase === 'landed' && selectable && <div className="da-hint">Würfel antippen, die zählen</div>}
      {phase === 'landed' && !selectable && <div className="da-hint">Tippen für weiter</div>}
    </div>
  )
}

/* ================================== CSS ================================= */
const CSS = `
.da-root{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit;
  background:radial-gradient(130% 100% at 50% 6%, #0c2b25 0%, #07201d 52%, #050b0d 100%);}
.da-cam{position:absolute;inset:0;}
.da-stage{position:absolute;left:50%;top:50%;transform-style:preserve-3d;
  transform:rotateX(var(--tilt));transform-origin:center;}
.da-floor{position:absolute;left:0;top:0;transform:translate(-50%,-50%) rotateX(90deg);
  border-radius:50%;
  background:
    radial-gradient(60% 45% at 50% 8%, rgba(255,203,92,.10), transparent 60%),
    radial-gradient(closest-side, #0e4034 0%, #0b332e 60%, #07221f 100%);
  box-shadow:inset 0 0 60px rgba(0,0,0,.62),
             inset 0 0 0 3px rgba(245,184,61,.16),
             0 22px 60px rgba(0,0,0,.5);}
.da-shadow{position:absolute;left:0;top:0;border-radius:50%;
  transform-origin:center;will-change:transform,opacity;
  background:radial-gradient(closest-side, rgba(0,0,0,.6), rgba(0,0,0,0));filter:blur(2px);
  translate:-50% -50%;}
.da-die{position:absolute;left:0;top:0;transform-style:preserve-3d;will-change:transform;
  translate:-50% -50%;}
.da-die.da-landed{transition:transform .18s ease-out;}
/* Ausgewählt (ausgelegt) → goldene Flächen, passend zur Ablage. */
.da-die.sel .da-face{
  background:radial-gradient(120% 120% at 30% 22%, #ffe9a8 0%, #f5c84e 55%, #e0a92e 100%);
  box-shadow:inset 0 0 0 1px rgba(150,108,20,.4),
             inset 0 6px 10px rgba(255,255,255,.5),
             0 0 16px rgba(245,184,61,.55);}
/* Ausgewählt, aber ungültig → rot. */
.da-die.invalid .da-face{
  background:radial-gradient(120% 120% at 30% 22%, #ffc1c1 0%, #ff6b6b 60%, #d83a3a 100%);
  box-shadow:inset 0 0 0 1px rgba(150,30,30,.4),
             inset 0 6px 10px rgba(255,255,255,.4),
             0 0 16px rgba(255,107,107,.5);}
.da-die.sel .da-pip,.da-die.invalid .da-pip{
  background:radial-gradient(closest-side, #3a2a05, #161003);}
/* Kurzes Aufblitzen beim Antippen. */
.da-die.flash .da-face{animation:da-selflash .45s ease-out;}
@keyframes da-selflash{0%{filter:brightness(2.1) saturate(1.3)}100%{filter:brightness(1)}}
/* Staub-Puff auf dem Filz beim Aufprall. */
.da-dust{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;
  translate:-50% -50%;
  background:radial-gradient(closest-side, rgba(226,214,182,.30), rgba(226,214,182,0) 70%);
  animation:da-dust .5s ease-out forwards;}
@keyframes da-dust{from{opacity:.9;scale:.35}to{opacity:0;scale:1.7}}
.da-face{position:absolute;inset:0;display:grid;box-sizing:border-box;
  grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
  padding:13%;border-radius:15%;backface-visibility:hidden;
  background:radial-gradient(120% 120% at 30% 22%,
    var(--die-hi, #fbf8f0) 0%, var(--die-mid, #efeadb) 58%, var(--die-lo, #e1dbca) 100%);
  box-shadow:inset 0 0 0 1px rgba(120,108,86,.18),
             inset 0 6px 10px rgba(255,255,255,.4),
             inset 0 -10px 16px rgba(0,0,0,.18);}
.da-pip{place-self:center;width:62%;height:62%;border-radius:50%;
  background:radial-gradient(closest-side, var(--die-pip-a, #2b2b2b), var(--die-pip-b, #131313));
  box-shadow:inset 0 1px 1px rgba(255,255,255,.18), 0 1px 1px rgba(0,0,0,.35);}
.da-tap{position:absolute;inset:0;padding:0;margin:0;border:0;background:transparent;
  cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent;}
.da-hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);
  pointer-events:none;white-space:nowrap;color:#f3deA0;
  font:800 12px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;
  letter-spacing:.16em;text-transform:uppercase;
  text-shadow:0 1px 6px rgba(0,0,0,.6);animation:da-pulse 1.5s ease-in-out infinite;}
@keyframes da-pulse{0%,100%{opacity:.45}50%{opacity:1}}
`
