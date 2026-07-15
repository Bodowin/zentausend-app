import { expect, test } from '@playwright/test'

test('shows a clear warning when device storage cannot be written', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === '10k_health_probe') throw new DOMException('quota reached', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })

  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Gerätespeicher nicht verfügbar')
  await expect(page.getByRole('button', { name: 'Erneut prüfen' })).toBeVisible()
})

test('remains usable in an iPhone-sized offline session', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_clique_code', 'FAMILIE-10000-26')
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
  })

  await page.goto('/')
  await expect(page.getByText('10.000', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await expect(page.getByRole('heading', { name: 'Familien-Code & Geräte' })).toBeVisible()
  await expect(page.getByPlaceholder('Familien-Code eingeben…')).toHaveValue('FAMILIE-10000-26')

  const viewport = page.viewportSize()
  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(viewport).not.toBeNull()
  expect(bodyWidth).toBeLessThanOrEqual(viewport!.width)
})
