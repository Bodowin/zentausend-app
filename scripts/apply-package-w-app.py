from pathlib import Path
import re


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

if 'setEndgameAnnounce(null)' not in text:
    text = re.sub(
        r'(setHandoff\(null\)\n)(\s*)(setBustAnnounce\(null\))',
        r'\1\2setEndgameAnnounce(null)\n\2\3',
        text,
    )

if not re.search(r'setWinner\(win\)\s*\n\s*setEndgameAnnounce\(null\)', text):
    text, count = re.subn(
        r'(setPlayers\(nextPlayers\)\s*\n\s*setWinner\(win\)\s*\n)(\s*)(setPhase\(\'finished\'\))',
        r'\1\2setEndgameAnnounce(null)\n\2\3',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f'Expected one finish block, found {count}')

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
    pattern = re.compile(
        r'''if \(justScored >= goalScore\) \{\s*'''
        r'''if \(idx === last\) return finish\(\)\s*'''
        r'''showToast\('Letzte Runde!'\)\s*'''
        r'''return advance\(idx \+ 1, 'lastChance', round, justScored\)\s*'''
        r'''\}''',
        re.DOTALL,
    )
    replacement = """if (justScored >= goalScore) {
         if (idx === last) return finish()
         setEndgameAnnounce({
           leaderName: nextPlayers[idx].name,
           leaderScore: justScored,
           nextName: nextPlayers[idx + 1].name,
         })
         return advance(idx + 1, 'lastChance', round, justScored, true)
       }"""
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f'Expected one goal transition block, found {count}')

if 'playablePointsNeeded(effectiveTarget - current.score)' not in text:
    replace_once(
        "const neededForWin = current ? Math.max(0, effectiveTarget - current.score) : 0",
        "const neededForWin = current ? playablePointsNeeded(effectiveTarget - current.score) : 0",
    )

if '&& !endgameAnnounce &&' not in text:
    text, count = re.subn(
        r'(!handoff &&\s*\n)(\s*)(!bustAnnounce &&)',
        r'\1\2!endgameAnnounce &&\n\2\3',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f'Expected one virtual throw guard, found {count}')
    text, count = re.subn(
        r'(handoff,\s*\n)(\s*)(bustAnnounce,)',
        r'\1\2endgameAnnounce,\n\2\3',
        text,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f'Expected one virtual throw dependency list, found {count}')

if 'aria-label={`Endphase – ${endgameAnnounce.leaderName}' not in text:
    pattern = re.compile(
        r'''\{celebration && <Celebration data=\{celebration\} onDone=\{\(\) => setCelebration\(null\)\} />\}\s*'''
        r'''\{handoff && !celebration && \(''',
        re.DOTALL,
    )
    replacement = """{celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}

       {endgameAnnounce && !celebration && (
         <div
           className="glass fixed inset-0 z-[56] flex items-center justify-center px-5 py-[max(env(safe-area-inset-top),1.25rem)] animate-pop"
           role="dialog"
           aria-modal="true"
           aria-label={`Endphase – ${endgameAnnounce.leaderName} erreicht ${endgameAnnounce.leaderScore.toLocaleString('de-DE')}`}
         >
           <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-gold-400/70 bg-gradient-to-b from-gold-500/20 to-ink-900 px-6 py-8 text-center shadow-2xl shadow-black/70">
             <span className="text-xs font-black uppercase tracking-[0.28em] text-coral-300">Endphase gestartet</span>
             <span className="mt-3 text-5xl">🏆</span>
             <h2 className="mt-3 font-display text-3xl font-black tracking-tight text-fog-100">
               {endgameAnnounce.leaderName} hat {endgameAnnounce.leaderScore.toLocaleString('de-DE')} erreicht!
             </h2>
             <p className="mt-3 text-sm font-bold text-gold-300">
               Zum Überholen sind mindestens {nextPlayableScoreAbove(endgameAnnounce.leaderScore).toLocaleString('de-DE')} Punkte nötig.
             </p>
             <p className="mt-3 text-sm leading-relaxed text-fog-400">
               Alle verbleibenden Spieler bekommen jetzt genau eine letzte Chance. Die höchste Punktzahl gewinnt.
             </p>
             <button
               type="button"
               onClick={() => setEndgameAnnounce(null)}
               className="mt-6 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-3.5 font-black text-ink-950 shadow-lg transition-all active:scale-[0.98]"
             >
               {endgameAnnounce.nextName}: letzte Chance starten
             </button>
           </div>
         </div>
       )}

       {handoff && !celebration && !endgameAnnounce && ("""
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f'Expected one handoff overlay insertion point, found {count}')

path.write_text(text)
