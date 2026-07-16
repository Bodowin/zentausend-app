import { expect, test, type Page } from '@playwright/test'

const prefs = {
  sound: false,
  haptics: false,
  shakeToRoll: false,
  handoff: false,
  miniChart: false,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  lastEvent: '',
}

async function openFinalTurn(page: Page) {
  await page.addInitScript(({ storedPrefs }) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_prefs_v1', JSON.stringify(storedPrefs))
    localStorage.setItem(
      '10k_active_game',
      JSON.stringify({
        sessionId: 'package-s-finale',
        players: [
          { id: 'player:gabi', name: 'Gabi', score: 10_000, busts: 1 },
          { id: 'player:mabi', name: 'Mabi', score: 9_950, busts: 2 },
        ],
        idx: 1,
        round: 5,
        phase: 'lastChance',
        target: 10_000,
        event: 'Finalabend',
        testMode: true,
        diceMode: 'real',
        goalScore: 10_000,
        entryMin: 350,
        kept: [],
        dice: [],
        accumulated: 0,
        turns: [
          { round: 1, player: 'Gabi', playerId: 'player:gabi', points: 1_000, bust: false },
          { round: 1, player: 'Mabi', playerId: 'player:mabi', points: 0, bust: true },
          { round: 2, player: 'Gabi', playerId: 'player:gabi', points: 500, bust: false },
          { round: 2, player: 'Mabi', playerId: 'player:mabi', points: 1_500, bust: false },
        ],
        rolled: [],
        thrown: [],
        throwSeq: 4,
        savedAt: new Date().toISOString(),
      }),
    )
  }, { storedPrefs: prefs })
  await page.goto('/')
  await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
}

test('shows the podium, awards and creates a shareable result image', async ({ page }) => {
  await openFinalTurn(page)
  await page.getByRole('button', { name: 'Würfel 1 hinzufügen', exact: true }).click()
  await page.getByRole('button', { name: '100 Punkte sichern' }).click()

  const finale = page.getByRole('dialog', { name: 'Spiel beendet – Mabi gewinnt' })
  await expect(finale).toBeVisible()
  await expect(finale.getByText('Champion der Clique')).toBeVisible()
  await expect(finale.getByText('Mabi', { exact: true }).first()).toBeVisible()
  await expect(finale.getByText('Auszeichnungen')).toBeVisible()
  await expect(finale.getByText('High Roller')).toBeVisible()
  await expect(finale.getByRole('button', { name: 'Revanche' })).toBeVisible()
  await expect(finale.getByRole('button', { name: 'Runden-Analyse' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await finale.getByRole('button', { name: 'Ergebnis teilen' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('10000-ergebnis.png')
})
