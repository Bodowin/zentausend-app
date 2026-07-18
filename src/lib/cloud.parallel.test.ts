import { describe, expect, it, vi } from 'vitest'
import { syncCloudPrerequisites } from './cloud'

describe('syncCloudPrerequisites', () => {
  it('starts identity and game fetch concurrently', async () => {
    let resolveIdentity!: (value: {
      online: boolean
      pending: number
      conflicts: number
      version: number
      denied: boolean
    }) => void
    let resolveGames!: (value: { games: []; ok: boolean }) => void
    const order: string[] = []

    const identityTask = vi.fn(
      () =>
        new Promise<{
          online: boolean
          pending: number
          conflicts: number
          version: number
          denied: boolean
        }>((resolve) => {
          order.push('identity')
          resolveIdentity = resolve
        }),
    )
    const gamesTask = vi.fn(
      () =>
        new Promise<{ games: []; ok: boolean }>((resolve) => {
          order.push('games')
          resolveGames = resolve
        }),
    )

    const pending = syncCloudPrerequisites(identityTask, gamesTask)

    expect(order).toEqual(['identity', 'games'])
    expect(identityTask).toHaveBeenCalledTimes(1)
    expect(gamesTask).toHaveBeenCalledTimes(1)

    resolveGames({ games: [], ok: true })
    await Promise.resolve()
    resolveIdentity({ online: true, pending: 0, conflicts: 0, version: 1, denied: false })

    await expect(pending).resolves.toEqual({
      identity: { online: true, pending: 0, conflicts: 0, version: 1, denied: false },
      fetched: { games: [], ok: true },
    })
  })
})
