import { expect, test, type Page } from '@playwright/test'

// Deterministic regression coverage for the independently audited Paket Y1 fixes.
const BASE_PREFS = {
  sound: false,
  haptics: false,
  shakeToRoll: false,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  handoff: false,
  miniChart: false,
  lastEvent: '',
}

async function openCleanApp(
  page: Page,
  options: {
    prefs?: typeof BASE_PREFS
    seeded?: Record<string, string>
    offline?: boolean
  } = {},
) {
  if (options.offline) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    })
  }
  await page.addInitScript(
    ({ prefs, seeded }) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify(prefs))
      for (const [key, value] of Object.entries(seeded)) localStorage.setItem(key, value)
    },
    { prefs: options.prefs ?? BASE_PREFS, seeded: options.seeded ?? {} },
  )
  await page.goto('/')
}

async function startTestGame(page: Page) {
  await page.getByRole('button', { name: 'Gabi', exact: true }).click()
  await page.getByRole('button', { name: 'Mabi', exact: true }).click()
  await page.getByRole('button', { name: /Optionen/ }).click()
  await page.getByRole('button', { name: '5.000', exact: true }).click()
  await page.getByRole('button', { name: 'Aus', exact: true }).click()
  await page.getByRole('switch', { name: /Testspiel/ }).click()
  await page.getByRole('button', { name: 'Testspiel starten · 2 Spieler' }).click()
  await expect(page.getByText('Runde 1', { exact: true })).toBeVisible()
}

async function expectHeaderFits(page: Page) {
  const info = await page.getByTestId('game-header-info').boundingBox()
  const actions = await page.getByTestId('game-header-actions').boundingBox()
  const pause = await page.getByRole('button', { name: 'Spiel pausieren' }).boundingBox()
  const viewport = page.viewportSize()

  expect(info).not.toBeNull()
  expect(actions).not.toBeNull()
  expect(pause).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(info!.x + info!.width).toBeLessThanOrEqual(actions!.x + 0.5)
  expect(pause!.x).toBeGreaterThanOrEqual(0)
  expect(pause!.x + pause!.width).toBeLessThanOrEqual(viewport!.width)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true)
}

test.describe('Paket Y1 audit regressions', () => {
  test('keeps every game-header action accessible from 320 to 430 px in both dice modes', async ({ page }) => {
    test.slow()
    for (const width of [320, 360, 375, 390, 402, 430]) {
      await page.setViewportSize({ width, height: 780 })
      await openCleanApp(page)
      await startTestGame(page)
      await expectHeaderFits(page)

      await page.getByRole('button', { name: 'Würfel-Modus wechseln' }).click()
      await expectHeaderFits(page)

      await page.getByRole('button', { name: 'Spiel pausieren' }).click()
      await expect(page.getByRole('button', { name: /Spiel fortsetzen/ })).toBeVisible()
    }
  })

  test('selecting landed virtual dice emits no cross-component React update warning', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await openCleanApp(page)
    await startTestGame(page)
    await page.getByRole('button', { name: 'Würfel-Modus wechseln' }).click()
    await page.getByRole('button', { name: 'Würfeln' }).click()
    await expect(page.locator('.da-die.da-landed').first()).toBeVisible({ timeout: 15_000 })

    await page.locator('.da-die.da-landed').first().click()
    await page.locator('.da-die.da-landed').nth(1).click()

    expect(
      consoleErrors.filter((message) =>
        message.includes('Cannot update a component') ||
        message.includes('while rendering a different component'),
      ),
    ).toEqual([])
  })

  test('shows a last-chance lead change inside the blocking handoff dialog', async ({ page }) => {
    const activeGame = {
      sessionId: 'e2e-y1-handoff',
      players: [
        { id: 'player:name:gabi', name: 'Gabi', score: 5000, busts: 0 },
        { id: 'player:name:mabi', name: 'Mabi', score: 4950, busts: 0 },
        { id: 'player:name:caro', name: 'Caro', score: 4100, busts: 0 },
      ],
      idx: 1,
      round: 4,
      phase: 'lastChance',
      target: 5000,
      event: 'E2E Y1',
      testMode: true,
      diceMode: 'real',
      goalScore: 5000,
      entryMin: 0,
      kept: [],
      dice: [],
      accumulated: 0,
      turns: [],
      currentRiskAttempts: [],
      pendingRiskAttempt: null,
      rolled: [],
      thrown: [],
      throwSeq: 0,
      savedAt: '2026-07-17T20:00:00.000Z',
    }
    await openCleanApp(page, {
      prefs: { ...BASE_PREFS, handoff: true },
      seeded: { '10k_active_game': JSON.stringify(activeGame) },
    })
    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
    await page.getByRole('button', { name: 'Würfel 1 hinzufügen' }).click()
    await page.getByRole('button', { name: '100 Punkte sichern' }).click()

    const handoff = page.getByRole('dialog', { name: /Caro/ })
    await expect(handoff).toBeVisible()
    await expect(handoff.getByRole('status')).toHaveText('Neue Führung!')
    await expect(page.getByText('Führung!', { exact: true })).toHaveCount(0)
  })

  test('reports offline immediately while keeping local statistics available', async ({ page }) => {
    await openCleanApp(page, { offline: true })
    await page.getByRole('button', { name: /Statistik/ }).click()

    await expect(page.getByText(/Gerade offline|Nur auf diesem Gerät/)).toBeVisible()
    await expect(page.getByText('Cloud wird geprüft…', { exact: true })).toHaveCount(0)
  })
})
