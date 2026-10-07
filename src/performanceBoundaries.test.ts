import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import gameScreenSource from './components/GameScreen.tsx?raw'
import gameOverDialogSource from './components/GameOverDialog.tsx?raw'
import diceArenaSource from './components/DiceArena.tsx?raw'

const sources = import.meta.glob<string>('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })

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
    // Echte Abhängigkeitsprüfung statt Stichwort: cannon-es steckt nur in der
    // Würfelphysik, und die erreicht man nur über die lazy geladene Arena.
    const importers = (pattern: RegExp) => Object.entries(sources)
      .filter(([path, source]) => !path.includes('.test.') && pattern.test(source))
      .map(([path]) => path)
      .sort()
    expect(importers(/from 'cannon-es'/)).toEqual(['./lib/diceSim.ts'])
    expect(importers(/from '(\.\.?\/)+(lib\/)?diceSim'/)).toEqual(['./components/DiceArena.tsx', './lib/diceThrowPlanner.ts'])
    expect(importers(/from '(\.\.?\/)+(lib\/)?diceThrowPlanner'/)).toEqual(['./components/DiceArena.tsx'])
    expect(importers(/from '\.\/DiceArena'|from '\.\/components\/DiceArena'/)).toEqual([])
    expect(diceArenaSource).toContain("from '../lib/diceSim'")
  })

  it('loads result sharing and analysis only on demand', () => {
    expect(gameScreenSource).not.toContain("from '../lib/shareImage'")
    expect(gameOverDialogSource).not.toContain("from '../lib/shareImage'")
    expect(gameOverDialogSource).toContain("import('../lib/shareImage')")
    expect(gameScreenSource).not.toContain("from './AnalysisScreen'")
    expect(gameScreenSource).toContain("import('./AnalysisScreen')")
  })
})
