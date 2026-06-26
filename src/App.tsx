import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameState, Player } from './lib/types'
import {
  clearActiveGame,
  loadActiveGame,
  saveActiveGame,
  type ActiveGame,
} from './lib/activeGame'
import { calculateScore, ENTRY_MIN, WINNING_SCORE } from './lib/scoring'
import { computeRisk } from './lib/risk'
import { saveGame } from './lib/storage'
import { pushGame } from './lib/cloud'
import { buzz } from './lib/haptics'
import { SetupScreen } from './components/SetupScreen'
import { GameScreen } from './components/GameScreen'
import { StatsScreen } from './components/StatsScreen'
import { IntroScreen } from './components/IntroScreen'

const INTRO_KEY = '10k_seen_intro'

type View = 'setup' | 'game' | 'stats'

/** Vollständiger Schnappschuss für einen einstufigen Undo. */
interface Snapshot {
  players: Player[]
  idx: number
  round: number
  phase: GameState
  target: number
  dice: number[]
  accumulated: number
  inHand: number
  turnHasPasch: boolean
  action: string
}

const uid = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`

export function App() {
  const [view, setView] = useState<View>('setup')

  // --- Spielzustand ---
  const [players, setPlayers] = useState<Player[]>([])
  const [event, setEvent] = useState('')
  const [idx, setIdx] = useState(0)
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState<GameState>('setup')
  const [target, setTarget] = useState(0)
  const [winner, setWinner] = useState<Player | null>(null)
  const [testMode, setTestMode] = useState(false)

  // --- Zugzustand ---
  const [dice, setDice] = useState<number[]>([])
  const [accumulated, setAccumulated] = useState(0)
  // Würfel "in der Hand" für den aktuellen Wurf (startet bei 6, sinkt beim
  // Beiseitelegen; bei 0 → heiße Würfel, wieder 6).
  const [inHand, setInHand] = useState(6)
  // Liegt in diesem Zug bereits ein Drilling/Pasch? → aktiviert Risiko-Szenario B.
  const [turnHasPasch, setTurnHasPasch] = useState(false)
  const [toast, setToast] = useState('')
  // Mehrstufiges Undo: Stapel von Schnappschüssen (jüngster zuletzt).
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const UNDO_LIMIT = 30

  // Fortsetzbares (unterbrochenes) Spiel aus dem letzten Mal.
  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())

  // Erklärungs-Bildschirm beim ersten Start (und über „?" erneut aufrufbar).
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

  const result = useMemo(() => calculateScore(dice), [dice])

  // Laufendes Spiel bei jeder Änderung sichern, damit es fortsetzbar ist.
  useEffect(() => {
    if (view === 'game' && (phase === 'active' || phase === 'lastChance')) {
      saveActiveGame({
        players,
        idx,
        round,
        phase,
        target,
        event,
        testMode,
        dice,
        accumulated,
        inHand,
        turnHasPasch,
        savedAt: new Date().toISOString(),
      })
    }
  }, [
    view,
    players,
    idx,
    round,
    phase,
    target,
    event,
    testMode,
    dice,
    accumulated,
    inHand,
    turnHasPasch,
  ])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 1800)
  }, [])

  // --- Setup ---
  const startGame = (chosen: Player[], evt: string, test: boolean) => {
    setPlayers(chosen.map((p) => ({ ...p, score: 0, busts: 0 })))
    setEvent(evt.trim())
    setTestMode(test)
    setIdx(0)
    setRound(1)
    setPhase('active')
    setTarget(0)
    setWinner(null)
    setDice([])
    setAccumulated(0)
    setInHand(6)
    setTurnHasPasch(false)
    setUndoStack([])
    setResumable(null)
    setToast('')
    setView('game')
  }

  const exitToSetup = () => {
    setPhase('setup')
    setWinner(null)
    setResumable(loadActiveGame()) // unterbrochenes Spiel ggf. zum Fortsetzen anbieten
    setView('setup')
  }

  const resumeGame = (g: ActiveGame) => {
    setPlayers(g.players)
    setIdx(g.idx)
    setRound(g.round)
    setPhase(g.phase)
    setTarget(g.target)
    setEvent(g.event)
    setTestMode(g.testMode)
    setDice(g.dice)
    setAccumulated(g.accumulated)
    setInHand(g.inHand)
    setTurnHasPasch(g.turnHasPasch)
    setWinner(null)
    setUndoStack([])
    setResumable(null)
    setToast('')
    setView('game')
  }

  // --- Würfel-Eingabe ---
  const addDie = (val: number) => {
    if (dice.length >= inHand || phase === 'finished') return
    buzz(6)
    setDice((d) => [...d, val].sort())
  }
  const removeDie = (i: number) => setDice((d) => d.filter((_, j) => j !== i))
  const clearDice = () => setDice([])

  const takeSnapshot = useCallback(
    (action: string) =>
      setUndoStack((stack) =>
        [
          ...stack,
          {
            players: players.map((p) => ({ ...p })),
            idx,
            round,
            phase,
            target,
            dice: [...dice],
            accumulated,
            inHand,
            turnHasPasch,
            action,
          },
        ].slice(-UNDO_LIMIT),
      ),
    [players, idx, round, phase, target, dice, accumulated, inHand, turnHasPasch],
  )

  const undo = () => {
    const snap = undoStack[undoStack.length - 1]
    if (!snap) return
    setPlayers(snap.players)
    setIdx(snap.idx)
    setRound(snap.round)
    setPhase(snap.phase)
    setTarget(snap.target)
    setDice(snap.dice)
    setAccumulated(snap.accumulated)
    setInHand(snap.inHand)
    setTurnHasPasch(snap.turnHasPasch)
    setWinner(null)
    setUndoStack((stack) => stack.slice(0, -1))
    showToast('Rückgängig')
  }

  // --- Zug-Auflösung (rein, ohne Seiteneffekte) ---
  const resolveTurn = useCallback(
    (nextPlayers: Player[], justScored: number) => {
      const n = nextPlayers.length
      const last = n - 1

      const finish = () => {
        const sorted = [...nextPlayers].sort((a, b) => b.score - a.score)
        const win = sorted[0]
        setPlayers(nextPlayers)
        setWinner(win)
        setPhase('finished')
        // Testspiele werden weder lokal noch in der Cloud gespeichert.
        if (!testMode) {
          const record = saveGame(win, nextPlayers, event)
          void pushGame(record) // fire-and-forget: offline bleibt es lokal, Sync später
        }
        clearActiveGame() // Spiel ist vorbei → nicht mehr fortsetzbar
        buzz([12, 40, 12, 40, 60])
      }

      const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number) => {
        setPlayers(nextPlayers)
        setIdx(nextIdx)
        setPhase(nextPhase)
        setRound(nextRound)
        setTarget(nextTarget)
        setAccumulated(0)
        setDice([])
        setInHand(6)
        setTurnHasPasch(false)
      }

      if (phase === 'lastChance') {
        const nextTarget = Math.max(target, justScored)
        if (idx === last) return finish()
        if (justScored > target) showToast('Führung!')
        return advance(idx + 1, 'lastChance', round, nextTarget)
      }

      // phase === 'active'
      if (justScored >= WINNING_SCORE) {
        if (idx === last) return finish()
        showToast('Letzte Runde!')
        return advance(idx + 1, 'lastChance', round, justScored)
      }

      const nextIdx = (idx + 1) % n
      const nextRound = nextIdx === 0 ? round + 1 : round
      return advance(nextIdx, 'active', nextRound, target)
    },
    [phase, idx, target, round, event, testMode, showToast],
  )

  // --- Aktionen ---
  // Weiterwürfeln: gewertete Würfel sichern und die RESTLICHEN neu würfeln.
  // Wurden alle Würfel der Hand gelegt → heiße Würfel (wieder 6).
  const handleContinue = () => {
    if (!result.isValid || result.score === 0 || dice.length === 0 || dice.length > inHand) return
    takeSnapshot('continue')
    buzz(10)
    const usedAll = dice.length === inHand
    setAccumulated((a) => a + result.score)
    // Heiße Würfel: alle 6 neu → kein Pasch mehr auf dem Tisch.
    // Teil-Wurf: beiseitegelegte Würfel (inkl. Pasch) bleiben liegen.
    if (usedAll) setTurnHasPasch(false)
    else if (result.hasTriple) setTurnHasPasch(true)
    setInHand(usedAll ? 6 : inHand - dice.length)
    setDice([])
    showToast(usedAll ? 'Heiße Würfel!' : 'Weiter!')
  }

  const handleBank = () => {
    if (!result.isValid) return
    const pot = accumulated + result.score
    if (pot === 0) return
    // Einstiegsregel: wer noch bei 0 steht, braucht mindestens ENTRY_MIN.
    if (players[idx].score === 0 && pot < ENTRY_MIN) return
    takeSnapshot('bank')
    buzz(14)
    const newPlayers = players.map((p, i) =>
      i === idx ? { ...p, score: p.score + pot } : p,
    )
    resolveTurn(newPlayers, newPlayers[idx].score)
  }

  const handleBust = () => {
    takeSnapshot('bust')
    buzz([18, 30, 18])
    showToast('Niete!')
    const newPlayers = players.map((p, i) => (i === idx ? { ...p, busts: p.busts + 1 } : p))
    resolveTurn(newPlayers, newPlayers[idx].score)
  }

  // --- Abgeleitete Werte ---
  const current = players[idx]
  const effectiveTarget = phase === 'lastChance' ? target + 1 : WINNING_SCORE
  const neededForWin = current ? Math.max(0, effectiveTarget - current.score) : 0
  const totalPotential = accumulated + (result.isValid ? result.score : 0)

  const risk = useMemo(() => {
    if (!result.isValid || dice.length === 0 || result.score === 0) return null
    // Alle Würfel der Hand gelegt → heiße Würfel: 6 frische, kein aktiver Pasch.
    if (dice.length === inHand) return computeRisk(6, false)
    // Sonst werden die restlichen Würfel neu geworfen; ein Pasch wertet weiter.
    return computeRisk(inHand - dice.length, turnHasPasch || result.hasTriple)
  }, [result, dice.length, inHand, turnHasPasch])

  // --- Rendering ---
  if (view === 'stats') {
    return <StatsScreen onBack={() => setView('setup')} />
  }

  if (view === 'setup') {
    return (
      <>
        <SetupScreen
          makePlayer={(name) => ({ id: uid(), name, score: 0, busts: 0 })}
          onStart={startGame}
          onShowStats={() => setView('stats')}
          onShowHelp={() => setShowIntro(true)}
          resumable={resumable}
          onResume={resumeGame}
        />
        {showIntro && <IntroScreen onClose={closeIntro} />}
      </>
    )
  }

  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center text-fog-400">Lade…</div>
    )
  }

  return (
    <GameScreen
      players={players}
      idx={idx}
      round={round}
      phase={phase}
      event={event}
      effectiveTarget={effectiveTarget}
      neededForWin={neededForWin}
      testMode={testMode}
      dice={dice}
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
      onContinue={handleContinue}
      onBank={handleBank}
      onBust={handleBust}
      onUndo={undo}
      onExit={exitToSetup}
      onNewGame={exitToSetup}
    />
  )
}
