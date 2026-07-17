from pathlib import Path


path = Path('src/App.tsx')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one App match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


if "import { nextPlayableScoreAbove, playablePointsNeeded } from './lib/scoreSteps'" not in text:
    replace_once(
        "import { calculateScore, ENTRY_MIN, WINNING_SCORE } from './lib/scoring'\n",
        "import { calculateScore, ENTRY_MIN, WINNING_SCORE } from './lib/scoring'\nimport { nextPlayableScoreAbove, playablePointsNeeded } from './lib/scoreSteps'\n",
    )

if 'interface EndgameAnnounce' not in text:
    replace_once(
        "interface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n}\n\nconst sortDice",
        "interface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n}\n\ninterface EndgameAnnounce {\n  leaderName: string\n  leaderScore: number\n  nextName: string\n}\n\nconst sortDice",
    )

if 'const [endgameAnnounce, setEndgameAnnounce]' not in text:
    replace_once(
        "const [handoff, setHandoff] = useState<TurnHandoff | null>(null)\n  const [bustAnnounce, setBustAnnounce] = useState<BustAnnounce | null>(null)\n",
        "const [handoff, setHandoff] = useState<TurnHandoff | null>(null)\n  const [endgameAnnounce, setEndgameAnnounce] = useState<EndgameAnnounce | null>(null)\n  const [bustAnnounce, setBustAnnounce] = useState<BustAnnounce | null>(null)\n",
    )

reset_old = "setHandoff(null)\n    setBustAnnounce(null)"
if reset_old in text:
    text = text.replace(
        reset_old,
        "setHandoff(null)\n    setEndgameAnnounce(null)\n    setBustAnnounce(null)",
    )

if "setWinner(win)\n         setEndgameAnnounce(null)" not in text:
    replace_once(
        "setPlayers(nextPlayers)\n         setWinner(win)\n         setPhase('finished')",
        "setPlayers(nextPlayers)\n         setWinner(win)\n         setEndgameAnnounce(null)\n         setPhase('finished')",
    )

if 'nextTarget: number, skipHandoff = false' not in text:
    replace_once(
        "const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number) => {",
        "const advance = (nextIdx: number, nextPhase: GameState, nextRound: number, nextTarget: number, skipHandoff = false) => {",
    )
    replace_once(
        "if (!suppressHandoff && getPrefs().handoff) {",
        "if (!suppressHandoff && !skipHandoff && getPrefs().handoff) {",
    )

if 'setEndgameAnnounce({' not in text:
    replace_once(
        "if (justScored >= goalScore) {\n         if (idx === last) return finish()\n         showToast('Letzte Runde!')\n         return advance(idx + 1, 'lastChance', round, justScored)\n       }",
        "if (justScored >= goalScore) {\n         if (idx === last) return finish()\n         setEndgameAnnounce({\n           leaderName: nextPlayers[idx].name,\n           leaderScore: justScored,\n           nextName: nextPlayers[idx + 1].name,\n         })\n         return advance(idx + 1, 'lastChance', round, justScored, true)\n       }",
    )

if 'playablePointsNeeded(effectiveTarget - current.score)' not in text:
    replace_once(
        "const neededForWin = current ? Math.max(0, effectiveTarget - current.score) : 0",
        "const neededForWin = current ? playablePointsNeeded(effectiveTarget - current.score) : 0",
    )

if '&& !endgameAnnounce &&\n       !bustAnnounce' not in text:
    replace_once(
        "!handoff &&\n       !bustAnnounce &&",
        "!handoff &&\n       !endgameAnnounce &&\n       !bustAnnounce &&",
    )
    replace_once(
        "handoff,\n     bustAnnounce,",
        "handoff,\n     endgameAnnounce,\n     bustAnnounce,",
    )

if 'aria-label={`Endphase – ${endgameAnnounce.leaderName}' not in text:
    replace_once(
        "{celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}\n\n       {handoff && !celebration && (",
        "{celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}\n\n       {endgameAnnounce && !celebration && (\n         <div\n           className=\"glass fixed inset-0 z-[56] flex items-center justify-center px-5 py-[max(env(safe-area-inset-top),1.25rem)] animate-pop\"\n           role=\"dialog\"\n           aria-modal=\"true\"\n           aria-label={`Endphase – ${endgameAnnounce.leaderName} erreicht ${endgameAnnounce.leaderScore.toLocaleString('de-DE')}`}\n         >\n           <div className=\"flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-gold-400/70 bg-gradient-to-b from-gold-500/20 to-ink-900 px-6 py-8 text-center shadow-2xl shadow-black/70\">\n             <span className=\"text-xs font-black uppercase tracking-[0.28em] text-coral-300\">Endphase gestartet</span>\n             <span className=\"mt-3 text-5xl\">🏆</span>\n             <h2 className=\"mt-3 font-display text-3xl font-black tracking-tight text-fog-100\">\n               {endgameAnnounce.leaderName} hat {endgameAnnounce.leaderScore.toLocaleString('de-DE')} erreicht!\n             </h2>\n             <p className=\"mt-3 text-sm font-bold text-gold-300\">\n               Zum Überholen sind mindestens {nextPlayableScoreAbove(endgameAnnounce.leaderScore).toLocaleString('de-DE')} Punkte nötig.\n             </p>\n             <p className=\"mt-3 text-sm leading-relaxed text-fog-400\">\n               Alle verbleibenden Spieler bekommen jetzt genau eine letzte Chance. Die höchste Punktzahl gewinnt.\n             </p>\n             <button\n               type=\"button\"\n               onClick={() => setEndgameAnnounce(null)}\n               className=\"mt-6 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-3.5 font-black text-ink-950 shadow-lg transition-all active:scale-[0.98]\"\n             >\n               {endgameAnnounce.nextName}: letzte Chance starten\n             </button>\n           </div>\n         </div>\n       )}\n\n       {handoff && !celebration && !endgameAnnounce && (",
    )

path.write_text(text)
