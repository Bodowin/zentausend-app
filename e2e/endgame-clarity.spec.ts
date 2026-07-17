import { expect, test, type Page } from '@playwright/test'

const prefs = {
  sound: false,
  haptics: false,
  shakeToRoll: false,
  handoff: true,
  miniChart: true,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  lastEvent: '',
}

async function openActiveGame(page: Page, game: Record<string, unknown>, seed: string) {
  await page.addInitScript(({ storedPrefs, storedGame, seedKey }) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_prefs_v1', JSON.stringify(storedPrefs))
    localStorage.setItem('10k_active_game', JSON.stringify(storedGame))
    sessionStorage.setItem(seedKey, '1')
  }, { storedPrefs: prefs, storedGame: game, seedKey: seed })
  await page.goto('/')
  await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
}

const baseGame = {
  round: 8,
  event: 'Finalabend',
  testMode: true,
  diceMode: 'real',
  goalScore: 10_000,
  entryMin: 350,
  kept: [],
  dice: [],
  accumulated: 0,
  turns: [],
  currentRiskAttempts: [],
  pendingRiskAttempt: null,
  rolled: [],
  thrown: [],
  throwSeq: 1,
  savedAt: new Date().toISOString(),
}

test('rounds the final gap to playable points and warns before banking away the last chance', async ({ page }) => {
  await openActiveGame(page, {
    ...baseGame,
    sessionId: 'package-w-bank-warning',
    players: [
      { id: 'player:gabi', name: 'Gabi', score: 10_000, busts: 1 },
      { id: 'player:bodo', name: 'Bodo', score: 9_900, busts: 2 },
    ],
    idx: 1,
    phase: 'lastChance',
    target: 10_000,
  }, 'package-w-bank-warning')

  await expect(page.getByText('Zum Überholen', { exact: true })).toBeVisible()
  await expect(page.getByText('150', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Würfel 1 hinzufügen', exact: true }).click()
  await page.getByRole('button', { name: '100 Punkte sichern' }).click()

  const warning = page.getByRole('dialog', { name: 'Damit kannst du nicht gewinnen' })
  await expect(warning).toBeVisible()
  await expect(warning.getByText('Mit +100 landest du bei 10.000 Punkten.')).toBeVisible()
  await expect(warning.getByText('Zum Überholen fehlen danach noch 50 Punkte.')).toBeVisible()
  await warning.getByRole('button', { name: 'Weiterwürfeln' }).click()
  await expect(warning).toBeHidden()

  await page.getByRole('button', { name: '100 Punkte sichern' }).click()
  await warning.getByRole('button', { name: 'Trotzdem sichern' }).click()
  await expect(page.getByRole('dialog', { name: 'Spiel beendet – Gabi gewinnt' })).toBeVisible()
})

test('announces the start of the final phase prominently before the next player begins', async ({ page }) => {
  await openActiveGame(page, {
    ...baseGame,
    sessionId: 'package-w-endgame-announcement',
    players: [
      { id: 'player:gabi', name: 'Gabi', score: 9_900, busts: 0 },
      { id: 'player:bodo', name: 'Bodo', score: 9_000, busts: 1 },
    ],
    idx: 0,
    phase: 'active',
    target: 0,
  }, 'package-w-endgame-announcement')

  await page.getByRole('button', { name: 'Würfel 1 hinzufügen', exact: true }).click()
  await page.getByRole('button', { name: '100 Punkte sichern' }).click()

  const announcement = page.getByRole('dialog', { name: 'Endphase – Gabi erreicht 10.000' })
  await expect(announcement).toBeVisible()
  await expect(announcement.getByText('Gabi hat 10.000 erreicht!')).toBeVisible()
  await expect(announcement.getByText('Zum Überholen sind mindestens 10.050 Punkte nötig.')).toBeVisible()
  await announcement.getByRole('button', { name: 'Bodo: letzte Chance starten' }).click()

  await expect(page.getByText('Letzte Chance!', { exact: true })).toBeVisible()
  await expect(page.getByText('Bodo braucht mindestens 1.050 Punkte')).toBeVisible()
})
