import { describe, expect, it } from 'vitest'
import activeSource from './lib/activeGame.ts?raw'
import setupSource from './components/SetupScreen.tsx?raw'

describe('safe resume wiring', () => {
  it('keeps bounded backups and restores only a damaged primary value', () => {
    expect(activeSource).toContain('const RECOVERY_LIMIT = 3')
    expect(activeSource).toContain('if (!raw) return null')
    expect(activeSource).toContain('recoveredFromBackup: true')
  })

  it('requires an explicit decision before replacing or discarding a running game', () => {
    expect(setupSource).toContain('Laufendes Spiel ersetzen?')
    expect(setupSource).toContain('Altes Spiel fortsetzen')
    expect(setupSource).toContain('Endgültig verwerfen')
    expect(setupSource).not.toContain("window.confirm('Laufendes Spiel verwerfen?")
  })
})
