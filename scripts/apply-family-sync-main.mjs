import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function update(path, transform) {
  const source = fs.readFileSync(path, 'utf8')
  const next = transform(source)
  if (next === source) throw new Error(`${path}: patch made no changes`)
  fs.writeFileSync(path, next)
}

update('src/lib/prefs.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  /** Aufprall-/Tipp-Sounds im virtuellen Würfelmodus. */\n  sound: boolean\n  /** Optik der virtuellen Würfel. */`,
    `  /** Aufprall-/Tipp-Sounds im virtuellen Würfelmodus. */\n  sound: boolean\n  /** Dezentes Vibrationsfeedback bei Spielaktionen; pro Gerät abschaltbar. */\n  haptics: boolean\n  /** Optik der virtuellen Würfel. */`,
    'haptics preference type',
  )
  source = replaceOnce(
    source,
    `const DEFAULTS: Prefs = {\n  sound: true,\n  diceTheme: 'classic',`,
    `const DEFAULTS: Prefs = {\n  sound: true,\n  haptics: false,\n  diceTheme: 'classic',`,
    'haptics preference default',
  )
  return source
})

update('src/lib/haptics.ts', () => `import { getPrefs } from './prefs'\n\n/** Dezentes haptisches Feedback (HTML5 Vibration API), wo verfügbar und aktiviert. */\nexport function buzz(pattern: number | number[] = 8): void {\n  try {\n    if (!getPrefs().haptics) return\n    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {\n      navigator.vibrate(pattern)\n    }\n  } catch {\n    /* nicht unterstützt – ignorieren */\n  }\n}\n`)

update('src/components/SettingsModal.tsx', (input) =>
  replaceOnce(
    input,
    `          </button>\n\n          {/* „X ist dran"-Übergabe */}`,
    `          </button>\n\n          <button\n            type="button"\n            role="switch"\n            aria-label="Haptisches Feedback"\n            aria-checked={prefs.haptics}\n            onClick={() => updatePrefs({ haptics: !prefs.haptics })}\n            className="mt-4 flex w-full items-center justify-between"\n          >\n            <span className="flex flex-col text-left">\n              <span className="text-sm font-bold text-fog-200">Haptisches Feedback</span>\n              <span className="text-[11px] text-fog-500">Kurzes Vibrieren bei Spielaktionen · Standard aus</span>\n            </span>\n            <span className={\`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.haptics ? 'bg-mint-500' : 'bg-ink-600'}\`}>\n              <span className={\`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${prefs.haptics ? 'left-[26px]' : 'left-1'}\`} />\n            </span>\n          </button>\n\n          {/* „X ist dran"-Übergabe */}`,
    'haptics settings toggle',
  ),
)

update('src/lib/cloud.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  identityConflicts: number\n  codeDenied: boolean\n}`,
    `  identityConflicts: number\n  codeDenied: boolean\n  /** Anzahl bestätigter Spiele in der Cloud; null, wenn nicht verlässlich abrufbar. */\n  cloudCount: number | null\n}`,
    'sync result cloud count',
  )
  source = replaceOnce(
    source,
    `      identityConflicts: 0,\n      codeDenied: false,\n    }`,
    `      identityConflicts: 0,\n      codeDenied: false,\n      cloudCount: null,\n    }`,
    'offline cloud count',
  )
  source = replaceOnce(
    source,
    `      identityConflicts: identity.conflicts,\n      codeDenied: identity.denied,\n    }`,
    `      identityConflicts: identity.conflicts,\n      codeDenied: identity.denied,\n      cloudCount: null,\n    }`,
    'failed fetch cloud count',
  )
  source = replaceOnce(
    source,
    `    identityConflicts: identity.conflicts,\n    codeDenied: identity.denied,\n  }`,
    `    identityConflicts: identity.conflicts,\n    codeDenied: identity.denied,\n    cloudCount: cloud.length,\n  }`,
    'successful cloud count',
  )
  return source
})

update('src/components/StatsScreen.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  const [codeDenied, setCodeDenied] = useState(false)\n  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())`,
    `  const [codeDenied, setCodeDenied] = useState(false)\n  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())\n  const [cloudCount, setCloudCount] = useState<number | null>(null)`,
    'cloud count state',
  )
  const syncMarker = `      setPendingSync(res.pending)\n      setCodeDenied(res.codeDenied)`
  const syncReplacement = `      setPendingSync(res.pending)\n      setCloudCount(res.cloudCount)\n      setCodeDenied(res.codeDenied)`
  const syncCount = source.split(syncMarker).length - 1
  if (syncCount !== 2) throw new Error(`sync result wiring: expected 2 matches, found ${syncCount}`)
  source = source.replaceAll(syncMarker, syncReplacement)
  source = replaceOnce(
    source,
    `      {/* Sync-Status */}\n      <div className="mb-4 flex items-center gap-2 text-[11px]">\n        <span\n          className={\`inline-block h-2 w-2 rounded-full ${\n            loading\n              ? 'animate-pulse bg-gold-500'\n              : pendingSync > 0\n                ? 'bg-gold-500'\n                : online\n                  ? 'bg-mint-400'\n                  : 'bg-fog-600'\n          }\`}\n        />\n        <span className="text-fog-500">\n          {loading\n            ? 'Synchronisiere mit der Cloud…'\n            : codeDenied\n              ? 'Clique-Code ungültig – in Einstellungen erneuern'\n              : pendingSync > 0\n              ? \`${'${pendingSync}'} ${'${pendingSync === 1 ? \'Änderung wartet\' : \'Änderungen warten\'}'} auf Cloud\`\n              : online\n                ? 'Mit Cloud synchronisiert · auf allen Geräten gleich'\n                : cloudEnabled\n                  ? 'Offline – nur dieses Gerät'\n                  : 'Lokal – nur dieses Gerät'}\n        </span>\n      </div>`,
    `      {/* Familienfreundlicher Sicherungsstatus mit explizitem manuellen Abgleich. */}\n      <div\n        className={\`mb-4 rounded-2xl border p-3 ${\n          codeDenied\n            ? 'border-coral-500/40 bg-coral-500/10'\n            : pendingSync > 0\n              ? 'border-gold-500/40 bg-gold-500/10'\n              : online\n                ? 'border-mint-500/30 bg-mint-500/10'\n                : 'border-ink-700 bg-ink-900/40'\n        }\`}\n        aria-live="polite"\n      >\n        <div className="flex items-start justify-between gap-3">\n          <div className="min-w-0 flex-1">\n            <div className="flex items-center gap-2">\n              <span\n                className={\`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${\n                  loading\n                    ? 'animate-pulse bg-gold-500'\n                    : codeDenied\n                      ? 'bg-coral-400'\n                      : pendingSync > 0\n                        ? 'bg-gold-500'\n                        : online\n                          ? 'bg-mint-400'\n                          : 'bg-fog-600'\n                }\`}\n              />\n              <span className="font-bold text-fog-100">\n                {loading\n                  ? 'Sicherung läuft…'\n                  : codeDenied\n                    ? 'Crew-Code prüfen'\n                    : pendingSync > 0\n                      ? 'Noch nicht alles gesichert'\n                      : online\n                        ? 'Alles gesichert'\n                        : cloudEnabled\n                          ? 'Gerade offline'\n                          : 'Nur auf diesem Gerät'}\n              </span>\n            </div>\n            <div className="mt-1 text-[11px] text-fog-400">\n              {games.length} ${'${games.length === 1 ? \'Spiel\' : \'Spiele\'}'} auf diesem Gerät\n              {cloudCount !== null && <> · {cloudCount} in der Cloud</>}\n            </div>\n            <div className="mt-1 text-[11px] leading-relaxed text-fog-500">\n              {loading\n                ? 'Lokale und gemeinsame Spielstände werden abgeglichen.'\n                : codeDenied\n                  ? 'Der gespeicherte Crew-Code stimmt nicht. Deine lokalen Spiele bleiben erhalten.'\n                  : pendingSync > 0\n                    ? \`${'${pendingSync}'} ${'${pendingSync === 1 ? \'Änderung ist\' : \'Änderungen sind\'}'} noch nur auf diesem Gerät.\`\n                    : online\n                      ? 'Eure Spielstände sind auf allen Geräten gleich.'\n                      : cloudEnabled\n                        ? 'Sobald wieder Internet da ist, kannst du erneut sichern.'\n                        : 'Cloud-Sicherung ist auf diesem Gerät nicht eingerichtet.'}\n            </div>\n          </div>\n          <button\n            type="button"\n            onClick={() => void reload()}\n            disabled={loading}\n            aria-label="Jetzt sichern"\n            className="shrink-0 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-bold text-fog-200 transition-colors disabled:opacity-50"\n          >\n            {loading ? 'Läuft…' : 'Jetzt sichern'}\n          </button>\n        </div>\n        {codeDenied && (\n          <button\n            type="button"\n            onClick={() => setShowSettings(true)}\n            className="mt-3 w-full rounded-xl bg-coral-500/20 px-3 py-2 text-xs font-bold text-coral-300"\n          >\n            Crew-Code ändern\n          </button>\n        )}\n      </div>`,
    'family sync card',
  )
  return source
})

update('e2e/app.spec.ts', (input) => {
  let source = replaceOnce(
    input,
    `  sound: false,\n  diceTheme: 'classic',`,
    `  sound: false,\n  haptics: false,\n  diceTheme: 'classic',`,
    'e2e haptics preference',
  )
  source = replaceOnce(
    source,
    `  test('keeps the stable player id when a roster member is renamed', async ({ page }) => {`,
    `  test('stores haptic feedback as an optional device setting', async ({ page }) => {\n    await openCleanApp(page)\n    await page.getByRole('button', { name: 'Einstellungen' }).click()\n\n    const haptics = page.getByRole('switch', { name: 'Haptisches Feedback' })\n    await expect(haptics).toHaveAttribute('aria-checked', 'false')\n    await haptics.click()\n    await expect(haptics).toHaveAttribute('aria-checked', 'true')\n    await page.getByRole('button', { name: 'Speichern', exact: true }).click()\n    await expect(page.getByRole('button', { name: 'Einstellungen' })).toBeVisible()\n\n    await page.reload()\n    await page.getByRole('button', { name: 'Einstellungen' }).click()\n    await expect(page.getByRole('switch', { name: 'Haptisches Feedback' })).toHaveAttribute('aria-checked', 'true')\n  })\n\n  test('keeps the stable player id when a roster member is renamed', async ({ page }) => {`,
    'haptics browser test',
  )
  return source
})

update('e2e/player-identity-cloud.spec.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  let patchBody: { version?: number; payload?: unknown } | null = null\n  await seedCloudPage(page, localState)`,
    `  let patchBody: { version?: number; payload?: unknown } | null = null\n  let gameReads = 0\n  await seedCloudPage(page, localState)`,
    'count cloud reads',
  )
  source = replaceOnce(
    source,
    `    if (url.pathname.endsWith('/rpc/check_clique_code')) return json(route, true)\n    if (url.pathname.endsWith('/games')) return json(route, [])`,
    `    if (url.pathname.endsWith('/rpc/check_clique_code')) return json(route, true)\n    if (url.pathname.endsWith('/games')) {\n      gameReads += 1\n      return json(route, [])\n    }`,
    'track games route',
  )
  source = replaceOnce(
    source,
    `  await page.getByRole('button', { name: /Statistik/ }).click()\n  await expect(page.getByText('Mit Cloud synchronisiert · auf allen Geräten gleich')).toBeVisible()\n\n  expect(patchBody).toEqual({ version: 2, payload: localState })`,
    `  await page.getByRole('button', { name: /Statistik/ }).click()\n  await expect(page.getByText('Alles gesichert', { exact: true })).toBeVisible()\n  await expect(page.getByText('0 Spiele auf diesem Gerät · 0 in der Cloud', { exact: true })).toBeVisible()\n\n  const readsAfterOpen = gameReads\n  await page.getByRole('button', { name: 'Jetzt sichern' }).click()\n  await expect.poll(() => gameReads).toBeGreaterThan(readsAfterOpen)\n\n  expect(patchBody).toEqual({ version: 2, payload: localState })`,
    'family sync browser expectations',
  )
  source = replaceOnce(
    source,
    `  await page.goto('/')\n  await page.getByRole('button', { name: /Statistik/ }).click()\n  await expect(page.getByText('Clique-Code ungültig – in Einstellungen erneuern')).toBeVisible()`,
    `  await page.goto('/')\n  await page.getByRole('button', { name: /Statistik/ }).click()\n  await expect(page.getByText('Crew-Code prüfen', { exact: true })).toBeVisible()\n  await expect(page.getByRole('button', { name: 'Crew-Code ändern' })).toBeVisible()`,
    'invalid code browser expectations',
  )
  return source
})

fs.writeFileSync(
  'src/familySyncWiring.test.ts',
  `import { describe, expect, it } from 'vitest'\nimport cloudSource from './lib/cloud.ts?raw'\nimport statsSource from './components/StatsScreen.tsx?raw'\nimport prefsSource from './lib/prefs.ts?raw'\nimport hapticsSource from './lib/haptics.ts?raw'\n\ndescribe('family-friendly sync and haptics wiring', () => {\n  it('reports confirmed cloud counts', () => {\n    expect(cloudSource).toContain('cloudCount: number | null')\n    expect(cloudSource).toContain('cloudCount: cloud.length')\n  })\n\n  it('offers an explicit save action and plain-language status', () => {\n    expect(statsSource).toContain('Alles gesichert')\n    expect(statsSource).toContain('Jetzt sichern')\n    expect(statsSource).toContain('Crew-Code prüfen')\n  })\n\n  it('keeps haptics optional and disabled by default', () => {\n    expect(prefsSource).toContain('haptics: false')\n    expect(hapticsSource).toContain("if (!getPrefs().haptics) return")\n  })\n})\n`,
)

fs.writeFileSync(
  'docs/package-h-family-sync.md',
  `# Paket H – Familienfreundliche Sicherung\n\n## Ziel\n\nDer Cloud-Status verwendet Alltagssprache statt technischer Sync-Begriffe. Familienmitglieder können die Sicherung bewusst mit einem einzigen Knopf prüfen.\n\n## Verhalten\n\n- **Alles gesichert:** Keine lokale Änderung wartet; Geräte- und Cloud-Anzahl sind sichtbar.\n- **Noch nicht alles gesichert:** Lokale Änderungen bleiben erhalten und werden gezählt.\n- **Crew-Code prüfen:** Der Code ist falsch oder wurde rotiert; lokale Spiele werden nicht gelöscht.\n- **Gerade offline:** Die Statistik bleibt offline lesbar und kann später erneut gesichert werden.\n- **Jetzt sichern:** Startet jederzeit einen vollständigen Abgleich.\n\n## Haptik\n\nHaptisches Feedback ist eine lokale Geräteeinstellung, standardmäßig ausgeschaltet und jederzeit in den Einstellungen änderbar. Es gibt keine wiederkehrende Nachfrage.\n\n## Abnahme\n\nUnit-Tests, Production-Build und mobile Chromium-Journeys prüfen Statusanzeige, manuellen Abgleich, ungültigen Code sowie persistente Haptik-Einstellung.\n`,
)

fs.writeFileSync(
  'docs/roadmap-natural-dice.md',
  `# Longlist – natürlicher virtueller Würfelwurf\n\n## Ausgangspunkt\n\nDie App verwendet bereits cannon-es für einen unsichtbaren, festen Physik-Pre-Roll und spielt die aufgezeichnete Bahn anschließend mit CSS-3D ab. Die Augenzahlen werden vor dem ersten sichtbaren Frame passend zur natürlichen Endlage beschriftet; dadurch gibt es kein sichtbares Umspringen und kein WebGL-Risiko.\n\n## Nächster Qualitätsausbau\n\n1. **Seedbarer Wurf:** Ein Seed aus Spiel-ID und Wurfsequenz erzeugt bei Reload dieselbe Bahn und dasselbe Ergebnis.\n2. **Gemeinsame Handbewegung:** Würfel starten als korrelierte Traube mit leicht versetzten Freigabezeitpunkten statt als unabhängige Zufallsobjekte.\n3. **Natürlichere Streuung:** Vorwärtsimpuls, seitliche Streuung und Drehachsen folgen begrenzten Verteilungen; extreme Raketenwürfe werden ausgeschlossen.\n4. **Rundere Schale:** Mehr Randsegmente und feinere Neigung reduzieren sichtbare achteckige Abpraller.\n5. **Material-Tuning:** Reibung und Rückprall werden anhand aufgezeichneter Kennzahlen kalibriert: erster Aufprall, Anzahl Abpraller, Rollzeit und Restbewegung.\n6. **Robustes Ausrollen:** cannon-es-Sleep-Zustand plus Grenzwerte für lineare und Winkelgeschwindigkeit bestimmen das Ende; gestapelte oder gekippte Würfel werden unsichtbar neu simuliert.\n7. **Leistungsbudget:** Maximaldauer und Simulationsversuche bleiben gedeckelt; reduzierte Bewegung und schwächere Geräte erhalten eine kürzere Variante.\n8. **Fairness unverändert:** Das Ergebnis bleibt gleichverteilt und reload-sicher. Die Physik gestaltet die sichtbare Bewegung, nicht die Gewinnchance.\n\n## Akzeptanzkriterien\n\n- Kein sichtbarer Endsprung oder Slerp-Zwang.\n- Gleicher gespeicherter Wurf nach Reload.\n- Stabile Ausführung auf iPhone Safari ohne WebGL.\n- 1 bis 6 Würfel kollidieren sichtbar miteinander und mit der Schale.\n- Median der Animation ungefähr 1,4–2,2 Sekunden; harter Timeout als Fallback.\n- Automatischer statistischer Test für gleichmäßige Werteverteilung.\n- Haptik bleibt vollständig optional und unabhängig von der Animation.\n\n## Technische Quellen\n\n- cannon-es Body: https://pmndrs.github.io/cannon-es/docs/classes/Body.html\n- cannon-es ContactMaterial: https://pmndrs.github.io/cannon-es/docs/classes/ContactMaterial.html\n- MDN Navigator.vibrate(): https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate\n`,
)

console.log('Family sync, optional haptics and natural-dice roadmap applied.')
