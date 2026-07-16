from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one anchor in {path}, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/types.ts',
    "/** Ein einzelner abgeschlossener Zug (für die Runden-Analyse). */\nexport interface Turn {\n",
    """/** Ein bewusst eingegangenes Weiterwurf-Risiko und sein tatsächliches Ergebnis. */
export interface RiskAttempt {
  /** Exakte Erfolgswahrscheinlichkeit des nächsten Wurfs in Prozent. */
  successPct: number
  /** Anzahl der Würfel im Risiko-Wurf. */
  dice: number
  /** Aktive zusätzliche Pasch-Rettungszahl? */
  scenarioB: boolean
  /** Punkte, die beim Eingehen des Risikos im Zug standen. */
  pot: number
  /** true = mindestens ein wertbarer Würfel; false = Niete. */
  success: boolean
}

export type PendingRiskAttempt = Omit<RiskAttempt, 'success'>

/** Ein einzelner abgeschlossener Zug (für die Runden-Analyse). */
export interface Turn {
""",
)
replace_once(
    'src/lib/types.ts',
    "  points: number\n  bust: boolean\n}\n",
    """  points: number
  bust: boolean
  /** Bewusste Weiterwürfe dieses Zugs; ältere Spiele haben dieses Feld nicht. */
  riskAttempts?: RiskAttempt[]
}
""",
)

# ---------------------------------------------------------------------------
# Active game persistence / validation
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/activeGame.ts',
    "import type { DiceMode, GameState, Player, Turn } from './types'\n",
    "import type { DiceMode, GameState, PendingRiskAttempt, Player, RiskAttempt, Turn } from './types'\n",
)
replace_once(
    'src/lib/activeGame.ts',
    "  turns: Turn[]\n  /** Im virtuellen Modus: noch nicht ausgewählte Würfel des aktuellen Wurfs. */\n",
    """  turns: Turn[]
  /** Bereits ausgewertete Risiko-Würfe des aktuell offenen Zugs. */
  currentRiskAttempts?: RiskAttempt[]
  /** Weiterwurf wurde gewählt; das Ergebnis des nächsten Wurfs steht noch aus. */
  pendingRiskAttempt?: PendingRiskAttempt | null
  /** Im virtuellen Modus: noch nicht ausgewählte Würfel des aktuellen Wurfs. */
""",
)
replace_once(
    'src/lib/activeGame.ts',
    "function isTurn(t: unknown): t is Turn {\n",
    """function isRiskAttemptBase(value: unknown): value is PendingRiskAttempt {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<PendingRiskAttempt>
  return (
    typeof v.successPct === 'number' &&
    Number.isFinite(v.successPct) &&
    v.successPct >= 0 &&
    v.successPct <= 100 &&
    isPositiveInt(v.dice) &&
    v.dice <= 6 &&
    typeof v.scenarioB === 'boolean' &&
    typeof v.pot === 'number' &&
    Number.isFinite(v.pot) &&
    v.pot >= 0
  )
}

function isRiskAttempt(value: unknown): value is RiskAttempt {
  return isRiskAttemptBase(value) && typeof (value as Partial<RiskAttempt>).success === 'boolean'
}

function isTurn(t: unknown): t is Turn {
""",
)
replace_once(
    'src/lib/activeGame.ts',
    "    typeof v.bust === 'boolean'\n  )\n}\n",
    """    typeof v.bust === 'boolean' &&
    (v.riskAttempts === undefined || (Array.isArray(v.riskAttempts) && v.riskAttempts.every(isRiskAttempt)))
  )
}
""",
)
replace_once(
    'src/lib/activeGame.ts',
    "    const turns = Array.isArray(value.turns) ? value.turns : []\n    if (!turns.every(isTurn)) return null\n",
    """    const turns = Array.isArray(value.turns) ? value.turns : []
    if (!turns.every(isTurn)) return null
    const currentRiskAttempts = Array.isArray(value.currentRiskAttempts) ? value.currentRiskAttempts : []
    if (!currentRiskAttempts.every(isRiskAttempt)) return null
    const pendingRiskAttempt = value.pendingRiskAttempt ?? null
    if (pendingRiskAttempt !== null && !isRiskAttemptBase(pendingRiskAttempt)) return null
""",
)
replace_once(
    'src/lib/activeGame.ts',
    "      turns,\n      rolled,\n",
    """      turns,
      currentRiskAttempts,
      pendingRiskAttempt,
      rolled,
""",
)

# ---------------------------------------------------------------------------
# Stored game validation keeps optional risk details
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/gameRecordValidation.ts',
    "import type { GameRecord, Turn } from './types'\n",
    "import type { GameRecord, RiskAttempt, Turn } from './types'\n",
)
replace_once(
    'src/lib/gameRecordValidation.ts',
    "function normalizeTurn(value: unknown, players: string[], index: number): { turn: Turn | null; repairs: string[] } {\n",
    """function normalizeRiskAttempt(value: unknown, path: string): { attempt: RiskAttempt | null; repairs: string[] } {
  if (!isObject(value)) return { attempt: null, repairs: [`${path} war kein Objekt und wurde ausgelassen`] }
  const successPct = value.successPct
  const dice = integerValue(value.dice, 1)
  const pot = integerValue(value.pot, 0)
  if (
    typeof successPct !== 'number' ||
    !Number.isFinite(successPct) ||
    successPct < 0 ||
    successPct > 100 ||
    dice.value === null ||
    dice.value > 6 ||
    pot.value === null ||
    typeof value.scenarioB !== 'boolean' ||
    typeof value.success !== 'boolean'
  ) {
    return { attempt: null, repairs: [`${path} war ungültig und wurde ausgelassen`] }
  }
  const repairs: string[] = []
  if (dice.repaired) repairs.push(`${path}.dice wurde normalisiert`)
  if (pot.repaired) repairs.push(`${path}.pot wurde normalisiert`)
  return {
    attempt: { successPct, dice: dice.value, scenarioB: value.scenarioB, pot: pot.value, success: value.success },
    repairs,
  }
}

function normalizeTurn(value: unknown, players: string[], index: number): { turn: Turn | null; repairs: string[] } {
""",
)
replace_once(
    'src/lib/gameRecordValidation.ts',
    "  if (matchedPlayer !== playerInput) repairs.push(`turns[${index}].player wurde vereinheitlicht`)\n\n  return {\n    turn: { round: round.value, player: matchedPlayer, ...(playerId ? { playerId } : {}), points: points.value, bust },\n    repairs,\n  }\n",
    """  if (matchedPlayer !== playerInput) repairs.push(`turns[${index}].player wurde vereinheitlicht`)

  let riskAttempts: RiskAttempt[] | undefined
  if (value.riskAttempts !== undefined && value.riskAttempts !== null) {
    if (!Array.isArray(value.riskAttempts)) {
      repairs.push(`turns[${index}].riskAttempts war kein Array und wurde ausgelassen`)
    } else {
      riskAttempts = []
      value.riskAttempts.forEach((candidate, riskIndex) => {
        const normalized = normalizeRiskAttempt(candidate, `turns[${index}].riskAttempts[${riskIndex}]`)
        repairs.push(...normalized.repairs)
        if (normalized.attempt) riskAttempts?.push(normalized.attempt)
      })
    }
  }

  return {
    turn: {
      round: round.value,
      player: matchedPlayer,
      ...(playerId ? { playerId } : {}),
      points: points.value,
      bust,
      ...(riskAttempts ? { riskAttempts } : {}),
    },
    repairs,
  }
""",
)

# ---------------------------------------------------------------------------
# Per-game awards
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/gameAwards.ts',
    "import type { Player, Turn } from './types'\n",
    "import type { Player, Turn } from './types'\nimport { findStatisticsDefiers } from './probabilityPerformance'\n",
)
replace_once(
    'src/lib/gameAwards.ts',
    "export type GameAwardId = 'high-roller' | 'efficiency' | 'pechvogel'\n",
    "export type GameAwardId = 'high-roller' | 'statistik-trotzer' | 'efficiency' | 'pechvogel'\n",
)
replace_once(
    'src/lib/gameAwards.ts',
    "  const turnStats = players\n",
    """  const defiers = findStatisticsDefiers(players, completedTurns)
  if (defiers.length > 0) {
    const best = defiers[0]
    const expected = best.expectedSuccesses.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const balance = best.balance.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    awards.push({
      id: 'statistik-trotzer',
      title: 'Statistik-Trotzer',
      names: orderedNames(defiers.map((entry) => entry.name), players),
      detail: `${best.successes}/${best.attempts} geschafft · ${expected} erwartet (+${balance})`,
      tone: 'mint',
    })
  }

  const turnStats = players
""",
)

# ---------------------------------------------------------------------------
# Game-over presentation
# ---------------------------------------------------------------------------
replace_once(
    'src/components/GameOverDialog.tsx',
    "  'high-roller': '◆',\n  efficiency: '◎',\n",
    "  'high-roller': '◆',\n  'statistik-trotzer': '↗',\n  efficiency: '◎',\n",
)
replace_once(
    'src/components/GameOverDialog.tsx',
    '              <div className="grid gap-2 sm:grid-cols-3">\n',
    '              <div className="grid gap-2 sm:grid-cols-2">\n',
)

# ---------------------------------------------------------------------------
# Game analysis
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/storage.ts',
    "import type { GameRecord, Player, PlayerStats, Turn } from './types'\n",
    "import type { GameRecord, Player, PlayerStats, Turn } from './types'\nimport { computeProbabilityPerformance, findStatisticsDefiers } from './probabilityPerformance'\n",
)
replace_once(
    'src/lib/storage.ts',
    "  best: number\n}\n\nexport interface GameAnalysis {\n  hasTurns: boolean\n",
    """  best: number
  riskAttempts: number
  riskSuccesses: number
  riskExpected: number
  riskBalance: number
}

export interface GameAnalysis {
  hasTurns: boolean
  hasRiskData: boolean
""",
)
replace_once(
    'src/lib/storage.ts',
    "  mostBusts: { name: string; count: number } | null\n  roundsCount: number\n}\n",
    """  mostBusts: { name: string; count: number } | null
  statisticsDefier: { name: string; balance: number; successes: number; attempts: number; expected: number } | null
  roundsCount: number
}
""",
)
replace_once(
    'src/lib/storage.ts',
    "  const hasTurns = turns.length > 0\n\n  const players: GamePlayerStat[] = names\n",
    """  const hasTurns = turns.length > 0
  const probabilityPlayers: Player[] = game.players.map((player) => ({
    id: player.playerId ?? player.name,
    name: player.name,
    score: player.score,
    busts: player.busts,
  }))
  const probability = computeProbabilityPerformance(probabilityPlayers, turns)
  const probabilityByName = new Map(probability.map((entry) => [entry.name, entry]))
  const defier = findStatisticsDefiers(probabilityPlayers, turns)[0] ?? null

  const players: GamePlayerStat[] = names
""",
)
replace_once(
    'src/lib/storage.ts',
    "      const best = ts.reduce((m, t) => Math.max(m, t.points), 0)\n      return { name, total, turns: turnsCount, avg: turnsCount ? Math.round(total / turnsCount) : 0, busts, best }\n",
    """      const best = ts.reduce((m, t) => Math.max(m, t.points), 0)
      const risk = probabilityByName.get(name)
      return {
        name,
        total,
        turns: turnsCount,
        avg: turnsCount ? Math.round(total / turnsCount) : 0,
        busts,
        best,
        riskAttempts: risk?.attempts ?? 0,
        riskSuccesses: risk?.successes ?? 0,
        riskExpected: risk?.expectedSuccesses ?? 0,
        riskBalance: risk?.balance ?? 0,
      }
""",
)
replace_once(
    'src/lib/storage.ts',
    "    hasTurns,\n    players,\n",
    """    hasTurns,
    hasRiskData: probability.length > 0,
    players,
""",
)
replace_once(
    'src/lib/storage.ts',
    "    mostBusts: mostBusts && mostBusts.busts > 0 ? { name: mostBusts.name, count: mostBusts.busts } : null,\n    roundsCount: roundNumbers.length,\n",
    """    mostBusts: mostBusts && mostBusts.busts > 0 ? { name: mostBusts.name, count: mostBusts.busts } : null,
    statisticsDefier: defier
      ? {
          name: defier.name,
          balance: defier.balance,
          successes: defier.successes,
          attempts: defier.attempts,
          expected: defier.expectedSuccesses,
        }
      : null,
    roundsCount: roundNumbers.length,
""",
)

replace_once(
    'src/components/AnalysisScreen.tsx',
    '        <div className="mb-5 grid grid-cols-3 gap-2.5">\n',
    '        <div className="mb-5 grid grid-cols-2 gap-2.5">\n',
)
replace_once(
    'src/components/AnalysisScreen.tsx',
    "          <Card emoji=\"🔁\" title=\"Runden\">\n            <div className=\"text-xl font-black text-fog-100\">{a.roundsCount}</div>\n          </Card>\n",
    """          <Card emoji="🔁" title="Runden">
            <div className="text-xl font-black text-fog-100">{a.roundsCount}</div>
          </Card>
          <Card emoji="📈" title="Statistik">
            {a.statisticsDefier ? (
              <>
                <div className="truncate font-bold text-fog-100">{a.statisticsDefier.name}</div>
                <div className="text-xs text-mint-400">
                  +{a.statisticsDefier.balance.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Würfe
                </div>
              </>
            ) : (
              <div className="text-fog-600">im Soll</div>
            )}
          </Card>
""",
)
replace_once(
    'src/components/AnalysisScreen.tsx',
    "      {/* Runde × Spieler */}\n",
    """      {a.hasRiskData && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Risiko-Bilanz</h2>
          <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
            {a.players
              .filter((player) => player.riskAttempts > 0)
              .map((player) => (
                <div key={player.name} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink-800/60 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold text-fog-100">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: playerColor(player.name) }} />
                      <span className="truncate">{player.name}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-fog-500">
                      {player.riskSuccesses}/{player.riskAttempts} geschafft · {player.riskExpected.toLocaleString('de-DE', { maximumFractionDigits: 1 })} erwartet
                    </div>
                  </div>
                  <div className={`font-mono text-lg font-black ${player.riskBalance >= 0 ? 'text-mint-400' : 'text-coral-400'}`}>
                    {player.riskBalance >= 0 ? '+' : ''}{player.riskBalance.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-fog-600">
            Tatsächlich überstandene Weiterwürfe minus Summe ihrer jeweiligen Erfolgswahrscheinlichkeiten. +1,8 heißt: 1,8 Würfe mehr geschafft als statistisch erwartet.
          </p>
        </section>
      )}

      {/* Runde × Spieler */}
""",
)

# ---------------------------------------------------------------------------
# Long-term player profile
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/playerProfiles.ts',
    "} from './playerIdentity'\n",
    "} from './playerIdentity'\nimport { summarizeRiskAttempts } from './probabilityPerformance'\n",
)
replace_once(
    'src/lib/playerProfiles.ts',
    "  gamesWithTurnData: number\n  successfulTurns: number\n",
    """  gamesWithTurnData: number
  gamesWithRiskData: number
  riskAttempts: number
  riskSuccesses: number
  riskExpectedSuccesses: number
  riskBalance: number
  successfulTurns: number
""",
)
replace_once(
    'src/lib/playerProfiles.ts',
    "  let gamesWithTurnData = 0\n  let successfulTurns = 0\n",
    """  let gamesWithTurnData = 0
  let gamesWithRiskData = 0
  let riskAttempts = 0
  let riskSuccesses = 0
  let riskExpectedSuccesses = 0
  let successfulTurns = 0
""",
)
replace_once(
    'src/lib/playerProfiles.ts',
    "    const rounds = Math.max(...turns.map((turn) => turn.round))\n    roundsTotal += rounds\n",
    """    const rounds = Math.max(...turns.map((turn) => turn.round))
    roundsTotal += rounds
    const gameRiskAttempts = turns
      .filter((turn) => turnIdentityKey(turn, game) === id)
      .flatMap((turn) => turn.riskAttempts ?? [])
    const riskSummary = summarizeRiskAttempts(names.get(id) ?? selector, gameRiskAttempts)
    if (riskSummary) {
      gamesWithRiskData += 1
      riskAttempts += riskSummary.attempts
      riskSuccesses += riskSummary.successes
      riskExpectedSuccesses += riskSummary.expectedSuccesses
    }
""",
)
replace_once(
    'src/lib/playerProfiles.ts',
    "    gamesWithTurnData,\n    successfulTurns,\n",
    """    gamesWithTurnData,
    gamesWithRiskData,
    riskAttempts,
    riskSuccesses,
    riskExpectedSuccesses,
    riskBalance: riskSuccesses - riskExpectedSuccesses,
    successfulTurns,
""",
)
replace_once(
    'src/components/PlayerProfileScreen.tsx',
    "           <ProfileRow label=\"Bester Einzelzug\" value={profile.bestTurn ? fmt(profile.bestTurn.points) : '–'} />\n           <ProfileRow label=\"Ø Spieldauer\" value={profile.avgRounds === null ? '–' : `${profile.avgRounds.toLocaleString('de-DE')} Runden`} />\n",
    """           <ProfileRow label="Bester Einzelzug" value={profile.bestTurn ? fmt(profile.bestTurn.points) : '–'} />
           <ProfileRow
             label="Risiko-Bilanz"
             value={
               profile.riskAttempts
                 ? `${profile.riskBalance >= 0 ? '+' : ''}${profile.riskBalance.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Würfe`
                 : '–'
             }
           />
           <ProfileRow label="Ø Spieldauer" value={profile.avgRounds === null ? '–' : `${profile.avgRounds.toLocaleString('de-DE')} Runden`} />
""",
)
replace_once(
    'src/components/PlayerProfileScreen.tsx',
    "          {profile.gamesWithTurnData < profile.games && ' Ältere Spiele bleiben in Endstand, Siegen und Nieten enthalten.'}\n",
    """          {profile.gamesWithTurnData < profile.games && ' Ältere Spiele bleiben in Endstand, Siegen und Nieten enthalten.'}
          {profile.riskAttempts > 0 && (
            <> Risiko: {profile.riskSuccesses}/{profile.riskAttempts} geschafft, {profile.riskExpectedSuccesses.toLocaleString('de-DE', { maximumFractionDigits: 1 })} erwartet ({profile.gamesWithRiskData} Spiele).</>
          )}
""",
)

# ---------------------------------------------------------------------------
# Runtime tracking in App
# ---------------------------------------------------------------------------
replace_once(
    'src/App.tsx',
    "import type { DiceMode, GameState, Player, Turn } from './lib/types'\n",
    "import type { DiceMode, GameState, PendingRiskAttempt, Player, RiskAttempt, Turn } from './lib/types'\n",
)
replace_once(
    'src/App.tsx',
    "  turns: Turn[]\n  rolled: number[]\n",
    """  turns: Turn[]
  currentRiskAttempts: RiskAttempt[]
  pendingRiskAttempt: PendingRiskAttempt | null
  rolled: number[]
""",
)
replace_once(
    'src/App.tsx',
    "  const [turns, setTurns] = useState<Turn[]>([])\n  const [rolled, setRolled] = useState<number[]>([])\n",
    """  const [turns, setTurns] = useState<Turn[]>([])
  const [currentRiskAttempts, setCurrentRiskAttempts] = useState<RiskAttempt[]>([])
  const [pendingRiskAttempt, setPendingRiskAttempt] = useState<PendingRiskAttempt | null>(null)
  const [rolled, setRolled] = useState<number[]>([])
""",
)
replace_once(
    'src/App.tsx',
    "      turns,\n      rolled,\n",
    """      turns,
      currentRiskAttempts,
      pendingRiskAttempt,
      rolled,
""",
)
replace_once(
    'src/App.tsx',
    "    turns,\n    rolled,\n",
    """    turns,
    currentRiskAttempts,
    pendingRiskAttempt,
    rolled,
""",
)
replace_once(
    'src/App.tsx',
    "    setTurns([])\n    setRolled([])\n",
    """    setTurns([])
    setCurrentRiskAttempts([])
    setPendingRiskAttempt(null)
    setRolled([])
""",
)
replace_once(
    'src/App.tsx',
    "    setTurns(game.turns ?? [])\n    setDiceMode(mode)\n",
    """    setTurns(game.turns ?? [])
    setCurrentRiskAttempts(game.currentRiskAttempts ?? [])
    setPendingRiskAttempt(game.pendingRiskAttempt ?? null)
    setDiceMode(mode)
""",
)
replace_once(
    'src/App.tsx',
    "             turns: turns.map((turn) => ({ ...turn })),\n             rolled: [...rolled],\n",
    """             turns: turns.map((turn) => ({
               ...turn,
               riskAttempts: turn.riskAttempts?.map((attempt) => ({ ...attempt })),
             })),
             currentRiskAttempts: currentRiskAttempts.map((attempt) => ({ ...attempt })),
             pendingRiskAttempt: pendingRiskAttempt ? { ...pendingRiskAttempt } : null,
             rolled: [...rolled],
""",
)
replace_once(
    'src/App.tsx',
    "    [players, idx, round, phase, target, kept, dice, accumulated, turns, rolled, thrown, throwSeq],\n",
    "    [players, idx, round, phase, target, kept, dice, accumulated, turns, currentRiskAttempts, pendingRiskAttempt, rolled, thrown, throwSeq],\n",
)
replace_once(
    'src/App.tsx',
    "    setTurns(snapshot.turns)\n    setWinner(null)\n",
    """    setTurns(snapshot.turns)
    setCurrentRiskAttempts(snapshot.currentRiskAttempts)
    setPendingRiskAttempt(snapshot.pendingRiskAttempt)
    setWinner(null)
""",
)
replace_once(
    'src/App.tsx',
    "  const clearDice = () => setDice([])\n\n  const takeSnapshot = useCallback(\n",
    """  const clearDice = () => setDice([])

  const settlePendingRisk = (success: boolean): RiskAttempt[] =>
    pendingRiskAttempt
      ? [...currentRiskAttempts, { ...pendingRiskAttempt, success }]
      : [...currentRiskAttempts]

  const takeSnapshot = useCallback(
""",
)
replace_once(
    'src/App.tsx',
    """  const handleContinue = () => {
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
""",
    """  const handleContinue = () => {
    if (!result.isValid || result.score === 0 || dice.length === 0) return
    takeSnapshot('continue')
    buzz(10)
    const newKept = [...kept, ...dice]
    const special = celebrationFor(combined, newKept.length === 6)
    if (special) setCelebration(special)

    const completedAttempts = settlePendingRisk(true)
    setCurrentRiskAttempts(completedAttempts)
    setPendingRiskAttempt(
      risk
        ? {
            successPct: risk.pct,
            dice: risk.dice,
            scenarioB: risk.scenarioB,
            pot: totalPotential,
          }
        : null,
    )

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
""",
)
replace_once(
    'src/App.tsx',
    """    const nextTurns = [
      ...turns,
      { round, player: players[idx].name, playerId: players[idx].id, points: pot, bust: false },
    ]
    setTurns(nextTurns)
    resolveTurn(nextPlayers, nextPlayers[idx].score, nextTurns, Boolean(special), false, pot, players[idx].name)
""",
    """    const turnRiskAttempts = dice.length > 0 ? settlePendingRisk(true) : [...currentRiskAttempts]
    const nextTurns = [
      ...turns,
      {
        round,
        player: players[idx].name,
        playerId: players[idx].id,
        points: pot,
        bust: false,
        ...(turnRiskAttempts.length > 0 ? { riskAttempts: turnRiskAttempts } : {}),
      },
    ]
    setCurrentRiskAttempts([])
    setPendingRiskAttempt(null)
    setTurns(nextTurns)
    resolveTurn(nextPlayers, nextPlayers[idx].score, nextTurns, Boolean(special), false, pot, players[idx].name)
""",
)
replace_once(
    'src/App.tsx',
    """    const nextTurns = [
      ...turns,
      { round, player: bustedName, playerId: players[idx].id, points: 0, bust: true },
    ]
""",
    """    const turnRiskAttempts = settlePendingRisk(false)
    const nextTurns = [
      ...turns,
      {
        round,
        player: bustedName,
        playerId: players[idx].id,
        points: 0,
        bust: true,
        ...(turnRiskAttempts.length > 0 ? { riskAttempts: turnRiskAttempts } : {}),
      },
    ]
""",
)
replace_once(
    'src/App.tsx',
    "    setBustAnnounce({ name: bustedName, lost, nextName })\n    setTurns(nextTurns)\n",
    """    setBustAnnounce({ name: bustedName, lost, nextName })
    setCurrentRiskAttempts([])
    setPendingRiskAttempt(null)
    setTurns(nextTurns)
""",
)
replace_once(
    'src/App.tsx',
    """    const correctedTurns = turns.map((turn, index) =>
      index === turnIndex ? { ...turn, points: bust ? 0 : points, bust } : { ...turn },
    )
""",
    """    const correctedTurns = turns.map((turn, index) => {
      const copiedRiskAttempts = turn.riskAttempts?.map((attempt, attemptIndex, all) =>
        index === turnIndex && turn.bust !== bust && attemptIndex === all.length - 1
          ? { ...attempt, success: !bust }
          : { ...attempt },
      )
      return index === turnIndex
        ? { ...turn, points: bust ? 0 : points, bust, ...(copiedRiskAttempts ? { riskAttempts: copiedRiskAttempts } : {}) }
        : { ...turn, ...(copiedRiskAttempts ? { riskAttempts: copiedRiskAttempts } : {}) }
    })
""",
)
replace_once(
    'src/App.tsx',
    "      turns,\n      rolled,\n      thrown,\n      throwSeq,\n      savedAt: new Date().toISOString(),\n    })\n    takeSnapshot('correction')\n",
    """      turns,
      currentRiskAttempts,
      pendingRiskAttempt,
      rolled,
      thrown,
      throwSeq,
      savedAt: new Date().toISOString(),
    })
    takeSnapshot('correction')
""",
)
replace_once(
    'src/App.tsx',
    "    setTurns(replay.turns)\n    setIdx(replay.idx)\n",
    """    setTurns(replay.turns)
    setCurrentRiskAttempts([])
    setPendingRiskAttempt(null)
    setIdx(replay.idx)
""",
)

# ---------------------------------------------------------------------------
# Tests and E2E fixture
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/gameAwards.test.ts',
    """  it('keeps ties visible instead of choosing an arbitrary player', () => {
""",
    """  it('adds Statistik-Trotzer only after repeated material outperformance', () => {
    const riskTurns: Turn[] = [
      {
        round: 1,
        player: 'Gabi',
        playerId: 'a',
        points: 1_000,
        bust: false,
        riskAttempts: [
          { successPct: 33.33, dice: 1, scenarioB: false, pot: 400, success: true },
          { successPct: 55.56, dice: 2, scenarioB: false, pot: 600, success: true },
          { successPct: 33.33, dice: 1, scenarioB: false, pot: 800, success: true },
        ],
      },
    ]
    const awards = computeGameAwards(players, riskTurns)
    expect(awards.map((award) => award.id)).toContain('statistik-trotzer')
    expect(awards.find((award) => award.id === 'statistik-trotzer')).toMatchObject({
      names: ['Gabi'],
      detail: '3/3 geschafft · 1,2 erwartet (+1,8)',
    })
  })

  it('keeps ties visible instead of choosing an arbitrary player', () => {
""",
)
replace_once(
    'e2e/game-finale.spec.ts',
    """        turns: [
          { round: 1, player: 'Gabi', playerId: 'player:gabi', points: 1_000, bust: false },
          { round: 1, player: 'Mabi', playerId: 'player:mabi', points: 0, bust: true },
          { round: 2, player: 'Gabi', playerId: 'player:gabi', points: 500, bust: false },
          { round: 2, player: 'Mabi', playerId: 'player:mabi', points: 1_500, bust: false },
        ],
        rolled: [],
""",
    """        turns: [
          { round: 1, player: 'Gabi', playerId: 'player:gabi', points: 1_000, bust: false },
          { round: 1, player: 'Mabi', playerId: 'player:mabi', points: 0, bust: true },
          { round: 2, player: 'Gabi', playerId: 'player:gabi', points: 500, bust: false },
          { round: 2, player: 'Mabi', playerId: 'player:mabi', points: 1_500, bust: false },
        ],
        currentRiskAttempts: [
          { successPct: 33.33, dice: 1, scenarioB: false, pot: 500, success: true },
          { successPct: 55.56, dice: 2, scenarioB: false, pot: 700, success: true },
        ],
        pendingRiskAttempt: { successPct: 33.33, dice: 1, scenarioB: false, pot: 900 },
        rolled: [],
""",
)
replace_once(
    'e2e/game-finale.spec.ts',
    "    await expect(finale.getByText('High Roller')).toBeVisible()\n",
    """    await expect(finale.getByText('High Roller')).toBeVisible()
    await expect(finale.getByText('Statistik-Trotzer')).toBeVisible()
    await expect(finale.getByText('3/3 geschafft · 1,2 erwartet (+1,8)')).toBeVisible()
""",
)

print('Package T integration applied')
