import { expect, test } from '@playwright/test'

const VIEWPORTS = [
  { name: 'Android compact', width: 360, height: 640 },
  { name: 'iPhone compact', width: 375, height: 667 },
  { name: 'iPhone standard', width: 390, height: 844 },
  { name: 'iPhone Pro', width: 393, height: 852 },
  { name: 'Android standard', width: 412, height: 915 },
  { name: 'iPhone Max', width: 430, height: 932 },
]

for (const device of VIEWPORTS) {
  test(`setup fits without scrolling on ${device.name} ${device.width}x${device.height}`, async ({ page }) => {
    await page.setViewportSize({ width: device.width, height: device.height })
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify({
        sound: false,
        haptics: false,
        shakeToRoll: false,
        handoff: true,
        miniChart: true,
        diceTheme: 'classic',
        defaultDiceMode: 'virtual',
        lastEvent: '',
      }))
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Gabi', exact: true }).click()
    await page.getByRole('button', { name: 'Mabi', exact: true }).click()

    const start = page.getByRole('button', { name: 'Spiel starten · 2 Spieler' })
    await expect(start).toBeVisible()

    const metrics = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="setup-scroll-area"]') as HTMLElement | null
      const actions = document.querySelector('[data-testid="setup-actions"]') as HTMLElement | null
      const startButton = Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Spiel starten · 2 Spieler'),
      ) as HTMLElement | undefined
      const actionRect = actions?.getBoundingClientRect()
      const startRect = startButton?.getBoundingClientRect()
      return {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        scrollerHeight: scroller?.clientHeight ?? -1,
        scrollerContentHeight: scroller?.scrollHeight ?? -1,
        actionTop: actionRect?.top ?? -1,
        actionBottom: actionRect?.bottom ?? -1,
        startTop: startRect?.top ?? -1,
        startBottom: startRect?.bottom ?? -1,
      }
    })

    expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.innerHeight + 1)
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.innerWidth + 1)
    expect(metrics.scrollerContentHeight).toBeLessThanOrEqual(metrics.scrollerHeight + 1)
    expect(metrics.actionTop).toBeGreaterThanOrEqual(0)
    expect(metrics.actionBottom).toBeLessThanOrEqual(metrics.innerHeight + 1)
    expect(metrics.startTop).toBeGreaterThanOrEqual(0)
    expect(metrics.startBottom).toBeLessThanOrEqual(metrics.innerHeight + 1)
  })
}
