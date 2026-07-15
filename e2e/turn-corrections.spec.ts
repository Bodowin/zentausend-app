import { expect, test } from '@playwright/test'

async function openCleanApp(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('10k_seen_intro', '1')
    localStorage.setItem('10k_code_dismissed', '1')
    localStorage.setItem(
      '10k_prefs_v1',
      JSON.stringify({
        sound: false,
        haptics: false,
        shakeToRoll: false,
        handoff: false,
        miniChart: false,
        diceTheme: 'classic',
        defaultDiceMode: 'real',
        lastEvent: '',
      }),
    )
  })
  await page.goto('/')
}

async function addDie(page: import('@playwright/test').Page, value: number) {
  await page.getByRole('button', { name: `Würfel ${value} hinzufügen`, exact: true }).click()
}

test('corrects an earlier turn, persists the replay and can undo the correction', async ({ page }) => {
  await openCleanApp(page)
  await page.getByRole('button', { name: 'Gabi', exact: true }).click()
  await page.getByRole('button', { name: 'Mabi', exact: true }).click()
  await page.getByRole('button', { name: /Optionen/ }).click()
  await page.getByRole('button', { name: 'Aus', exact: true }).click()
  await page.getByRole('switch', { name: /Testspiel/ }).click()
  await page.getByRole('button', { name: 'Testspiel starten · 2 Spieler' }).click()

  await addDie(page, 1)
  await page.getByRole('button', { name: '100 Punkte sichern' }).click()
  await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')

  await addDie(page, 5)
  await page.getByRole('button', { name: '50 Punkte sichern' }).click()
  await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')

  await page.getByRole('button', { name: 'Rundenprotokoll öffnen' }).click()
  const log = page.getByRole('dialog', { name: 'Rundenprotokoll' })
  await expect(log).toBeVisible()
  await log.getByRole('button', { name: 'Gabi Zug korrigieren' }).click()
  await log.getByLabel('Punkte für Gabi').fill('500')
  await log.getByRole('button', { name: 'Korrektur speichern' }).click()
  await expect(log.getByText('Korrektur gespeichert')).toBeVisible()
  await log.getByRole('button', { name: 'Schließen', exact: true }).click()

  await expect(page.locator('[aria-label^="Gabi:"]')).toContainText('500')
  await expect(page.locator('[aria-label^="Mabi:"]')).toContainText('50')
  await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')

  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = JSON.parse(localStorage.getItem('10k_active_game') || '{}') as {
          players?: { name: string; score: number }[]
        }
        return active.players?.find((player) => player.name === 'Gabi')?.score
      }),
    )
    .toBe(500)

  await page.reload()
  await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
  await expect(page.locator('[aria-label^="Gabi:"]')).toContainText('500')
  await expect(page.locator('[aria-label^="Mabi:"]')).toContainText('50')

  await page.getByRole('button', { name: 'Rundenprotokoll öffnen' }).click()
  const restoredLog = page.getByRole('dialog', { name: 'Rundenprotokoll' })
  await restoredLog.getByRole('button', { name: 'Mabi Zug korrigieren' }).click()
  await restoredLog.getByRole('button', { name: 'Niete', exact: true }).click()
  await restoredLog.getByRole('button', { name: 'Korrektur speichern' }).click()
  await restoredLog.getByRole('button', { name: 'Schließen', exact: true }).click()

  await expect(page.locator('[aria-label^="Mabi:"]')).toHaveAttribute('aria-label', /Mabi: 0 Punkte, 1 Nieten/)
  await page.getByRole('button', { name: 'Letzte Aktion rückgängig' }).click()
  await expect(page.locator('[aria-label^="Mabi:"]')).toHaveAttribute('aria-label', /Mabi: 50 Punkte, 0 Nieten/)
})
