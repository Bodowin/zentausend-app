import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8')
  const after = transform(before)
  if (after === before) throw new Error(`${path}: no changes produced`)
  fs.writeFileSync(path, after)
}

update('src/App.tsx', (initial) => {
  let source = initial
  source = replaceOnce(
    source,
    "import { useCallback, useEffect, useMemo, useState } from 'react'",
    "import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'",
    'App react import',
  )
  source = replaceOnce(source, "import { pushGame } from './lib/cloud'\n", '', 'App cloud import')
  source = replaceOnce(source, "import { GameScreen } from './components/GameScreen'\n", '', 'App GameScreen import')
  source = replaceOnce(source, "import { StatsScreen } from './components/StatsScreen'\n", '', 'App StatsScreen import')
  source = replaceOnce(
    source,
    "import { celebrationFor } from './lib/celebration'\n",
    "import { celebrationFor } from './lib/celebration'\n\nconst GameScreen = lazy(() =>\n  import('./components/GameScreen').then((module) => ({ default: module.GameScreen })),\n)\nconst StatsScreen = lazy(() =>\n  import('./components/StatsScreen').then((module) => ({ default: module.StatsScreen })),\n)\n",
    'App lazy screens',
  )
  source = replaceOnce(
    source,
    "const sortDice = (values: number[]) => [...values].sort((a, b) => a - b)\n\nexport function App()",
    "const sortDice = (values: number[]) => [...values].sort((a, b) => a - b)\n\nfunction ScreenFallback({ label }: { label: string }) {\n  return (\n    <div className=\"flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center\">\n      <div className=\"rounded-2xl border border-ink-800 bg-ink-900/70 px-6 py-5 text-sm font-semibold text-fog-400 animate-pulse\">\n        {label}\n      </div>\n    </div>\n  )\n}\n\nexport function App()",
    'App fallback component',
  )
  source = replaceOnce(
    source,
    '          void pushGame(record)',
    "          void import('./lib/cloud')\n            .then(({ pushGame }) => pushGame(record))\n            .catch((error) => console.warn('Cloud-Modul konnte nicht geladen werden:', error))",
    'App dynamic cloud push',
  )
  source = replaceOnce(
    source,
    "  if (view === 'stats') return <StatsScreen onBack={() => setView('setup')} />",
    "  if (view === 'stats') {\n    return (\n      <Suspense fallback={<ScreenFallback label=\"Statistik wird geladen…\" />}>\n        <StatsScreen onBack={() => setView('setup')} />\n      </Suspense>\n    )\n  }",
    'App lazy stats render',
  )
  source = replaceOnce(
    source,
    '      <GameScreen\n',
    '      <Suspense fallback={<ScreenFallback label="Spiel wird geladen…" />}>\n        <GameScreen\n',
    'App GameScreen suspense opening',
  )
  source = replaceOnce(
    source,
    '        onToggleDiceMode={toggleDiceMode}\n      />',
    '          onToggleDiceMode={toggleDiceMode}\n        />\n      </Suspense>',
    'App GameScreen suspense closing',
  )
  return source
})

update('src/components/GameScreen.tsx', (initial) => {
  let source = initial
  source = replaceOnce(
    source,
    "import { useMemo, useState } from 'react'",
    "import { lazy, Suspense, useMemo, useState } from 'react'",
    'GameScreen react import',
  )
  source = replaceOnce(source, "import { shareResultImage } from '../lib/shareImage'\n", '', 'GameScreen share import')
  source = replaceOnce(source, "import DiceArena, { PIPS } from './DiceArena'\n", '', 'GameScreen DiceArena import')
  source = replaceOnce(source, "import { AnalysisScreen } from './AnalysisScreen'\n", '', 'GameScreen Analysis import')
  source = replaceOnce(
    source,
    "import { computeGameAnalysis } from '../lib/storage'\n",
    "import { computeGameAnalysis } from '../lib/storage'\nimport { PIPS } from '../lib/dicePips'\n",
    'GameScreen PIPS import',
  )
  source = replaceOnce(
    source,
    "} from './Icons'\n",
    "} from './Icons'\n\nconst DiceArena = lazy(() => import('./DiceArena'))\nconst AnalysisScreen = lazy(() =>\n  import('./AnalysisScreen').then((module) => ({ default: module.AnalysisScreen })),\n)\n",
    'GameScreen lazy modules',
  )
  source = replaceOnce(
    source,
    `                <DiceArena\n                  key={throwSeq}\n                  values={thrown}\n                  selectable\n                  invalidValues={result.invalidDice}\n                  onSelectionChange={p.onBowlSelect}\n                  onPhaseChange={setBowlPhase}\n                />`,
    `                <Suspense fallback={<DiceArenaFallback />}>\n                  <DiceArena\n                    key={throwSeq}\n                    values={thrown}\n                    selectable\n                    invalidValues={result.invalidDice}\n                    onSelectionChange={p.onBowlSelect}\n                    onPhaseChange={setBowlPhase}\n                  />\n                </Suspense>`,
    'GameScreen DiceArena suspense',
  )
  source = replaceOnce(
    source,
    '          <AnalysisScreen game={finishedGameRecord} onBack={() => setShowAnalysis(false)} />',
    '          <Suspense fallback={<AnalysisFallback />}>\n            <AnalysisScreen game={finishedGameRecord} onBack={() => setShowAnalysis(false)} />\n          </Suspense>',
    'GameScreen Analysis suspense',
  )
  source = replaceOnce(
    source,
    '                    onClick={() => shareResultImage(winner, players, event)}',
    `                    onClick={() => {\n                      void import('../lib/shareImage')\n                        .then(({ shareResultImage }) => shareResultImage(winner, players, event))\n                        .catch((error) => console.warn('Teilen-Modul konnte nicht geladen werden:', error))\n                    }}`,
    'GameScreen dynamic share',
  )
  source = replaceOnce(
    source,
    '/** Kleiner Würfel mit echten Augen für die Ablage der ausgelegten Würfel. */',
    `function DiceArenaFallback() {\n  return (\n    <div className=\"grid h-full min-h-[200px] place-items-center bg-ink-950/40\">\n      <span className=\"rounded-full border border-ink-700 bg-ink-900/80 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold-400 animate-pulse\">\n        Würfelschale wird geladen…\n      </span>\n    </div>\n  )\n}\n\nfunction AnalysisFallback() {\n  return (\n    <div className=\"grid min-h-screen place-items-center bg-ink-950 px-6\">\n      <span className=\"text-sm font-semibold text-fog-400 animate-pulse\">Analyse wird geladen…</span>\n    </div>\n  )\n}\n\n/** Kleiner Würfel mit echten Augen für die Ablage der ausgelegten Würfel. */`,
    'GameScreen fallback components',
  )
  return source
})

update('src/components/DiceArena.tsx', (initial) => {
  let source = initial
  source = replaceOnce(
    source,
    "import { getPrefs, DICE_THEMES } from '../lib/prefs'\n",
    "import { getPrefs, DICE_THEMES } from '../lib/prefs'\nimport { PIPS } from '../lib/dicePips'\n",
    'DiceArena PIPS import',
  )
  source = replaceOnce(
    source,
    `// Augen-Positionen (Spalte, Zeile) im 3×3-Raster – auch für Mini-Würfel in der Ablage.\nexport const PIPS: Record<number, [number, number][]> = {\n  1: [[1, 1]],\n  2: [[0, 0], [2, 2]],\n  3: [[0, 0], [1, 1], [2, 2]],\n  4: [[0, 0], [2, 0], [0, 2], [2, 2]],\n  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],\n  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],\n}\n\n`,
    '',
    'DiceArena inline PIPS removal',
  )
  return source
})
