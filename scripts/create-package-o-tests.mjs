import fs from 'node:fs'

const spec = `import { expect, test } from '@playwright/test'

const activeGame = {
  sessionId: 'iphone-flow-test',
  players: [
    { id: 'anna', name: 'Anna', score: 0, busts: 0 },
    { id: 'bert', name: 'Bert', score: 0, busts: 0 },
  ],
  idx: 0,
  round: 1,
  phase: 'active',
  target: 0,
  event: 'iPhone-Test',
  testMode: true,
  diceMode: 'virtual',
  goalScore: 10000,
  entryMin: 0,
  kept: [],
  dice: [],
  accumulated: 0,
  turns: [],
  rolled: [1, 2, 3, 4, 5, 6],
  thrown: [1, 2, 3, 4, 5, 6],
  throwSeq: 1,
  savedAt: '2026-07-15T12:00:00.000Z',
}

test('fills an iPhone viewport and starts the next throw only after the handoff', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/rest/v1/clique_state**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.addInitScript((game) => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_active_game', JSON.stringify(game))
    localStorage.setItem('10k_prefs', JSON.stringify({
      sound: false,
      haptics: false,
      shakeToRoll: false,
      handoff: true,
      miniChart: true,
      diceTheme: 'classic',
      defaultDiceMode: 'virtual',
      lastEvent: '',
    }))
  }, activeGame)

  await page.goto('/')
  await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()

  const initialSize = await page.evaluate(() => ({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(initialSize.scrollHeight).toBeLessThanOrEqual(initialSize.innerHeight + 1)
  expect(initialSize.scrollWidth).toBeLessThanOrEqual(initialSize.innerWidth + 1)

  await page.getByRole('button', { name: 'Würfeln', exact: true }).click()
  await expect(page.getByText('Würfel antippen, die zählen')).toBeVisible()
  await page.locator('.da-die').first().click()
  await page.getByRole('button', { name: '100 Punkte sichern' }).click()

  const handoff = page.getByRole('dialog', { name: 'Bert' })
  await expect(handoff).toBeVisible()
  await expect(handoff.getByText('Anna sichert')).toBeVisible()
  await expect(handoff.getByText('+100', { exact: true })).toBeVisible()
  await expect(handoff.getByText('Gesamt 100 Punkte')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Würfeln', exact: true })).toHaveCount(0)

  await handoff.getByRole('button', { name: 'Würfeln starten' }).click()
  await expect(handoff).toBeHidden()
  await expect(page.getByRole('button', { name: 'Würfeln', exact: true })).toBeVisible()

  const finalSize = await page.evaluate(() => ({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(finalSize.scrollHeight).toBeLessThanOrEqual(finalSize.innerHeight + 1)
  expect(finalSize.scrollWidth).toBeLessThanOrEqual(finalSize.innerWidth + 1)
})
`

fs.writeFileSync('e2e/iphone-gameflow.spec.ts', spec)

const configPath = 'playwright.webkit.config.ts'
let config = fs.readFileSync(configPath, 'utf8')
const before = "  testMatch: /production-hardening\\.spec\\.ts/,"
const after = "  testMatch: /(production-hardening|iphone-gameflow)\\.spec\\.ts/,"
if (!config.includes(before)) throw new Error('WebKit testMatch marker fehlt')
config = config.replace(before, after)
fs.writeFileSync(configPath, config)

console.log('Paket O Tests angelegt')
