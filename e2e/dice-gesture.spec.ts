import { expect, test } from '@playwright/test'

for (const count of [1, 2, 6]) {
  test(`drag, cancel, release and select ${count} dice without clipping`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.addInitScript((n) => {
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify({ sound: false, haptics: false, handoff: false }))
      localStorage.setItem('10k_active_game', JSON.stringify({
        sessionId: 'dice-gesture-test',
        players: [{ id: 'anna', name: 'Anna', score: 0, busts: 0 }, { id: 'bert', name: 'Bert', score: 0, busts: 0 }],
        idx: 0, round: 1, phase: 'active', target: 0, event: '', testMode: true,
        diceMode: 'virtual', goalScore: 10000, entryMin: 0,
        kept: Array(6 - n).fill(1), dice: [], accumulated: 0, turns: [],
        rolled: Array(n).fill(1), thrown: Array(n).fill(1), throwSeq: 1,
        savedAt: new Date().toISOString(),
      }))
    }, count)
    await page.goto('/')
    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
    const roll = page.getByRole('button', { name: 'Würfeln', exact: true })
    await expect(page.locator('.da-die')).toHaveCount(count)
    const firstPose = await page.locator('.da-die').first().getAttribute('style')
    await expect.poll(() => page.locator('.da-die').first().getAttribute('style')).not.toBe(firstPose)
    const area = await roll.boundingBox()
    const x = area!.x + area!.width / 2, y = area!.y + area!.height / 2
    const floorBefore = await page.locator('.da-floor').boundingBox()
    const dieBefore = await page.locator('.da-die').first().boundingBox()
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 45, y + 20, { steps: 5 })
    await expect(page.getByText('Loslassen zum Würfeln')).toBeVisible()
    const dieDragged = await page.locator('.da-die').first().boundingBox()
    expect(dieDragged!.x - dieBefore!.x).toBeGreaterThan(20)
    expect(await page.locator('.da-floor').boundingBox()).toEqual(floorBefore)
    // The platform can cancel a touch (e.g. app switch); that must not roll.
    await roll.dispatchEvent('pointercancel', { pointerId: 1 })
    await page.mouse.up()
    await expect(roll).toBeVisible()
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 35, y - 15, { steps: 5 })
    await page.mouse.up()
    await expect(page.locator('.da-die.da-landed')).toHaveCount(count, { timeout: 15000 })
    for (let i = 0; i < count; i++) {
      await page.locator('.da-die').nth(i).click({ force: true })
    }
    await expect(page.locator('.da-die.sel')).toHaveCount(count)
    await expect.poll(async () => page.locator('.da-root').evaluate((root) => {
      const area = root.getBoundingClientRect()
      return Array.from(root.querySelectorAll('.da-die .da-face')).every((face) => {
        const box = face.getBoundingClientRect()
        return box.left >= area.left && box.right <= area.right && box.top >= area.top && box.bottom <= area.bottom
      })
    })).toBe(true)
  })
}
