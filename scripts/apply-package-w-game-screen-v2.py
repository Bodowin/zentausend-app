from pathlib import Path
import re


path = Path('src/components/GameScreen.tsx')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one GameScreen match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


if "import { nextPlayableScoreAbove } from '../lib/scoreSteps'" not in text:
    replace_once(
        "import { diceThrowSeed } from '../lib/diceThrowSeed'\n",
        "import { diceThrowSeed } from '../lib/diceThrowSeed'\nimport { nextPlayableScoreAbove } from '../lib/scoreSteps'\n",
    )

if 'const [bankWarningOpen, setBankWarningOpen]' not in text:
    replace_once(
        "const [showRiskInfo, setShowRiskInfo] = useState(false)\n",
        "const [showRiskInfo, setShowRiskInfo] = useState(false)\n  const [bankWarningOpen, setBankWarningOpen] = useState(false)\n",
    )

if 'const bankFallsShort =' not in text:
    replace_once(
        "const neededAfterBank = Math.max(0, neededForWin - totalPotential)\n  // Letzte Chance: Anführer (höchster Score) und die zu schlagende Marke.\n  const leader = lastChance ? [...players].sort((a, b) => b.score - a.score)[0] : null\n  const beatScore = effectiveTarget - 1\n",
        "const neededAfterBank = Math.max(0, neededForWin - totalPotential)\n  // Letzte Chance: Anführer (höchster Score) und die zu schlagende Marke.\n  const leader = lastChance ? [...players].sort((a, b) => b.score - a.score)[0] : null\n  const beatScore = effectiveTarget - 1\n  const minimumWinningScore = lastChance ? nextPlayableScoreAbove(beatScore) : goalScore\n  const projectedScore = players[idx].score + totalPotential\n  const bankWins = canBank && projectedScore >= effectiveTarget\n  const bankFallsShort = lastChance && canBank && projectedScore < effectiveTarget\n  const projectedRank = 1 + players.filter((player, index) => index !== idx && player.score > projectedScore).length\n  const requestBank = () => {\n    if (bankFallsShort) {\n      setBankWarningOpen(true)\n      return\n    }\n    p.onBank()\n  }\n",
    )

if 'onClick={requestBank}' not in text:
    count = text.count('onClick={p.onBank}')
    if count != 2:
        raise RuntimeError(f'Expected two bank handlers, found {count}')
    text = text.replace('onClick={p.onBank}', 'onClick={requestBank}')

if "{bankWins ? 'Sieg sichern' : 'Doch sichern'}" not in text:
    replace_once('<span>Doch sichern</span>', "<span>{bankWins ? 'Sieg sichern' : 'Doch sichern'}</span>")
    replace_once(
        '<span className="mt-0.5 text-[10px] font-normal opacity-80">{fmt(totalPotential)}</span>',
        '<span className="mt-0.5 text-[10px] font-normal opacity-80">\n                   {bankWins ? `+${fmt(totalPotential)} · gewinnt` : fmt(totalPotential)}\n                 </span>',
    )

if "Platz {projectedRank} sichern · kein Sieg" not in text:
    pattern = re.compile(
        r'''<span>\{fmt\(totalPotential\)\}</span>\s*'''
        r'''\{entryShort\s*&&\s*\(\s*'''
        r'''<span className="mt-0\.5 text-\[10px\] font-normal opacity-80">Einstieg ab \{entryMin\}</span>\s*'''
        r'''\)\}''',
        re.DOTALL,
    )
    replacement = '''<span>{bankWins ? 'Sieg sichern' : fmt(totalPotential)}</span>
               {bankWins ? (
                 <span className="mt-0.5 text-[10px] font-normal opacity-80">
                   +{fmt(totalPotential)} · {fmt(projectedScore)} gesamt
                 </span>
               ) : entryShort ? (
                 <span className="mt-0.5 text-[10px] font-normal opacity-80">Einstieg ab {entryMin}</span>
               ) : bankFallsShort ? (
                 <span className="mt-0.5 text-[10px] font-normal opacity-80">
                   Platz {projectedRank} sichern · kein Sieg
                 </span>
               ) : null}'''
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f'Expected one primary bank label block, found {count}')

if 'Zum Überholen: {fmt(minimumWinningScore)} Gesamtpunkte' not in text:
    pattern = re.compile(
        r'''\{\/\* Letzte-Chance-Banner: macht klar, dass jemand 10\.000 hat \*\/\}\s*'''
        r'''\{lastChance\s*&&\s*leader\s*&&\s*\(\s*'''
        r'''<div className="flex items-center justify-center gap-2 border-b border-coral-500/30 bg-coral-500/10 px-4 py-2 text-center text-xs font-bold animate-pop">.*?</div>\s*\)\}''',
        re.DOTALL,
    )
    replacement = '''{/* Letzte-Chance-Banner: klare spielbare Marke statt arithmetischer +1-Differenz. */}
       {lastChance && leader && (
         <div className="border-b border-coral-500/40 bg-gradient-to-r from-coral-500/10 via-gold-500/10 to-coral-500/10 px-4 py-3 text-center animate-pop">
           <div className="flex items-center justify-center gap-2">
             <IconTrophy className="h-5 w-5 text-gold-400" />
             <span className="text-xs font-black uppercase tracking-[0.18em] text-coral-300">Finale – alles oder nichts</span>
             <span className="text-xs font-bold text-fog-400">{leader.name} · {fmt(leader.score)}</span>
           </div>
           <div className="mt-1 font-display text-lg font-black text-fog-100">
             {players[idx].name} braucht mindestens {fmt(neededForWin)} Punkte
           </div>
           <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300">
             Zum Überholen: {fmt(minimumWinningScore)} Gesamtpunkte
           </div>
         </div>
       )}'''
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f'Expected one last-chance banner, found {count}')

if "{lastChance ? 'Zum Überholen' : 'Bis zum Sieg'}" not in text:
    replace_once(
        '<span className="text-fog-600">Bis zum Sieg</span>',
        '<span className="text-fog-600">{lastChance ? \'Zum Überholen\' : \'Bis zum Sieg\'}</span>',
    )
    replace_once(
        '<div className="mb-0.5 text-fog-600">Bis zum Sieg</div>',
        '<div className="mb-0.5 text-fog-600">{lastChance ? \'Zum Überholen\' : \'Bis zum Sieg\'}</div>',
    )

if "neededAfterBank <= 0 ? 'Sieg sichern!'" not in text:
    old = "neededAfterBank <= 0 ? 'Sieg möglich!' : `${fmt(neededAfterBank)} fehlen`"
    count = text.count(old)
    if count != 2:
        raise RuntimeError(f'Expected two after-bank hints, found {count}')
    text = text.replace(old, "neededAfterBank <= 0 ? 'Sieg sichern!' : `${fmt(neededAfterBank)} fehlen`")

if 'id="bank-warning-title"' not in text:
    replace_once(
        "{/* Risiko-Erklärung (optionaler Info-Knopf) */}\n",
        "{bankWarningOpen && (\n         <div\n           className=\"glass absolute inset-0 z-[54] flex items-center justify-center p-5 animate-pop\"\n           role=\"dialog\"\n           aria-modal=\"true\"\n           aria-labelledby=\"bank-warning-title\"\n           onClick={() => setBankWarningOpen(false)}\n         >\n           <div\n             className=\"w-full max-w-sm rounded-3xl border-2 border-amber-400/60 bg-ink-900 p-6 text-center shadow-2xl shadow-black/60\"\n             onClick={(event) => event.stopPropagation()}\n           >\n             <span className=\"text-4xl\">⚠️</span>\n             <h3 id=\"bank-warning-title\" className=\"mt-2 font-display text-2xl font-black text-fog-100\">\n               Damit kannst du nicht gewinnen\n             </h3>\n             <p className=\"mt-3 text-sm font-semibold text-fog-300\">\n               Mit +{fmt(totalPotential)} landest du bei {fmt(projectedScore)} Punkten.\n             </p>\n             <p className=\"mt-1 text-sm font-bold text-coral-300\">\n               Zum Überholen fehlen danach noch {fmt(neededAfterBank)} Punkte.\n             </p>\n             <div className=\"mt-4 rounded-2xl border border-ink-700 bg-ink-950/50 px-4 py-3 text-xs leading-relaxed text-fog-400\">\n               Wenn du jetzt sicherst, endet deine letzte Chance. Du kannst damit bewusst Platz {projectedRank} festhalten – oder weiterwürfeln und noch auf den Sieg gehen.\n             </div>\n             <div className=\"mt-5 grid grid-cols-2 gap-3\">\n               <button type=\"button\" onClick={() => setBankWarningOpen(false)} className=\"rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 py-3 font-black text-ink-950 shadow-lg\">\n                 Weiterwürfeln\n               </button>\n               <button\n                 type=\"button\"\n                 onClick={() => {\n                   setBankWarningOpen(false)\n                   p.onBank()\n                 }}\n                 className=\"rounded-2xl border border-ink-600 bg-ink-800 py-3 font-bold text-fog-200\"\n               >\n                 Trotzdem sichern\n               </button>\n             </div>\n           </div>\n         </div>\n       )}\n\n       {/* Risiko-Erklärung (optionaler Info-Knopf) */}\n",
    )

path.write_text(text)
