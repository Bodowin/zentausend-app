from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def replace_regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one regex match, found {count}: {pattern}")
    write(path, updated)


# ---------------------------------------------------------------------------
# 1) Responsive game header: every action remains visible at 320–430 px.
# ---------------------------------------------------------------------------
header = '''      {/* Kopfzeile */}
      <header
        className={`grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b px-2 pt-[max(env(safe-area-inset-top),0.5rem)] transition-colors min-[360px]:px-3 sm:px-4 ${
          virtual ? 'pb-1.5' : 'pb-2.5'
        } ${lastChance ? 'border-coral-500/30 bg-coral-500/10' : 'border-ink-800 bg-ink-900/80'}`}
      >
        <div className="flex min-w-0 items-center gap-1.5 min-[360px]:gap-2 min-[430px]:gap-3">
          <button
            onClick={p.onExit}
            className="shrink-0 font-display text-xl font-black tracking-tighter text-gold-500 transition-opacity hover:opacity-80 min-[360px]:text-2xl"
            aria-label="Pausieren und zum Startbildschirm"
          >
            <span className="min-[360px]:hidden">10k</span>
            <span className="hidden min-[360px]:inline">10.000</span>
          </button>
          <div className="h-6 w-px shrink-0 bg-ink-700" />
          <div data-testid="game-header-info" className="flex min-w-0 flex-col leading-tight">
            {lastChance ? (
              <span className="truncate text-xs font-bold uppercase tracking-wider text-coral-400">Letzte Chance!</span>
            ) : (
              <span className="truncate text-xs font-bold uppercase tracking-wider text-fog-400">Runde {round}</span>
            )}
            <span className="block max-w-full truncate text-[10px] text-fog-600">
              Ziel {fmt(effectiveTarget)}
              {event ? ` · ${event}` : ''}
              {testMode ? ' · TEST' : ''}
            </span>
          </div>
        </div>
        <div
          data-testid="game-header-actions"
          className="grid shrink-0 grid-cols-4 items-stretch gap-0 min-[430px]:gap-1.5"
        >
          <button
            onClick={p.onToggleDiceMode}
            disabled={dice.length > 0 || (diceMode === 'virtual' && bowlPhase !== 'ready')}
            className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-lg px-0 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200 disabled:opacity-30 min-[430px]:w-auto min-[430px]:px-2"
            aria-label="Würfel-Modus wechseln"
          >
            <span className="text-base leading-none">{diceMode === 'virtual' ? '🎲' : '🎯'}</span>
            <span className="hidden text-[8px] font-bold uppercase tracking-wide min-[430px]:block">
              {diceMode === 'virtual' ? 'Virtuell' : 'Echt'}
            </span>
          </button>
          <button
            onClick={() => setShowTurnLog(true)}
            className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-lg px-0 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200 min-[430px]:w-auto min-[430px]:px-2"
            aria-label="Rundenprotokoll öffnen"
          >
            <span className="text-sm leading-none">▤</span>
            <span className="hidden text-[8px] font-bold uppercase tracking-wide min-[430px]:block">Verlauf</span>
          </button>
          <button
            onClick={p.onUndo}
            disabled={!canUndo}
            className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-lg px-0 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200 disabled:opacity-30 min-[430px]:w-auto min-[430px]:px-2"
            aria-label="Letzte Aktion rückgängig"
          >
            <IconUndo className="h-4 w-4" />
            <span className="hidden text-[8px] font-bold uppercase tracking-wide min-[430px]:block">Zurück</span>
          </button>
          <button
            onClick={p.onExit}
            className="flex h-11 w-10 flex-col items-center justify-center gap-0.5 rounded-lg px-0 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200 min-[430px]:w-auto min-[430px]:px-2"
            aria-label="Spiel pausieren"
          >
            <IconPause className="h-4 w-4" />
            <span className="hidden text-[8px] font-bold uppercase tracking-wide min-[430px]:block">Pause</span>
          </button>
        </div>
      </header>'''

replace_regex_once(
    "src/components/GameScreen.tsx",
    r"      \{/\* Kopfzeile \*/\}\n      <header.*?\n      </header>",
    header,
)

replace_once(
    "src/components/GameScreen.tsx",
    '<td className="px-2.5 py-1.5 text-[9px] uppercase text-fog-500">Σ</td>',
    '<td className="px-2.5 py-1.5 text-[9px] uppercase text-fog-500">Endstand</td>',
)

# ---------------------------------------------------------------------------
# 2) Dice selection: never call App's callback from a child state updater.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/DiceArena.tsx",
    "  const [sel, setSel] = useState<boolean[]>([])\n",
    "  const [sel, setSel] = useState<boolean[]>([])\n"
    "  // Synchronous mirror: rapid taps derive from the latest selection without\n"
    "  // invoking the parent callback from inside React's state updater.\n"
    "  const selRef = useRef<boolean[]>([])\n",
)

replace_once(
    "src/components/DiceArena.tsx",
    "    setSel(new Array(n).fill(false))\n",
    "    const emptySelection = new Array<boolean>(n).fill(false)\n"
    "    selRef.current = emptySelection\n"
    "    setSel(emptySelection)\n",
)

old_toggle = '''    setSel((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      const vals = values.map((v) => clamp(Math.round(v), 1, 6))
      const selected: number[] = []
      const remaining: number[] = []
      for (let j = 0; j < vals.length; j++) (next[j] ? selected : remaining).push(vals[j])
      onSelRef.current?.(selected, remaining)
      return next
    })'''
new_toggle = '''    const next = [...selRef.current]
    while (next.length < values.length) next.push(false)
    next[i] = !next[i]
    selRef.current = next
    setSel(next)

    const vals = values.map((v) => clamp(Math.round(v), 1, 6))
    const selected: number[] = []
    const remaining: number[] = []
    for (let j = 0; j < vals.length; j++) (next[j] ? selected : remaining).push(vals[j])
    onSelRef.current?.(selected, remaining)'''
replace_once("src/components/DiceArena.tsx", old_toggle, new_toggle)

# ---------------------------------------------------------------------------
# 3) Cloud: identity and game fetch start together, plus truthful loading copy.
# ---------------------------------------------------------------------------
cloud_helper = '''type IdentitySyncResult = Awaited<ReturnType<typeof syncPlayerIdentityState>>
type CloudGamesResult = Awaited<ReturnType<typeof fetchCloudGames>>

/**
 * Starts the two independent cloud reads together. Dependency injection keeps
 * the concurrency guarantee directly testable without a network connection.
 */
export async function syncCloudPrerequisites(
  identityTask: () => Promise<IdentitySyncResult> = syncPlayerIdentityState,
  gamesTask: () => Promise<CloudGamesResult> = fetchCloudGames,
): Promise<{ identity: IdentitySyncResult; fetched: CloudGamesResult }> {
  const [identity, fetched] = await Promise.all([identityTask(), gamesTask()])
  return { identity, fetched }
}

'''
replace_once(
    "src/lib/cloud.ts",
    "export interface SyncResult {\n",
    cloud_helper + "export interface SyncResult {\n",
)
replace_once(
    "src/lib/cloud.ts",
    "  const identity = await syncPlayerIdentityState()\n  const fetched = await fetchCloudGames()\n",
    "  const { identity, fetched } = await syncCloudPrerequisites()\n",
)

replace_once(
    "src/components/StatsScreen.tsx",
    "const fmt = (n: number) => n.toLocaleString('de-DE')\n",
    "const fmt = (n: number) => n.toLocaleString('de-DE')\n"
    "const shouldProbeCloud = () =>\n"
    "  cloudEnabled && (typeof navigator === 'undefined' || navigator.onLine !== false)\n",
)
replace_once(
    "src/components/StatsScreen.tsx",
    "  const [loading, setLoading] = useState(true)\n",
    "  const [loading, setLoading] = useState(shouldProbeCloud)\n",
)

stats = read("src/components/StatsScreen.tsx")
loading_count = stats.count("    setLoading(true)\n")
if loading_count != 2:
    raise RuntimeError(f"src/components/StatsScreen.tsx: expected 2 setLoading(true) calls, found {loading_count}")
stats = stats.replace("    setLoading(true)\n", "    setLoading(shouldProbeCloud())\n")
write("src/components/StatsScreen.tsx", stats)

replace_once(
    "src/components/StatsScreen.tsx",
    "? 'Sicherung läuft…'",
    "? 'Cloud wird geprüft…'",
)
replace_once(
    "src/components/StatsScreen.tsx",
    "? 'Lokale und gemeinsame Spielstände werden abgeglichen.'",
    "? 'Deine lokalen Spiele sind bereits verfügbar. Cloud und Spieler-Zuordnungen werden abgeglichen.'",
)

# ---------------------------------------------------------------------------
# 4) "Σ" is not a mathematical sum here; name the official value explicitly.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/AnalysisScreen.tsx",
    '<td className="px-3 py-2 text-[10px] uppercase text-fog-500">Σ</td>',
    '<td className="px-3 py-2 text-[10px] uppercase text-fog-500">Endstand</td>',
)
replace_once(
    "src/components/AnalysisScreen.tsx",
    '            Werte = in der jeweiligen Runde gesicherte Punkte. „·" = Niete oder kein Eintrag.\n',
    '            Werte = in der jeweiligen Runde gesicherte Punkte. „·" = Niete oder kein Eintrag. „Endstand" zeigt den offiziell gespeicherten Spielstand.\n',
)

# ---------------------------------------------------------------------------
# 5) Important transition notices belong inside the blocking handoff dialog.
# ---------------------------------------------------------------------------
replace_once(
    "src/App.tsx",
    "interface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n}\n",
    "interface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n  notice?: string\n}\n",
)

replace_once(
    "src/App.tsx",
    "      const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number, skipHandoff = false) => {\n",
    "      const advance = (\n"
    "        nextIdx: number,\n"
    "        nextPhase: GameState,\n"
    "        nextRound: number,\n"
    "        nextTarget: number,\n"
    "        skipHandoff = false,\n"
    "        notice?: string,\n"
    "      ) => {\n",
)

old_handoff = '''        if (!suppressHandoff && !skipHandoff && getPrefs().handoff) {
          setHandoff({
            scoredName,
            points: turnPoints,
            total: justScored,
            nextName: nextPlayers[nextIdx].name,
          })
        }'''
new_handoff = '''        if (!suppressHandoff && !skipHandoff && getPrefs().handoff) {
          // A blocking handoff must own important transition information. Clear
          // any field toast so it cannot remain hidden behind this dialog.
          setToast('')
          setHandoff({
            scoredName,
            points: turnPoints,
            total: justScored,
            nextName: nextPlayers[nextIdx].name,
            notice,
          })
        } else if (notice) {
          showToast(notice)
        }'''
replace_once("src/App.tsx", old_handoff, new_handoff)

old_last_chance = '''      if (phase === 'lastChance') {
        const nextTarget = Math.max(target, justScored)
        if (idx === last) return finish()
        if (justScored > target) showToast('Führung!')
        return advance(idx + 1, 'lastChance', round, nextTarget)
      }'''
new_last_chance = '''      if (phase === 'lastChance') {
        const nextTarget = Math.max(target, justScored)
        if (idx === last) return finish()
        const notice = justScored > target ? 'Neue Führung!' : undefined
        return advance(idx + 1, 'lastChance', round, nextTarget, false, notice)
      }'''
replace_once("src/App.tsx", old_last_chance, new_last_chance)

replace_once(
    "src/App.tsx",
    '            <span className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-fog-300">ist dran</span>\n\n'
    '            <button\n',
    '            <span className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-fog-300">ist dran</span>\n'
    '            {handoff.notice && (\n'
    '              <div role="status" className="mt-4 w-full rounded-2xl border border-gold-500/35 bg-gold-500/10 px-4 py-2.5 text-sm font-black text-gold-300">\n'
    '                {handoff.notice}\n'
    '              </div>\n'
    '            )}\n\n'
    '            <button\n',
)

# ---------------------------------------------------------------------------
# Unit test: both cloud tasks are invoked before either promise resolves.
# ---------------------------------------------------------------------------
write(
    "src/lib/cloud.parallel.test.ts",
    '''import { describe, expect, it, vi } from 'vitest'
import { syncCloudPrerequisites } from './cloud'

describe('syncCloudPrerequisites', () => {
  it('starts identity and game fetch concurrently', async () => {
    let resolveIdentity!: (value: {
      online: boolean
      pending: number
      conflicts: number
      version: number
      denied: boolean
    }) => void
    let resolveGames!: (value: { games: []; ok: boolean }) => void
    const order: string[] = []

    const identityTask = vi.fn(
      () =>
        new Promise<{
          online: boolean
          pending: number
          conflicts: number
          version: number
          denied: boolean
        }>((resolve) => {
          order.push('identity')
          resolveIdentity = resolve
        }),
    )
    const gamesTask = vi.fn(
      () =>
        new Promise<{ games: []; ok: boolean }>((resolve) => {
          order.push('games')
          resolveGames = resolve
        }),
    )

    const pending = syncCloudPrerequisites(identityTask, gamesTask)

    expect(order).toEqual(['identity', 'games'])
    expect(identityTask).toHaveBeenCalledTimes(1)
    expect(gamesTask).toHaveBeenCalledTimes(1)

    resolveGames({ games: [], ok: true })
    await Promise.resolve()
    resolveIdentity({ online: true, pending: 0, conflicts: 0, version: 1, denied: false })

    await expect(pending).resolves.toEqual({
      identity: { online: true, pending: 0, conflicts: 0, version: 1, denied: false },
      fetched: { games: [], ok: true },
    })
  })
})
''',
)

# ---------------------------------------------------------------------------
# Browser regressions: compact header, React console, handoff notice, offline UI.
# ---------------------------------------------------------------------------
write(
    "e2e/audit-fixes.spec.ts",
    '''import { expect, test, type Page } from '@playwright/test'

const BASE_PREFS = {
  sound: false,
  haptics: false,
  shakeToRoll: false,
  diceTheme: 'classic',
  defaultDiceMode: 'real',
  handoff: false,
  miniChart: false,
  lastEvent: '',
}

async function openCleanApp(
  page: Page,
  options: {
    prefs?: typeof BASE_PREFS
    seeded?: Record<string, string>
    offline?: boolean
  } = {},
) {
  if (options.offline) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    })
  }
  await page.addInitScript(
    ({ prefs, seeded }) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('10k_seen_intro', '1')
      localStorage.setItem('10k_code_dismissed', '1')
      localStorage.setItem('10k_prefs_v1', JSON.stringify(prefs))
      for (const [key, value] of Object.entries(seeded)) localStorage.setItem(key, value)
    },
    { prefs: options.prefs ?? BASE_PREFS, seeded: options.seeded ?? {} },
  )
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

async function expectHeaderFits(page: Page) {
  const info = await page.getByTestId('game-header-info').boundingBox()
  const actions = await page.getByTestId('game-header-actions').boundingBox()
  const pause = await page.getByRole('button', { name: 'Spiel pausieren' }).boundingBox()
  const viewport = page.viewportSize()

  expect(info).not.toBeNull()
  expect(actions).not.toBeNull()
  expect(pause).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(info!.x + info!.width).toBeLessThanOrEqual(actions!.x + 0.5)
  expect(pause!.x).toBeGreaterThanOrEqual(0)
  expect(pause!.x + pause!.width).toBeLessThanOrEqual(viewport!.width)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true)
}

test.describe('Paket Y1 audit regressions', () => {
  test('keeps every game-header action accessible from 320 to 430 px in both dice modes', async ({ page }) => {
    test.slow()
    for (const width of [320, 360, 375, 390, 402, 430]) {
      await page.setViewportSize({ width, height: 780 })
      await openCleanApp(page)
      await startTestGame(page)
      await expectHeaderFits(page)

      await page.getByRole('button', { name: 'Würfel-Modus wechseln' }).click()
      await expectHeaderFits(page)

      await page.getByRole('button', { name: 'Spiel pausieren' }).click()
      await expect(page.getByRole('button', { name: /Spiel fortsetzen/ })).toBeVisible()
    }
  })

  test('selecting landed virtual dice emits no cross-component React update warning', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await openCleanApp(page)
    await startTestGame(page)
    await page.getByRole('button', { name: 'Würfel-Modus wechseln' }).click()
    await page.getByRole('button', { name: 'Würfeln' }).click()
    await expect(page.locator('.da-die.da-landed').first()).toBeVisible({ timeout: 15_000 })

    await page.locator('.da-die.da-landed').first().click()
    await page.locator('.da-die.da-landed').nth(1).click()

    expect(
      consoleErrors.filter((message) =>
        message.includes('Cannot update a component') ||
        message.includes('while rendering a different component'),
      ),
    ).toEqual([])
  })

  test('shows a last-chance lead change inside the blocking handoff dialog', async ({ page }) => {
    const activeGame = {
      sessionId: 'e2e-y1-handoff',
      players: [
        { id: 'player:name:gabi', name: 'Gabi', score: 5000, busts: 0 },
        { id: 'player:name:mabi', name: 'Mabi', score: 4950, busts: 0 },
        { id: 'player:name:caro', name: 'Caro', score: 4100, busts: 0 },
      ],
      idx: 1,
      round: 4,
      phase: 'lastChance',
      target: 5000,
      event: 'E2E Y1',
      testMode: true,
      diceMode: 'real',
      goalScore: 5000,
      entryMin: 0,
      kept: [],
      dice: [],
      accumulated: 0,
      turns: [],
      currentRiskAttempts: [],
      pendingRiskAttempt: null,
      rolled: [],
      thrown: [],
      throwSeq: 0,
      savedAt: '2026-07-17T20:00:00.000Z',
    }
    await openCleanApp(page, {
      prefs: { ...BASE_PREFS, handoff: true },
      seeded: { '10k_active_game': JSON.stringify(activeGame) },
    })
    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()
    await page.getByRole('button', { name: 'Würfel 1 hinzufügen' }).click()
    await page.getByRole('button', { name: '100 Punkte sichern' }).click()

    const handoff = page.getByRole('dialog', { name: /Caro/ })
    await expect(handoff).toBeVisible()
    await expect(handoff.getByRole('status')).toHaveText('Neue Führung!')
    await expect(page.getByText('Führung!', { exact: true })).toHaveCount(0)
  })

  test('reports offline immediately while keeping local statistics available', async ({ page }) => {
    await openCleanApp(page, { offline: true })
    await page.getByRole('button', { name: /Statistik/ }).click()

    await expect(page.getByText(/Gerade offline|Nur auf diesem Gerät/)).toBeVisible()
    await expect(page.getByText('Cloud wird geprüft…', { exact: true })).toHaveCount(0)
  })
})
''',
)

print("Package Y1 patches applied successfully")
