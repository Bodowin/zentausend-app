import { lazy, Suspense, useMemo, useState } from 'react'
import type { DiceMode, GameRecord, Player, ScoreResult, GameState, Turn } from '../lib/types'
import type { CoachTone, RiskInfo } from '../lib/risk'
import { computeRisk, explainRisk, recommendAction } from '../lib/risk'
import { playerColor } from '../lib/colors'
import { getPrefs } from '../lib/prefs'
import { computeGameAnalysis } from '../lib/storage'
import { PIPS } from '../lib/dicePips'
import { diceThrowSeed } from '../lib/diceThrowSeed'
import { TurnLogDialog } from './TurnLogDialog'
import { GameChart } from './GameChart'
import {
  IconCheck,
  IconChart,
  IconPause,
  IconRefresh,
  IconShare,
  IconTrash,
  IconTrophy,
  IconUndo,
} from './Icons'

const DiceArena = lazy(() => import('./DiceArena'))
const AnalysisScreen = lazy(() =>
  import('./AnalysisScreen').then((module) => ({ default: module.AnalysisScreen })),
)

interface Props {
  players: Player[]
  idx: number
  round: number
  phase: GameState
  event: string
  effectiveTarget: number
  neededForWin: number
  testMode: boolean
  diceMode: DiceMode
  /** Ziel-Punktzahl dieses Spiels (Standard 10.000). */
  goalScore: number
  /** Einstiegsgrenze dieses Spiels (Standard 350). */
  entryMin: number
  kept: number[]
  dice: number[]
  rolled: number[]
  /** Zug-für-Zug-Verlauf für die Mini-Punktekurve je Spieler. */
  turns: Turn[]
  /** Virtueller Modus: Augen des aktuellen Wurfs (stabile Reihenfolge). */
  thrown: number[]
  /** Hochzählender Wurf-Zähler – setzt die Schale je Wurf frisch auf. */
  throwSeq: number
  inHand: number
  accumulated: number
  result: ScoreResult
  totalPotential: number
  risk: RiskInfo | null
  toast: string
  winner: Player | null
  canUndo: boolean
  onAddDie: (v: number) => void
  onRemoveDie: (i: number) => void
  onClearDice: () => void
  onBowlSelect: (selected: number[], remaining: number[]) => void
  onContinue: () => void
  onBank: () => void
  onBust: () => void
  onUndo: () => void
  onCorrectTurn: (index: number, points: number, bust: boolean) => { ok: boolean; message: string }
  onExit: () => void
  onNewGame: () => void
  onRematch: () => void
  onToggleDiceMode: () => void
}

const fmt = (n: number) => n.toLocaleString('de-DE')

export function GameScreen(p: Props) {
  const {
    players,
    idx,
    round,
    phase,
    event,
    effectiveTarget,
    neededForWin,
    testMode,
    diceMode,
    goalScore,
    entryMin,
    kept,
    dice,
    rolled,
    turns,
    thrown,
    throwSeq,
    inHand,
    accumulated,
    result,
    totalPotential,
    risk,
    toast,
    winner,
    canUndo,
  } = p

  const [showTurnLog, setShowTurnLog] = useState(false)
  const [showRiskInfo, setShowRiskInfo] = useState(false)
  // Rundenanalyse direkt vom Sieg-Overlay aus öffnen, ohne über die Statistik
  // gehen zu müssen.
  const [showAnalysis, setShowAnalysis] = useState(false)
  // Wurfphase der Schale, um den Coach schon während des Drehens zu zeigen.
  const [bowlPhase, setBowlPhase] = useState<'ready' | 'rolling' | 'landed'>('ready')
  // Virtueller Modus: alles außer der Schale kompakter, damit die Würfel groß
  // und gut antippbar sind.
  const virtual = diceMode === 'virtual'
  const lastChance = phase === 'lastChance'
  // Einstiegsregel: noch nicht "auf dem Brett" (Score 0) → erst ab ENTRY_MIN sichern.
  const onBoard = players[idx].score > 0
  const entryShort = !onBoard && totalPotential > 0 && totalPotential < entryMin
  const canBank = result.isValid && totalPotential > 0 && (onBoard || totalPotential >= entryMin)
  // „Doch sichern" (ohne den neuen Wurf zu werten) geht nur, solange die Würfel
  // noch in der Hand kreiseln. Sobald gewürfelt wurde, ist man festgelegt.
  const canBankIdle = canBank && (diceMode !== 'virtual' || bowlPhase === 'ready')
  // Weiterwürfeln möglich, sobald mindestens ein gültiger Würfel gelegt ist.
  const canContinue = result.isValid && result.score > 0 && dice.length >= 1
  // Alle Würfel der Hand gelegt → heiße Würfel (6 neu), sonst Rest neu würfeln.
  const usedAll = dice.length === inHand
  const remainingAfter = inHand - dice.length
  // Kein Wurf gewertet → nur Niete (verliert ggf. das im Zug Gesicherte).
  const idle = dice.length === 0
  const neededAfterBank = Math.max(0, neededForWin - totalPotential)
  // Letzte Chance: Anführer (höchster Score) und die zu schlagende Marke.
  const leader = lastChance ? [...players].sort((a, b) => b.score - a.score)[0] : null
  const beatScore = effectiveTarget - 1

  // Risiko schon WÄHREND des virtuellen Wurfs zeigen (Würfel drehen/fallen, noch
  // nichts ausgewählt) → man kann sich rechtzeitig fürs Sichern entscheiden.
  const preThrow =
    diceMode === 'virtual' &&
    dice.length === 0 &&
    kept.length < 6 &&
    (bowlPhase === 'ready' || bowlPhase === 'rolling')
  const meterRisk = preThrow ? computeRisk(inHand, result.hasJokerTriple) : risk

  // Risiko-Coach: Empfehlung, die nicht nur die Bust-Chance, sondern auch den
  // Topf-Einsatz berücksichtigt (großer Topf → vorsichtiger raten).
  const TONE_CLASS: Record<CoachTone, string> = {
    good: 'text-mint-400',
    ok: 'text-risk-4',
    warn: 'text-risk-3',
    danger: 'text-coral-400',
  }
  const coach: { text: string; tone: string } | null =
    !meterRisk || totalPotential === 0
      ? null
      : (() => {
          const a = recommendAction(meterRisk.pct, totalPotential, canBank, neededAfterBank <= 0)
          return { text: a.text, tone: TONE_CLASS[a.tone] }
        })()

  // Was wurde in dieser 6er-Hand insgesamt schon ausgelegt? Nach Augenzahl
  // gruppiert (kept = frühere Würfe, dice = aktuelle Auswahl). Ein Drilling+
  // macht diese Augenzahl zur Rettung – das hebt der „Pasch"-Hinweis hervor.
  // Gemeinsame y-Skala für die Mini-Punktekurven (höchster Punktestand).
  const maxScore = Math.max(1, ...players.map((pl) => pl.score))
  const throwMotionSeed = useMemo(
    () =>
      diceThrowSeed({
        values: thrown,
        round,
        playerIndex: idx,
        turnCount: turns.length,
        keptCount: kept.length,
        accumulated,
      }),
    [thrown, round, idx, turns.length, kept.length, accumulated],
  )
  const showMiniChart = getPrefs().miniChart
  const laidOut = [...kept, ...dice]
  const laidGroups = [1, 2, 3, 4, 5, 6]
    .map((value) => ({ value, count: laidOut.filter((x) => x === value).length }))
    .filter((g) => g.count > 0)

  // Live-Spielverlauf (Kurve + Rundentabelle) für die iPad-Seitenleiste: nutzt
  // dieselbe Analyse-Funktion wie der Rückblick nach dem Spiel, gefüttert mit
  // dem aktuellen (noch laufenden) Stand statt einem abgeschlossenen Spiel.
  const liveAnalysis = useMemo(
    () =>
      computeGameAnalysis({
        id: 0,
        date: '',
        event: '',
        winner: '',
        winnerScore: 0,
        players: players.map((pl) => ({ name: pl.name, score: pl.score, busts: pl.busts })),
        turns,
      }),
    [players, turns],
  )
  // Niete ja/nein je Runde+Spieler, für die kompakte Rundentabelle (roundPoints
  // allein unterscheidet „Niete" nicht von „noch kein Zug in dieser Runde").
  const bustByRoundPlayer = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const t of turns) m.set(`${t.round}|${t.player}`, t.bust)
    return m
  }, [turns])

  // Für die „Runden-Analyse" direkt vom Sieg-Overlay: dasselbe Format wie ein
  // gespeichertes Spiel, aus dem aktuellen Endstand gebaut – funktioniert auch
  // für Testspiele, die gar nicht in der Statistik landen.
  const finishedGameRecord: GameRecord | null = useMemo(() => {
    if (!winner) return null
    return {
      id: 0,
      date: new Date().toISOString(),
      event,
      winner: winner.name,
      winnerScore: winner.score,
      players: players.map((pl) => ({ name: pl.name, score: pl.score, busts: pl.busts })),
      turns,
    }
  }, [winner, players, turns, event])

  // Kompakte Rundentabelle für die iPad-Seitenleiste: wie „Punkte pro Runde"
  // im Rückblick nach dem Spiel, aber enger und mit eigener Nieten-Markierung
  // (roundPoints allein zeigt für Nieten und „noch kein Zug" beides als 0).
  const renderRoundTable = () => (
    <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40">
      <div className="scrollbar-hide overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-ink-800 text-[9px] uppercase tracking-wide text-fog-600">
              <th className="px-2.5 py-1.5 text-left font-bold">Rd.</th>
              {liveAnalysis.players.map((pl) => (
                <th key={pl.name} className="px-2 py-1.5 text-right font-bold">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: playerColor(pl.name) }} />
                    <span className="max-w-[52px] truncate">{pl.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liveAnalysis.roundNumbers.map((r) => (
              <tr key={r} className="border-b border-ink-800/50 last:border-0">
                <td className="px-2.5 py-1.5 font-mono text-fog-500">{r}</td>
                {liveAnalysis.players.map((pl) => {
                  const bust = bustByRoundPlayer.get(`${r}|${pl.name}`)
                  const v = liveAnalysis.roundPoints[r]?.[pl.name] ?? 0
                  return (
                    <td
                      key={pl.name}
                      className={`px-2 py-1.5 text-right font-mono ${
                        bust ? 'font-bold text-coral-400' : v > 0 ? 'text-fog-200' : 'text-fog-700'
                      }`}
                    >
                      {bust ? '✕' : v > 0 ? fmt(v) : '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-700 bg-ink-900/60 font-bold">
              <td className="px-2.5 py-1.5 text-[9px] uppercase text-fog-500">Σ</td>
              {liveAnalysis.players.map((pl) => (
                <td key={pl.name} className="px-2 py-1.5 text-right font-mono text-gold-400">
                  {fmt(pl.total)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

  // --- iPad-Querformat: Risiko-Meter, Aktions-Buttons und Zahlen-Pad wandern
  // in eine breite Seitenleiste rechts, damit Würfelschale bzw. Zahlen-Pad
  // links die volle Breite/Höhe nutzen können. Als Funktionen gehalten, damit
  // Hochformat (unverändert) und Querformat dieselbe Logik/Markup teilen, statt
  // sie zweimal pflegen zu müssen. `big` schaltet nur auf größere Touch-Ziele.
  const renderRiskMeter = (big: boolean) =>
    meterRisk && (
      <div
        className={`rounded-xl border border-ink-800 bg-ink-900/60 px-3 animate-pop ${
          big ? 'py-3' : virtual ? 'py-1.5' : 'py-2'
        }`}
      >
        {/* Zeile 1: Label + Info (links) · Empfehlung des Coaches (rechts) */}
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowRiskInfo(true)}
            className={`flex shrink-0 items-center gap-1 font-semibold uppercase tracking-wide text-fog-500 transition-colors hover:text-fog-300 ${
              big ? 'text-xs' : 'text-[10px]'
            }`}
            aria-label="Wahrscheinlichkeit erklären"
          >
            {preThrow ? 'Nächster Wurf' : meterRisk.scenarioB ? 'Mit Pasch weiter' : 'Weiterwürfeln'}
            <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-fog-600 text-[8px] font-black not-italic text-fog-500">
              i
            </span>
          </button>
          {coach && (
            <span className={`text-right font-bold leading-tight ${coach.tone} ${big ? 'text-sm' : 'text-xs'}`}>
              {coach.text}
            </span>
          )}
        </div>
        {/* Zeile 2: Balken · Bewertung · Prozent */}
        <div className="flex items-center gap-2.5">
          <div className={`flex-1 overflow-hidden rounded-full bg-ink-800 ${big ? 'h-3' : 'h-2'}`}>
            <div className={`h-full rounded-full ${meterRisk.bar}`} style={{ width: `${meterRisk.pct}%` }} />
          </div>
          <span className={`shrink-0 font-bold ${meterRisk.color} ${big ? 'text-sm' : 'text-xs'}`}>
            {meterRisk.label}
          </span>
          <span className={`shrink-0 font-bold tabular-nums text-fog-400 ${big ? 'text-sm' : 'text-xs'}`}>
            {meterRisk.pct.toFixed(0)}%
          </span>
        </div>
      </div>
    )

  const renderNumpad = (big: boolean) => (
    <div className={big ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-6 gap-2'}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          onClick={() => p.onAddDie(n)}
          aria-label={`Würfel ${n} hinzufügen`}
          disabled={dice.length >= inHand || phase === 'finished'}
          className={`rounded-xl border-b-4 border-ink-950 bg-ink-800 font-bold text-fog-100 transition-all hover:bg-ink-700 active:translate-y-1 active:border-b-0 disabled:translate-y-0 disabled:opacity-30 ${
            big ? 'h-24 text-3xl' : 'h-14 text-xl'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )

  const renderActionBar = (big: boolean) => (
    <div className={big ? 'h-24' : 'h-14'}>
      {idle ? (
        <div className="grid h-full grid-cols-[1fr_2fr] gap-3">
          <button
            onClick={p.onBust}
            aria-label="Niete verbuchen"
            className={`flex flex-col items-center justify-center rounded-xl border border-coral-500/30 bg-ink-900 font-bold leading-none text-coral-400 transition-colors hover:bg-coral-500/10 ${
              big ? 'text-lg' : ''
            }`}
          >
            Niete
            {accumulated > 0 && (
              <span className="mt-0.5 text-[9px] font-normal opacity-80">verliert {fmt(accumulated)}</span>
            )}
          </button>
          {canBankIdle ? (
            /* Umentschieden: schon Ausgelegtes doch sichern, ohne neu zu werfen. */
            <button
              onClick={p.onBank}
              aria-label={`${fmt(totalPotential)} Punkte sichern`}
              className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-mint-400 to-mint-500 font-bold text-ink-950 shadow-[0_4px_0_var(--color-mint-600)] transition-all active:translate-y-1 active:shadow-none ${
                big ? 'text-lg' : ''
              }`}
            >
              <IconCheck className={big ? 'h-7 w-7' : 'h-5 w-5'} />
              <div className="flex flex-col items-start leading-none">
                <span>Doch sichern</span>
                <span className="mt-0.5 text-[10px] font-normal opacity-80">{fmt(totalPotential)}</span>
              </div>
            </button>
          ) : (
            <div className="grid place-items-center rounded-xl border border-dashed border-ink-800 text-sm italic text-fog-600">
              {diceMode === 'virtual' && rolled.length > 0
                ? 'Würfel auslegen…'
                : inHand < 6
                  ? `${inHand} Würfel werfen…`
                  : 'Auf Wurf warten…'}
            </div>
          )}
        </div>
      ) : !result.isValid ? (
        <div className="grid h-full grid-cols-[1fr_2fr] gap-3">
          <button
            onClick={p.onBust}
            aria-label="Niete verbuchen"
            className={`rounded-xl border border-ink-800 bg-ink-900 font-bold text-fog-500 transition-colors hover:border-coral-500/40 hover:text-coral-400 ${
              big ? 'text-lg' : ''
            }`}
          >
            Niete
          </button>
          <button disabled className={`cursor-not-allowed rounded-xl bg-ink-800 font-bold text-fog-600 ${big ? 'text-lg' : ''}`}>
            Ungültig
          </button>
        </div>
      ) : (
        <div className="grid h-full grid-cols-2 gap-3">
          <button
            onClick={p.onBank}
            aria-label={`${fmt(totalPotential)} Punkte sichern`}
            disabled={!canBank}
            className={`flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${
              canBank
                ? 'bg-gradient-to-b from-mint-400 to-mint-500 text-ink-950 shadow-[0_4px_0_var(--color-mint-600)] active:translate-y-1 active:shadow-none'
                : 'cursor-not-allowed bg-ink-800 text-fog-600'
            } ${big ? 'text-lg' : ''}`}
          >
            <IconCheck className={big ? 'h-8 w-8' : 'h-6 w-6'} />
            <div className="flex flex-col items-start leading-none">
              <span>{fmt(totalPotential)}</span>
              {entryShort && (
                <span className="mt-0.5 text-[10px] font-normal opacity-80">Einstieg ab {entryMin}</span>
              )}
            </div>
          </button>
          <button
            onClick={p.onContinue}
            aria-label={usedAll ? 'Heiße Würfel – sechs neue Würfel' : `Weiterwürfeln mit ${remainingAfter} Würfeln`}
            disabled={!canContinue}
            // Bewusst Bernstein statt der früheren neutralen Iris-Farbe: dieser
            // Knopf ist die riskante Entscheidung (weiterwürfeln kann alles aus
            // diesem Zug kosten) und soll sich klar von „Sichern" (Mint = sicher)
            // unterscheiden, damit man ihn nicht aus Versehen verwechselt.
            className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 font-bold text-ink-950 shadow-[0_4px_0_var(--color-amber-600)] transition-all active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:from-ink-800 disabled:to-ink-800 disabled:text-fog-600 disabled:shadow-none ${
              usedAll ? 'animate-pulse' : ''
            } ${big ? 'text-lg' : ''}`}
          >
            <IconRefresh className={big ? 'h-7 w-7' : 'h-5 w-5'} />
            <div className="flex flex-col items-start leading-none">
              <span>{usedAll ? 'Heiße Würfel' : 'Zocken'}</span>
              <span className="mt-0.5 text-[10px] font-normal opacity-80">
                {usedAll ? '6 neu' : `noch ${remainingAfter}`}
                {risk ? ` · ${risk.pct.toFixed(0)} %` : ''}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="relative mx-auto flex h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-ink-800/60 safe-pb sm:border-x lg:landscape:max-w-6xl">
      {/* Kopfzeile */}
      <header
        className={`flex shrink-0 items-center justify-between border-b px-4 pt-[max(env(safe-area-inset-top),0.5rem)] transition-colors ${
          virtual ? 'pb-1.5' : 'pb-2.5'
        } ${lastChance ? 'border-coral-500/30 bg-coral-500/10' : 'border-ink-800 bg-ink-900/80'}`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={p.onExit}
            className="font-display text-2xl font-black tracking-tighter text-gold-500 transition-opacity hover:opacity-80"
            aria-label="Pausieren und zum Startbildschirm"
          >
            10.000
          </button>
          <div className="h-6 w-px bg-ink-700" />
          <div className="flex flex-col leading-tight">
            {lastChance ? (
              <span className="text-xs font-bold uppercase tracking-wider text-coral-400">Letzte Chance!</span>
            ) : (
              <span className="text-xs font-bold uppercase tracking-wider text-fog-400">Runde {round}</span>
            )}
            <span className="text-[10px] text-fog-600">
              Ziel {fmt(effectiveTarget)}
              {event ? ` · ${event}` : ''}
              {testMode ? ' · TEST' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={p.onToggleDiceMode}
            disabled={dice.length > 0 || (diceMode === 'virtual' && bowlPhase !== 'ready')}
            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200 disabled:opacity-30"
            aria-label="Würfel-Modus wechseln"
          >
            <span className="text-base leading-none">{diceMode === 'virtual' ? '🎲' : '🎯'}</span>
            <span className="text-[8px] font-bold uppercase tracking-wide">{diceMode === 'virtual' ? 'Virtuell' : 'Echt'}</span>
          </button>
          <button
            onClick={() => setShowTurnLog(true)}
            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200"
            aria-label="Rundenprotokoll öffnen"
          >
            <span className="text-sm leading-none">▤</span>
            <span className="text-[8px] font-bold uppercase tracking-wide">Verlauf</span>
          </button>
          <button
            onClick={p.onUndo}
            disabled={!canUndo}
            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200 disabled:opacity-30"
            aria-label="Letzte Aktion rückgängig"
          >
            <IconUndo className="h-4 w-4" />
            <span className="text-[8px] font-bold uppercase tracking-wide">Zurück</span>
          </button>
          <button
            onClick={p.onExit}
            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200"
            aria-label="Spiel pausieren"
          >
            <IconPause className="h-4 w-4" />
            <span className="text-[8px] font-bold uppercase tracking-wide">Pause</span>
          </button>
        </div>
      </header>

      {/* Spieler-Leiste */}
      <div
        className={`scrollbar-hide flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-ink-800 px-3 ${
          virtual ? 'py-1' : 'py-2.5'
        }`}
      >
        {players.map((pl, i) => {
          const active = i === idx && phase !== 'finished'
          const reached = pl.score >= goalScore
          return (
            <div
              key={pl.id}
              role="group"
              aria-current={active ? 'true' : undefined}
              aria-label={`${pl.name}: ${fmt(pl.score)} Punkte, ${pl.busts} Nieten${active ? ', ist dran' : ''}`}
              className={`relative inline-flex min-w-[104px] flex-col rounded-2xl border transition-all ${
                virtual ? 'px-3 py-1.5' : 'px-4 py-2.5'
              } ${
                active
                  ? 'z-10 scale-105 border-gold-500/60 bg-ink-800 shadow-lg shadow-black/40'
                  : reached
                    ? 'border-gold-500/60 bg-gold-500/10'
                    : 'border-transparent bg-ink-900/40 opacity-60'
              }`}
            >
              {reached && (
                <span className="absolute -top-2 right-2 rounded-full bg-gold-500 px-1.5 py-px text-[8px] font-black uppercase tracking-wide text-ink-950 shadow">
                  🏆 {fmt(goalScore)}
                </span>
              )}
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: playerColor(pl.name) }}
                  />
                  <span
                    className={`max-w-[64px] truncate text-[11px] font-bold uppercase tracking-wide ${
                      active || reached ? 'text-fog-100' : 'text-fog-500'
                    }`}
                  >
                    {pl.name}
                  </span>
                </span>
                {reached && <IconTrophy className="h-3.5 w-3.5 text-gold-400" />}
              </div>
              <span
                className={`font-mono font-black tracking-tight ${virtual ? 'text-lg' : 'text-2xl'} ${
                  reached ? 'text-gold-300' : active ? 'text-gold-400' : 'text-fog-400'
                }`}
              >
                {fmt(pl.score)}
              </span>
              {!virtual && <span className="mt-0.5 text-[9px] text-fog-600">{pl.busts} Nieten</span>}
              {showMiniChart && !virtual && (
                <Sparkline turns={turns} name={pl.name} maxScore={maxScore} color={playerColor(pl.name)} />
              )}
            </div>
          )
        })}
      </div>

      {/* Letzte-Chance-Banner: macht klar, dass jemand 10.000 hat */}
      {lastChance && leader && (
        <div className="flex items-center justify-center gap-2 border-b border-coral-500/30 bg-coral-500/10 px-4 py-2 text-center text-xs font-bold animate-pop">
          <IconTrophy className="h-4 w-4 text-gold-400" />
          <span className="text-fog-100">{leader.name} führt mit {fmt(leader.score)}!</span>
          <span className="text-coral-300">{fmt(beatScore)} muss überboten werden</span>
        </div>
      )}

      {/* Status-Zeile: virtuell einzeilig, damit die Schale mehr Platz bekommt. */}
      {virtual ? (
        <div className="flex items-center justify-between gap-4 border-b border-ink-800 bg-ink-900/40 px-4 py-1.5 font-mono text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-fog-600">Bis zum Sieg</span>
            <span className="font-bold text-fog-100">
              {neededForWin > 0 ? fmt(neededForWin) : 'Ziel erreicht'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-fog-600">Nach Sichern</span>
            {totalPotential > 0 ? (
              <span className={`font-bold ${neededAfterBank <= 0 ? 'text-mint-400' : 'text-fog-300'}`}>
                {neededAfterBank <= 0 ? 'Sieg möglich!' : `${fmt(neededAfterBank)} fehlen`}
              </span>
            ) : (
              <span className="text-fog-600">–</span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 border-b border-ink-800 bg-ink-900/40 px-4 py-2.5 font-mono text-xs">
          <div>
            <div className="mb-0.5 text-fog-600">Bis zum Sieg</div>
            <div className="text-base font-bold leading-none text-fog-100">
              {neededForWin > 0 ? fmt(neededForWin) : 'Ziel erreicht'}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-0.5 text-fog-600">Nach dem Sichern</div>
            {totalPotential > 0 ? (
              <div
                className={`text-base font-bold leading-none ${
                  neededAfterBank <= 0 ? 'text-mint-400' : 'text-fog-300'
                }`}
              >
                {neededAfterBank <= 0 ? 'Sieg möglich!' : `${fmt(neededAfterBank)} fehlen`}
              </div>
            ) : (
              <div className="text-fog-600">–</div>
            )}
          </div>
        </div>
      )}

      {/* Spielfeld: Auf dem iPad im Querformat (breit + landscape) zweispaltig –
          links die Würfelschale/das Zahlen-Pad in voller Größe, rechts Risiko
          und Aktionen als große Seitenleiste. Hochformat/Handy bleibt einspaltig,
          exakt wie zuvor. */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden px-3 lg:landscape:flex-row lg:landscape:gap-5 lg:landscape:px-6 ${
          virtual ? 'pb-1.5 pt-1.5' : 'pb-2 pt-2'
        } lg:landscape:pb-4 lg:landscape:pt-3`}
      >
        {/* Linke Spalte: immer sichtbar, wird im Querformat automatisch breiter
            (die Würfelschale/das Zahlen-Pad skalieren mit dem Container mit). */}
        <div className="flex min-w-0 flex-1 flex-col lg:landscape:min-h-0">
        {/* Virtuell: Platzhalter-Zeile nur rendern, wenn es etwas zu zeigen gibt. */}
        {(!virtual || accumulated > 0) && (
          <div className={`flex h-5 items-center justify-center ${virtual ? 'mb-1' : 'mb-2'}`}>
            {accumulated > 0 && (
              <span className="rounded-full border border-ink-700 bg-ink-800 px-3 py-0.5 text-[10px] font-bold text-fog-300 animate-pop">
                Gesichert im Zug: {fmt(accumulated)}
              </span>
            )}
          </div>
        )}

        {diceMode === 'virtual' ? (
          /* Virtuell: Würfelschale auf EINEM Screen – Würfel direkt antippen. */
          <>
            {/* Kompakte Kopfzeile: Punkte dieser Auswahl (links) · ausgelegte
                Würfel als Mini-Würfel mit Augen (Mitte) · Zug-Gesamt (rechts).
                Einzeilig, damit die Schale darunter maximal groß wird. */}
            <div className="mb-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900/40 px-3 py-1.5">
              <div className="min-w-0">
                <span className="block truncate text-[8px] font-bold uppercase tracking-widest text-fog-500">Auswahl</span>
              </div>
              <div className="flex flex-col items-center leading-none">
                <span
                  key={result.score}
                  className={`font-mono text-3xl font-black leading-none animate-pop ${
                    result.score > 0 ? (result.isValid ? 'text-mint-400' : 'text-coral-400') : 'text-fog-600'
                  }`}
                >
                  +{fmt(result.score)}
                </span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-fog-500">Punkte</span>
              </div>
              <div className="flex min-w-0 flex-col items-end leading-none">
                <span className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-fog-500">Zug gesamt</span>
                <span className="font-mono text-lg font-black leading-none text-gold-400">{fmt(totalPotential)}</span>
              </div>
            </div>

            {/* Ausgelegte Würfel separat und zentriert, damit die Punktzahl immer wirklich mittig bleibt. */}
            <div className="mb-1 flex min-h-[30px] flex-wrap items-center justify-center gap-1">
                {laidGroups.length === 0 ? (
                  <span className="text-[10px] italic text-fog-600">Noch nichts ausgelegt</span>
                ) : (
                  laidGroups.map((g) => {
                    const bad = result.invalidDice.includes(g.value)
                    const pasch = g.count >= 3 && !bad
                    return (
                      <span
                        key={g.value}
                        className={`flex items-center gap-0.5 rounded-lg p-0.5 ${
                          bad
                            ? 'bg-coral-500/15 ring-1 ring-coral-400/70'
                            : pasch
                              ? 'bg-gold-500/15 ring-2 ring-gold-400/70'
                              : ''
                        }`}
                      >
                        {Array.from({ length: g.count }, (_, i) => (
                          <MiniDie key={i} value={g.value} bad={bad} />
                        ))}
                        {pasch && (
                          <span className="px-0.5 text-[8px] font-black uppercase tracking-wide text-gold-300">
                            Pasch
                          </span>
                        )}
                      </span>
                    )
                  })
                )}
              </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-ink-800 bg-ink-950/40">
              {thrown.length > 0 && (
                <Suspense fallback={<DiceArenaFallback />}>
                  <DiceArena
                    key={throwSeq}
                    values={thrown}
                    seed={throwMotionSeed}
                    selectable
                    invalidValues={result.invalidDice}
                    onSelectionChange={p.onBowlSelect}
                    onPhaseChange={setBowlPhase}
                  />
                </Suspense>
              )}
              {/* kurzer Hinweis-Toast (z. B. „Weiter!") oben mittig */}
              {toast && (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-20 text-center text-xs font-bold uppercase tracking-widest text-gold-400 animate-pop">
                  {toast}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Würfel-Ablage (echte Würfel: Zahlen-Pad) */}
            <div
              className={`relative flex min-h-[96px] flex-col items-center justify-center gap-3 rounded-3xl border-2 p-3 transition-colors ${
                result.isValid ? 'border-ink-800 bg-ink-900/50' : 'border-coral-500/40 bg-coral-500/5'
              }`}
            >
              {kept.length === 0 && dice.length === 0 ? (
                <span className="text-sm italic text-fog-600">
                  {inHand < 6 ? `${inHand} Würfel geworfen – Gewertete eintippen…` : 'Gewertete Würfel eintippen…'}
                </span>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {/* Bereits ausgelegte Würfel dieser Hand (fixiert) */}
                  {kept.map((val, i) => (
                    <span
                      key={`k${i}`}
                      className="grid h-12 w-12 place-items-center rounded-xl border-b-4 border-gold-600/70 bg-gold-300/90 text-xl font-bold text-ink-900 shadow-sm lg:landscape:h-16 lg:landscape:w-16 lg:landscape:text-2xl"
                    >
                      {val}
                    </span>
                  ))}
                  {/* Aktueller Wurf (antippbar zum Entfernen) */}
                  {dice.map((val, i) => {
                    const bad = result.invalidDice.includes(val)
                    return (
                      <button
                        key={`d${i}`}
                        onClick={() => p.onRemoveDie(i)}
                        className={`grid h-12 w-12 place-items-center rounded-xl border-b-4 text-xl font-bold shadow-sm transition-colors animate-pop lg:landscape:h-16 lg:landscape:w-16 lg:landscape:text-2xl ${
                          bad
                            ? 'border-coral-600 bg-coral-400 text-white'
                            : 'border-fog-500 bg-fog-100 text-ink-900'
                        }`}
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
              )}
              {dice.length > 0 && (
                <button
                  onClick={p.onClearDice}
                  className="absolute right-2 top-2 p-2 text-fog-600 transition-colors hover:text-fog-300"
                  aria-label="Würfel löschen"
                >
                  <IconTrash />
                </button>
              )}
            </div>

            {/* Hinweis-Zeile */}
            <div className="mt-1 flex h-5 items-center justify-center text-center">
              {!result.isValid && dice.length > 0 ? (
                <span className="text-xs font-bold text-coral-400">Ungültige Würfel – bitte entfernen!</span>
              ) : (
                toast && (
                  <span className="text-xs font-bold uppercase tracking-widest text-gold-400 animate-pop">{toast}</span>
                )
              )}
            </div>

            {/* Punkte-Anzeige */}
            <div className="flex flex-1 flex-col items-center justify-center py-1">
              <div
                key={result.score}
                className={`font-mono text-6xl font-black tracking-tighter transition-colors animate-pop lg:landscape:text-8xl ${
                  result.score > 0 ? (result.isValid ? 'text-mint-400' : 'text-ink-600') : 'text-ink-700'
                }`}
              >
                +{fmt(result.score)}
              </div>
              {totalPotential > 0 && result.isValid && (
                <div className="mt-1 text-[11px] uppercase tracking-widest text-fog-500">
                  Gesamt im Zug: <span className="font-bold text-fog-100">{fmt(totalPotential)}</span>
                </div>
              )}
            </div>

            {/* iPad quer: großes Zahlen-Pad direkt in der breiten linken Spalte
                (mehr Platz → deutlich größere Tasten als im Hochformat). */}
            <div className="hidden lg:landscape:mt-3 lg:landscape:block">{renderNumpad(true)}</div>
          </>
        )}

        {/* Hochformat/Handy: Risiko-Meter + Aktionsleiste bleiben unten in
            dieser einen Spalte, exakt wie zuvor. Im iPad-Querformat wandern sie
            stattdessen in die rechte Seitenleiste (siehe unten). */}
        <div className="shrink-0 lg:landscape:hidden">
          <div className={virtual ? 'mb-1.5' : 'mb-2.5'}>{renderRiskMeter(false)}</div>
          <div className={`mt-auto ${virtual ? 'space-y-1.5' : 'space-y-2.5'}`}>
            {diceMode === 'real' && renderNumpad(false)}
            {renderActionBar(false)}
          </div>
        </div>
        </div>

        {/* Rechte Seitenleiste: nur im iPad-Querformat (breit + landscape).
            Oben der laufende Spielverlauf (Kurve + Rundentabelle mit Nieten),
            unten Risiko und Aktionen deutlich größer und leichter erreichbar –
            während links die Würfelschale bzw. das Zahlen-Pad die volle Breite
            nutzt. */}
        <div className="hidden lg:landscape:flex lg:landscape:w-[420px] lg:landscape:min-h-0 lg:landscape:shrink-0 lg:landscape:flex-col lg:landscape:gap-3">
          {liveAnalysis.hasTurns && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {liveAnalysis.roundsCount >= 2 && <GameChart analysis={liveAnalysis} />}
              {renderRoundTable()}
            </div>
          )}
          {renderRiskMeter(true)}
          {/* Aktionsleiste bleibt unten angedockt, auch wenn (noch) kein
              Risiko-Meter angezeigt wird – wie im Hochformat via mt-auto. */}
          <div className="mt-auto shrink-0">{renderActionBar(true)}</div>
        </div>
      </div>

      {/* Risiko-Erklärung (optionaler Info-Knopf) */}
      {showRiskInfo && meterRisk && (
        <div
          className="glass absolute inset-0 z-50 flex items-center justify-center p-6 animate-pop"
          onClick={() => setShowRiskInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-ink-700 bg-ink-850 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-fog-100">
                Warum {meterRisk.pct.toFixed(0)} %?
              </h3>
              <span className={`rounded-lg px-2 py-1 text-xs font-bold ${meterRisk.color}`}>{meterRisk.label}</span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className={`h-full rounded-full ${meterRisk.bar}`} style={{ width: `${meterRisk.pct}%` }} />
            </div>
            <ul className="space-y-2.5 text-sm leading-snug text-fog-300">
              {explainRisk(meterRisk).map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-gold-500">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowRiskInfo(false)}
              className="mt-5 w-full rounded-2xl border border-ink-700 bg-ink-800 py-3 font-bold text-fog-200 transition-colors hover:text-fog-100"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}

      {showTurnLog && (
        <TurnLogDialog
          turns={turns}
          onCorrectTurn={p.onCorrectTurn}
          onClose={() => setShowTurnLog(false)}
        />
      )}

      {/* Sieg-Overlay – oder, umgeschaltet, die Runden-Analyse desselben Spiels. */}
      {winner && showAnalysis && finishedGameRecord ? (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-ink-950 animate-pop">
          <Suspense fallback={<AnalysisFallback />}>
            <AnalysisScreen game={finishedGameRecord} onBack={() => setShowAnalysis(false)} />
          </Suspense>
        </div>
      ) : (
        winner && (
          <div
            className="glass absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-pop"
            role="dialog"
            aria-modal="true"
            aria-label={`Spiel beendet – ${winner.name} gewinnt`}
          >
            <div className="w-full max-w-sm rounded-3xl border border-gold-500/30 bg-ink-850 p-8 text-center shadow-2xl">
              <IconTrophy className="mx-auto mb-3 h-12 w-12 text-gold-400" />
              <h2 className="mb-1 font-display text-4xl font-black text-fog-100">Sieg!</h2>
              <p className="mb-6 text-xl font-bold uppercase tracking-widest text-gold-400">{winner.name}</p>
              <div className="mb-7 max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-ink-800 bg-ink-950/50 p-5">
                {[...players]
                  .sort((a, b) => b.score - a.score)
                  .map((pl, i) => (
                    <div
                      key={pl.id}
                      className={`flex justify-between text-sm ${
                        i === 0 ? 'font-bold text-gold-400' : 'text-fog-400'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-3 text-right text-fog-600">{i + 1}.</span>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: playerColor(pl.name) }} />
                        {pl.name}
                        <span className="text-[10px] text-fog-600">{pl.busts} N</span>
                      </span>
                      <span className="font-mono">{fmt(pl.score)}</span>
                    </div>
                  ))}
              </div>
              <div className="space-y-3">
                <button
                  onClick={p.onRematch}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3.5 font-bold text-ink-950 shadow-lg transition-all active:scale-[0.98]"
                >
                  <IconRefresh className="h-5 w-5" /> Revanche
                </button>
                <p className="-mt-1 text-[11px] text-fog-500">
                  Gleiche Runde, {winner.name} beginnt – Reihenfolge vorm Start frei änderbar.
                </p>
                <button
                  onClick={() => setShowAnalysis(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 py-3 font-bold text-fog-200 transition-colors hover:text-fog-100"
                >
                  <IconChart className="h-4 w-4" /> Runden-Analyse
                </button>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <button
                    onClick={p.onNewGame}
                    className="rounded-2xl border border-ink-700 bg-ink-800 py-3 font-bold text-fog-200 transition-colors hover:text-fog-100"
                  >
                    Zum Start
                  </button>
                  <button
                    onClick={() => {
                      void import('../lib/shareImage')
                        .then(({ shareResultImage }) => shareResultImage(winner, players, event))
                        .catch((error) => console.warn('Teilen-Modul konnte nicht geladen werden:', error))
                    }}
                    className="grid place-items-center rounded-2xl border border-ink-700 bg-ink-800 px-4 font-bold text-fog-200 transition-colors hover:text-fog-100"
                    aria-label="Ergebnis als Bild teilen"
                  >
                    <IconShare className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function DiceArenaFallback() {
  return (
    <div className="grid h-full min-h-[200px] place-items-center bg-ink-950/40">
      <span className="rounded-full border border-ink-700 bg-ink-900/80 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold-400 animate-pulse">
        Würfelschale wird geladen…
      </span>
    </div>
  )
}

function AnalysisFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 px-6">
      <span className="text-sm font-semibold text-fog-400 animate-pulse">Analyse wird geladen…</span>
    </div>
  )
}

/** Kleiner Würfel mit echten Augen für die Ablage der ausgelegten Würfel. */
function MiniDie({ value, bad }: { value: number; bad?: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 grid-cols-3 grid-rows-3 rounded-md border-b-2 p-[3px] shadow-sm animate-pop ${
        bad ? 'border-coral-600 bg-coral-400' : 'border-gold-600/70 bg-gold-300/90'
      }`}
    >
      {PIPS[value].map(([c, r], i) => (
        <span
          key={i}
          className={`h-[5px] w-[5px] place-self-center rounded-full ${bad ? 'bg-white' : 'bg-ink-900'}`}
          style={{ gridColumn: c + 1, gridRow: r + 1 }}
        />
      ))}
    </span>
  )
}

/** Winzige Punktekurve eines Spielers (kumuliert über seine Züge). */
function Sparkline({
  turns,
  name,
  maxScore,
  color,
}: {
  turns: Turn[]
  name: string
  maxScore: number
  color: string
}) {
  const ts = turns.filter((t) => t.player === name)
  if (ts.length < 2) return null // erst ab dem 2. Zug aussagekräftig
  const W = 84, H = 18
  let cum = 0
  const pts = [`0,${H}`] // Start bei 0 Punkten
  ts.forEach((t, i) => {
    cum += t.points
    const x = ((i + 1) / ts.length) * W
    const y = Math.max(1, H - (cum / maxScore) * H)
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 h-3.5 w-full opacity-90">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
