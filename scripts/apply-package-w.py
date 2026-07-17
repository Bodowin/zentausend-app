from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected exactly one match in {path}, found {count}: {old[:100]!r}')
    file.write_text(text.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'Expected {expected} matches in {path}, found {count}: {old[:100]!r}')
    file.write_text(text.replace(old, new))


chart = Path('src/components/GameChart.tsx').read_text()
game = Path('src/components/GameScreen.tsx').read_text()
app = Path('src/App.tsx').read_text()
if 'spreadChartLabels' in chart and 'Damit kannst du nicht gewinnen' in game and 'interface EndgameAnnounce' in app:
    raise SystemExit(0)

replace_once(
    'src/components/GameChart.tsx',
    "import { playerColor } from '../lib/colors'\n",
    "import { playerColor } from '../lib/colors'\nimport { spreadChartLabels } from '../lib/chartLabelLayout'\n",
)
replace_once(
    'src/components/GameChart.tsx',
    "  const x = (i: number) => PAD.l + (steps === 0 ? 0 : (i / steps) * iw)\n  const y = (v: number) => PAD.t + ih - (v / yMax) * ih\n\n  const fmtShort",
    "  const x = (i: number) => PAD.l + (steps === 0 ? 0 : (i / steps) * iw)\n  const y = (v: number) => PAD.t + ih - (v / yMax) * ih\n  const endLabels = new Map(\n    directLabels\n      ? spreadChartLabels(\n          series.map((entry) => ({\n            id: entry.name,\n            y: y(entry.pts[entry.pts.length - 1]),\n          })),\n          PAD.t + 6,\n          PAD.t + ih - 6,\n          12,\n        ).map((entry) => [entry.id, entry.labelY] as const)\n      : [],\n  )\n\n  const fmtShort",
)
replace_once(
    'src/components/GameChart.tsx',
    "              const lastV = s.pts[s.pts.length - 1]\n              return (",
    "              const lastV = s.pts[s.pts.length - 1]\n              const lineY = y(lastV)\n              const labelY = endLabels.get(s.name) ?? lineY\n              return (",
)
replace_once(
    'src/components/GameChart.tsx',
    "                   {directLabels && (\n                     <text x={x(steps) + 7} y={y(lastV) + 3} fontSize={9} fontWeight={700} fill=\"#aab3c7\">\n                       {s.name.length > 6 ? `${s.name.slice(0, 6)}…` : s.name}\n                     </text>\n                   )}",
    "                   {directLabels && (\n                     <>\n                       {Math.abs(labelY - lineY) > 1 && (\n                         <line\n                           x1={x(steps) + 3}\n                           x2={x(steps) + 7}\n                           y1={lineY}\n                           y2={labelY}\n                           stroke={c}\n                           strokeWidth={1}\n                           opacity={0.65}\n                         />\n                       )}\n                       <text\n                         x={x(steps) + 8}\n                         y={labelY + 3}\n                         fontSize={9}\n                         fontWeight={700}\n                         fill=\"#c4ccdc\"\n                         stroke=\"#0e1320\"\n                         strokeWidth={3}\n                         paintOrder=\"stroke\"\n                       >\n                         {s.name.length > 6 ? `${s.name.slice(0, 6)}…` : s.name}\n                       </text>\n                     </>\n                   )}",
)

replace_once(
    'src/components/GameScreen.tsx',
    "import { diceThrowSeed } from '../lib/diceThrowSeed'\n",
    "import { diceThrowSeed } from '../lib/diceThrowSeed'\nimport { nextPlayableScoreAbove } from '../lib/scoreSteps'\n",
)
replace_once(
    'src/components/GameScreen.tsx',
    "  const [showRiskInfo, setShowRiskInfo] = useState(false)\n",
    "  const [showRiskInfo, setShowRiskInfo] = useState(false)\n  const [bankWarningOpen, setBankWarningOpen] = useState(false)\n",
)
replace_once(
    'src/components/GameScreen.tsx',
    "  const neededAfterBank = Math.max(0, neededForWin - totalPotential)\n  // Letzte Chance: Anführer (höchster Score) und die zu schlagende Marke.\n  const leader = lastChance ? [...players].sort((a, b) => b.score - a.score)[0] : null\n  const beatScore = effectiveTarget - 1\n",
    "  const neededAfterBank = Math.max(0, neededForWin - totalPotential)\n  // Letzte Chance: Anführer (höchster Score) und die zu schlagende Marke.\n  const leader = lastChance ? [...players].sort((a, b) => b.score - a.score)[0] : null\n  const beatScore = effectiveTarget - 1\n  const minimumWinningScore = lastChance ? nextPlayableScoreAbove(beatScore) : goalScore\n  const projectedScore = players[idx].score + totalPotential\n  const bankWins = canBank && projectedScore >= effectiveTarget\n  const bankFallsShort = lastChance && canBank && projectedScore < effectiveTarget\n  const projectedRank = 1 + players.filter((player, index) => index !== idx && player.score > projectedScore).length\n  const requestBank = () => {\n    if (bankFallsShort) {\n      setBankWarningOpen(true)\n      return\n    }\n    p.onBank()\n  }\n",
)
replace_count('src/components/GameScreen.tsx', 'onClick={p.onBank}', 'onClick={requestBank}', 2)
replace_once(
    'src/components/GameScreen.tsx',
    "                 <span>Doch sichern</span>\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">{fmt(totalPotential)}</span>",
    "                 <span>{bankWins ? 'Sieg sichern' : 'Doch sichern'}</span>\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">\n                   {bankWins ? `+${fmt(totalPotential)} · gewinnt` : fmt(totalPotential)}\n                 </span>",
)
replace_once(
    'src/components/GameScreen.tsx',
    "             className={`flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${\n               canBank\n                 ? 'bg-gradient-to-b from-mint-400 to-mint-500 text-ink-950 shadow-[0_4px_0_var(--color-mint-600)] active:translate-y-1 active:shadow-none'\n                 : 'cursor-not-allowed bg-ink-800 text-fog-600'\n             } ${big ? 'text-lg' : ''}`}",
    "             className={`flex items-center justify-center gap-2 rounded-xl font-bold transition-all ${\n               canBank\n                 ? 'bg-gradient-to-b from-mint-400 to-mint-500 text-ink-950 shadow-[0_4px_0_var(--color-mint-600)] active:translate-y-1 active:shadow-none'\n                 : 'cursor-not-allowed bg-ink-800 text-fog-600'\n             } ${bankWins ? 'ring-2 ring-gold-300/70 animate-pulse' : ''} ${big ? 'text-lg' : ''}`}",
)
replace_once(
    'src/components/GameScreen.tsx',
    "               <span>{fmt(totalPotential)}</span>\n               {entryShort && (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">Einstieg ab {entryMin}</span>\n               )}",
    "               <span>{bankWins ? 'Sieg sichern' : fmt(totalPotential)}</span>\n               {bankWins ? (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">\n                   +{fmt(totalPotential)} · {fmt(projectedScore)} gesamt\n                 </span>\n               ) : entryShort ? (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">Einstieg ab {entryMin}</span>\n               ) : bankFallsShort ? (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">\n                   Platz {projectedRank} sichern · kein Sieg\n                 </span>\n               ) : null}",
)
replace_once(
    'src/components/GameScreen.tsx',
    "       {/* Letzte-Chance-Banner: macht klar, dass jemand 10.000 hat */}\n       {lastChance && leader && (\n         <div className=\"flex items-center justify-center gap-2 border-b border-coral-500/30 bg-coral-500/10 px-4 py-2 text-center text-xs font-bold animate-pop\">\n           <IconTrophy className=\"h-4 w-4 text-gold-400\" />\n           <span className=\"text-fog-100\">{leader.name} führt mit {fmt(leader.score)}!</span>\n           <span className=\"text-coral-300\">{fmt(beatScore)} muss überboten werden</span>\n         </div>\n       )}",
    "       {/* Letzte-Chance-Banner: klare spielbare Marke statt arithmetischer +1-Differenz. */}\n       {lastChance && leader && (\n         <div className=\"border-b border-coral-500/40 bg-gradient-to-r from-coral-500/10 via-gold-500/10 to-coral-500/10 px-4 py-3 text-center animate-pop\">\n           <div className=\"flex items-center justify-center gap-2\">\n             <IconTrophy className=\"h-5 w-5 text-gold-400\" />\n             <span className=\"text-xs font-black uppercase tracking-[0.18em] text-coral-300\">Letzte Chance!</span>\n             <span className=\"text-xs font-bold text-fog-400\">{leader.name} · {fmt(leader.score)}</span>\n           </div>\n           <div className=\"mt-1 font-display text-lg font-black text-fog-100\">\n             {players[idx].name} braucht mindestens {fmt(neededForWin)} Punkte\n           </div>\n           <div className=\"mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300\">\n             Zum Überholen: {fmt(minimumWinningScore)} Gesamtpunkte\n           </div>\n         </div>\n       )}",
)
replace_once(
    'src/components/GameScreen.tsx',
    '<span className="text-fog-600">Bis zum Sieg</span>',
    '<span className="text-fog-600">{lastChance ? \'Zum Überholen\' : \'Bis zum Sieg\'}</span>',
)
replace_once(
    'src/components/GameScreen.tsx',
    '<div className="mb-0.5 text-fog-600">Bis zum Sieg</div>',
    '<div className="mb-0.5 text-fog-600">{lastChance ? \'Zum Überholen\' : \'Bis zum Sieg\'}</div>',
)
replace_count(
    'src/components/GameScreen.tsx',
    "neededAfterBank <= 0 ? 'Sieg möglich!' : `${fmt(neededAfterBank)} fehlen`",
    "neededAfterBank <= 0 ? 'Sieg sichern!' : `${fmt(neededAfterBank)} fehlen`",
    2,
)
replace_once(
    'src/components/GameScreen.tsx',
    "       {/* Risiko-Erklärung (optionaler Info-Knopf) */}\n",
    "       {bankWarningOpen && (\n         <div\n           className=\"glass absolute inset-0 z-[54] flex items-center justify-center p-5 animate-pop\"\n           role=\"dialog\"\n           aria-modal=\"true\"\n           aria-labelledby=\"bank-warning-title\"\n           onClick={() => setBankWarningOpen(false)}\n         >\n           <div\n             className=\"w-full max-w-sm rounded-3xl border-2 border-amber-400/60 bg-ink-900 p-6 text-center shadow-2xl shadow-black/60\"\n             onClick={(event) => event.stopPropagation()}\n           >\n             <span className=\"text-4xl\">⚠️</span>\n             <h3 id=\"bank-warning-title\" className=\"mt-2 font-display text-2xl font-black text-fog-100\">\n               Damit kannst du nicht gewinnen\n             </h3>\n             <p className=\"mt-3 text-sm font-semibold text-fog-300\">\n               Mit +{fmt(totalPotential)} landest du bei {fmt(projectedScore)} Punkten.\n             </p>\n             <p className=\"mt-1 text-sm font-bold text-coral-300\">\n               Zum Überholen fehlen danach noch {fmt(neededAfterBank)} Punkte.\n             </p>\n             <div className=\"mt-4 rounded-2xl border border-ink-700 bg-ink-950/50 px-4 py-3 text-xs leading-relaxed text-fog-400\">\n               Wenn du jetzt sicherst, endet deine letzte Chance. Du kannst damit bewusst Platz {projectedRank} festhalten – oder weiterwürfeln und noch auf den Sieg gehen.\n             </div>\n             <div className=\"mt-5 grid grid-cols-2 gap-3\">\n               <button\n                 type=\"button\"\n                 onClick={() => setBankWarningOpen(false)}\n                 className=\"rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 py-3 font-black text-ink-950 shadow-lg\"\n               >\n                 Weiterwürfeln\n               </button>\n               <button\n                 type=\"button\"\n                 onClick={() => {\n                   setBankWarningOpen(false)\n                   p.onBank()\n                 }}\n                 className=\"rounded-2xl border border-ink-600 bg-ink-800 py-3 font-bold text-fog-200\"\n               >\n                 Trotzdem sichern\n               </button>\n             </div>\n           </div>\n         </div>\n       )}\n\n       {/* Risiko-Erklärung (optionaler Info-Knopf) */}\n",
)

replace_once(
    'src/App.tsx',
    "import { calculateScore, ENTRY_MIN, WINNING_SCORE } from './lib/scoring'\n",
    "import { calculateScore, ENTRY_MIN, WINNING_SCORE } from './lib/scoring'\nimport { nextPlayableScoreAbove, playablePointsNeeded } from './lib/scoreSteps'\n",
)
replace_once(
    'src/App.tsx',
    "interface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n}\n\nconst sortDice",
    "interface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n}\n\ninterface EndgameAnnounce {\n  leaderName: string\n  leaderScore: number\n  nextName: string\n}\n\nconst sortDice",
)
replace_once(
    'src/App.tsx',
    "  const [handoff, setHandoff] = useState<TurnHandoff | null>(null)\n  const [bustAnnounce, setBustAnnounce] = useState<BustAnnounce | null>(null)\n",
    "  const [handoff, setHandoff] = useState<TurnHandoff | null>(null)\n  const [endgameAnnounce, setEndgameAnnounce] = useState<EndgameAnnounce | null>(null)\n  const [bustAnnounce, setBustAnnounce] = useState<BustAnnounce | null>(null)\n",
)
replace_count(
    'src/App.tsx',
    "    setHandoff(null)\n    setBustAnnounce(null)",
    "    setHandoff(null)\n    setEndgameAnnounce(null)\n    setBustAnnounce(null)",
    5,
)
replace_once(
    'src/App.tsx',
    "         setPlayers(nextPlayers)\n         setWinner(win)\n         setPhase('finished')",
    "         setPlayers(nextPlayers)\n         setWinner(win)\n         setEndgameAnnounce(null)\n         setPhase('finished')",
)
replace_once(
    'src/App.tsx',
    "       const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number) => {",
    "       const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number, skipHandoff = false) => {",
)
replace_once(
    'src/App.tsx',
    "         if (!suppressHandoff && getPrefs().handoff) {",
    "         if (!suppressHandoff && !skipHandoff && getPrefs().handoff) {",
)
replace_once(
    'src/App.tsx',
    "       if (justScored >= goalScore) {\n         if (idx === last) return finish()\n         showToast('Letzte Runde!')\n         return advance(idx + 1, 'lastChance', round, justScored)\n       }",
    "       if (justScored >= goalScore) {\n         if (idx === last) return finish()\n         setEndgameAnnounce({\n           leaderName: nextPlayers[idx].name,\n           leaderScore: justScored,\n           nextName: nextPlayers[idx + 1].name,\n         })\n         return advance(idx + 1, 'lastChance', round, justScored, true)\n       }",
)
replace_once(
    'src/App.tsx',
    "  const neededForWin = current ? Math.max(0, effectiveTarget - current.score) : 0",
    "  const neededForWin = current ? playablePointsNeeded(effectiveTarget - current.score) : 0",
)
replace_once(
    'src/App.tsx',
    "       {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}\n\n       {handoff && !celebration && (",
    "       {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}\n\n       {endgameAnnounce && !celebration && (\n         <div\n           className=\"glass fixed inset-0 z-[56] flex items-center justify-center px-5 py-[max(env(safe-area-inset-top),1.25rem)] animate-pop\"\n           role=\"dialog\"\n           aria-modal=\"true\"\n           aria-label={`Endphase – ${endgameAnnounce.leaderName} erreicht ${endgameAnnounce.leaderScore.toLocaleString('de-DE')}`}\n         >\n           <div className=\"flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-gold-400/70 bg-gradient-to-b from-gold-500/20 to-ink-900 px-6 py-8 text-center shadow-2xl shadow-black/70\">\n             <span className=\"text-xs font-black uppercase tracking-[0.28em] text-coral-300\">Endphase gestartet</span>\n             <span className=\"mt-3 text-5xl\">🏆</span>\n             <h2 className=\"mt-3 font-display text-3xl font-black tracking-tight text-fog-100\">\n               {endgameAnnounce.leaderName} hat {endgameAnnounce.leaderScore.toLocaleString('de-DE')} erreicht!\n             </h2>\n             <p className=\"mt-3 text-sm font-bold text-gold-300\">\n               Zum Überholen sind mindestens {nextPlayableScoreAbove(endgameAnnounce.leaderScore).toLocaleString('de-DE')} Punkte nötig.\n             </p>\n             <p className=\"mt-3 text-sm leading-relaxed text-fog-400\">\n               Alle verbleibenden Spieler bekommen jetzt genau eine letzte Chance. Die höchste Punktzahl gewinnt.\n             </p>\n             <button\n               type=\"button\"\n               onClick={() => setEndgameAnnounce(null)}\n               className=\"mt-6 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-3.5 font-black text-ink-950 shadow-lg transition-all active:scale-[0.98]\"\n             >\n               {endgameAnnounce.nextName}: letzte Chance starten\n             </button>\n           </div>\n         </div>\n       )}\n\n       {handoff && !celebration && !endgameAnnounce && (",
)
