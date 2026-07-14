import { describe, expect, it } from 'vitest'
import type { ActiveGame } from './activeGame'
import {
  planActiveGameCloudSync,
  type ActiveGameCloudSnapshot,
} from './activeGameCloud'

const local: ActiveGame = {
  sessionId: 'game-a',
  players: [
    { id: 'a', name: 'Gabi', score: 900, busts: 1 },
    { id: 'b', name: 'Mabi', score: 500, busts: 0 },
  ],
  idx: 0,
  round: 3,
  phase: 'active',
  target: 0,
  event: 'Familienabend',
  testMode: false,
  diceMode: 'real',
  goalScore: 10000,
  entryMin: 350,
  kept: [],
  dice: [],
  accumulated: 0,
  turns: [],
  rolled: [],
  thrown: [],
  throwSeq: 0,
  savedAt: '2026-07-14T10:00:00.000Z',
}

function cloud(overrides: Partial<ActiveGameCloudSnapshot> = {}): ActiveGameCloudSnapshot {
  const game = { ...local, savedAt: '2026-07-14T09:59:00.000Z' }
  return {
    schemaVersion: 1,
    status: 'active',
    sessionId: game.sessionId,
    ownerDeviceId: 'device-a',
    savedAt: game.savedAt,
    game,
    version: 4,
    updatedAt: game.savedAt,
    ...overrides,
  }
}

describe('active-game cloud planning', () => {
  it('pushes a newer local snapshot only while this device owns the game', () => {
    expect(planActiveGameCloudSync(local, cloud(), 'device-a')).toBe('push-local')
  })

  it('loads a newer cloud snapshot instead of silently replacing it', () => {
    const newer = { ...local, savedAt: '2026-07-14T10:01:00.000Z' }
    expect(planActiveGameCloudSync(local, cloud({ game: newer, savedAt: newer.savedAt }), 'device-a')).toBe('use-cloud')
  })

  it('blocks autosave after another device has taken ownership', () => {
    expect(planActiveGameCloudSync(local, cloud({ ownerDeviceId: 'device-b' }), 'device-a')).toBe('taken-over')
  })

  it('never silently replaces a different running game', () => {
    const other = { ...local, sessionId: 'game-b' }
    expect(
      planActiveGameCloudSync(
        local,
        cloud({ sessionId: 'game-b', game: other, ownerDeviceId: 'device-b' }),
        'device-a',
      ),
    ).toBe('different-game')
  })

  it('does not resurrect a session that was cleared on another device', () => {
    expect(
      planActiveGameCloudSync(
        local,
        cloud({ status: 'cleared', game: null, savedAt: '2026-07-14T10:02:00.000Z' }),
        'device-a',
      ),
    ).toBe('cloud-cleared')
  })
})
