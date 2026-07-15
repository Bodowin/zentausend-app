import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncResult } from './cloud'
import type { GameRecord } from './types'
import { buildFamilyShareText, prepareFamilyDevice } from './deviceSetup'

const game = (id: number): GameRecord => ({
  id,
  date: `2026-01-${String(id).padStart(2, '0')}T18:00:00.000Z`,
  event: 'Familie',
  winner: 'Bodo',
  winnerScore: 10000,
  players: [{ playerId: 'player-bodo', name: 'Bodo', score: 10000, busts: 0 }],
  turns: [],
})

const baseSync: SyncResult = {
  games: [],
  online: true,
  pending: 0,
  identityConflicts: 0,
  codeDenied: false,
  cloudCount: 0,
}

describe('family device setup', () => {
  beforeEach(() => localStorage.clear())

  it('builds a simple share message without an admin code', () => {
    const text = buildFamilyShareText(' FAMILIE-10000-26 ', 'https://zentausend-app.vercel.app/')
    expect(text).toContain('Familien-Code: FAMILIE-10000-26')
    expect(text).toContain('https://zentausend-app.vercel.app')
    expect(text).not.toContain('Admin')
  })

  it('requires a code before syncing', async () => {
    const sync = vi.fn<() => Promise<SyncResult>>()
    await expect(prepareFamilyDevice('   ', sync)).resolves.toEqual({
      state: 'missing',
      localCount: 0,
      cloudCount: null,
    })
    expect(sync).not.toHaveBeenCalled()
  })

  it('stores the code and reports a ready device', async () => {
    const sync = vi.fn<() => Promise<SyncResult>>().mockResolvedValue({ ...baseSync, games: [game(1)], cloudCount: 4 })
    await expect(prepareFamilyDevice(' FAMILY-TEST ', sync)).resolves.toEqual({
      state: 'ready',
      localCount: 1,
      cloudCount: 4,
    })
    expect(localStorage.getItem('10k_clique_code')).toBe('FAMILY-TEST')
  })

  it('distinguishes a wrong code from an offline device', async () => {
    const denied = vi.fn<() => Promise<SyncResult>>().mockResolvedValue({ ...baseSync, codeDenied: true, games: [game(1)] })
    const offline = vi.fn<() => Promise<SyncResult>>().mockResolvedValue({
      ...baseSync,
      online: false,
      games: [game(1), game(2)],
      cloudCount: null,
    })

    await expect(prepareFamilyDevice('WRONG', denied)).resolves.toMatchObject({ state: 'denied', localCount: 1 })
    await expect(prepareFamilyDevice('RIGHT', offline)).resolves.toEqual({
      state: 'offline',
      localCount: 2,
      cloudCount: null,
    })
  })
})
