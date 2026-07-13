import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('performance chunk boundaries', () => {
  it('keeps cloud code out of the initial App module', () => {
    const app = read('src/App.tsx')
    expect(app).not.toContain("from './lib/cloud'")
    expect(app).toContain("import('./lib/cloud')")
  })

  it('loads route-level screens through React.lazy', () => {
    const app = read('src/App.tsx')
    expect(app).not.toContain("from './components/GameScreen'")
    expect(app).not.toContain("from './components/StatsScreen'")
    expect(app).toContain("import('./components/GameScreen')")
    expect(app).toContain("import('./components/StatsScreen')")
  })

  it('keeps cannon-es behind the virtual dice boundary', () => {
    const gameScreen = read('src/components/GameScreen.tsx')
    const diceArena = read('src/components/DiceArena.tsx')

    expect(gameScreen).not.toContain("from './DiceArena'")
    expect(gameScreen).toContain("lazy(() => import('./DiceArena'))")
    expect(diceArena).toContain("from 'cannon-es'")
  })

  it('loads result sharing and analysis only on demand', () => {
    const gameScreen = read('src/components/GameScreen.tsx')
    expect(gameScreen).not.toContain("from '../lib/shareImage'")
    expect(gameScreen).toContain("import('../lib/shareImage')")
    expect(gameScreen).not.toContain("from './AnalysisScreen'")
    expect(gameScreen).toContain("import('./AnalysisScreen')")
  })
})
