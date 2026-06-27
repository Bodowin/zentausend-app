import { useState } from 'react'
import type { DiceMode, Player, ScoreResult, GameState } from '../lib/types'
import type { RiskInfo } from '../lib/risk'
import { ENTRY_MIN, rollHasScore, WINNING_SCORE } from '../lib/scoring'
import { playerColor } from '../lib/colors'
import { shareResultImage } from '../lib/shareImage'
import DiceCss from './DiceCss'
import {
  IconCheck,
  IconRefresh,
  IconRotate,
  IconShare,
  IconTrash,
  IconTrophy,
  IconUndo,
} from './Icons'

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
  kept: number[]
  dice: number[]
  rolled: number[]
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
  onRoll: () => void
  onKeep: (i: number) => void
  onContinue: () => void
  onBank: () => void
  onBust: () => void
  onUndo: () => void
  onExit: () => void
  onNewGame: () => void
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
    kept,
    dice,
    rolled,
    inHand,
    accumulated,
    result,
    totalPotential,
    risk,
    toast,
    winner,
    canUndo,
  } = p

  const [rolling3D, setRolling3D] = useState(false)
  const handleRoll3D = () => {
    setRolling3D(true)
    p.onRoll()
  }
  const lastChance = phase === 'lastChance'
  // Einstiegsregel: noch nicht "auf dem Brett" (Score 0) → erst ab ENTRY_MIN sichern.
  const onBoard = players[idx].score > 0
  const entryShort = !onBoard && totalPotential > 0 && totalPotential < ENTRY_MIN
  const canBank = result.isValid && totalPotential > 0 && (onBoard || totalPotential >= ENTRY_MIN)
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

  // Risiko-Coach: dezente Empfehlung auf Basis der Erfolgschance.
  const coach: { text: string; tone: string } | null =
    !risk || totalPotential === 0
      ? null
      : neededAfterBank <= 0 && canBank
        ? { text: 'Sichern = Sieg!', tone: 'text-mint-300' }
        : risk.pct >= 85
          ? { text: 'Weiter ist sicher', tone: 'text-mint-400' }
          : risk.pct >= 65
            ? { text: 'Geht noch', tone: 'text-risk-3' }
            : { text: 'Lieber sichern', tone: 'text-coral-400' }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col overflow-hidden border-x border-ink-800/60 safe-pb">
      {/* Kopfzeile */}
      <header
        className={`flex items-center justify-between border-b px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] transition-colors ${
          lastChance ? 'border-coral-500/30 bg-coral-500/10' : 'border-ink-800 bg-ink-900/80'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-black tracking-tighter text-gold-500">10.000</span>
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
        <div className="flex items-center gap-1">
          <button
            onClick={p.onUndo}
            disabled={!canUndo}
            className="grid h-9 w-9 place-items-center rounded-full text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-200 disabled:opacity-30"
            aria-label="Rückgängig"
          >
            <IconUndo className="h-4 w-4" />
          </button>
          <button
            onClick={p.onExit}
            className="grid h-9 w-9 place-items-center rounded-full text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-200"
            aria-label="Spiel beenden"
          >
            <IconRotate className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Spieler-Leiste */}
      <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-ink-800 px-3 py-3">
        {players.map((pl, i) => {
          const active = i === idx && phase !== 'finished'
          const reached = pl.score >= WINNING_SCORE
          return (
            <div
              key={pl.id}
              className={`relative inline-flex min-w-[104px] flex-col rounded-2xl border px-4 py-2.5 transition-all ${
                active
                  ? 'z-10 scale-105 border-gold-500/60 bg-ink-800 shadow-lg shadow-black/40'
                  : reached
                    ? 'border-gold-500/60 bg-gold-500/10'
                    : 'border-transparent bg-ink-900/40 opacity-60'
              }`}
            >
              {reached && (
                <span className="absolute -top-2 right-2 rounded-full bg-gold-500 px-1.5 py-px text-[8px] font-black uppercase tracking-wide text-ink-950 shadow">
                  🏆 10.000
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
                className={`font-mono text-2xl font-black tracking-tight ${
                  reached ? 'text-gold-300' : active ? 'text-gold-400' : 'text-fog-400'
                }`}
              >
                {fmt(pl.score)}
              </span>
              <span className="mt-0.5 text-[9px] text-fog-600">{pl.busts} Nieten</span>
            </div>
          )
        })}
      </div>

      {/* Letzte-Chance-Banner: macht klar, dass jemand 10.000 hat */}
      {lastChance && leader && (
        <div className="flex items-center justify-center gap-2 border-b border-coral-500/30 bg-coral-500/10 px-4 py-2 text-center text-xs font-bold animate-pop">
          <IconTrophy className="h-4 w-4 text-gold-400" />
          <span className="text-fog-100">{leader.name} hat 10.000!</span>
          <span className="text-coral-300">{fmt(beatScore)} muss überboten werden</span>
        </div>
      )}

      {/* Status-Zeile */}
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

      {/* Spielfeld */}
      <div className="flex flex-1 flex-col px-4 pb-3 pt-3">
        <div className="mb-2 flex h-5 items-center justify-center">
          {accumulated > 0 && (
            <span className="rounded-full border border-ink-700 bg-ink-800 px-3 py-0.5 text-[10px] font-bold text-fog-300 animate-pop">
              Gesichert im Zug: {fmt(accumulated)}
            </span>
          )}
        </div>

        {/* Würfel-Ablage */}
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
                  className="grid h-12 w-12 place-items-center rounded-xl border-b-4 border-gold-600/70 bg-gold-300/90 text-xl font-bold text-ink-900 shadow-sm"
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
                    className={`grid h-12 w-12 place-items-center rounded-xl border-b-4 text-xl font-bold shadow-sm transition-colors animate-pop ${
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
            className={`font-mono text-6xl font-black tracking-tighter transition-colors animate-pop ${
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

        {/* Risiko-Meter + Coach */}
        <div className="mb-3 h-12">
          {risk && (
            <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 animate-pop">
              <div className="w-20 text-[10px] uppercase leading-tight text-fog-500">
                {risk.scenarioB ? 'Mit Pasch weiter' : 'Weiterwürfeln'}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-xs font-bold">
                  <span className={risk.color}>{risk.label}</span>
                  <span className="text-fog-400">{risk.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${risk.pct}%` }} />
                </div>
              </div>
              {coach && (
                <div className={`w-16 text-right text-[10px] font-bold leading-tight ${coach.tone}`}>
                  {coach.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Eingabe: Zahlen-Pad (echt) oder virtuelle Würfel */}
        <div className="mt-auto space-y-3">
          {diceMode === 'real' ? (
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => p.onAddDie(n)}
                  disabled={dice.length >= inHand || phase === 'finished'}
                  className="h-14 rounded-xl border-b-4 border-ink-950 bg-ink-800 text-xl font-bold text-fog-100 transition-all hover:bg-ink-700 active:translate-y-1 active:border-b-0 disabled:translate-y-0 disabled:opacity-30"
                >
                  {n}
                </button>
              ))}
            </div>
          ) : rolled.length === 0 && dice.length === 0 ? (
            <button
              onClick={handleRoll3D}
              disabled={phase === 'finished'}
              className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 text-lg font-bold text-ink-950 shadow-[0_4px_0_var(--color-gold-600)] transition-all active:translate-y-1 active:shadow-none"
            >
              🎲 Würfeln · {inHand} Würfel
            </button>
          ) : (
            <div className="min-h-16 rounded-2xl border border-ink-800 bg-ink-900/40 p-2.5">
              {rolled.length > 0 ? (
                <>
                  <div className="mb-1.5 text-center text-[10px] uppercase tracking-wide text-fog-500">
                    {rollHasScore(rolled) ? 'Tippe die Würfel, die du auslegst' : 'Niete – nichts Wertbares!'}
                  </div>
                  <div key={rolled.length} className="flex flex-wrap justify-center gap-2">
                    {rolled.map((v, i) => (
                      <PipDie
                        key={i}
                        value={v}
                        onClick={() => p.onKeep(i)}
                        disabled={dice.length >= inHand}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center py-3 text-sm italic text-fog-500">
                  Alle ausgelegt – „Weiter" oder „Sichern".
                </div>
              )}
            </div>
          )}

          {/* Aktionsleiste */}
          <div className="h-14">
            {idle ? (
              <div className="grid h-full grid-cols-[1fr_2fr] gap-3">
                <button
                  onClick={p.onBust}
                  className="flex flex-col items-center justify-center rounded-xl border border-coral-500/30 bg-ink-900 font-bold leading-none text-coral-400 transition-colors hover:bg-coral-500/10"
                >
                  Niete
                  {accumulated > 0 && (
                    <span className="mt-0.5 text-[9px] font-normal opacity-80">verliert {fmt(accumulated)}</span>
                  )}
                </button>
                <div className="grid place-items-center rounded-xl border border-dashed border-ink-800 text-sm italic text-fog-600">
                  {diceMode === 'virtual' && rolled.length > 0
                    ? 'Würfel auslegen…'
                    : inHand < 6
                      ? `${inHand} Würfel werfen…`
                      : 'Auf Wurf warten…'}
                </div>
              </div>
            ) : !result.isValid ? (
              <div className="grid h-full grid-cols-[1fr_2fr] gap-3">
                <button
                  onClick={p.onBust}
                  className="rounded-xl border border-ink-800 bg-ink-900 font-bold text-fog-500 transition-colors hover:border-coral-500/40 hover:text-coral-400"
                >
                  Niete
                </button>
                <button
                  disabled
                  className="cursor-not-allowed rounded-xl bg-ink-800 font-bold text-fog-600"
                >
                  Ungültig
                </button>
              </div>
            ) : (
              <div className="grid h-full grid-cols-2 gap-3">
                <button
                  onClick={p.onBank}
                  disabled={!canBank}
                  className={`flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${
                    canBank
                      ? 'bg-gradient-to-b from-mint-400 to-mint-500 text-ink-950 shadow-[0_4px_0_var(--color-mint-600)] active:translate-y-1 active:shadow-none'
                      : 'cursor-not-allowed bg-ink-800 text-fog-600'
                  }`}
                >
                  <IconCheck className="h-6 w-6" />
                  <div className="flex flex-col items-start leading-none">
                    <span>{fmt(totalPotential)}</span>
                    {entryShort && (
                      <span className="mt-0.5 text-[10px] font-normal opacity-80">Einstieg ab {ENTRY_MIN}</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={p.onContinue}
                  disabled={!canContinue}
                  className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-iris-400 to-iris-500 font-bold text-white shadow-[0_4px_0_var(--color-iris-600)] transition-all active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:from-ink-800 disabled:to-ink-800 disabled:text-fog-600 disabled:shadow-none ${
                    usedAll ? 'animate-pulse' : ''
                  }`}
                >
                  <IconRefresh className="h-5 w-5" />
                  <div className="flex flex-col items-start leading-none">
                    <span>{usedAll ? 'Heiße Würfel' : 'Weiter'}</span>
                    <span className="mt-0.5 text-[10px] font-normal opacity-80">
                      {usedAll ? '6 neu' : `noch ${remainingAfter}`}
                      {risk ? ` · ${risk.pct.toFixed(0)} %` : ''}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Würfel-Wurf (Virtuell-Modus) */}
      {rolling3D && (
        <div className="glass fixed inset-0 z-[60] flex flex-col items-center justify-center">
          <div className="mb-2 text-sm font-bold uppercase tracking-widest text-gold-400">Würfelt…</div>
          <div className="h-[55vh] w-full max-w-lg">
            <DiceCss values={rolled} onSettle={() => setRolling3D(false)} />
          </div>
          <button
            onClick={() => setRolling3D(false)}
            className="mt-2 rounded-xl px-4 py-2 text-xs text-fog-500 hover:text-fog-200"
          >
            Überspringen
          </button>
        </div>
      )}

      {/* Sieg-Overlay */}
      {winner && (
        <div className="glass absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-pop">
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
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button
                onClick={p.onNewGame}
                className="rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3.5 font-bold text-ink-950 shadow-lg transition-all active:scale-[0.98]"
              >
                Neues Spiel
              </button>
              <button
                onClick={() => shareResultImage(winner, players, event)}
                className="grid place-items-center rounded-2xl border border-ink-700 bg-ink-800 px-4 font-bold text-fog-200 transition-colors hover:text-fog-100"
                aria-label="Ergebnis als Bild teilen"
              >
                <IconShare className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Pip-Positionen im 3×3-Raster je Augenzahl.
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** Ein antippbarer 2D-Würfel mit Augen (für den virtuellen Modus). */
function PipDie({
  value,
  onClick,
  disabled,
}: {
  value: number
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid h-12 w-12 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl border-b-4 border-fog-500 bg-gradient-to-br from-[#f4f7ff] to-[#d9e0f0] p-1.5 shadow-sm transition-transform animate-pop active:scale-90 disabled:opacity-40"
      aria-label={`Würfel ${value} auslegen`}
    >
      {Array.from({ length: 9 }, (_, c) =>
        PIP_LAYOUT[value].includes(c) ? (
          <span key={c} className="h-2 w-2 place-self-center rounded-full bg-ink-900" />
        ) : (
          <span key={c} />
        ),
      )}
    </button>
  )
}
