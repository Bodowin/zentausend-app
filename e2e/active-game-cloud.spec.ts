import { expect, test, type Page, type Route } from '@playwright/test'

const SUPABASE = 'https://xikqtpqdzmwsvybaklud.supabase.co'

function game(sessionId: string, savedAt: string, round = 4) {
  return {
    sessionId,
    players: [
      { id: 'player:gabi', name: 'Gabi', score: 1250, busts: 1 },
      { id: 'player:mabi', name: 'Mabi', score: 900, busts: 0 },
    ],
    idx: 1,
    round,
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
    savedAt,
  }
}

async function seed(page: Page, localGame?: unknown) {
  await page.addInitScript((active) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_clique_code', 'E2E-CLIQUE-CODE')
    localStorage.setItem('10k_device_id_v1', 'device-e2e')
    if (active) localStorage.setItem('10k_active_game', JSON.stringify(active))
  }, localGame ?? null)
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test('explicitly takes a cloud game over on a new device', async ({ page }) => {
  const cloudGame = game('cloud-session', '2026-07-14T10:20:00.000Z')
  let patchBody: { version?: number; payload?: Record<string, unknown> } | null = null
  await seed(page)

  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.endsWith('/clique_state')) return json(route, { message: 'unexpected request' }, 404)

    if (request.method() === 'GET') {
      return json(route, [
        {
          state_key: 'active_game',
          version: 8,
          updated_at: '2026-07-14T10:20:00.000Z',
          payload: {
            schemaVersion: 1,
            status: 'active',
            sessionId: cloudGame.sessionId,
            ownerDeviceId: 'other-device',
            savedAt: cloudGame.savedAt,
            game: cloudGame,
          },
        },
      ])
    }

    if (request.method() === 'PATCH') {
      patchBody = request.postDataJSON() as typeof patchBody
      return json(route, [
        {
          state_key: 'active_game',
          version: 9,
          updated_at: '2026-07-14T10:21:00.000Z',
          payload: patchBody?.payload,
        },
      ])
    }

    return json(route, { message: 'unexpected method' }, 405)
  })

  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Spiel aus der Cloud gefunden' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cloud-Spiel auf diesem Gerät übernehmen' }).click()

  await expect(page.getByText('Runde 4', { exact: true })).toBeVisible()
  await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
  expect(patchBody?.version).toBe(9)
  expect(patchBody?.payload?.ownerDeviceId).toBe('device-e2e')
  expect(patchBody?.payload?.sessionId).toBe('cloud-session')
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('10k_active_game') || '{}').sessionId))
    .toBe('cloud-session')
})

test('requires an explicit choice before replacing a different cloud game', async ({ page }) => {
  const localGame = game('local-session', '2026-07-14T10:30:00.000Z', 2)
  const cloudGame = game('cloud-session', '2026-07-14T10:29:00.000Z', 5)
  let patchBody: { version?: number; payload?: Record<string, unknown> } | null = null
  await seed(page, localGame)

  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.endsWith('/clique_state')) return json(route, { message: 'unexpected request' }, 404)

    if (request.method() === 'GET') {
      return json(route, [
        {
          state_key: 'active_game',
          version: 11,
          updated_at: '2026-07-14T10:29:00.000Z',
          payload: {
            schemaVersion: 1,
            status: 'active',
            sessionId: cloudGame.sessionId,
            ownerDeviceId: 'other-device',
            savedAt: cloudGame.savedAt,
            game: cloudGame,
          },
        },
      ])
    }

    if (request.method() === 'PATCH') {
      patchBody = request.postDataJSON() as typeof patchBody
      return json(route, [
        {
          state_key: 'active_game',
          version: 12,
          updated_at: '2026-07-14T10:31:00.000Z',
          payload: patchBody?.payload,
        },
      ])
    }

    return json(route, { message: 'unexpected method' }, 405)
  })

  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Zwei laufende Spiele gefunden' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Lokales Spiel behalten' }).click()

  await expect(dialog).toBeHidden()
  expect(patchBody?.version).toBe(12)
  expect(patchBody?.payload?.ownerDeviceId).toBe('device-e2e')
  expect(patchBody?.payload?.sessionId).toBe('local-session')
  await expect(page.getByText('Spiel fortsetzen', { exact: true })).toBeVisible()
})
