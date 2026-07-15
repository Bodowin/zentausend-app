import { expect, test } from '@playwright/test'

test('guides a parent through sharing and preparing a family device', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (payload: ShareData) => {
        localStorage.setItem('10k_test_last_share', JSON.stringify(payload))
      },
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await expect(page.getByRole('heading', { name: 'Familien-Code & Geräte' })).toBeVisible()

  const codeInput = page.getByPlaceholder('Familien-Code eingeben…')
  await codeInput.fill('FAMILIE-10000-26')
  await page.getByRole('button', { name: 'Code teilen' }).click()

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('10k_test_last_share') || ''))
    .toContain('FAMILIE-10000-26')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('10k_test_last_share') || ''))
    .not.toContain('Admin-Code')

  await page.getByRole('button', { name: 'Code prüfen & Daten laden' }).click()
  await expect(page.getByText('Keine Internetverbindung', { exact: true })).toBeVisible()
  await expect(page.getByText(/Der Familien-Code ist auf diesem Gerät gespeichert/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('10k_clique_code'))).toBe('FAMILIE-10000-26')
})
