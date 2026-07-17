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

async function openCleanApp(page: Page, extra?: Record<string, string>) {
  await page.addInitScript(
    ({ prefs, seeded }) => {
      // addInitScript runs again on reload. sessionStorage survives that reload,
      // so destructive seeding must happen only for the first document in a test.
      if (sessionStorage.getItem('10k_e2e_seeded') === '1') return
      localStorage.clear()
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify(prefs))
      for (const [key, value] of Object.entries(seeded)) localStorage.setItem(key, value)
      sessionStorage.setItem('10k_e2e_seeded', '1')
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

    const endgameDialog = page.getByRole('dialog', { name: 'Endphase – Gabi erreicht 5.000' })
    await expect(endgameDialog).toBeVisible()
    await endgameDialog.getByRole('button', { name: 'Mabi: letzte Chance starten' }).click()

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

  test('stores haptic feedback as an optional device setting', async ({ page }) => {
    await openCleanApp(page)
    await page.getByRole('button', { name: 'Einstellungen' }).click()

    const shake = page.getByRole('switch', { name: 'Schütteln zum Würfeln' })
    await expect(shake).toHaveAttribute('aria-checked', 'false')

    const haptics = page.getByRole('switch', { name: 'Haptisches Feedback' })
    await expect(haptics).toHaveAttribute('aria-checked', 'false')
    await haptics.click()
    await expect(haptics).toHaveAttribute('aria-checked', 'true')
    await shake.click()
    await expect(shake).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Einstellungen' })).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    await expect(page.getByRole('switch', { name: 'Haptisches Feedback' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('switch', { name: 'Schütteln zum Würfeln' })).toHaveAttribute('aria-checked', 'true')
  })

  test('keeps the stable player id when a roster member is renamed', async ({ page }) => {
    await openCleanApp(page)
    await page.getByRole('button', { name: 'Kader', exact: true }).click()

    const rosterInput = page.getByRole('textbox', { name: 'Gabi umbenennen' })
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

  test('protects a running game before another one is started', async ({ page }) => {
    const activeGame = {
      players: [
        { id: 'player:name:gabi', name: 'Gabi', score: 850, busts: 1 },
        { id: 'player:name:mabi', name: 'Mabi', score: 500, busts: 0 },
      ],
      idx: 1,
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
      savedAt: '2026-07-14T08:00:00.000Z',
    }
    await openCleanApp(page, { '10k_active_game': JSON.stringify(activeGame) })
    await choosePlayers(page)

    await page.getByRole('button', { name: 'Spiel starten · 2 Spieler' }).click()
    const dialog = page.getByRole('dialog', { name: 'Laufendes Spiel ersetzen?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Altes Spiel fortsetzen' }).click()

    await expect(page.getByText('Runde 3', { exact: true })).toBeVisible()
    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
  })

  test('restores a safety copy when the main active-game value is damaged', async ({ page }) => {
    const activeGame = {
      players: [
        { id: 'player:name:gabi', name: 'Gabi', score: 1200, busts: 0 },
        { id: 'player:name:mabi', name: 'Mabi', score: 900, busts: 2 },
      ],
      idx: 0,
      round: 4,
      phase: 'active',
      target: 0,
      event: 'Recovery Test',
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
      savedAt: '2026-07-14T08:30:00.000Z',
    }
    await openCleanApp(page, {
      '10k_active_game': '{broken',
      '10k_active_game_recovery_v1': JSON.stringify([JSON.stringify(activeGame)]),
    })

    await expect(page.getByText('Sicherheitskopie wiederhergestellt', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
    await expect(page.getByText('Runde 4', { exact: true })).toBeVisible()
    await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')
  })

})
