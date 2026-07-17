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

async function openCleanApp(page: Page) {
  await page.addInitScript((prefs) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem('10k_prefs_v1', JSON.stringify(prefs))
  }, PREFS)
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

async function triggerFourFives(page: Page) {
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: 'Würfel 5 hinzufügen', exact: true }).click()
  }
  await expect(page.getByText('+1.500', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '1.500 Punkte sichern', exact: true }).click()
}

const APPLE_VIEWPORTS = [
  { name: 'compact iPhone', width: 360, height: 780 },
  { name: 'current iPhone', width: 402, height: 874 },
  { name: 'iPad portrait', width: 768, height: 1024 },
]

for (const viewport of APPLE_VIEWPORTS) {
  test(`centers a large saved-score celebration on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openCleanApp(page)
    await startTestGame(page)
    await triggerFourFives(page)

    const overlay = page.getByRole('status', { name: '4ER-PASCH! 1.500 Punkte' })
    const content = page.locator('.celebr-content')
    const score = page.locator('.celebr-score')

    await expect(overlay).toBeVisible()
    await expect(page.locator('.celebr-title')).toHaveText('4ER-PASCH!')
    await expect(page.locator('.celebr-score-value')).toHaveText('1.500')
    await expect(page.locator('.celebr-score-label')).toHaveText('Punkte gesichert')
    await expect(overlay).toHaveCSS('pointer-events', 'auto')

    const layout = await content.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        center: rect.left + rect.width / 2,
        viewportCenter: window.innerWidth / 2,
      }
    })
    const scoreLayout = await score.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, right: rect.right, center: rect.left + rect.width / 2 }
    })

    expect(layout.left).toBeGreaterThanOrEqual(15)
    expect(layout.right).toBeLessThanOrEqual(viewport.width - 15)
    expect(Math.abs(layout.center - layout.viewportCenter)).toBeLessThanOrEqual(1)
    expect(Math.abs(scoreLayout.center - layout.viewportCenter)).toBeLessThanOrEqual(1)
    expect(scoreLayout.left).toBeGreaterThanOrEqual(15)
    expect(scoreLayout.right).toBeLessThanOrEqual(viewport.width - 15)

    await expect(overlay).toBeHidden({ timeout: 3000 })
    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')
  })
}

test('respects reduced motion without leaving a faded ghost state', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCleanApp(page)
  await startTestGame(page)
  await triggerFourFives(page)

  const overlay = page.getByRole('status', { name: '4ER-PASCH! 1.500 Punkte' })
  await expect(overlay).toBeVisible()
  await expect(page.locator('.confetti').first()).toBeHidden()
  await expect(page.locator('.celebr-content')).toHaveCSS('animation-name', 'none')
  await expect(overlay).toBeHidden({ timeout: 3000 })
})
