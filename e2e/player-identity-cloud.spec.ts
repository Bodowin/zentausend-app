import { expect, test, type Page, type Route } from '@playwright/test'

const SUPABASE = 'https://xikqtpqdzmwsvybaklud.supabase.co'
const emptyState = { aliases: {}, redirects: {}, preferredNames: {} }

async function seedCloudPage(page: Page, identity: unknown) {
  await page.addInitScript((state) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_clique_code', 'E2E-CLIQUE-CODE')
    localStorage.setItem('10k_player_aliases_v1', JSON.stringify((state as { aliases?: unknown }).aliases ?? {}))
    localStorage.setItem('10k_player_redirects_v1', JSON.stringify((state as { redirects?: unknown }).redirects ?? {}))
    localStorage.setItem(
      '10k_player_preferred_names_v1',
      JSON.stringify((state as { preferredNames?: unknown }).preferredNames ?? {}),
    )
  }, identity)
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

test('pushes local player identities with versioned compare-and-swap', async ({ page }) => {
  const localState = {
    aliases: { gabi: 'player-gabi' },
    redirects: { 'player-gabriela': 'player-gabi' },
    preferredNames: { 'player-gabi': 'Gabi' },
  }
  let patchBody: { version?: number; payload?: unknown } | null = null
  let gameReads = 0
  await seedCloudPage(page, localState)

  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/rpc/check_clique_code')) return json(route, true)
    if (url.pathname.endsWith('/games')) {
      gameReads += 1
      return json(route, [])
    }
    if (!url.pathname.endsWith('/clique_state')) return json(route, { message: 'unexpected request' }, 404)

    if (request.method() === 'GET') {
      return json(route, [
        {
          state_key: 'player_identity',
          version: 1,
          payload: emptyState,
          updated_at: '2026-07-13T20:00:00.000Z',
        },
      ])
    }
    if (request.method() === 'PATCH') {
      patchBody = request.postDataJSON() as { version?: number; payload?: unknown }
      return json(route, [
        {
          state_key: 'player_identity',
          version: 2,
          payload: patchBody.payload,
          updated_at: '2026-07-13T20:01:00.000Z',
        },
      ])
    }
    return json(route, { message: 'unexpected method' }, 405)
  })

  await page.goto('/')
  await page.getByRole('button', { name: /Statistik/ }).click()
  await expect(page.getByText('Alles gesichert', { exact: true })).toBeVisible()
  await expect(page.getByText('0 Spiele auf diesem Gerät · 0 in der Cloud', { exact: true })).toBeVisible()

  const readsAfterOpen = gameReads
  await page.getByRole('button', { name: 'Jetzt sichern' }).click()
  await expect.poll(() => gameReads).toBeGreaterThan(readsAfterOpen)

  expect(patchBody).toEqual({ version: 2, payload: localState })
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('10k_player_identity_sync_v1') || '{}').dirty),
    )
    .toBe(false)
})

test('shows a rotated or invalid clique code instead of claiming successful sync', async ({ page }) => {
  await seedCloudPage(page, emptyState)
  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/rpc/check_clique_code')) return json(route, false)
    if (url.pathname.endsWith('/games')) return json(route, [])
    if (url.pathname.endsWith('/clique_state')) {
      return json(route, [
        {
          state_key: 'player_identity',
          version: 1,
          payload: emptyState,
          updated_at: '2026-07-13T20:00:00.000Z',
        },
      ])
    }
    return json(route, { message: 'unexpected request' }, 404)
  })

  await page.goto('/')
  await page.getByRole('button', { name: /Statistik/ }).click()
  await expect(page.getByText('Crew-Code prüfen', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crew-Code ändern' })).toBeVisible()
})
