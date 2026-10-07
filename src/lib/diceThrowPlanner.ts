/**
 * Plant Würfe für die Arena, ohne den Main-Thread spürbar zu blockieren.
 *
 * Der Standardwurf (Tippen, Schütteln) wird sofort nach dem Öffnen im
 * Hintergrund berechnet. Während der Spieler zieht, wird der Wurf für die
 * aktuelle Wischrichtung und -stärke spekulativ vorbereitet; beim Loslassen
 * steht er so meist schon bereit. Alle Jobs laufen in Zeitscheiben (pump).
 */
import {
  createThrowJob,
  rotateThrow,
  trimRestTail,
  DEFAULT_TUNING,
  type DicePhysicsTuning,
  type DiceSimConfig,
  type DiceThrow,
  type ThrowJob,
} from './diceSim'
import { createSeededRandom, mixSeed } from './diceThrowSeed'

/** Wischrichtungen in 30°-Schritten. */
export const DIRECTION_STEPS = 12
/** Weich, normal, kräftig. */
export const ENERGY_LEVELS = [0.8, 1, 1.22] as const

export type ThrowChoice = { dir: number; energy: number }

export const choiceKey = (c: ThrowChoice) => `${c.dir}:${c.energy}`

export function choiceInput(c: ThrowChoice) {
  const step = (Math.PI * 2) / DIRECTION_STEPS
  const raw = c.dir * step
  return { direction: Math.atan2(Math.sin(raw), Math.cos(raw)), energy: ENERGY_LEVELS[c.energy] }
}

/**
 * Tippen ohne Wischen: eine natürliche Richtung vom Spieler weg, leicht nach
 * links oder rechts gestreut (−60° … +60°), stabil für denselben Wurf-Seed.
 */
export function defaultChoice(seed: number): ThrowChoice {
  const offset = Math.floor(createSeededRandom(mixSeed(seed, 77))() * 5) - 2
  return { dir: (offset + DIRECTION_STEPS) % DIRECTION_STEPS, energy: 1 }
}

/**
 * Bildschirm-Geschwindigkeit (px/s, y nach unten) → Wurf.
 * Nach oben wischen wirft vom Spieler weg, nach unten zu ihm hin.
 */
export function gestureChoice(vx: number, vy: number): ThrowChoice {
  const step = (Math.PI * 2) / DIRECTION_STEPS
  const angle = Math.atan2(-vx, -vy)
  const dir = ((Math.round(angle / step) % DIRECTION_STEPS) + DIRECTION_STEPS) % DIRECTION_STEPS
  const speed = Math.hypot(vx, vy)
  const energy = speed < 450 ? 0 : speed < 1300 ? 1 : 2
  return { dir, energy }
}

export class ThrowPlanner {
  private readonly jobs = new Map<string, ThrowJob>()
  private readonly done = new Map<string, DiceThrow>()
  private readonly order: string[] = []
  private wanted: string | null = null
  private readonly n: number
  private readonly cfg: DiceSimConfig
  private readonly seed: number
  private readonly tuning: DicePhysicsTuning

  constructor(n: number, cfg: DiceSimConfig, seed: number, tuning: DicePhysicsTuning = DEFAULT_TUNING) {
    this.n = n
    this.cfg = cfg
    this.seed = seed
    this.tuning = tuning
  }

  /** Stellt sicher, dass der Wurf berechnet wird; `urgent` zieht ihn nach vorn. */
  request(choice: ThrowChoice, urgent = false): void {
    const key = choiceKey(choice)
    if (urgent) this.wanted = key
    if (this.done.has(key) || this.jobs.has(key)) return
    this.jobs.set(key, createThrowJob(this.n, this.cfg, this.seed, choiceInput(choice), this.tuning))
    this.order.push(key)
    // Spekulative Jobs, die längst überholt sind, nicht ewig weiterrechnen.
    while (this.order.length > 8) {
      const stale = this.order.find((k) => k !== this.wanted && this.jobs.has(k))
      if (!stale) break
      this.jobs.delete(stale)
      this.order.splice(this.order.indexOf(stale), 1)
    }
  }

  get(choice: ThrowChoice): DiceThrow | null {
    return this.done.get(choiceKey(choice)) ?? null
  }

  /**
   * Fertiger Wurf für diese Geste oder, falls er noch rechnet, ein fertiger
   * Nachbarwurf höchstens einen Richtungsschritt daneben, exakt in die
   * gewünschte Richtung gedreht (die Schale ist dafür symmetrisch). Gleiche
   * Kraft wird bevorzugt.
   */
  getNearest(choice: ThrowChoice, opts: { anyEnergy?: boolean } = {}): DiceThrow | null {
    const exact = this.get(choice)
    if (exact) return exact
    let best: { t: DiceThrow; steps: number; score: number } | null = null
    for (const [key, t] of this.done) {
      const [dir, energy] = key.split(':').map(Number)
      if (!opts.anyEnergy && energy !== choice.energy) continue
      let steps = choice.dir - dir
      steps = ((steps + DIRECTION_STEPS / 2) % DIRECTION_STEPS + DIRECTION_STEPS) % DIRECTION_STEPS - DIRECTION_STEPS / 2
      if (Math.abs(steps) > 1) continue
      const score = Math.abs(steps) * 2 + Math.abs(energy - choice.energy)
      if (!best || score < best.score) best = { t, steps, score }
    }
    if (!best) return null
    if ((this.tuning.rimSegments % DIRECTION_STEPS) !== 0) return null
    return rotateThrow(best.t, best.steps * (Math.PI * 2) / DIRECTION_STEPS)
  }

  /** Rechnet höchstens budgetMs weiter, den gewünschten Wurf zuerst. */
  pump(budgetMs: number): void {
    const start = performance.now()
    while (this.jobs.size) {
      const left = budgetMs - (performance.now() - start)
      if (left <= 0) return
      // Sonst der zuletzt angefragte: er entspricht am ehesten der aktuellen Geste.
      const key = this.wanted && this.jobs.has(this.wanted)
        ? this.wanted
        : [...this.order].reverse().find((k) => this.jobs.has(k))
      if (!key) return
      const result = this.jobs.get(key)!.advance(left)
      if (result) {
        this.jobs.delete(key)
        this.order.splice(this.order.indexOf(key), 1)
        this.done.set(key, trimRestTail(result))
      }
    }
  }

  get busy(): boolean {
    return this.jobs.size > 0
  }

  /**
   * Leerlauf-Vorrat: die vier Hauptrichtungen mit normaler Kraft. Jede der
   * zwölf Wischrichtungen liegt höchstens einen Schritt daneben und kann so
   * per getNearest sofort bedient werden.
   */
  requestCardinals(): void {
    for (let k = 0; k < 4; k++) this.request({ dir: (k * DIRECTION_STEPS) / 4, energy: 1 })
  }
}
