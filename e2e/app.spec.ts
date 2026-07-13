import { expect, test, type Page } from '@playwright/test'

const PREFS = {
  sound: false,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  handoff: false,
  miniChart: false,
  lastEvent: '',
}

async function openCleanApp(page: Page, extra?: Record<string, string>) {
  await page.addInitScript(
    ({ prefs, seeded }) => {
      localStorage.clear()
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify(prefs))
      for (const [key, value] of Object.entries(seeded)) localStorage.setItem(key, value)
    },
    { prefs: PREFS, seeded: extra ?? {} },
  )
  await page.goto('/')
}

async function choosePlayers(page: Page, names = ['Gabi', 'Mabi']) {
  for (const name of names) await page.getByRole('button', { name, exact: true }).click()
}

async function configureTestGame(page: Page) {
  await page.getByRole('button', { name: /Optionen/ }).click()
  await page.getByRole('button', { name: '5.000', exact: true }).click()
  await page.getByRole('button', { name: 'Aus', exact: true }).click()
  await page.getByRole('switch', { name: /Testspiel/ }).click()
}

async function startTestGame(page: Page) {
  await choosePlayers(page)
  await configureTestGame(page)
  await page.getByRole('button', { name: 'Testspiel starten · 2 Spieler' }).click()
  await expect(page.getByText('Runde 1', { exact: true })).toBeVisible()
}

async function addDice(page: Page, value: number, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: `Würfel ${value} hinzufügen`, exact: true }).click()
  }
}

test.describe('10.000 browser journeys', () => {
  test('configures and starts a mobile test game', async ({ page }) => {
    await openCleanApp(page)
    await startTestGame(page)

    await expect(page.getByText(/Ziel 5\.000.*TEST/)).toBeVisible()
    await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')
    await expect(page.getByRole('button', { name: 'Spiel pausieren' })).toBeVisible()
  })

  test('banks, records a bust, undoes it and restores selected dice after reload', async ({ page }) => {
    await openCleanApp(page)
    await startTestGame(page)

    await addDice(page, 1, 2)
    await addDice(page, 5, 2)
    await expect(page.getByText('+300', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '300 Punkte sichern' }).click()
    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')

    await page.getByRole('button', { name: 'Niete verbuchen' }).click()
    const bustDialog = page.getByRole('dialog', { name: /Mabi hat sich ausgezockt/ })
    await expect(bustDialog).toBeVisible()
    await bustDialog.getByRole('button', { name: 'Gabi ist dran →' }).click()

    await page.getByRole('button', { name: 'Letzte Aktion rückgängig' }).click()
    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
    await expect(page.locator('[aria-current="true"]')).toContainText('0 Nieten')

    await addDice(page, 1, 1)
    await expect(page.getByText('+100', { exact: true })).toBeVisible()
    await page.reload()

    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
    await expect(page.getByText('+100', { exact: true })).toBeVisible()
  })

  test('finishes a restored last round and prepares a rematch', async ({ page }) => {
    const activeGame = {
      players: [
        { id: 'player:name:gabi', name: 'Gabi', score: 4900, busts: 0 },
        { id: 'player:name:mabi', name: 'Mabi', score: 0, busts: 0 },
      ],
      idx: 0,
      round: 4,
      phase: 'active',
      target: 0,
      event: 'E2E Finale',
      testMode: true,
      diceMode: 'real',
      goalScore: 5000,
      entryMin: 0,
      kept: [],
      dice: [],
      accumulated: 0,
      turns: [],
      rolled: [],
      thrown: [],
      throwSeq: 0,
      savedAt: '2026-07-13T18:00:00.000Z',
    }
    await openCleanApp(page, { '10k_active_game': JSON.stringify(activeGame) })

    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
    await addDice(page, 1, 1)
    await page.getByRole('button', { name: '100 Punkte sichern' }).click()
    await expect(page.getByText('Letzte Chance!', { exact: true })).toBeVisible()
    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')

    await page.getByRole('button', { name: 'Niete verbuchen' }).click()
    const bustDialog = page.getByRole('dialog', { name: /Mabi hat sich ausgezockt/ })
    await bustDialog.getByRole('button', { name: 'Ergebnis anzeigen →' }).click()

    const winDialog = page.getByRole('dialog', { name: 'Spiel beendet – Gabi gewinnt' })
    await expect(winDialog).toBeVisible()
    await expect(winDialog.getByText('5.000', { exact: true })).toBeVisible()
    await winDialog.getByRole('button', { name: /Revanche/ }).click()

    await expect(page.getByRole('button', { name: 'Spiel starten · 2 Spieler' })).toBeVisible()
    await expect(page.getByText('Gabi', { exact: true }).first()).toBeVisible()
  })

  test('imports a backup through the real statistics file input', async ({ page }) => {
    await openCleanApp(page)
    await page.getByRole('button', { name: /Statistik/ }).click()

    const backup = {
      format: '10000-clique-backup',
      version: 1,
      exportedAt: '2026-07-13T18:00:00.000Z',
      games: [
        {
          id: 1750000000000,
          date: '2026-07-12T18:00:00.000Z',
          event: 'E2E Backup',
          winner: 'Gabi',
          winnerScore: 10000,
          players: [
            { playerId: 'player:name:gabi', name: 'Gabi', score: 10000, busts: 1 },
            { playerId: 'player:name:mabi', name: 'Mabi', score: 8500, busts: 2 },
          ],
          turns: [],
        },
      ],
    }

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    })

    await expect(page.getByText(/1 neu importiert · 1 gesamt/)).toBeVisible()
    await expect(page.getByText('E2E Backup', { exact: true })).toBeVisible()
    await expect(page.getByText('Gabi', { exact: true }).first()).toBeVisible()
  })

  test('keeps the stable player id when a roster member is renamed', async ({ page }) => {
    await openCleanApp(page)
    await page.getByRole('button', { name: 'Kader', exact: true }).click()

    const rosterInput = page.getByDisplayValue('Gabi')
    await expect(rosterInput).toBeVisible()
    await rosterInput.fill('Gabriela')
    await rosterInput.press('Enter')
    await page.getByRole('button', { name: 'Fertig', exact: true }).click()

    await page.getByRole('button', { name: 'Gabriela', exact: true }).click()
    await page.getByRole('button', { name: 'Mabi', exact: true }).click()
    await page.getByRole('button', { name: 'Spiel starten · 2 Spieler' }).click()

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const active = JSON.parse(localStorage.getItem('10k_active_game') || '{}') as {
            players?: { id: string; name: string }[]
          }
          return active.players?.find((player) => player.name === 'Gabriela')?.id
        }),
      )
      .toBe('player:name:gabi')
  })
})
