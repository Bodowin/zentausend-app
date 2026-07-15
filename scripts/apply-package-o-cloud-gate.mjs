import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`Marker fehlt: ${label}`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Marker mehrfach gefunden: ${label}`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

let app = fs.readFileSync('src/App.tsx', 'utf8')
app = replaceOnce(
  app,
  `import { getPrefs } from './lib/prefs'\n`,
  `import { getPrefs } from './lib/prefs'\nimport { hasCliqueCode } from './lib/cliqueCode'\n`,
  'Clique-Code-Import',
)

app = replaceOnce(
  app,
  `  useEffect(() => {\n    let cancelled = false\n    void inspectActiveGameCloud(initialResume.current).then((prompt) => {\n      if (!cancelled && prompt && dismissedCloudVersion.current !== prompt.snapshot.version) {\n        setCloudPrompt(prompt)\n      }\n    })\n    return () => {\n      cancelled = true\n    }\n  }, [])`,
  `  useEffect(() => {\n    let cancelled = false\n\n    const inspectCloudGame = () => {\n      if (!hasCliqueCode()) {\n        setCloudPrompt(null)\n        return\n      }\n      void inspectActiveGameCloud(initialResume.current).then((prompt) => {\n        if (!cancelled && prompt && dismissedCloudVersion.current !== prompt.snapshot.version) {\n          setCloudPrompt(prompt)\n        }\n      })\n    }\n\n    inspectCloudGame()\n    window.addEventListener('10k-clique-code-changed', inspectCloudGame)\n    return () => {\n      cancelled = true\n      window.removeEventListener('10k-clique-code-changed', inspectCloudGame)\n    }\n  }, [])`,
  'Cloud-Inspektion nur mit Familien-Code',
)

app = replaceOnce(
  app,
  `    saveActiveGame(snapshot)\n\n    const timer = window.setTimeout(() => {`,
  `    saveActiveGame(snapshot)\n    if (!hasCliqueCode()) return\n\n    const timer = window.setTimeout(() => {`,
  'Cloud-Autosave nur mit Familien-Code',
)
fs.writeFileSync('src/App.tsx', app)

let code = fs.readFileSync('src/lib/cliqueCode.ts', 'utf8')
code = replaceOnce(
  code,
  `export function setCliqueCode(code: string): void {\n  try {\n    localStorage.setItem(KEY, code.trim())\n  } catch {\n    /* ignore */\n  }\n}`,
  `export function setCliqueCode(code: string): void {\n  try {\n    localStorage.setItem(KEY, code.trim())\n  } catch {\n    /* ignore */\n  }\n  if (typeof window !== 'undefined') window.dispatchEvent(new Event('10k-clique-code-changed'))\n}`,
  'Code-Aenderungsereignis',
)
fs.writeFileSync('src/lib/cliqueCode.ts', code)

const spec = `import { expect, test } from '@playwright/test'\n\ntest('checks a running cloud game only after a family code exists', async ({ page }) => {\n  let cloudReads = 0\n  await page.route('**/rest/v1/clique_state**', async (route) => {\n    cloudReads += 1\n    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })\n  })\n  await page.addInitScript(() => {\n    localStorage.clear()\n    localStorage.setItem('10k_seen_intro', '1')\n    localStorage.setItem('10k_code_dismissed', '1')\n  })\n\n  await page.goto('/')\n  await page.waitForTimeout(700)\n  expect(cloudReads).toBe(0)\n\n  await page.evaluate(() => {\n    localStorage.setItem('10k_clique_code', 'E2E-FAMILY-CODE')\n    window.dispatchEvent(new Event('10k-clique-code-changed'))\n  })\n  await expect.poll(() => cloudReads).toBeGreaterThan(0)\n})\n`
fs.writeFileSync('e2e/cloud-code-gate.spec.ts', spec)
console.log('Cloud-Code-Gate angewendet')
