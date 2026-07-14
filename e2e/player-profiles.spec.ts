import { expect, test, type Page } from '@playwright/test'

const history = [
  {
    id: 1,
    date: '2026-01-01T18:00:00.000Z',
    event: 'Urlaub',
    winner: 'Bodo',
    winnerScore: 10500,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 10500, busts: 1 },
      { playerId: 'player-gabi', name: 'Gabi', score: 8000, busts: 2 },
    ],
    turns: [
      { round: 1, player: 'Bodo', playerId: 'player-bodo', points: 1000, bust: false },
      { round: 2, player: 'Bodo', playerId: 'player-bodo', points: 0, bust: true },
      { round: 3, player: 'Bodo', playerId: 'player-bodo', points: 2000, bust: false },
      { round: 4, player: 'Bodo', playerId: 'player-bodo', points: 7500, bust: false },
    ],
  },
  {
    id: 2,
    date: '2026-01-02T18:00:00.000Z',
    event: 'Urlaub',
    winner: 'Gabi',
    winnerScore: 10000,
    players: [
      { playerId: 'player-bodo', name: 'Bodo', score: 9000, busts: 2 },
      { playerId: 'player-gabi', name: 'Gabi', score: 10000, busts: 0 },
    ],
  },
  {
    id: 3,
    date: '2026-02-01T18:00:00.000Z',
    event: 'Familie',
    winner: 'Bodowin',
    winnerScore: 11000,
    players: [
      { playerId: 'player-bodo', name: 'Bodowin', score: 11000, busts: 0 },
      { playerId: 'player-gabi', name: 'Gabi', score: 7000, busts: 1 },
    ],
    turns: [
      { round: 1, player: 'Bodowin', playerId: 'player-bodo', points: 5000, bust: false },
      { round: 3, player: 'Bodowin', playerId: 'player-bodo', points: 6000, bust: false },
    ],
  },
  {
    id: 4,
    date: '2026-02-02T18:00:00.000Z',
    event: 'Familie',
    winner: 'Bodowin',
    winnerScore: 12000,
    players: [
      { playerId: 'player-bodo', name: 'Bodowin', score: 12000, busts: 0 },
      { playerId: 'player-gabi', name: 'Gabi', score: 9000, busts: 0 },
    ],
    turns: [
      { round: 1, player: 'Bodowin', playerId: 'player-bodo', points: 4000, bust: false },
      { round: 2, player: 'Bodowin', playerId: 'player-bodo', points: 8000, bust: false },
    ],
  },
]

async function openStats(page: Page) {
  await page.addInitScript((games) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_history_v3', JSON.stringify(games))
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
  }, history)
  await page.goto('/')
  await page.getByRole('button', { name: /Statistik/ }).click()
  await expect(page.getByRole('heading', { name: 'Statistik' })).toBeVisible()
}

test('opens an identity-aware personal profile with honest turn-data coverage', async ({ page }) => {
  await openStats(page)

  await page.getByRole('button', { name: 'Profil von Bodowin öffnen' }).click()
  await expect(page.getByRole('heading', { name: 'Bodowin' })).toBeVisible()
  await expect(page.getByText('4 Spiele · Siegquote 75 %', { exact: true })).toBeVisible()
  await expect(page.getByText('10.625', { exact: true })).toBeVisible()
  await expect(page.getByText('4.786', { exact: true })).toBeVisible()
  await expect(page.getByText(/Zugdaten vorhanden für 3 von 4 Spielen/)).toBeVisible()
  await expect(page.getByText('Gabi', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Zurück/ }).click()
  await page.getByRole('button', { name: 'Urlaub' }).click()
  await page.getByRole('button', { name: 'Profil von Bodowin öffnen' }).click()

  await expect(page.getByText('Gefiltert: Urlaub', { exact: true })).toBeVisible()
  await expect(page.getByText('2 Spiele · Siegquote 50 %', { exact: true })).toBeVisible()
})
