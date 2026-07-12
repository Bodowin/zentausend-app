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
import { playerColor } from './lib/colors'
import { getPrefs } from './lib/prefs'
import { SetupScreen } from './components/SetupScreen'
import { GameScreen } from './components/GameScreen'
import { StatsScreen } from './components/StatsScreen'
import { IntroScreen } from './components/IntroScreen'
import { Celebration, type CelebrationData } from './components/Celebration'
import { celebrationFor } from './lib/celebration'

const INTRO_KEY = '10k_seen_intro'

type View = 'setup' | 'game' | 'stats'

/** Vollständiger Schnappschuss für einen einstufigen Undo. */
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
  // Konfigurierbares Ziel + Einstiegsgrenze (Standard: 10.000 / 350).
  const [goalScore, setGoalScore] = useState(WINNING_SCORE)
  const [entryMin, setEntryMin] = useState(ENTRY_MIN)
  // Vorbelegung des Setup-Screens für eine Revanche (gleicher Kader, Sieger beginnt).
  const [setupSeed, setSetupSeed] = useState<{
    players: Player[]
    event: string
    diceMode: DiceMode
    goalScore: number
    entryMin: number
  } | null>(null)

  // --- Zugzustand ---
  // Bereits ausgelegte Würfel dieser "Hand" (über mehrere Würfe hinweg, bis
  // heiße Würfel). Werden GEMEINSAM gewertet, damit Drillinge auch über mehrere
  // Würfe entstehen (drei 1er = 1000, nicht 3×100).
  const [kept, setKept] = useState<number[]>([])
  // Würfel des aktuellen Wurfs (noch nicht "weiter" bestätigt).
  const [dice, setDice] = useState<number[]>([])
  // Gesicherte Punkte aus abgeschlossenen heißen Würfeln in diesem Zug.
  const [accumulated, setAccumulated] = useState(0)
  // Zug-für-Zug-Verlauf für die Runden-Analyse.
  const [turns, setTurns] = useState<Turn[]>([])
  // Virtueller Modus: aktuell geworfene, noch nicht ausgelegte Würfel.
  const [rolled, setRolled] = useState<number[]>([])
  // Virtueller Modus: die Augen des aktuellen Wurfs (stabile Reihenfolge für die
  // Schale) + Zähler, der die Schale bei jedem neuen Wurf frisch aufsetzt.
  const [thrown, setThrown] = useState<number[]>([])
  const [throwSeq, setThrowSeq] = useState(0)
  const [toast, setToast] = useState('')
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)
  // Kurze „X ist dran"-Einblendung beim Spielerwechsel (Übergabe am Tisch).
  const [handoff, setHandoff] = useState<string | null>(null)
  // Niete: großes Banner statt sofortigem Weiterschalten – `commit` führt die
  // eigentliche Zug-Auflösung erst aus, wenn "Nächster Spieler" bestätigt wird.
  const [bustAnnounce, setBustAnnounce] = useState<{ name: string; lost: number; commit: () => void } | null>(
    null,
  )
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

  // Die ganze Hand (ausgelegt + aktueller Wurf) wird gemeinsam gewertet.
  const combined = useMemo(() => [...kept, ...dice], [kept, dice])
  const result = useMemo(() => calculateScore(combined), [combined])
  const inHand = 6 - kept.length // Würfel, die diesen Wurf geworfen/getippt werden

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
        goalScore,
        entryMin,
        kept,
        dice,
        accumulated,
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
    goalScore,
    entryMin,
    kept,
    dice,
    accumulated,
    turns,
    rolled,
  ])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? '' : t)), 1800)
  }, [])

  // „X ist dran"-Banner nach kurzer Zeit selbst ausblenden. Etwas länger als
  // die frühere kleine Einblendung, damit das jetzt große Banner in Ruhe
  // gelesen werden kann.
  useEffect(() => {
    if (!handoff) return
    const t = window.setTimeout(() => setHandoff(null), 2000)
    return () => window.clearTimeout(t)
  }, [handoff])

  // --- Setup ---
  const startGame = (
    chosen: Player[],
    evt: string,
    test: boolean,
    mode: DiceMode,
    goal: number,
    entry: number,
  ) => {
    setPlayers(chosen.map((p) => ({ ...p, score: 0, busts: 0 })))
    setEvent(evt.trim())
    setTestMode(test)
    setDiceMode(mode)
    setGoalScore(goal)
    setEntryMin(entry)
    setRolled([])
    setThrown([])
    setIdx(0)
    setRound(1)
    setPhase('active')
    setTarget(0)
    setWinner(null)
    setKept([])
    setDice([])
    setAccumulated(0)
    setTurns([])
    setUndoStack([])
    setResumable(null)
    setToast('')
    setView('game')
  }

  const exitToSetup = () => {
    setPhase('setup')
    setWinner(null)
    setSetupSeed(null) // „Neues Spiel" startet mit leerem Kader
    setResumable(loadActiveGame()) // unterbrochenes Spiel ggf. zum Fortsetzen anbieten
    setView('setup')
  }

  // Revanche: gleicher Kader, Sieger beginnt, Reihenfolge im Uhrzeigersinn
  // beibehalten. Der Setup-Screen wird damit vorbelegt – die Reihenfolge bleibt
  // dort frei änderbar, bevor man erneut startet.
  const startRematch = () => {
    const wi = winner ? players.findIndex((p) => p.id === winner.id) : 0
    const start = wi < 0 ? 0 : wi
    const ordered = [...players.slice(start), ...players.slice(0, start)].map((p) => ({
      ...p,
      score: 0,
      busts: 0,
    }))
    clearActiveGame()
    setSetupSeed({ players: ordered, event, diceMode, goalScore, entryMin })
    setPhase('setup')
    setWinner(null)
    setResumable(null)
    setView('setup')
  }

  const discardResume = () => {
    clearActiveGame()
    setResumable(null)
  }

  const resumeGame = (g: ActiveGame) => {
    setPlayers(g.players)
    setIdx(g.idx)
    setRound(g.round)
    setPhase(g.phase)
    setTarget(g.target)
    setEvent(g.event)
    setTestMode(g.testMode)
    setGoalScore(g.goalScore ?? WINNING_SCORE)
    setEntryMin(g.entryMin ?? ENTRY_MIN)
    setKept(g.kept ?? [])
    setAccumulated(g.accumulated)
    setTurns(g.turns ?? [])
    setDiceMode(g.diceMode ?? 'real')
    // Virtueller Modus: laufenden Wurf nicht fortsetzen – Effekt wirft frisch.
    setDice(g.diceMode === 'virtual' ? [] : g.dice)
    setRolled(g.diceMode === 'virtual' ? [] : (g.rolled ?? []))
    setThrown([])
    setWinner(null)
    setUndoStack([])
    setResumable(null)
    setToast('')
    setView('game')
  }

  // --- Würfel-Eingabe ---
  const addDie = (val: number) => {
    if (kept.length + dice.length >= 6 || phase === 'finished') return
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
            kept: [...kept],
            dice: [...dice],
            accumulated,
            turns: [...turns],
            rolled: [...rolled],
            action,
          },
        ].slice(-UNDO_LIMIT),
      ),
    [players, idx, round, phase, target, kept, dice, accumulated, turns, rolled],
  )

  const undo = () => {
    const snap = undoStack[undoStack.length - 1]
    if (!snap) return
    setPlayers(snap.players)
    setIdx(snap.idx)
    setRound(snap.round)
    setPhase(snap.phase)
    setTarget(snap.target)
    setKept(snap.kept)
    setAccumulated(snap.accumulated)
    setTurns(snap.turns)
    // Virtueller Modus: laufenden Wurf nicht rekonstruieren – frische Schale.
    setDice(diceMode === 'virtual' ? [] : snap.dice)
    setRolled(diceMode === 'virtual' ? [] : snap.rolled)
    setThrown([])
    setWinner(null)
    setUndoStack((stack) => stack.slice(0, -1))
    showToast('Rückgängig')
  }

  // Feiert die Schale gerade etwas (Pasch, Straße, heiße Würfel …)? Dann erst
  // die Feier zu Ende laufen lassen, bevor „X ist dran" erscheint – beide sind
  // Vollbild-Einblendungen und überlagerten sich sonst.
  const CELEBRATION_HANDOFF_DELAY_MS = 2000

  // --- Zug-Auflösung (rein, ohne Seiteneffekte) ---
  const resolveTurn = useCallback(
    (nextPlayers: Player[], justScored: number, nextTurns: Turn[], celebrating: boolean) => {
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
        setKept([])
        setDice([])
        setRolled([])
        setThrown([])
        if (getPrefs().handoff) {
          const name = nextPlayers[nextIdx].name
          if (celebrating) window.setTimeout(() => setHandoff(name), CELEBRATION_HANDOFF_DELAY_MS)
          else setHandoff(name) // „X ist dran" (optional)
        }
      }

      if (phase === 'lastChance') {
        const nextTarget = Math.max(target, justScored)
        if (idx === last) return finish()
        if (justScored > target) showToast('Führung!')
        return advance(idx + 1, 'lastChance', round, nextTarget)
      }

      // phase === 'active'
      if (justScored >= goalScore) {
        if (idx === last) return finish()
        showToast('Letzte Runde!')
        return advance(idx + 1, 'lastChance', round, justScored)
      }

      const nextIdx = (idx + 1) % n
      const nextRound = nextIdx === 0 ? round + 1 : round
      return advance(nextIdx, 'active', nextRound, target)
    },
    [phase, idx, target, round, event, testMode, goalScore, showToast],
  )

  // --- Aktionen ---
  // Weiterwürfeln: aktuellen Wurf zur Hand dazulegen und die RESTLICHEN neu
  // würfeln. Sind alle 6 ausgelegt → heiße Würfel: Hand-Punkte sichern, neu mit 6.
  const handleContinue = () => {
    if (!result.isValid || result.score === 0 || dice.length === 0) return
    takeSnapshot('continue')
    buzz(10)
    const newKept = [...kept, ...dice]
    const cel = celebrationFor(combined, newKept.length === 6)
    if (cel) setCelebration(cel)
    if (newKept.length === 6) {
      // Heiße Würfel: die ganze Hand ist gewertet → Punkte sichern, frisch starten.
      setAccumulated((a) => a + calculateScore(newKept).score)
      setKept([])
      if (!cel) showToast('Heiße Würfel!')
    } else {
      setKept(newKept)
      if (!cel) showToast('Zocken!')
    }
    setDice([])
    setRolled([])
    setThrown([]) // virtueller Modus: Effekt präsentiert den nächsten Wurf
  }

  // Würfel-Modus mitten im Spiel wechseln (nur sinnvoll am Zug-Anfang).
  const toggleDiceMode = () => {
    setDiceMode((m) => (m === 'real' ? 'virtual' : 'real'))
    setRolled([])
    setDice([])
    setThrown([])
  }

  // --- Virtueller Würfel-Modus (Schale auf einem Screen) ---
  const rnd6 = () => 1 + Math.floor(Math.random() * 6)
  // Neuen Wurf in die Schale legen: Augen vorab bestimmen (Physik landet genau
  // darauf), nichts ausgewählt. Die Schale setzt über throwSeq frisch auf.
  const newThrow = useCallback(() => {
    const n = 6 - kept.length
    if (n <= 0) return
    const vals = Array.from({ length: n }, rnd6).sort((a, b) => a - b)
    setThrown(vals)
    setRolled(vals)
    setDice([])
    setThrowSeq((s) => s + 1)
  }, [kept.length])

  // Sobald ein neuer Wurf fällig ist (Zuganfang, nach „Weiter", heiße Würfel),
  // automatisch eine frische Schale präsentieren – getippt wird in der Schale.
  useEffect(() => {
    if (
      diceMode === 'virtual' &&
      view === 'game' &&
      (phase === 'active' || phase === 'lastChance') &&
      !winner &&
      thrown.length === 0 &&
      dice.length === 0 &&
      kept.length < 6
    ) {
      newThrow()
    }
  }, [diceMode, view, phase, winner, thrown.length, dice.length, kept.length, newThrow])

  // Auswahl aus der Schale übernehmen: ausgelegte = gewertete Augen.
  const handleBowlSelect = (selected: number[], remaining: number[]) => {
    buzz(6)
    setDice([...selected].sort((a, b) => a - b))
    setRolled([...remaining].sort((a, b) => a - b))
  }

  const handleBank = () => {
    if (!result.isValid) return
    const pot = accumulated + result.score
    if (pot === 0) return
    // Einstiegsregel: wer noch bei 0 steht, braucht mindestens entryMin.
    if (players[idx].score === 0 && pot < entryMin) return
    const cel = celebrationFor(combined, combined.length === 6)
    // Beim Sichern zeigt die Feier bewusst die GESAMT im Zug gesicherten Punkte
    // (inkl. evtl. schon gebankter heißer Würfel) statt nur des Werts dieses
    // einen Wurfs – das ist die Zahl, die gerade wirklich aufs Konto geht. Beim
    // Weiterwürfeln (Zocken) bleibt die Feier unverändert (Wurf-Wert/„Heiße
    // Würfel!"), da dort noch nichts final gesichert ist.
    if (cel) setCelebration({ ...cel, sub: `${pot.toLocaleString('de-DE')} Punkte` })
    takeSnapshot('bank')
    buzz(14)
    const newPlayers = players.map((p, i) =>
      i === idx ? { ...p, score: p.score + pot } : p,
    )
    const nextTurns = [...turns, { round, player: players[idx].name, points: pot, bust: false }]
    setTurns(nextTurns)
    resolveTurn(newPlayers, newPlayers[idx].score, nextTurns, !!cel)
  }

  // Niete: den Zug NICHT sofort auflösen, sondern erst ein großes „ausgezockt"-
  // Banner zeigen und auf explizite Bestätigung warten (bustAnnounce.commit).
  // So bleibt der Verlust kurz sichtbar, statt dass sofort zum nächsten
  // Spieler gesprungen wird – gerade bei einem großen Zug frustrierend schnell.
  const handleBust = () => {
    takeSnapshot('bust')
    buzz([18, 30, 18])
    const lost = totalPotential
    const bustedName = players[idx].name
    const newPlayers = players.map((p, i) => (i === idx ? { ...p, busts: p.busts + 1 } : p))
    const nextTurns = [...turns, { round, player: players[idx].name, points: 0, bust: true }]
    setBustAnnounce({
      name: bustedName,
      lost,
      commit: () => {
        setTurns(nextTurns)
        setBustAnnounce(null)
        resolveTurn(newPlayers, newPlayers[idx].score, nextTurns, false)
      },
    })
  }

  // --- Abgeleitete Werte ---
  const current = players[idx]
  const effectiveTarget = phase === 'lastChance' ? target + 1 : goalScore
  const neededForWin = current ? Math.max(0, effectiveTarget - current.score) : 0
  const totalPotential = accumulated + (result.isValid ? result.score : 0)

  const risk = useMemo(() => {
    if (!result.isValid || dice.length === 0 || result.score === 0) return null
    // Ganze Hand gelegt → heiße Würfel: 6 frische, kein aktiver Pasch mehr.
    if (combined.length === 6) return computeRisk(6, false)
    // Sonst werden die restlichen Würfel neu geworfen; ein Joker-Pasch wertet weiter.
    return computeRisk(6 - combined.length, result.hasJokerTriple)
  }, [result, dice.length, combined.length])

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
          onDiscardResume={discardResume}
          initialPlayers={setupSeed?.players}
          initialEvent={setupSeed?.event}
          initialDiceMode={setupSeed?.diceMode}
          initialGoalScore={setupSeed?.goalScore}
          initialEntryMin={setupSeed?.entryMin}
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
    <>
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
      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}
      {handoff && (
        // Großes, mittiges Banner über der ganzen Spielfläche – am oberen
        // Bildschirmrand (v.a. auf großen/quer gehaltenen Geräten wie einem
        // aufrecht am Tisch stehenden iPad) geht ein kleiner Hinweis leicht
        // unter. Bleibt nicht-blockierend (pointer-events-none), damit man bei
        // Bedarf sofort weiterspielen kann, statt zu warten.
        <div className="glass pointer-events-none fixed inset-0 z-[55] flex items-center justify-center px-6 animate-pop">
          <div
            className="flex flex-col items-center gap-3 rounded-3xl border-2 px-12 py-9 text-center shadow-2xl shadow-black/50"
            style={{ borderColor: `${playerColor(handoff)}80`, backgroundColor: `${playerColor(handoff)}14` }}
          >
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: playerColor(handoff) }} />
            <span className="font-display text-5xl font-black tracking-tight" style={{ color: playerColor(handoff) }}>
              {handoff}
            </span>
            <span className="text-lg font-bold uppercase tracking-[0.2em] text-fog-300">ist dran</span>
          </div>
        </div>
      )}
      {bustAnnounce && (
        // Anders als die Übergabe-Einblendung BLOCKIEREND (pointer-events-auto)
        // und ohne Auto-Ausblenden: der Verlust soll bewusst wahrgenommen
        // werden, bevor es weitergeht – kein Wegtippen aus Versehen.
        <div className="glass fixed inset-0 z-[56] flex items-center justify-center px-6 animate-pop">
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-coral-500/60 bg-coral-500/10 px-10 py-9 text-center shadow-2xl shadow-black/50">
            <span className="font-display text-4xl font-black tracking-tight text-coral-400">
              {bustAnnounce.name} hat sich ausgezockt!
            </span>
            {bustAnnounce.lost > 0 && (
              <span className="text-sm font-bold text-fog-300">
                − {bustAnnounce.lost.toLocaleString('de-DE')} Punkte futsch
              </span>
            )}
            <button
              onClick={bustAnnounce.commit}
              className="mt-2 rounded-2xl bg-gradient-to-b from-coral-400 to-coral-500 px-8 py-3.5 font-bold text-white shadow-lg transition-all active:scale-[0.98]"
            >
              Nächster Spieler →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
