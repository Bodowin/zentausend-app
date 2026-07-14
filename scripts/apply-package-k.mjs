import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`${label}: start marker missing`)
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error(`${label}: end marker missing`)
  return source.slice(0, start) + replacement + source.slice(end)
}

const path = 'src/App.tsx'
let source = fs.readFileSync(path, 'utf8')

source = replaceOnce(
  source,
  "import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'",
  "import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'",
  'React useRef import',
)

source = replaceOnce(
  source,
  `import {
  clearActiveGame,
  loadActiveGame,
  saveActiveGame,
  type ActiveGame,
} from './lib/activeGame'`,
  `import {
  clearActiveGame,
  createActiveGameSessionId,
  loadActiveGame,
  saveActiveGame,
  type ActiveGame,
} from './lib/activeGame'`,
  'active game session import',
)

source = replaceOnce(
  source,
  `import { celebrationFor } from './lib/celebration'`,
  `import { celebrationFor } from './lib/celebration'
import {
  clearCloudActiveGame,
  inspectActiveGameCloud,
  replaceCloudActiveGame,
  syncActiveGameToCloud,
  takeOverCloudActiveGame,
  type ActiveGameCloudPrompt,
} from './lib/activeGameCloud'
import { CloudGameDialog } from './components/CloudGameDialog'`,
  'cloud imports',
)

source = replaceOnce(
  source,
  `  const [entryMin, setEntryMin] = useState(ENTRY_MIN)
`,
  `  const [entryMin, setEntryMin] = useState(ENTRY_MIN)
  const [sessionId, setSessionId] = useState('')
`,
  'session state',
)

source = replaceOnce(
  source,
  `  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())
`,
  `  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())
  const initialResume = useRef(resumable)
  const [cloudPrompt, setCloudPrompt] = useState<ActiveGameCloudPrompt | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const cloudSyncGeneration = useRef(0)
  const dismissedCloudVersion = useRef<number | null>(null)
`,
  'cloud state',
)

source = replaceOnce(
  source,
  `  const closeIntro = () => {
    try {
      localStorage.setItem(INTRO_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowIntro(false)
  }
`,
  `  const closeIntro = () => {
    try {
      localStorage.setItem(INTRO_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowIntro(false)
  }

  useEffect(() => {
    let cancelled = false
    void inspectActiveGameCloud(initialResume.current).then((prompt) => {
      if (!cancelled && prompt && dismissedCloudVersion.current !== prompt.snapshot.version) {
        setCloudPrompt(prompt)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])
`,
  'startup cloud inspection',
)

const autosave = `  // Das sichtbare Ergebnis eines virtuellen Wurfs wird gemeinsam mit Auswahl
  // und Restmenge gespeichert. Ein Reload kann dadurch keinen neuen Wurf ziehen.
  // Dieselbe validierte Momentaufnahme wird kurz verzögert zusätzlich per CAS in
  // der Cloud gesichert. Ein fremder Gerätebesitzer wird niemals überschrieben.
  useEffect(() => {
    const generation = ++cloudSyncGeneration.current
    if (view !== 'game' || (phase !== 'active' && phase !== 'lastChance') || !sessionId) return

    const snapshot: ActiveGame = {
      sessionId,
      players,
      idx,
      round,
      phase,
      target,
      event,
      testMode,
      diceMode,
      goalScore,
      entryMin,
      kept,
      dice,
      accumulated,
      turns,
      rolled,
      thrown,
      throwSeq,
      savedAt: new Date().toISOString(),
    }
    saveActiveGame(snapshot)

    const timer = window.setTimeout(() => {
      void syncActiveGameToCloud(snapshot).then((result) => {
        if (cloudSyncGeneration.current !== generation) return
        if (result.prompt && dismissedCloudVersion.current !== result.prompt.snapshot.version) {
          setCloudPrompt(result.prompt)
        }
      })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [
    view,
    sessionId,
    players,
    idx,
    round,
    phase,
    target,
    event,
    testMode,
    diceMode,
    goalScore,
    entryMin,
    kept,
    dice,
    accumulated,
    turns,
    rolled,
    thrown,
    throwSeq,
  ])

`
source = replaceSection(
  source,
  `  // Das sichtbare Ergebnis eines virtuellen Wurfs wird gemeinsam mit Auswahl`,
  `  const showToast`,
  autosave,
  'active game autosave',
)

source = replaceOnce(
  source,
  `    setEntryMin(entry)
    setIdx(0)`,
  `    setEntryMin(entry)
    setSessionId(createActiveGameSessionId())
    setIdx(0)`,
  'new game session',
)

source = replaceOnce(
  source,
  `    clearActiveGame()
    setSetupSeed({ players: ordered, event, diceMode, goalScore, entryMin })`,
  `    cloudSyncGeneration.current += 1
    void clearCloudActiveGame(sessionId)
    clearActiveGame()
    setSetupSeed({ players: ordered, event, diceMode, goalScore, entryMin })`,
  'rematch cloud clear',
)

source = replaceOnce(
  source,
  `  const discardResume = () => {
    clearActiveGame()
    setResumable(null)
  }`,
  `  const discardResume = () => {
    const discardedSession = resumable?.sessionId ?? ''
    cloudSyncGeneration.current += 1
    clearActiveGame()
    setResumable(null)
    if (discardedSession) void clearCloudActiveGame(discardedSession)
  }`,
  'discard cloud clear',
)

source = replaceOnce(
  source,
  `    setEntryMin(game.entryMin ?? ENTRY_MIN)
    setKept(game.kept ?? [])`,
  `    setEntryMin(game.entryMin ?? ENTRY_MIN)
    setSessionId(game.sessionId)
    setKept(game.kept ?? [])`,
  'resume session',
)

const cloudHandlers = `  const useCloudGame = async () => {
    const prompt = cloudPrompt
    const cloudGame = prompt?.snapshot.game
    if (!prompt || !cloudGame || cloudBusy) return
    setCloudBusy(true)
    try {
      const result = await takeOverCloudActiveGame(prompt.snapshot)
      if (result.status === 'saved') {
        const game = result.snapshot?.game ?? cloudGame
        dismissedCloudVersion.current = null
        saveActiveGame(game)
        setResumable(game)
        setCloudPrompt(null)
        resumeGame(game)
        return
      }
      if (result.prompt) setCloudPrompt(result.prompt)
      else showToast(result.status === 'denied' ? 'Crew-Code prüfen' : 'Cloud-Übernahme fehlgeschlagen')
    } finally {
      setCloudBusy(false)
    }
  }

  const keepLocalCloudGame = async () => {
    const prompt = cloudPrompt
    const local = loadActiveGame()
    if (!prompt || !local || cloudBusy) return
    setCloudBusy(true)
    try {
      const result = await replaceCloudActiveGame(local, prompt.snapshot.version)
      if (result.status === 'saved') {
        dismissedCloudVersion.current = null
        setCloudPrompt(null)
        showToast('Lokaler Spielstand ist jetzt in der Cloud')
        return
      }
      if (result.prompt) setCloudPrompt(result.prompt)
      else showToast(result.status === 'denied' ? 'Crew-Code prüfen' : 'Cloud-Sicherung fehlgeschlagen')
    } finally {
      setCloudBusy(false)
    }
  }

  const discardLocalAfterCloudClear = () => {
    cloudSyncGeneration.current += 1
    clearActiveGame()
    setResumable(null)
    setCloudPrompt(null)
  }

  const closeCloudPrompt = () => {
    if (cloudPrompt) dismissedCloudVersion.current = cloudPrompt.snapshot.version
    setCloudPrompt(null)
  }

`
source = replaceOnce(source, `  const addDie = (value: number) => {`, cloudHandlers + `  const addDie = (value: number) => {`, 'cloud handlers')

source = replaceOnce(
  source,
  `        clearActiveGame()
        buzz([12, 40, 12, 40, 60])`,
  `        cloudSyncGeneration.current += 1
        void clearCloudActiveGame(sessionId)
        clearActiveGame()
        buzz([12, 40, 12, 40, 60])`,
  'finished game cloud clear',
)

source = replaceOnce(
  source,
  `    [phase, idx, target, round, event, testMode, goalScore, showToast],`,
  `    [phase, idx, target, round, event, testMode, goalScore, sessionId, showToast],`,
  'resolve turn dependencies',
)

source = replaceOnce(
  source,
  `  if (view === 'stats') {`,
  `  const cloudDialog = cloudPrompt ? (
    <CloudGameDialog
      prompt={cloudPrompt}
      busy={cloudBusy}
      onUseCloud={useCloudGame}
      onKeepLocal={keepLocalCloudGame}
      onDiscardLocal={discardLocalAfterCloudClear}
      onClose={closeCloudPrompt}
    />
  ) : null

  if (view === 'stats') {`,
  'cloud dialog element',
)

source = replaceOnce(
  source,
  `    return (
      <Suspense fallback={<ScreenFallback label="Statistik wird geladen…" />}>
        <StatsScreen onBack={() => setView('setup')} />
      </Suspense>
    )`,
  `    return (
      <>
        <Suspense fallback={<ScreenFallback label="Statistik wird geladen…" />}>
          <StatsScreen onBack={() => setView('setup')} />
        </Suspense>
        {cloudDialog}
      </>
    )`,
  'stats cloud dialog',
)

source = replaceOnce(
  source,
  `        {showIntro && <IntroScreen onClose={closeIntro} />}
      </>`,
  `        {showIntro && <IntroScreen onClose={closeIntro} />}
        {cloudDialog}
      </>`,
  'setup cloud dialog',
)

source = replaceOnce(
  source,
  `      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}`,
  `      {cloudDialog}

      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}`,
  'game cloud dialog',
)

fs.writeFileSync(path, source)
