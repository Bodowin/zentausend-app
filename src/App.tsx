import { useCallback, useMemo, useState } from 'react'
import type { GameState, Player } from './lib/types'
import { calculateScore, WINNING_SCORE } from './lib/scoring'
import { computeRisk } from './lib/risk'
import { saveGame } from './lib/storage'
import { buzz } from './lib/haptics'
import { SetupScreen } from './components/SetupScreen'
import { GameScreen } from './components/GameScreen'
import { StatsScreen } from './components/StatsScreen'

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

  // --- Zugzustand ---
  const [dice, setDice] = useState<number[]>([])
  const [accumulated, setAccumulated] = useState(0)
  const [toast, setToast] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  const result = useMemo(() => calculateScore(dice), [dice])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 1800)
  }, [])

  // --- Setup ---
  const startGame = (chosen: Player[], evt: string) => {
    setPlayers(chosen.map((p) => ({ ...p, score: 0, busts: 0 })))
    setEvent(evt.trim())
    setIdx(0)
    setRound(1)
    setPhase('active')
    setTarget(0)
    setWinner(null)
    setDice([])
    setAccumulated(0)
    setSnapshot(null)
    setToast('')
    setView('game')
  }

  const exitToSetup = () => {
    setPhase('setup')
    setWinner(null)
    setView('setup')
  }

  // --- Würfel-Eingabe ---
  const addDie = (val: number) => {
    if (dice.length >= 6 || phase === 'finished') return
    buzz(6)
    setDice((d) => [...d, val].sort())
  }
  const removeDie = (i: number) => setDice((d) => d.filter((_, j) => j !== i))
  const clearDice = () => setDice([])

  const takeSnapshot = useCallback(
    (action: string) =>
      setSnapshot({
        players: players.map((p) => ({ ...p })),
        idx,
        round,
        phase,
        target,
        dice: [...dice],
        accumulated,
        action,
      }),
    [players, idx, round, phase, target, dice, accumulated],
  )

  const undo = () => {
    if (!snapshot) return
    setPlayers(snapshot.players)
    setIdx(snapshot.idx)
    setRound(snapshot.round)
    setPhase(snapshot.phase)
    setTarget(snapshot.target)
    setDice(snapshot.dice)
    setAccumulated(snapshot.accumulated)
    setWinner(null)
    setSnapshot(null)
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
        saveGame(win, nextPlayers, event)
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
    [phase, idx, target, round, event, showToast],
  )

  // --- Aktionen ---
  const handleRefill = () => {
    if (!result.isValid || result.score === 0 || dice.length !== 6) return
    takeSnapshot('refill')
    buzz(10)
    setAccumulated((a) => a + result.score)
    setDice([])
    showToast('Refill!')
  }

  const handleBank = () => {
    if (!result.isValid) return
    const pot = accumulated + result.score
    if (pot === 0) return
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
    if (dice.length === 6) return computeRisk(6, false) // Refill → 6 frische Würfel
    return computeRisk(6 - dice.length, result.hasTriple)
  }, [result, dice.length])

  // --- Rendering ---
  if (view === 'stats') {
    return <StatsScreen onBack={() => setView('setup')} />
  }

  if (view === 'setup') {
    return (
      <SetupScreen
        makePlayer={(name) => ({ id: uid(), name, score: 0, busts: 0 })}
        onStart={startGame}
        onShowStats={() => setView('stats')}
      />
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
      dice={dice}
      accumulated={accumulated}
      result={result}
      totalPotential={totalPotential}
      risk={risk}
      toast={toast}
      winner={winner}
      canUndo={!!snapshot}
      onAddDie={addDie}
      onRemoveDie={removeDie}
      onClearDice={clearDice}
      onRefill={handleRefill}
      onBank={handleBank}
      onBust={handleBust}
      onUndo={undo}
      onExit={exitToSetup}
      onNewGame={exitToSetup}
    />
  )
}
