import { expect, test } from '@playwright/test'

const history = [
  {
    id: 2,
    date: '2026-01-01T00:00:00.000Z',
    event: 'E2E Profile',
    winner: 'Bodowin',
    winnerScore: 10500,
    players: [
      { playerId: 'player-bodowin', name: 'Bodowin', score: 10500, busts: 0 },
      { playerId: 'player-dana', name: 'Dana', score: 8000, busts: 1 },
    ],
    turns: [],
  },
  {
    id: 1,
    date: '2025-01-01T00:00:00.000Z',
    event: 'E2E Profile',
    winner: 'Bodo',
    winnerScore: 10000,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 10000, busts: 1 },
      { playerId: 'player-dana', name: 'Dana', score: 7000, busts: 2 },
    ],
    turns: [],
  },
]

test('merges two player profiles and restores them with undo', async ({ page }) => {
  await page.addInitScript((games) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_history_v3', JSON.stringify(games))
  }, history)
  await page.goto('/')
  await page.getByRole('button', { name: /Statistik/ }).click()

  const leaderboard = page.getByRole('heading', { name: 'Ewige Bestenliste' }).locator('..')
  await expect(leaderboard).toContainText('Bodo')
  await expect(leaderboard).toContainText('Bodowin')

  await page.getByRole('button', { name: '👥 Spielerprofile verwalten' }).click()
  const manager = page.getByRole('dialog', { name: 'Spieler verwalten' })
  await manager.getByLabel('Dieses Profil auflösen').selectOption('player-bodowin')
  await manager.getByLabel('In dieses Zielprofil').selectOption('player-bodo')
  page.once('dialog', (dialog) => dialog.accept())
  await manager.getByRole('button', { name: 'Profile sicher zusammenführen' }).click()

  await expect(page.getByText(/wurde mit Bodo zusammengeführt/)).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('10k_player_redirects_v1') || '{}')['player-bodowin']),
    )
    .toBe('player-bodo')
  await expect(leaderboard).toContainText('2 Sp.')

  await page.getByRole('button', { name: '👥 Spielerprofile verwalten' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Letzte Zusammenführung rückgängig/ }).click()

  await expect(page.getByText(/wurde rückgängig gemacht/)).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('10k_player_redirects_v1') || '{}')['player-bodowin'] ?? null),
    )
    .toBeNull()
  await expect(leaderboard).toContainText('Bodo')
  await expect(leaderboard).toContainText('Bodowin')
})
