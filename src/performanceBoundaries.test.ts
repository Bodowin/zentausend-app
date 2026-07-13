import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import gameScreenSource from './components/GameScreen.tsx?raw'
import diceArenaSource from './components/DiceArena.tsx?raw'

describe('performance chunk boundaries', () => {
  it('keeps cloud code out of the initial App module', () => {
    expect(appSource).not.toContain("from './lib/cloud'")
    expect(appSource).toContain("import('./lib/cloud')")
  })

  it('loads route-level screens through React.lazy', () => {
    expect(appSource).not.toContain("from './components/GameScreen'")
    expect(appSource).not.toContain("from './components/StatsScreen'")
    expect(appSource).toContain("import('./components/GameScreen')")
    expect(appSource).toContain("import('./components/StatsScreen')")
  })

  it('keeps cannon-es behind the virtual dice boundary', () => {
    expect(gameScreenSource).not.toContain("from './DiceArena'")
    expect(gameScreenSource).toContain("lazy(() => import('./DiceArena'))")
    expect(diceArenaSource).toContain("from 'cannon-es'")
  })

  it('loads result sharing and analysis only on demand', () => {
    expect(gameScreenSource).not.toContain("from '../lib/shareImage'")
    expect(gameScreenSource).toContain("import('../lib/shareImage')")
    expect(gameScreenSource).not.toContain("from './AnalysisScreen'")
    expect(gameScreenSource).toContain("import('./AnalysisScreen')")
  })
})
