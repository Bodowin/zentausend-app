import { expect, test } from '@playwright/test'

test('checks a running cloud game only after a family code exists', async ({ page }) => {
  let cloudReads = 0
  await page.route('**/rest/v1/clique_state**', async (route) => {
    cloudReads += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
  })

  await page.goto('/')
  await page.waitForTimeout(700)
  expect(cloudReads).toBe(0)

  await page.evaluate(() => {
    localStorage.setItem('10k_clique_code', 'E2E-FAMILY-CODE')
    window.dispatchEvent(new Event('10k-clique-code-changed'))
  })
  await expect.poll(() => cloudReads).toBeGreaterThan(0)
})
