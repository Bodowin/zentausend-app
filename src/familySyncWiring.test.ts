import { describe, expect, it } from 'vitest'
import cloudSource from './lib/cloud.ts?raw'
import statsSource from './components/StatsScreen.tsx?raw'
import prefsSource from './lib/prefs.ts?raw'
import hapticsSource from './lib/haptics.ts?raw'

describe('family-friendly sync and haptics wiring', () => {
  it('reports confirmed cloud counts', () => {
    expect(cloudSource).toContain('cloudCount: number | null')
    expect(cloudSource).toContain('cloudCount: cloud.length')
  })

  it('offers an explicit save action and plain-language status', () => {
    expect(statsSource).toContain('Alles gesichert')
    expect(statsSource).toContain('Jetzt sichern')
    expect(statsSource).toContain('Crew-Code prüfen')
  })

  it('keeps haptics optional and disabled by default', () => {
    expect(prefsSource).toContain('haptics: false')
    expect(hapticsSource).toContain("if (!getPrefs().haptics) return")
  })
})
