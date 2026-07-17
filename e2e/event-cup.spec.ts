import { expect, test } from '@playwright/test'

const history = [
  {
    id: 1_788_134_400_000,
    date: '2026-09-01T18:00:00.000Z',
    event: 'Sommerurlaub 2026',
    winner: 'Gabi',
    winnerScore: 10_200,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 10_200, busts: 1 },
      { playerId: 'player:bodo', name: 'Bodo', score: 8_400, busts: 2 },
    ],
    turns: [
      {
        round: 1,
        player: 'Gabi',
        playerId: 'player:gabi',
        points: 1_000,
        bust: false,
        riskAttempts: [
          { successPct: 33.33, dice: 1, scenarioB: false, pot: 300, success: true },
          { successPct: 55.56, dice: 2, scenarioB: false, pot: 500, success: true },
          { successPct: 33.33, dice: 1, scenarioB: false, pot: 700, success: true },
        ],
      },
    ],
  },
  {
    id: 1_788_220_800_000,
    date: '2026-09-02T18:00:00.000Z',
    event: 'Sommerurlaub 2026',
    winner: 'Bodo',
    winnerScore: 10_050,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 9_600, busts: 2 },
      { playerId: 'player:bodo', name: 'Bodo', score: 10_050, busts: 1 },
    ],
  },
  {
    id: 1_788_307_200_000,
    date: '2026-09-03T18:00:00.000Z',
    event: 'Sommerurlaub 2026',
    winner: 'Gabi',
    winnerScore: 10_400,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 10_400, busts: 0 },
      { playerId: 'player:bodo', name: 'Bodo', score: 9_900, busts: 3 },
      { playerId: 'player:clara', name: 'Clara', score: 8_800, busts: 1 },
    ],
  },
  {
    id: 1_788_393_600_000,
    date: '2026-09-04T18:00:00.000Z',
    event: '',
    winner: 'Clara',
    winnerScore: 10_100,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 8_900, busts: 1 },
      { playerId: 'player:clara', name: 'Clara', score: 10_100, busts: 0 },
    ],
  },
]

test('opens a fair vacation cup with records, progress and unassigned reminder', async ({ page }) => {
  await page.addInitScript(({ storedHistory }) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_history_v3', JSON.stringify(storedHistory))
  }, { storedHistory: history })

  await page.goto('/')
  await page.getByRole('button', { name: 'Statistik' }).click()
  await page.getByRole('button', { name: 'Sommerurlaub 2026', exact: true }).click()
  await expect(page.getByText('Sommerurlaub 2026 – Podest')).toBeVisible()
  await page.getByRole('button', { name: 'Urlaubs-Cup öffnen' }).click()

  await expect(page.getByText('Urlaubs-Cup', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sommerurlaub 2026' })).toBeVisible()
  await expect(page.getByText('Urlaubs-Champion', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gabi' })).toBeVisible()
  await expect(page.getByText('Siege → Siegquote → Ø Platzierung → direkte Duelle')).toBeVisible()
  await expect(page.getByText('Stärkste Risiko-Bilanz')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Direkte Duelle' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cup-Verlauf' })).toBeVisible()
  await expect(page.getByText('1 Spiel hat noch keinen Anlass.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Urlaubs-Cup teilen' })).toBeVisible()

  await page.getByRole('button', { name: /Gabi gewinnt/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Runden-Analyse' })).toBeVisible()
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page.getByRole('heading', { name: 'Cup-Verlauf' })).toBeVisible()
})
