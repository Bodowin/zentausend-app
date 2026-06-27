import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DiceMode, GameState, Player, Turn } from './lib/types'
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
  turns: Turn[]
  rolled: number[]
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
  const [diceMode, setDiceMode] = useState<DiceMode>('real')

  // --- Zugzustand ---
  const [dice, setDice] = useState<number[]>([])
  const [accumulated, setAccumulated] = useState(0)
  // Würfel "in der Hand" für den aktuellen Wurf (startet bei 6, sinkt beim
  // Beiseitelegen; bei 0 → heiße Würfel, wieder 6).
  const [inHand, setInHand] = useState(6)
  // Liegt in diesem Zug bereits ein Drilling/Pasch? → aktiviert Risiko-Szenario B.
  const [turnHasPasch, setTurnHasPasch] = useState(false)
  // Zug-für-Zug-Verlauf für die Runden-Analyse.
  const [turns, setTurns] = useState<Turn[]>([])
  // Virtueller Modus: aktuell geworfene, noch nicht ausgelegte Würfel.
  const [rolled, setRolled] = useState<number[]>([])
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
        diceMode,
        dice,
        accumulated,
        inHand,
        turnHasPasch,
        turns,
        rolled,
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
    diceMode,
    dice,
    accumulated,
    inHand,
    turnHasPasch,
    turns,
    rolled,
  ])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 1800)
  }, [])

  // --- Setup ---
  const startGame = (chosen: Player[], evt: string, test: boolean, mode: DiceMode) => {
    setPlayers(chosen.map((p) => ({ ...p, score: 0, busts: 0 })))
    setEvent(evt.trim())
    setTestMode(test)
    setDiceMode(mode)
    setRolled([])
    setIdx(0)
    setRound(1)
    setPhase('active')
    setTarget(0)
    setWinner(null)
    setDice([])
    setAccumulated(0)
    setInHand(6)
    setTurnHasPasch(false)
    setTurns([])
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
    setTurns(g.turns ?? [])
    setDiceMode(g.diceMode ?? 'real')
    setRolled(g.rolled ?? [])
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
            turns: [...turns],
            rolled: [...rolled],
            action,
          },
        ].slice(-UNDO_LIMIT),
      ),
    [players, idx, round, phase, target, dice, accumulated, inHand, turnHasPasch, turns, rolled],
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
    setTurns(snap.turns)
    setRolled(snap.rolled)
    setWinner(null)
    setUndoStack((stack) => stack.slice(0, -1))
    showToast('Rückgängig')
  }

  // --- Zug-Auflösung (rein, ohne Seiteneffekte) ---
  const resolveTurn = useCallback(
    (nextPlayers: Player[], justScored: number, nextTurns: Turn[]) => {
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
          const record = saveGame(win, nextPlayers, event, nextTurns)
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
        setRolled([])
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
    // Teil-Wurf: ein Joker-Pasch (2/3/4/6) bleibt liegen und wertet weiter (Szenario B).
    if (usedAll) setTurnHasPasch(false)
    else if (result.hasJokerTriple) setTurnHasPasch(true)
    setInHand(usedAll ? 6 : inHand - dice.length)
    setDice([])
    setRolled([]) // virtueller Modus: Rest neu würfeln
    showToast(usedAll ? 'Heiße Würfel!' : 'Weiter!')
  }

  // --- Virtueller Würfel-Modus ---
  const rnd6 = () => 1 + Math.floor(Math.random() * 6)
  const rollDice = () => {
    if (dice.length > 0 || rolled.length > 0) return
    buzz([14, 22, 14])
    setRolled(Array.from({ length: inHand }, rnd6))
  }
  // Ausgelegten (geworfenen) Würfel behalten → in die Ablage.
  const keepDie = (i: number) => {
    const val = rolled[i]
    if (val === undefined || dice.length >= inHand) return
    buzz(6)
    setRolled((r) => r.filter((_, j) => j !== i))
    setDice((d) => [...d, val].sort())
  }
  // Ausgelegten Würfel zurück auf den Tisch.
  const returnDie = (i: number) => {
    const val = dice[i]
    if (val === undefined) return
    setDice((d) => d.filter((_, j) => j !== i))
    setRolled((r) => [...r, val])
  }
  const clearKept = () => {
    setRolled((r) => [...r, ...dice])
    setDice([])
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
    const nextTurns = [...turns, { round, player: players[idx].name, points: pot, bust: false }]
    setTurns(nextTurns)
    resolveTurn(newPlayers, newPlayers[idx].score, nextTurns)
  }

  const handleBust = () => {
    takeSnapshot('bust')
    buzz([18, 30, 18])
    showToast('Niete!')
    const newPlayers = players.map((p, i) => (i === idx ? { ...p, busts: p.busts + 1 } : p))
    const nextTurns = [...turns, { round, player: players[idx].name, points: 0, bust: true }]
    setTurns(nextTurns)
    resolveTurn(newPlayers, newPlayers[idx].score, nextTurns)
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
    // Sonst werden die restlichen Würfel neu geworfen; ein Joker-Pasch wertet weiter.
    return computeRisk(inHand - dice.length, turnHasPasch || result.hasJokerTriple)
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
      diceMode={diceMode}
      dice={dice}
      rolled={rolled}
      inHand={inHand}
      accumulated={accumulated}
      result={result}
      totalPotential={totalPotential}
      risk={risk}
      toast={toast}
      winner={winner}
      canUndo={undoStack.length > 0}
      onAddDie={addDie}
      onRemoveDie={diceMode === 'virtual' ? returnDie : removeDie}
      onClearDice={diceMode === 'virtual' ? clearKept : clearDice}
      onRoll={rollDice}
      onKeep={keepDie}
      onContinue={handleContinue}
      onBank={handleBank}
      onBust={handleBust}
      onUndo={undo}
      onExit={exitToSetup}
      onNewGame={exitToSetup}
    />
  )
}
