import { describe, expect, it } from 'vitest'
import arenaSource from './components/DiceArena.tsx?raw'
import gameSource from './components/GameScreen.tsx?raw'
import prefsSource from './lib/prefs.ts?raw'

describe('natural dice motion wiring', () => {
  it('uses a stable motion seed without changing drawn values', () => {
    expect(gameSource).toContain('diceThrowSeed({')
    expect(gameSource).toContain('seed={throwMotionSeed}')
    expect(arenaSource).toContain('createSeededRandom(mixSeed(seed, k))')
  })

  it('uses a rounder bowl and correlated hand throw', () => {
    expect(arenaSource).toContain('i < 12')
    expect(arenaSource).toContain('const commonForward')
    expect(arenaSource).toContain('let cocked = !settled')
  })

  it('never requests motion access unless shake-to-roll was enabled', () => {
    expect(prefsSource).toContain('shakeToRoll: false')
    expect(arenaSource).toContain('if (motionEnabled) requestMotion()')
    expect(arenaSource).toContain("if (!motionEnabled || motionPermission === 'denied') return")
  })

  it('routes every vibration through the optional haptics preference', () => {
    expect(arenaSource).not.toContain('navigator.vibrate')
    expect(arenaSource).toContain('buzz(Math.round(4 + im.intensity * 10))')
  })
})
