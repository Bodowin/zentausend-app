import { expect, test } from '@playwright/test'

type SeedOptions = {
  sessionId: string
  savedAt: string
  event: string
  score?: number
}

function activeGame({ sessionId, savedAt, event, score = 500 }: SeedOptions) {
  return {
    sessionId,
    players: [
      { id: 'gabi', name: 'Gabi', score, busts: 0 },
      { id: 'mabi', name: 'Mabi', score: 50, busts: 1 },
    ],
    idx: 0,
    round: 2,
    phase: 'active',
    target: 0,
    event,
    testMode: true,
    diceMode: 'real',
    goalScore: 10000,
    entryMin: 350,
    kept: [],
    dice: [],
    accumulated: 0,
    turns: [
      { round: 1, player: 'Gabi', playerId: 'gabi', points: score, bust: false },
      { round: 1, player: 'Mabi', playerId: 'mabi', points: 0, bust: true },
    ],
    rolled: [],
    thrown: [],
    throwSeq: 0,
    savedAt,
  }
}

async function seedApp(page: import('@playwright/test').Page, game: ReturnType<typeof activeGame>) {
  await page.addInitScript((seed) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_active_game', JSON.stringify(seed))
    localStorage.setItem(
      '10k_prefs_v1',
      JSON.stringify({
        sound: false,
        haptics: false,
        shakeToRoll: false,
        handoff: false,
        miniChart: false,
        diceTheme: 'classic',
        defaultDiceMode: 'real',
        lastEvent: '',
      }),
    )
  }, game)
  await page.goto('/')
}

test('starting a new game safely pauses the previous game and lets either game resume', async ({ page }) => {
  const oldGame = activeGame({
    sessionId: 'old-family-game',
    savedAt: new Date().toISOString(),
    event: 'Skiurlaub',
  })
  await seedApp(page, oldGame)

  await expect(page.getByText('Spiel fortsetzen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dana', exact: true }).click()
  await page.getByRole('button', { name: 'Bodo', exact: true }).click()
  await page.getByRole('button', { name: 'Spiel starten · 2 Spieler', exact: true }).click()

  const conflict = page.getByRole('dialog', { name: 'Aktuelles Spiel pausieren?' })
  await expect(conflict).toBeVisible()
  await conflict.getByRole('button', { name: 'Pausieren & neues Spiel starten', exact: true }).click()

  await expect(page.locator('[aria-current="true"]')).toContainText('Dana')
  await page.getByRole('button', { name: 'Spiel pausieren', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Weitere pausierte Spiele (1)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Weitere pausierte Spiele (1)', exact: true }).click()
  const library = page.getByRole('dialog', { name: 'Pausierte Spiele' })
  await expect(library.getByText('Skiurlaub', { exact: true })).toBeVisible()
  await library.getByRole('button', { name: 'Skiurlaub fortsetzen', exact: true }).click()

  await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')
  await expect(page.locator('[aria-label^="Gabi:"]')).toContainText('500')

  const state = await page.evaluate(() => ({
    active: JSON.parse(localStorage.getItem('10k_active_game') || '{}') as { sessionId?: string },
    paused: JSON.parse(localStorage.getItem('10k_paused_games_v1') || '{}') as {
      records?: { sessionId: string; status: string }[]
    },
  }))
  expect(state.active.sessionId).toBe('old-family-game')
  expect(state.paused.records?.some((record) => record.status === 'paused' && record.sessionId !== 'old-family-game')).toBe(true)
})

test('games older than fourteen days move to the archive without being deleted', async ({ page }) => {
  const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  await seedApp(
    page,
    activeGame({
      sessionId: 'archived-family-game',
      savedAt: oldDate,
      event: 'Osterurlaub',
      score: 700,
    }),
  )

  await expect(page.getByText('Spiel fortsetzen', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pausierte Spiele (1)', exact: true }).click()
  const library = page.getByRole('dialog', { name: 'Pausierte Spiele' })
  await expect(library.getByRole('button', { name: /Archiv/ })).toBeVisible()
  await expect(library.getByText('Osterurlaub', { exact: true })).toBeVisible()
  await expect(library.getByText(/bleibt es erhalten/)).toBeVisible()

  await library.getByRole('button', { name: 'Osterurlaub fortsetzen', exact: true }).click()
  await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')
  await expect(page.locator('[aria-label^="Gabi:"]')).toContainText('700')

  const activeSession = await page.evaluate(() => JSON.parse(localStorage.getItem('10k_active_game') || '{}').sessionId)
  expect(activeSession).toBe('archived-family-game')
})
