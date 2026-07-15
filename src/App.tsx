import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DiceMode, GameState, Player, Turn } from './lib/types'
import {
  clearActiveGame,
  createActiveGameSessionId,
  loadActiveGame,
  saveActiveGame,
  type ActiveGame,
} from './lib/activeGame'
import { calculateScore, ENTRY_MIN, WINNING_SCORE } from './lib/scoring'
import { computeRisk } from './lib/risk'
import { saveGame } from './lib/storage'
import { buzz } from './lib/haptics'
import { playerColor } from './lib/colors'
import { getPrefs } from './lib/prefs'
import { playerIdForName } from './lib/playerIdentity'
import { SetupScreen } from './components/SetupScreen'
import { IntroScreen } from './components/IntroScreen'
import { Celebration, type CelebrationData } from './components/Celebration'
import { celebrationFor } from './lib/celebration'
import {
  clearCloudActiveGame,
  inspectActiveGameCloud,
  replaceCloudActiveGame,
  syncActiveGameToCloud,
  takeOverCloudActiveGame,
  type ActiveGameCloudPrompt,
} from './lib/activeGameCloud'
import { CloudGameDialog } from './components/CloudGameDialog'

const GameScreen = lazy(() =>
  import('./components/GameScreen').then((module) => ({ default: module.GameScreen })),
)
const StatsScreen = lazy(() =>
  import('./components/StatsScreen').then((module) => ({ default: module.StatsScreen })),
)

const INTRO_KEY = '10k_seen_intro'
const UNDO_LIMIT = 30

type View = 'setup' | 'game' | 'stats'

interface Snapshot {
  players: Player[]
  idx: number
  round: number
  phase: GameState
  target: number
  kept: number[]
  dice: number[]
  accumulated: number
  turns: Turn[]
  rolled: number[]
  thrown: number[]
  throwSeq: number
  action: string
}

interface BustAnnounce {
  name: string
  lost: number
  nextName: string | null
}

interface TurnHandoff {
  scoredName: string
  points: number
  total: number
  nextName: string
}

const sortDice = (values: number[]) => [...values].sort((a, b) => a - b)

function ScreenFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/70 px-6 py-5 text-sm font-semibold text-fog-400 animate-pulse">
        {label}
      </div>
    </div>
  )
}

export function App() {
  const [view, setView] = useState<View>('setup')

  const [players, setPlayers] = useState<Player[]>([])
  const [event, setEvent] = useState('')
  const [idx, setIdx] = useState(0)
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState<GameState>('setup')
  const [target, setTarget] = useState(0)
  const [winner, setWinner] = useState<Player | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [diceMode, setDiceMode] = useState<DiceMode>('real')
  const [goalScore, setGoalScore] = useState(WINNING_SCORE)
  const [entryMin, setEntryMin] = useState(ENTRY_MIN)
  const [sessionId, setSessionId] = useState('')
  const [setupSeed, setSetupSeed] = useState<{
    players: Player[]
    event: string
    diceMode: DiceMode
    goalScore: number
    entryMin: number
  } | null>(null)

  const [kept, setKept] = useState<number[]>([])
  const [dice, setDice] = useState<number[]>([])
  const [accumulated, setAccumulated] = useState(0)
  const [turns, setTurns] = useState<Turn[]>([])
  const [rolled, setRolled] = useState<number[]>([])
  const [thrown, setThrown] = useState<number[]>([])
  const [throwSeq, setThrowSeq] = useState(0)
  const [toast, setToast] = useState('')
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)
  const [handoff, setHandoff] = useState<TurnHandoff | null>(null)
  const [bustAnnounce, setBustAnnounce] = useState<BustAnnounce | null>(null)
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())
  const initialResume = useRef(resumable)
  const [cloudPrompt, setCloudPrompt] = useState<ActiveGameCloudPrompt | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const cloudSyncGeneration = useRef(0)
  const dismissedCloudVersion = useRef<number | null>(null)

  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !localStorage.getItem(INTRO_KEY)
    } catch {
      return false
    }
  })

  const closeIntro = () => {
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

  const combined = useMemo(() => [...kept, ...dice], [kept, dice])
  const result = useMemo(() => calculateScore(combined), [combined])
  const inHand = 6 - kept.length

  // Das sichtbare Ergebnis eines virtuellen Wurfs wird gemeinsam mit Auswahl
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

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((current) => (current === msg ? '' : current)), 1800)
  }, [])

  const startGame = (
    chosen: Player[],
    evt: string,
    test: boolean,
    mode: DiceMode,
    goal: number,
    entry: number,
  ) => {
    setPlayers(chosen.map((player) => ({ ...player, score: 0, busts: 0 })))
    setEvent(evt.trim())
    setTestMode(test)
    setDiceMode(mode)
    setGoalScore(goal)
    setEntryMin(entry)
    setSessionId(createActiveGameSessionId())
    setIdx(0)
    setRound(1)
    setPhase('active')
    setTarget(0)
    setWinner(null)
    setKept([])
    setDice([])
    setAccumulated(0)
    setTurns([])
    setRolled([])
    setThrown([])
    setThrowSeq(0)
    setToast('')
    setCelebration(null)
    setHandoff(null)
    setBustAnnounce(null)
    setUndoStack([])
    setResumable(null)
    setView('game')
  }

  const exitToSetup = () => {
    setPhase('setup')
    setWinner(null)
    setCelebration(null)
    setHandoff(null)
    setBustAnnounce(null)
    setSetupSeed(null)
    setResumable(loadActiveGame())
    setView('setup')
  }

  const startRematch = () => {
    const winnerIndex = winner ? players.findIndex((player) => player.id === winner.id) : 0
    const start = winnerIndex < 0 ? 0 : winnerIndex
    const ordered = [...players.slice(start), ...players.slice(0, start)].map((player) => ({
      ...player,
      score: 0,
      busts: 0,
    }))
    cloudSyncGeneration.current += 1
    void clearCloudActiveGame(sessionId)
    clearActiveGame()
    setSetupSeed({ players: ordered, event, diceMode, goalScore, entryMin })
    setPhase('setup')
    setWinner(null)
    setResumable(null)
    setView('setup')
  }

  const discardResume = () => {
    const discardedSession = resumable?.sessionId ?? ''
    cloudSyncGeneration.current += 1
    clearActiveGame()
    setResumable(null)
    if (discardedSession) void clearCloudActiveGame(discardedSession)
  }

  const resumeGame = (game: ActiveGame) => {
    const mode = game.diceMode ?? 'real'
    const reconstructedThrow =
      mode === 'virtual'
        ? game.thrown?.length
          ? sortDice(game.thrown)
          : sortDice([...(game.dice ?? []), ...(game.rolled ?? [])])
        : []

    setPlayers(game.players)
    setIdx(game.idx)
    setRound(game.round)
    setPhase(game.phase)
    setTarget(game.target)
    setEvent(game.event)
    setTestMode(game.testMode)
    setGoalScore(game.goalScore ?? WINNING_SCORE)
    setEntryMin(game.entryMin ?? ENTRY_MIN)
    setSessionId(game.sessionId)
    setKept(game.kept ?? [])
    setAccumulated(game.accumulated)
    setTurns(game.turns ?? [])
    setDiceMode(mode)

    // Im virtuellen Modus wird derselbe Wurf noch einmal dargestellt, die frühere
    // Auswahl aber bewusst zurückgesetzt. So bleibt das Ergebnis fair und der
    // Spieler kann nach einem Reload eindeutig neu auswählen.
    setDice(mode === 'virtual' ? [] : game.dice ?? [])
    setRolled(mode === 'virtual' ? reconstructedThrow : game.rolled ?? [])
    setThrown(reconstructedThrow)
    setThrowSeq((game.throwSeq ?? 0) + 1)
    setWinner(null)
    setCelebration(null)
    setHandoff(null)
    setBustAnnounce(null)
    setUndoStack([])
    setResumable(null)
    setToast('')
    setView('game')
    if (mode === 'virtual' && reconstructedThrow.length) showToast('Wurf wiederhergestellt')
  }

  const useCloudGame = async () => {
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

  const addDie = (value: number) => {
    if (kept.length + dice.length >= 6 || phase === 'finished') return
    buzz(6)
    setDice((current) => sortDice([...current, value]))
  }

  const removeDie = (index: number) => setDice((current) => current.filter((_, i) => i !== index))
  const clearDice = () => setDice([])

  const takeSnapshot = useCallback(
    (action: string) => {
      setUndoStack((stack) =>
        [
          ...stack,
          {
            players: players.map((player) => ({ ...player })),
            idx,
            round,
            phase,
            target,
            kept: [...kept],
            dice: [...dice],
            accumulated,
            turns: turns.map((turn) => ({ ...turn })),
            rolled: [...rolled],
            thrown: [...thrown],
            throwSeq,
            action,
          },
        ].slice(-UNDO_LIMIT),
      )
    },
    [players, idx, round, phase, target, kept, dice, accumulated, turns, rolled, thrown, throwSeq],
  )

  const undo = () => {
    const snapshot = undoStack[undoStack.length - 1]
    if (!snapshot) return

    setPlayers(snapshot.players)
    setIdx(snapshot.idx)
    setRound(snapshot.round)
    setPhase(snapshot.phase)
    setTarget(snapshot.target)
    setKept(snapshot.kept)
    setAccumulated(snapshot.accumulated)
    setTurns(snapshot.turns)
    setWinner(null)
    setCelebration(null)
    setHandoff(null)
    setBustAnnounce(null)

    if (diceMode === 'virtual') {
      // Gleiches Ergebnis erneut zeigen, aber Auswahl zurücksetzen.
      setDice([])
      setRolled(snapshot.thrown)
      setThrown(snapshot.thrown)
      setThrowSeq(snapshot.throwSeq + 1)
    } else {
      setDice(snapshot.dice)
      setRolled(snapshot.rolled)
      setThrown(snapshot.thrown)
      setThrowSeq(snapshot.throwSeq)
    }

    setUndoStack((stack) => stack.slice(0, -1))
    showToast(`${snapshot.action === 'bank' ? 'Sichern' : snapshot.action === 'bust' ? 'Niete' : 'Zocken'} rückgängig`)
  }

  const resolveTurn = useCallback(
    (
      nextPlayers: Player[],
      justScored: number,
      nextTurns: Turn[],
      _celebrating: boolean,
      suppressHandoff = false,
      turnPoints = 0,
      scoredName = '',
    ) => {
      const count = nextPlayers.length
      const last = count - 1

      const finish = () => {
        const win = [...nextPlayers].sort((a, b) => b.score - a.score)[0]
        setPlayers(nextPlayers)
        setWinner(win)
        setPhase('finished')
        if (!testMode) {
          const record = saveGame(win, nextPlayers, event, nextTurns)
          void import('./lib/cloud')
            .then(({ pushGame }) => pushGame(record))
            .catch((error) => console.warn('Cloud-Modul konnte nicht geladen werden:', error))
        }
        cloudSyncGeneration.current += 1
        void clearCloudActiveGame(sessionId)
        clearActiveGame()
        buzz([12, 40, 12, 40, 60])
      }

      const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number) => {
        setPlayers(nextPlayers)
        setIdx(nextIdx)
        setPhase(nextPhase)
        setRound(nextRound)
        setTarget(nextTarget)
        setAccumulated(0)
        setKept([])
        setDice([])
        setRolled([])
        setThrown([])
        if (!suppressHandoff && getPrefs().handoff) {
          setHandoff({
            scoredName,
            points: turnPoints,
            total: justScored,
            nextName: nextPlayers[nextIdx].name,
          })
        }
      }

      if (phase === 'lastChance') {
        const nextTarget = Math.max(target, justScored)
        if (idx === last) return finish()
        if (justScored > target) showToast('Führung!')
        return advance(idx + 1, 'lastChance', round, nextTarget)
      }

      if (justScored >= goalScore) {
        if (idx === last) return finish()
        showToast('Letzte Runde!')
        return advance(idx + 1, 'lastChance', round, justScored)
      }

      const nextIdx = (idx + 1) % count
      const nextRound = nextIdx === 0 ? round + 1 : round
      return advance(nextIdx, 'active', nextRound, target)
    },
    [phase, idx, target, round, event, testMode, goalScore, sessionId, showToast],
  )

  const handleContinue = () => {
    if (!result.isValid || result.score === 0 || dice.length === 0) return
    takeSnapshot('continue')
    buzz(10)
    const newKept = [...kept, ...dice]
    const special = celebrationFor(combined, newKept.length === 6)
    if (special) setCelebration(special)

    if (newKept.length === 6) {
      setAccumulated((current) => current + calculateScore(newKept).score)
      setKept([])
      if (!special) showToast('Heiße Würfel!')
    } else {
      setKept(newKept)
      if (!special) showToast('Zocken!')
    }

    setDice([])
    setRolled([])
    setThrown([])
  }

  const toggleDiceMode = () => {
    setDiceMode((mode) => (mode === 'real' ? 'virtual' : 'real'))
    setRolled([])
    setDice([])
    setThrown([])
    setThrowSeq((sequence) => sequence + 1)
  }

  const rnd6 = () => 1 + Math.floor(Math.random() * 6)

  const newThrow = useCallback(() => {
    const count = 6 - kept.length
    if (count <= 0) return
    const values = Array.from({ length: count }, rnd6).sort((a, b) => a - b)
    setThrown(values)
    setRolled(values)
    setDice([])
    setThrowSeq((sequence) => sequence + 1)
  }, [kept.length])

  useEffect(() => {
    if (
      diceMode === 'virtual' &&
      view === 'game' &&
      (phase === 'active' || phase === 'lastChance') &&
      !winner &&
      !celebration &&
      !handoff &&
      !bustAnnounce &&
      thrown.length === 0 &&
      dice.length === 0 &&
      kept.length < 6
    ) {
      newThrow()
    }
  }, [
    diceMode,
    view,
    phase,
    winner,
    celebration,
    handoff,
    bustAnnounce,
    thrown.length,
    dice.length,
    kept.length,
    newThrow,
  ])

  const handleBowlSelect = (selected: number[], remaining: number[]) => {
    buzz(6)
    setDice(sortDice(selected))
    setRolled(sortDice(remaining))
  }

  const handleBank = () => {
    if (!result.isValid) return
    const pot = accumulated + result.score
    if (pot === 0) return
    if (players[idx].score === 0 && pot < entryMin) return

    const special = celebrationFor(combined, combined.length === 6)
    if (special) {
      setCelebration({ ...special, sub: `${pot.toLocaleString('de-DE')} Punkte`, bigSub: true })
    }

    takeSnapshot('bank')
    buzz(14)
    const nextPlayers = players.map((player, index) =>
      index === idx ? { ...player, score: player.score + pot } : player,
    )
    const nextTurns = [
      ...turns,
      { round, player: players[idx].name, playerId: players[idx].id, points: pot, bust: false },
    ]
    setTurns(nextTurns)
    resolveTurn(nextPlayers, nextPlayers[idx].score, nextTurns, Boolean(special), false, pot, players[idx].name)
  }

  const handleBust = () => {
    if (bustAnnounce) return
    takeSnapshot('bust')
    buzz([18, 30, 18])

    const lost = totalPotential
    const bustedName = players[idx].name
    const nextPlayers = players.map((player, index) =>
      index === idx ? { ...player, busts: player.busts + 1 } : player,
    )
    const nextTurns = [
      ...turns,
      { round, player: bustedName, playerId: players[idx].id, points: 0, bust: true },
    ]
    const finishes = phase === 'lastChance' && idx === players.length - 1
    const nextIndex = phase === 'lastChance' ? idx + 1 : (idx + 1) % players.length
    const nextName = finishes ? null : nextPlayers[nextIndex]?.name ?? null

    // Die Niete wird SOFORT fachlich verbucht. Das Banner ist nur noch eine
    // blockierende Übergabe – ein Reload kann die Niete nicht mehr zurücknehmen.
    setBustAnnounce({ name: bustedName, lost, nextName })
    setTurns(nextTurns)
    resolveTurn(nextPlayers, nextPlayers[idx].score, nextTurns, false, true)
  }

  const acknowledgeBust = () => {
    setBustAnnounce(null)
  }

  const current = players[idx]
  const effectiveTarget = phase === 'lastChance' ? target + 1 : goalScore
  const neededForWin = current ? Math.max(0, effectiveTarget - current.score) : 0
  const totalPotential = accumulated + (result.isValid ? result.score : 0)

  const risk = useMemo(() => {
    if (!result.isValid || dice.length === 0 || result.score === 0) return null
    if (combined.length === 6) return computeRisk(6, false)
    return computeRisk(6 - combined.length, result.hasJokerTriple)
  }, [result, dice.length, combined.length])

  const cloudDialog = cloudPrompt ? (
    <CloudGameDialog
      prompt={cloudPrompt}
      busy={cloudBusy}
      onUseCloud={useCloudGame}
      onKeepLocal={keepLocalCloudGame}
      onDiscardLocal={discardLocalAfterCloudClear}
      onClose={closeCloudPrompt}
    />
  ) : null

  if (view === 'stats') {
    return (
      <>
        <Suspense fallback={<ScreenFallback label="Statistik wird geladen…" />}>
          <StatsScreen onBack={() => setView('setup')} />
        </Suspense>
        {cloudDialog}
      </>
    )
  }

  if (view === 'setup') {
    return (
      <>
        <SetupScreen
          makePlayer={(name) => ({ id: playerIdForName(name), name, score: 0, busts: 0 })}
          onStart={startGame}
          onShowStats={() => setView('stats')}
          onShowHelp={() => setShowIntro(true)}
          resumable={resumable}
          onResume={resumeGame}
          onDiscardResume={discardResume}
          initialPlayers={setupSeed?.players}
          initialEvent={setupSeed?.event}
          initialDiceMode={setupSeed?.diceMode}
          initialGoalScore={setupSeed?.goalScore}
          initialEntryMin={setupSeed?.entryMin}
        />
        {showIntro && <IntroScreen onClose={closeIntro} />}
        {cloudDialog}
      </>
    )
  }

  if (!current) {
    return <div className="flex min-h-screen items-center justify-center text-fog-400">Lade…</div>
  }

  return (
    <>
      <Suspense fallback={<ScreenFallback label="Spiel wird geladen…" />}>
        <GameScreen
        players={players}
        idx={idx}
        round={round}
        phase={phase}
        event={event}
        effectiveTarget={effectiveTarget}
        neededForWin={neededForWin}
        testMode={testMode}
        diceMode={diceMode}
        goalScore={goalScore}
        entryMin={entryMin}
        kept={kept}
        dice={dice}
        rolled={rolled}
        turns={turns}
        thrown={thrown}
        throwSeq={throwSeq}
        inHand={inHand}
        accumulated={accumulated}
        result={result}
        totalPotential={totalPotential}
        risk={risk}
        toast={toast}
        winner={winner}
        canUndo={undoStack.length > 0}
        onAddDie={addDie}
        onRemoveDie={removeDie}
        onClearDice={clearDice}
        onBowlSelect={handleBowlSelect}
        onContinue={handleContinue}
        onBank={handleBank}
        onBust={handleBust}
        onUndo={undo}
        onExit={exitToSetup}
        onNewGame={exitToSetup}
        onRematch={startRematch}
          onToggleDiceMode={toggleDiceMode}
        />
      </Suspense>

      {cloudDialog}

      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}

      {handoff && !celebration && (
        <div
          className="glass fixed inset-0 z-[55] flex items-center justify-center px-5 py-[max(env(safe-area-inset-top),1.25rem)] animate-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="turn-handoff-title"
        >
          <div
            className="flex w-full max-w-sm flex-col items-center rounded-3xl border-2 bg-ink-900/95 px-6 py-7 text-center shadow-2xl shadow-black/60"
            style={{ borderColor: `${playerColor(handoff.nextName)}80` }}
          >
            <span className="text-xs font-black uppercase tracking-[0.2em] text-fog-500">
              {handoff.scoredName} sichert
            </span>
            <span className="mt-2 font-mono text-6xl font-black tracking-tighter text-mint-400">
              +{handoff.points.toLocaleString('de-DE')}
            </span>
            <span className="mt-1 text-sm font-bold text-fog-400">
              Gesamt {handoff.total.toLocaleString('de-DE')} Punkte
            </span>

            <div className="my-6 h-px w-full bg-ink-700" />

            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: playerColor(handoff.nextName) }} />
            <span
              id="turn-handoff-title"
              className="mt-2 max-w-full break-words font-display text-4xl font-black tracking-tight"
              style={{ color: playerColor(handoff.nextName) }}
            >
              {handoff.nextName}
            </span>
            <span className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-fog-300">ist dran</span>

            <button
              type="button"
              onClick={() => setHandoff(null)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-3.5 font-black text-ink-950 shadow-lg transition-all active:scale-[0.98]"
            >
              Würfeln starten →
            </button>
          </div>
        </div>
      )}

      {bustAnnounce && (
        <div
          className="glass fixed inset-0 z-[56] flex items-center justify-center px-6 animate-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bust-title"
        >
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-coral-500/60 bg-coral-500/10 px-10 py-9 text-center shadow-2xl shadow-black/50">
            <span id="bust-title" className="font-display text-4xl font-black tracking-tight text-coral-400">
              {bustAnnounce.name} hat sich ausgezockt!
            </span>
            {bustAnnounce.lost > 0 && (
              <span className="text-sm font-bold text-fog-300">
                − {bustAnnounce.lost.toLocaleString('de-DE')} Punkte futsch
              </span>
            )}
            <button
              type="button"
              onClick={acknowledgeBust}
              className="mt-2 rounded-2xl bg-gradient-to-b from-coral-400 to-coral-500 px-8 py-3.5 font-bold text-white shadow-lg transition-all active:scale-[0.98]"
            >
              {bustAnnounce.nextName ? `${bustAnnounce.nextName} ist dran →` : 'Ergebnis anzeigen →'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
