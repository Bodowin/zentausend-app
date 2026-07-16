import { expect, test, type Page } from '@playwright/test'

const PREFS = {
  sound: false,
  haptics: false,
  shakeToRoll: false,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  handoff: false,
  miniChart: false,
  lastEvent: '',
}

function activeGame(sessionId: string, event: string, savedAt: string) {
  return {
    sessionId,
    players: [
      { id: 'player:name:gabi', name: 'Gabi', score: 850, busts: 1 },
      { id: 'player:name:mabi', name: 'Mabi', score: 500, busts: 0 },
    ],
    idx: 1,
    round: 3,
    phase: 'active',
    target: 0,
    event,
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

async function openApp(page: Page, values: Record<string, string>) {
  await page.addInitScript(
    ({ prefs, seeded }) => {
      if (sessionStorage.getItem('10k_pause_e2e_seeded') === '1') return
      localStorage.clear()
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify(prefs))
      for (const [key, value] of Object.entries(seeded)) localStorage.setItem(key, value)
      sessionStorage.setItem('10k_pause_e2e_seeded', '1')
    },
    { prefs: PREFS, seeded: values },
  )
  await page.goto('/')
}

async function choosePlayers(page: Page) {
  await page.getByRole('button', { name: 'Gabi', exact: true }).click()
  await page.getByRole('button', { name: 'Mabi', exact: true }).click()
}

test('starts a new game without overwriting the paused one and can switch back later', async ({ page }) => {
  const old = activeGame('old-session', 'Alte Familienrunde', '2026-07-16T08:00:00.000Z')
  await openApp(page, { '10k_active_game': JSON.stringify(old) })
  await choosePlayers(page)

  await page.getByRole('button', { name: 'Spiel starten · 2 Spieler' }).click()
  const conflict = page.getByRole('dialog', { name: 'Laufendes Spiel ersetzen?' })
  await expect(conflict).toBeVisible()
  await conflict.getByRole('button', { name: 'Spiel pausieren & neues starten' }).click()

  await expect(page.getByText('Runde 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Spiel pausieren' }).click()

  await expect(page.getByText('Pausierte Spiele', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Pausiertes Spiel Gabi, Mabi fortsetzen/ })).toBeVisible()
  await page.getByRole('button', { name: /Pausiertes Spiel Gabi, Mabi fortsetzen/ }).click()

  await expect(page.getByText('Runde 3', { exact: true })).toBeVisible()
  await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
  await expect(page.locator('[aria-label^="Gabi:"]')).toContainText('850')

  const statuses = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('10k_paused_games_v1') || '{}') as {
      items?: { sessionId: string; status: string }[]
    }
    return store.items?.map((item) => `${item.sessionId}:${item.status}`) ?? []
  })
  expect(statuses).toContain('old-session:deleted')
  expect(statuses.some((value) => value !== 'old-session:deleted' && value.endsWith(':paused'))).toBe(true)
})

test('moves a 15-day-old pause to the archive and restores it on demand', async ({ page }) => {
  const pausedAt = '2026-07-01T08:00:00.000Z'
  const archivedCandidate = activeGame('archive-session', 'Sommerurlaub', pausedAt)
  const store = {
    schemaVersion: 1,
    items: [
      {
        sessionId: archivedCandidate.sessionId,
        status: 'paused',
        changedAt: pausedAt,
        pausedAt,
        game: archivedCandidate,
      },
    ],
  }
  await openApp(page, { '10k_paused_games_v1': JSON.stringify(store) })

  const archiveButton = page.getByRole('button', { name: 'Archiv (1)' })
  await expect(archiveButton).toBeVisible()
  await archiveButton.click()
  await page.getByRole('button', { name: /Archiviertes Spiel Gabi, Mabi fortsetzen/ }).click()

  await expect(page.getByText('Runde 3', { exact: true })).toBeVisible()
  await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
})
