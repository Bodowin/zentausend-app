import { describe, expect, it } from 'vitest'
import arenaSource from './components/DiceArena.tsx?raw'
import gameSource from './components/GameScreen.tsx?raw'
import prefsSource from './lib/prefs.ts?raw'
import simSource from './lib/diceSim.ts?raw'
import { DEFAULT_TUNING } from './lib/diceSim'

describe('natural dice motion wiring', () => {
  it('uses a stable motion seed without changing drawn values', () => {
    expect(gameSource).toContain('diceThrowSeed({')
    expect(gameSource).toContain('seed={throwMotionSeed}')
    // Handlage und Wurfplanung hängen nur am Bewegungs-Seed, nie an Augenzahlen.
    expect(arenaSource).toContain('handPose(n, cfg, seed)')
    expect(arenaSource).toContain('new ThrowPlanner(n, cfg, seed)')
    expect(arenaSource).not.toMatch(/handPose\([^)]*values/)
  })

  it('uses a round bowl, a correlated hand throw and rejects cocked dice', () => {
    expect(DEFAULT_TUNING.rimSegments).toBeGreaterThanOrEqual(12)
    expect(DEFAULT_TUNING.fan).toBeGreaterThan(0)
    expect(simSource).toContain('const commonForward')
    expect(simSource).toContain('let cocked = !settled')
  })

  it('never requests motion access unless shake-to-roll was enabled', () => {
    expect(prefsSource).toContain('shakeToRoll: false')
    expect(arenaSource).toContain('if (motionEnabled) requestMotion()')
    expect(arenaSource).toContain("if (!motionEnabled || motionPermission === 'denied') return")
  })

  it('routes every vibration through the optional haptics preference', () => {
    expect(arenaSource).not.toContain('navigator.vibrate')
    expect(arenaSource).toContain('if (strongest) buzz(Math.round(4 + strongest.intensity * 10))')
  })
})
