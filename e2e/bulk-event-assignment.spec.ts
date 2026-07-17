import { expect, test } from '@playwright/test'

const history = [
  {
    id: 1_788_134_400_000,
    date: '2026-09-01T18:00:00.000Z',
    event: '',
    winner: 'Gabi',
    winnerScore: 10_200,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 10_200, busts: 1 },
      { playerId: 'player:bodo', name: 'Bodo', score: 8_400, busts: 2 },
    ],
  },
  {
    id: 1_788_220_800_000,
    date: '2026-09-02T18:00:00.000Z',
    event: '',
    winner: 'Bodo',
    winnerScore: 10_050,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 9_600, busts: 2 },
      { playerId: 'player:bodo', name: 'Bodo', score: 10_050, busts: 1 },
    ],
  },
  {
    id: 1_785_542_400_000,
    date: '2026-08-02T18:00:00.000Z',
    event: 'Spieleabend',
    winner: 'Gabi',
    winnerScore: 10_100,
    players: [
      { playerId: 'player:gabi', name: 'Gabi', score: 10_100, busts: 0 },
      { playerId: 'player:bodo', name: 'Bodo', score: 7_900, busts: 3 },
    ],
  },
]

test('assigns several vacation games to one event and keeps it after reload', async ({ page }) => {
  await page.addInitScript(({ storedHistory }) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_history_v3', JSON.stringify(storedHistory))
  }, { storedHistory: history })

  await page.goto('/')
  await page.getByRole('button', { name: 'Statistik' }).click()
  await page.getByRole('button', { name: /Mehrere Spiele einem Anlass zuordnen/ }).click()

  const dialog = page.getByRole('dialog', { name: 'Spiele gesammelt zuordnen' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Von').fill('2026-09-01')
  await dialog.getByLabel('Bis').fill('2026-09-03')
  await dialog.getByRole('button', { name: 'Alle im Zeitraum' }).click()
  await expect(dialog.getByText('2 ausgewählt')).toBeVisible()

  await dialog.getByLabel('Gemeinsamer Anlass').fill('Sommerurlaub 2026')
  await dialog.getByRole('button', { name: '2 Spiele zuordnen' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('· Sommerurlaub 2026')).toHaveCount(2)

  await page.reload()
  await page.getByRole('button', { name: 'Statistik' }).click()
  await expect(page.getByRole('button', { name: 'Sommerurlaub 2026' })).toBeVisible()
  await expect(page.getByText('· Sommerurlaub 2026')).toHaveCount(2)
})
