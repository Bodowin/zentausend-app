/**
 * DiceArena — echter 3D-Schwerkraft-Fall in einer Würfelschale, gerendert OHNE WebGL.
 *
 * Architektur:
 *  1) HAND: Die Würfel liegen sofort in der Hand (Lage nur aus dem Seed, keine
 *     Rechenpause) und tragen eine feste, gültige Beschriftung.
 *  2) ABWURF: Richtung und Kraft kommen aus der Geste. cannon-es simuliert den
 *     Wurf headless bis zur Ruhe (lib/diceSim), in Zeitscheiben und meist schon
 *     spekulativ während des Ziehens (lib/diceThrowPlanner).
 *  3) UMGREIFEN STATT UMSCHREIBEN: Damit am Ende values[i] oben liegt, wird die
 *     Bahn als q(t)·g gezeichnet, g eine der 24 Würfeldrehungen. Für einen
 *     Würfel ist das physikalisch dieselbe Bahn; die Beschriftung springt nie.
 *     Der Unterschied zur Handlage verschwindet in der 240-ms-Abwurfdrehung.
 *  4) PLAYBACK per CSS-3D (matrix3d aus der Quaternion). Kein WebGL → iOS-stabil,
 *     offline.
 */

import { useEffect, useRef, useState } from 'react'
import { getPrefs, DICE_THEMES } from '../lib/prefs'
import { PIPS } from '../lib/dicePips'
import { buzz } from '../lib/haptics'
import { createSeededRandom, mixSeed } from '../lib/diceThrowSeed'
import { selectPlaybackImpacts, type DiceImpact, type DiceImpactKind } from '../lib/diceImpact'
import {
  SLOT_NORMALS,
  chooseBodySymmetry,
  handPose,
  qMul,
  qSlerp,
  rotV,
  type DiceSimConfig,
  type DiceThrow,
} from '../lib/diceSim'
import { ThrowPlanner, defaultChoice, gestureChoice, type ThrowChoice } from '../lib/diceThrowPlanner'

type DiceArenaProps = {
  values: number[]
  /** Stabiler Bewegungs-Seed; verändert nie die bereits gezogenen Augenzahlen. */
  seed?: number
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
// Slots (Body-lokal): 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z (siehe SLOT_NORMALS in lib/diceSim)
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

export function chooseLabeling(topSlot: number, value: number): number[] {
  return LABELINGS.find((L) => L[topSlot] === value) ?? LABELINGS[0]
}

/** Feste Beschriftung je Würfel in der Hand, unabhängig vom späteren Ergebnis. */
export function handLabelings(count: number, seed: number): number[][] {
  const random = createSeededRandom(mixSeed(seed, 31))
  return Array.from({ length: count }, () => LABELINGS[Math.floor(random() * LABELINGS.length)])
}

/* ============================ Mathe-Helfer ============================== */
type Q = [number, number, number, number]
type V = [number, number, number]

function qAxisAngle(x: number, y: number, z: number, angle: number): Q {
  const half = angle / 2
  const s = Math.sin(half)
  return [x * s, y * s, z * s, Math.cos(half)]
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
// A short, cached noise transient plus a damped body resonance: a dry clack,
// not a pitched electronic sweep. Generated locally, including offline.
// Mehrere Varianten je Material, damit ein Wurf nicht wie ein wiederholtes
// Sample klingt; Tonhöhe und Raum (Stereo) folgen dem einzelnen Aufprall.
const IMPACT_VARIANTS = 4
const impactBuffers = new WeakMap<AudioContext, Map<string, AudioBuffer>>()

function createImpactBuffer(ctx: AudioContext, kind: DiceImpactKind, variant: number): AudioBuffer {
  const duration = (kind === 'rim' ? 0.055 : 0.035) * (0.9 + variant * 0.07)
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  const base = kind === 'felt' ? 0xfe1701 : kind === 'rim' ? 0xdecaf : 0xd1ce01
  const random = createSeededRandom(mixSeed(base, variant))
  // Leicht verschiedene Körperresonanzen: verschiedene Würfel, verschiedene Stellen.
  const tone = 1 + (variant - 1.5) * 0.06
  let previousNoise = 0
  for (let i = 0; i < samples.length; i++) {
    const t = i / ctx.sampleRate
    const whiteNoise = random() * 2 - 1
    if (kind === 'felt') {
      previousNoise = previousNoise * 0.78 + whiteNoise * 0.22
      samples[i] = previousNoise * Math.exp(-t * 125)
    } else if (kind === 'dice') {
      const brightNoise = whiteNoise - previousNoise * 0.7
      previousNoise = whiteNoise
      samples[i] = brightNoise * Math.exp(-t * 175)
        + Math.sin(2 * Math.PI * 880 * tone * t) * Math.exp(-t * 130) * 0.18
        + Math.sin(2 * Math.PI * 1370 * tone * t) * Math.exp(-t * 160) * 0.07
    } else {
      samples[i] = whiteNoise * Math.exp(-t * 150)
        + Math.sin(2 * Math.PI * 460 * tone * t) * Math.exp(-t * 95) * 0.3
    }
  }
  return buffer
}

/**
 * Ein Aufprall. `pan` −1…1 (links…rechts), `delay` in Sekunden: mehrere
 * gleichzeitige Aufpralle werden um wenige Millisekunden versetzt, wie beim
 * echten Prasseln.
 */
function playClick(kind: DiceImpactKind, intensity: number, variant = 0, pan = 0, delay = 0) {
  const ctx = audioCtx
  if (!ctx || ctx.state !== 'running' || !soundOn()) return
  let buffers = impactBuffers.get(ctx)
  if (!buffers) { buffers = new Map(); impactBuffers.set(ctx, buffers) }
  const v = ((variant % IMPACT_VARIANTS) + IMPACT_VARIANTS) % IMPACT_VARIANTS
  const cacheKey = `${kind}:${v}`
  let impactBuffer = buffers.get(cacheKey)
  if (!impactBuffer) { impactBuffer = createImpactBuffer(ctx, kind, v); buffers.set(cacheKey, impactBuffer) }
  const source = ctx.createBufferSource(), gain = ctx.createGain()
  source.buffer = impactBuffer
  source.playbackRate.value = (0.85 + intensity * 0.35) * (0.96 + v * 0.025)
  const kindGain = kind === 'felt' ? 0.6 : kind === 'dice' ? 0.8 : 1
  gain.gain.value = (0.035 + intensity * 0.12) * kindGain
  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null
  if (panner) {
    panner.pan.value = clamp(pan, -1, 1)
    source.connect(gain).connect(panner).connect(ctx.destination)
  } else {
    source.connect(gain).connect(ctx.destination)
  }
  source.onended = () => { source.disconnect(); gain.disconnect(); panner?.disconnect() }
  source.start(ctx.currentTime + Math.max(0, delay))
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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/* =============================== Komponente ============================= */
type ArenaData = {
  pos: V[][]; quat: Q[][]; impacts: DiceImpact[]; labelings: number[][]
  frames: number; S: number; sizePx: number; feltPx: number; FIXED_DT: number; camTilt: number; perspective: number
}

type Phase = 'ready' | 'rolling' | 'landed'

// Licht von oben links vorn (Welt: y oben, z zum Betrachter), normiert.
const LIGHT: V = (() => { const v: V = [-0.45, 1, 0.55]; const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l] })()
// Stärkste Abdunklung einer vom Licht abgewandten Fläche.
const SHADE_MAX = 0.42

// Sichtbarer Auswahl-Hub, der auch in flachen iPhone-Layouts innerhalb der Arena bleibt.
const LIFT = 0.68
const DRAG_RELEASE_MS = 240
// Höchstens so lange hält die Hand nach dem Loslassen still, um die Bahn mit
// exakt passender Kraft abzuwarten; spürbar wird erst deutlich mehr.
const PENDING_EXACT_MS = 80
export const DICE_PLAYBACK_SPEED = 1.45
export const DICE_MAX_PLAYBACK_SECONDS = 2.8

export function dicePlaybackSpeed(frames: number, fixedDt: number): number {
  const recordedSeconds = Math.max(0, frames - 1) * fixedDt
  return Math.max(DICE_PLAYBACK_SPEED, recordedSeconds / DICE_MAX_PLAYBACK_SECONDS)
}

let motionPermission: 'unknown' | 'granted' | 'denied' = 'unknown'

export default function DiceArena({
  values,
  seed = 0x6d2b79f5,
  onSettle,
  selectable = false,
  invalidValues = [],
  onSelectionChange,
  onPhaseChange,
}: DiceArenaProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<HTMLDivElement>(null)
  const diceStageRef = useRef<HTMLDivElement>(null)
  const dieRefs = useRef<HTMLDivElement[]>([])
  const shadowRefs = useRef<HTMLDivElement[]>([])
  // Abdunklung je Würfelfläche (Licht von oben links vorn) und zuletzt gesetzter Wert.
  const shadeRefs = useRef<HTMLElement[][]>([])
  const shadeValues = useRef<number[][]>([])
  const dataRef = useRef<ArenaData | null>(null)
  const reduceRef = useRef(false)
  const idleQuatRef = useRef<Q[]>([])
  const idleOffsetRef = useRef<V[]>([])
  // Abstand sichtbare Hand → Start der übernommenen Bahn (wird beim Abwurf ausgeblendet).
  const releaseOffsetRef = useRef<V[]>([])
  const dragRef = useRef({
    pointerId: -1, lastX: 0, lastY: 0, x: 0, y: 0, vx: 0, vy: 0, time: 0,
    // Rohe Fingerbewegung für den Wurf (px/s bzw. px seit dem Aufsetzen).
    startX: 0, startY: 0, fvx: 0, fvy: 0,
  })
  const releaseRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const plannerRef = useRef<ThrowPlanner | null>(null)
  const defaultChoiceRef = useRef<ThrowChoice>({ dir: 0, energy: 1 })
  // Wurf ist losgelassen, aber die Bahn wird noch fertig gerechnet.
  const pendingRef = useRef<ThrowChoice | null>(null)
  // Bis dahin wird auf die Bahn mit exakt passender Kraft gewartet, danach
  // startet eine fertige Nachbarbahn mit etwas anderer Kraft.
  const pendingDeadlineRef = useRef(0)
  const [launching, setLaunching] = useState(false)
  const onSettleRef = useRef(onSettle); onSettleRef.current = onSettle
  const onSelRef = useRef(onSelectionChange); onSelRef.current = onSelectionChange
  const onPhaseRef = useRef(onPhaseChange); onPhaseRef.current = onPhaseChange
  const [ready, setReady] = useState(false)
  // ready = Würfel drehen sich „in der Hand", warten auf Tipp;
  // rolling = aufgezeichneter Fall läuft; landed = liegen, antippbar zum Auslegen.
  const [phase, setPhase] = useState<Phase>('ready')
  // Welche gelandeten Würfel sind ausgewählt (ausgelegt)?
  const [sel, setSel] = useState<boolean[]>([])
  const [dragging, setDragging] = useState(false)
  // Synchronous mirror: rapid taps derive from the latest selection without
  // invoking the parent callback from inside React's state updater.
  const selRef = useRef<boolean[]>([])

  const setDiceStageOffset = (x: number, y: number, animate: boolean) => {
    const stage = diceStageRef.current
    if (!stage) return
    stage.style.transition = animate
      ? `transform ${DRAG_RELEASE_MS}ms cubic-bezier(.2,.8,.3,1)`
      : 'none'
    stage.style.transform = `translate3d(${x}px, ${y}px, 0) rotateX(var(--tilt))`
  }

  // Hilfsfunktion: Würfel + Schatten setzen.
  const writeDie = (d: ArenaData, i: number, p: V, q: Q) => {
    const el = dieRefs.current[i]
    if (el) el.style.transform = matrix3dFor(q, p, d.S)
    const sh = shadowRefs.current[i]
    if (sh) {
      const lift = clamp(p[1] / 4, 0, 1)
      sh.style.transform = `translate3d(${p[0] * d.S}px,0,${p[2] * d.S}px) rotateX(90deg) scale(${0.7 + lift * 0.8})`
      sh.style.opacity = `${0.4 * (1 - lift * 0.6)}`
    }
    // Licht folgt der Lage: Flächen, die sich vom Licht wegdrehen, werden
    // dunkler. Nur geänderte Werte schreiben (Deckkraft ist billig für den Compositor).
    const shades = shadeRefs.current[i]
    if (shades) {
      const last = (shadeValues.current[i] ??= [])
      for (let s = 0; s < 6; s++) {
        const nrm = rotV(SLOT_NORMALS[s], q)
        const lambert = nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]
        const shade = Math.round(SHADE_MAX * clamp((LIGHT[1] - lambert) / LIGHT[1], 0, 1) * 100) / 100
        if (shades[s] && last[s] !== shade) { shades[s].style.opacity = `${shade}`; last[s] = shade }
      }
    }
  }

  // --- Pre-Roll (einmal, beim Mount) ---
  useEffect(() => {
    const root = rootRef.current; if (!root) return
    const vals = values.map((v) => clamp(Math.round(v), 1, 6))
    const n = vals.length
    if (n === 0) { onSettleRef.current?.(); return }
    const emptySelection = new Array<boolean>(n).fill(false)
    selRef.current = emptySelection
    setSel(emptySelection)

    const W = root.clientWidth || 320, H = root.clientHeight || 360, minD = Math.min(W, H)
    const h = 0.44
    // Engere Schale relativ zur Würfelgröße → die Würfel wirken größer und
    // sind am Handy leichter anzutippen (Platz für 6 Würfel bleibt reichlich).
    const Rb = 1.7 + n * 0.26
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

    // Keine Rechenpause beim Öffnen: Die Handlage ist sofort bekannt, die Bahn
    // entsteht erst mit der Geste (Standardwurf im Hintergrund vorbereitet).
    const cfg: DiceSimConfig = { h, Rb, y0, G: 26, FIXED_DT: 1 / 120, MAX_STEPS: 720 }
    const pose = handPose(n, cfg, seed)
    dataRef.current = {
      pos: pose.pos.map((p) => [p]), quat: pose.quat.map((q) => [q]), impacts: [],
      labelings: handLabelings(n, seed),
      frames: 1, S, sizePx, feltPx, FIXED_DT: cfg.FIXED_DT, camTilt, perspective,
    }
    const planner = new ThrowPlanner(n, cfg, seed)
    defaultChoiceRef.current = defaultChoice(seed)
    planner.request(defaultChoiceRef.current, true)
    // Danach im Leerlauf: Vorrat, mit dem jede Wischrichtung sofort startet.
    planner.requestCardinals()
    plannerRef.current = planner
    pendingRef.current = null
    setLaunching(false)
    setReady(true)
  }, [values, seed])

  // Übernimmt eine fertige Bahn. Jeder Würfel wird so „umgegriffen“, dass am
  // Ende values[i] oben liegt, ohne die Beschriftung zu ändern.
  const commitThrow = (t: DiceThrow) => {
    const d = dataRef.current; if (!d) return
    const vals = values.map((v) => clamp(Math.round(v), 1, 6))
    const last = t.frames - 1
    const quat = t.quat.map((path, i) => {
      const wanted = Math.max(0, d.labelings[i].indexOf(vals[i]))
      const visible = idleQuatRef.current[i] ?? path[0]
      const g = chooseBodySymmetry(path[last], wanted, path[0], visible)
      return path.map((q) => qMul(q, g))
    })
    // Sichtbare Lage in der Hand (inkl. Wippen) minus Start der Bahn. Bei einer
    // gedrehten Nachbarbahn ist das mehr als nur das Wippen.
    releaseOffsetRef.current = t.pos.map((path, i) => {
      const hand = d.pos[i][0], hop = idleOffsetRef.current[i] ?? [0, 0, 0]
      return [hand[0] + hop[0] - path[0][0], hand[1] + hop[1] - path[0][1], hand[2] + hop[2] - path[0][2]]
    })
    dataRef.current = { ...d, pos: t.pos, quat, impacts: t.impacts, frames: t.frames }
  }

  // Wirft mit der gewählten Geste: sofort, wenn die Bahn schon bereitliegt,
  // sonst sobald sie fertig ist (die Würfel bleiben solange in der Hand).
  const launch = (choice: ThrowChoice) => {
    if (pendingRef.current) return
    const planner = plannerRef.current
    if (reduceRef.current || !planner) { setPhase('rolling'); return }
    planner.request(choice, true)
    // Exakt passende Bahn oder eine fertige Nachbarbahn, exakt hingedreht.
    const ready = planner.getNearest(choice)
    if (ready) {
      commitThrow(ready)
      setPhase('rolling')
    } else {
      pendingRef.current = choice
      pendingDeadlineRef.current = performance.now() + PENDING_EXACT_MS
      setLaunching(true)
    }
  }

  // --- Planer in Zeitscheiben, solange die Würfel in der Hand liegen. ---
  useEffect(() => {
    if (!ready || phase !== 'ready' || reduceRef.current) return
    let raf = 0
    const tick = () => {
      const planner = plannerRef.current
      if (planner) {
        const pending = pendingRef.current
        // Wartet ein losgelassener Wurf, darf er mehr vom Frame bekommen.
        planner.pump(pending ? 12 : 5)
        const t = pending && (planner.getNearest(pending)
          ?? (performance.now() > pendingDeadlineRef.current ? planner.getNearest(pending, { anyEnergy: true }) : null))
        if (t) {
          pendingRef.current = null
          commitThrow(t)
          setLaunching(false)
          setPhase('rolling')
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, phase])

  // --- „In der Hand": Würfel drehen sich an der Startposition, bis getippt wird. ---
  useEffect(() => {
    if (!ready || phase !== 'ready' || reduceRef.current) return
    // Bewusst die HAND-Daten dieses Effekts festhalten: commitThrow ersetzt
    // dataRef durch die (umgegriffene) Bahn, die Hand darf davon nichts sehen.
    const d = dataRef.current; if (!d) return
    const n = d.labelings.length
    const start = performance.now()
    let raf = 0
    const spin = (now: number) => {
      const t = (now - start) / 1000
      for (let i = 0; i < n; i++) {
        const p0 = d.pos[i]?.[0]; if (!p0) continue
        // Individual tumbles and small hops keep the handful loose and alive.
        // Capture both pose offsets so release continues without a snap.
        const base = d.quat[i][0]
        const phaseOffset = i * 0.9
        const hand = dragRef.current
        const rock = qAxisAngle(0.8, 0, 0.6,
          t * (1.1 + i * 0.09) + hand.x * 0.009 + hand.y * 0.006)
        const q = qMul(base, rock)
        const hop = Math.sin(t * 4.2 + phaseOffset)
        const offset: V = [Math.sin(t * 2.4 + phaseOffset) * 0.035, 0.11 * hop * hop, Math.cos(t * 2.1 + phaseOffset) * 0.035]
        idleQuatRef.current[i] = q
        idleOffsetRef.current[i] = offset
        writeDie(d, i, [p0[0] + offset[0], p0[1] + offset[1], p0[2] + offset[2]], q)
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
    const n = d.labelings.length, dt = d.FIXED_DT, last = d.frames - 1
    const playbackSpeed = dicePlaybackSpeed(d.frames, dt)
    const releaseQuat = [...idleQuatRef.current]
    const releaseOffsets = [...releaseOffsetRef.current]
    // Correct the whole recorded orientation, preserving its angular motion.
    const corrections = releaseQuat.map((q, i) => {
      const initial = d.quat[i][0]
      return qMul(q, [-initial[0], -initial[1], -initial[2], initial[3]])
    })
    const handRelease = { ...releaseRef.current }
    let impactPtr = 0, raf = 0
    // Schalenradius für das Stereo-Panorama der Aufpralle.
    const bowlRadius = (d.feltPx / d.S - 1.2) / 2
    const start = performance.now()

    const frame = (now: number) => {
      const releaseT = Math.min(1, (now - start) / DRAG_RELEASE_MS)
      const tail = 1 - releaseT
      // Hermite return: carry finger velocity into release, settle with zero velocity.
      const positionWeight = tail * tail * (1 + 2 * releaseT)
      const velocityWeight = releaseT * tail * tail * DRAG_RELEASE_MS / 1000
      setDiceStageOffset(
        handRelease.x * positionWeight + handRelease.vx * velocityWeight,
        handRelease.y * positionWeight + handRelease.vy * velocityWeight,
        false,
      )
      const f = ((now - start) / 1000) * playbackSpeed / dt
      const i0 = Math.min(Math.floor(f), last), i1 = Math.min(i0 + 1, last)
      const a = i0 === last ? 0 : f - i0
      for (let i = 0; i < n; i++) {
        const arr = d.pos[i], qarr = d.quat[i]
        if (!arr || !arr.length) continue
        const li = arr.length - 1
        const k0 = Math.max(0, Math.min(i0, li)), k1 = Math.max(0, Math.min(i1, li))
        const p0 = arr[k0], p1 = arr[k1]
        const p: V = [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a]
        const q = qSlerp(qarr[k0], qarr[k1], a)
        const offset = releaseOffsets[i]
        if (offset && releaseT < 1) {
          for (let axis = 0; axis < 3; axis++) p[axis] += offset[axis] * positionWeight
        }
        const correction = corrections[i]
        const blend = releaseT * releaseT * (3 - 2 * releaseT)
        writeDie(d, i, p, correction && releaseT < 1
          ? qMul(qSlerp(correction, [0, 0, 0, 1], blend), q) : q)
      }
      const due = selectPlaybackImpacts(d.impacts, impactPtr, i0)
      impactPtr = due.nextIndex
      due.impacts.forEach((impact, voice) => {
        const x = d.pos[impact.die]?.[Math.min(impact.frame, last)]?.[0] ?? 0
        playClick(impact.kind, impact.intensity, impact.die + impact.frame, (x / bowlRadius) * 0.7, voice * 0.009)
      })
      // Haptik nur für den stärksten Aufprall: ein klarer Impuls statt Brummen.
      const strongest = due.impacts[0]
      if (strongest) buzz(Math.round(4 + strongest.intensity * 10))
      if (i0 >= last) {
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
  const motionEnabled = getPrefs().shakeToRoll
  const [motionOk, setMotionOk] = useState(() => motionEnabled && motionPermission === 'granted')
  const requestMotion = () => {
    if (!motionEnabled || motionPermission === 'denied') return
    if (motionPermission === 'granted') { setMotionOk(true); return }
    try {
      const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
      if (DM?.requestPermission) {
        DM.requestPermission()
          .then((result) => {
            motionPermission = result === 'granted' ? 'granted' : 'denied'
            setMotionOk(motionPermission === 'granted')
          })
          .catch(() => { motionPermission = 'denied' })
      } else if ('DeviceMotionEvent' in window) {
        motionPermission = 'granted'
        setMotionOk(true)
      }
    } catch {
      motionPermission = 'denied'
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
      if (mag > 14 && now - lastTrigger > 800 && dragRef.current.pointerId === -1) {
        lastTrigger = now
        buzz(20)
        unlockDiceAudio()
        launch(defaultChoiceRef.current)
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [motionOk, phase])

  const handleTap = () => {
    if (phase === 'ready') {
      unlockDiceAudio() // erste Geste → Sound entsperren
      if (motionEnabled) requestMotion() // Sensorzugriff nur nach ausdrücklicher Aktivierung
      launch(defaultChoiceRef.current)
    } else if (phase === 'landed' && !selectable) onSettleRef.current?.()
  }

  const beginDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (phase !== 'ready' || !ready || pendingRef.current || !e.isPrimary || e.button !== 0 || dragRef.current.pointerId !== -1) return
    setDiceStageOffset(0, 0, false)
    unlockDiceAudio()
    if (motionEnabled) requestMotion()
    releaseRef.current = { x: 0, y: 0, vx: 0, vy: 0 }
    dragRef.current = {
      pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY, x: 0, y: 0, vx: 0, vy: 0, time: performance.now(),
      startX: e.clientX, startY: e.clientY, fvx: 0, fvy: 0,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const moveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (phase !== 'ready' || drag.pointerId !== e.pointerId) return
    const root = rootRef.current
    const maxX = Math.min(86, (root?.clientWidth ?? 320) * 0.22)
    const maxY = Math.min(72, (root?.clientHeight ?? 360) * 0.18)
    // Incremental movement avoids a dead zone when reversing at the boundary.
    const x = clamp(drag.x + (e.clientX - drag.lastX) * 1.2, -maxX, maxX)
    const y = clamp(drag.y + (e.clientY - drag.lastY) * 1.2, -maxY, maxY)
    const now = performance.now(), dt = Math.max(0.008, (now - drag.time) / 1000)
    // Geglättete echte Fingergeschwindigkeit: daraus entstehen Richtung und Kraft.
    drag.fvx = drag.fvx * 0.4 + ((e.clientX - drag.lastX) / dt) * 0.6
    drag.fvy = drag.fvy * 0.4 + ((e.clientY - drag.lastY) / dt) * 0.6
    drag.lastX = e.clientX; drag.lastY = e.clientY
    drag.vx = clamp((x - drag.x) / dt, -220, 220)
    drag.vy = clamp((y - drag.y) / dt, -180, 180)
    drag.x = x; drag.y = y; drag.time = now
    if (!reduceRef.current) setDiceStageOffset(drag.x, drag.y, false)
    // Den Wurf für die gerade gezeigte Richtung schon vorbereiten.
    if (Math.hypot(drag.fvx, drag.fvy) > 150) plannerRef.current?.request(gestureChoice(drag.fvx, drag.fvy), true)
  }

  const releaseDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (phase !== 'ready' || drag.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    drag.pointerId = -1
    setDragging(false)
    const fresh = performance.now() - drag.time < 100
    releaseRef.current = reduceRef.current ? { x: 0, y: 0, vx: 0, vy: 0 }
      : { x: drag.x, y: drag.y, vx: fresh ? drag.vx : 0, vy: fresh ? drag.vy : 0 }
    // Geschleudert: Richtung und Kraft der letzten Fingerbewegung. Langsam
    // geführt und losgelassen: sanft in Zugrichtung. Kaum bewegt: Standardwurf.
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY
    const choice: ThrowChoice = fresh && Math.hypot(drag.fvx, drag.fvy) > 150
      ? gestureChoice(drag.fvx, drag.fvy)
      : Math.hypot(dx, dy) > 24 ? { ...gestureChoice(dx, dy), energy: 0 } : defaultChoiceRef.current
    launch(choice)
  }

  const cancelDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return
    dragRef.current.pointerId = -1
    setDragging(false)
    setDiceStageOffset(0, 0, true)
  }

  // Einen gelandeten Würfel aus-/abwählen und die neue Auswahl melden.
  const toggleDie = (i: number) => {
    if (phase !== 'landed' || !selectable) return
    buzz(8)
    unlockDiceAudio()
    playTap()
    // Kurzes Aufblitzen des angetippten Würfels.
    const el = dieRefs.current[i]
    if (el) {
      el.classList.remove('flash')
      void el.offsetWidth // Reflow → Animation startet erneut
      el.classList.add('flash')
    }
    const next = [...selRef.current]
    while (next.length < values.length) next.push(false)
    next[i] = !next[i]
    selRef.current = next
    setSel(next)

    const vals = values.map((v) => clamp(Math.round(v), 1, 6))
    const selected: number[] = []
    const remaining: number[] = []
    for (let j = 0; j < vals.length; j++) (next[j] ? selected : remaining).push(vals[j])
    onSelRef.current?.(selected, remaining)
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
          <div ref={diceStageRef} className="da-stage da-dice-stage">
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
                    <i className="da-shade" ref={(el) => { if (el) (shadeRefs.current[i] ??= [])[s] = el }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tipp-Fläche zum Werfen (und „weiter" nur im nicht-auswählbaren Alt-Modus). */}
      {phase === 'ready' && (
        <button
          className="da-tap"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={releaseDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onClick={(e) => { if (e.detail === 0) handleTap() }}
          aria-label="Würfeln"
        />
      )}
      {phase === 'landed' && !selectable && (
        <button className="da-tap" onClick={handleTap} aria-label="Weiter" />
      )}
      {phase === 'ready' && !launching && (
        <div className="da-hint">{
          dragging
            ? 'Loslassen zum Würfeln'
            : motionEnabled && motionOk
              ? 'Ziehen, tippen oder schütteln'
              : 'Ziehen oder tippen zum Würfeln'
        }</div>
      )}
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
 .da-dice-stage{will-change:transform;}
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
.da-shade{position:absolute;inset:0;border-radius:inherit;background:#000;opacity:0;pointer-events:none;}
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
   cursor:grab;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;}
 .da-tap:active{cursor:grabbing;}
.da-hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);
  pointer-events:none;white-space:nowrap;color:#f3deA0;
  font:800 12px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;
  letter-spacing:.16em;text-transform:uppercase;
  text-shadow:0 1px 6px rgba(0,0,0,.6);animation:da-pulse 1.5s ease-in-out infinite;}
@keyframes da-pulse{0%,100%{opacity:.45}50%{opacity:1}}
`
