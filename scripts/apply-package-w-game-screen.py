from pathlib import Path


path = Path('src/components/GameScreen.tsx')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one GameScreen match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


def replace_all(old: str, new: str, expected: int) -> None:
    global text
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'Expected {expected} GameScreen matches, found {count}: {old[:120]!r}')
    text = text.replace(old, new)


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
    replace_all('onClick={p.onBank}', 'onClick={requestBank}', 2)

if "{bankWins ? 'Sieg sichern' : 'Doch sichern'}" not in text:
    replace_once(
        "<span>Doch sichern</span>\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">{fmt(totalPotential)}</span>",
        "<span>{bankWins ? 'Sieg sichern' : 'Doch sichern'}</span>\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">\n                   {bankWins ? `+${fmt(totalPotential)} · gewinnt` : fmt(totalPotential)}\n                 </span>",
    )

if "ring-2 ring-gold-300/70" not in text:
    replace_once(
        "} ${big ? 'text-lg' : ''}`}\n           >\n             <IconCheck className={big ? 'h-8 w-8' : 'h-6 w-6'} />",
        "} ${bankWins ? 'ring-2 ring-gold-300/70 animate-pulse' : ''} ${big ? 'text-lg' : ''}`}\n           >\n             <IconCheck className={big ? 'h-8 w-8' : 'h-6 w-6'} />",
    )

if "Platz {projectedRank} sichern · kein Sieg" not in text:
    replace_once(
        "<span>{fmt(totalPotential)}</span>\n               {entryShort && (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">Einstieg ab {entryMin}</span>\n               )}",
        "<span>{bankWins ? 'Sieg sichern' : fmt(totalPotential)}</span>\n               {bankWins ? (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">\n                   +{fmt(totalPotential)} · {fmt(projectedScore)} gesamt\n                 </span>\n               ) : entryShort ? (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">Einstieg ab {entryMin}</span>\n               ) : bankFallsShort ? (\n                 <span className=\"mt-0.5 text-[10px] font-normal opacity-80\">\n                   Platz {projectedRank} sichern · kein Sieg\n                 </span>\n               ) : null}",
    )

if 'Zum Überholen: {fmt(minimumWinningScore)} Gesamtpunkte' not in text:
    replace_once(
        "{/* Letzte-Chance-Banner: macht klar, dass jemand 10.000 hat */}\n       {lastChance && leader && (\n         <div className=\"flex items-center justify-center gap-2 border-b border-coral-500/30 bg-coral-500/10 px-4 py-2 text-center text-xs font-bold animate-pop\">\n           <IconTrophy className=\"h-4 w-4 text-gold-400\" />\n           <span className=\"text-fog-100\">{leader.name} führt mit {fmt(leader.score)}!</span>\n           <span className=\"text-coral-300\">{fmt(beatScore)} muss überboten werden</span>\n         </div>\n       )}",
        "{/* Letzte-Chance-Banner: klare spielbare Marke statt arithmetischer +1-Differenz. */}\n       {lastChance && leader && (\n         <div className=\"border-b border-coral-500/40 bg-gradient-to-r from-coral-500/10 via-gold-500/10 to-coral-500/10 px-4 py-3 text-center animate-pop\">\n           <div className=\"flex items-center justify-center gap-2\">\n             <IconTrophy className=\"h-5 w-5 text-gold-400\" />\n             <span className=\"text-xs font-black uppercase tracking-[0.18em] text-coral-300\">Letzte Chance!</span>\n             <span className=\"text-xs font-bold text-fog-400\">{leader.name} · {fmt(leader.score)}</span>\n           </div>\n           <div className=\"mt-1 font-display text-lg font-black text-fog-100\">\n             {players[idx].name} braucht mindestens {fmt(neededForWin)} Punkte\n           </div>\n           <div className=\"mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300\">\n             Zum Überholen: {fmt(minimumWinningScore)} Gesamtpunkte\n           </div>\n         </div>\n       )}",
    )

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
    replace_all(
        "neededAfterBank <= 0 ? 'Sieg möglich!' : `${fmt(neededAfterBank)} fehlen`",
        "neededAfterBank <= 0 ? 'Sieg sichern!' : `${fmt(neededAfterBank)} fehlen`",
        2,
    )

if 'id="bank-warning-title"' not in text:
    replace_once(
        "{/* Risiko-Erklärung (optionaler Info-Knopf) */}\n",
        "{bankWarningOpen && (\n         <div\n           className=\"glass absolute inset-0 z-[54] flex items-center justify-center p-5 animate-pop\"\n           role=\"dialog\"\n           aria-modal=\"true\"\n           aria-labelledby=\"bank-warning-title\"\n           onClick={() => setBankWarningOpen(false)}\n         >\n           <div\n             className=\"w-full max-w-sm rounded-3xl border-2 border-amber-400/60 bg-ink-900 p-6 text-center shadow-2xl shadow-black/60\"\n             onClick={(event) => event.stopPropagation()}\n           >\n             <span className=\"text-4xl\">⚠️</span>\n             <h3 id=\"bank-warning-title\" className=\"mt-2 font-display text-2xl font-black text-fog-100\">\n               Damit kannst du nicht gewinnen\n             </h3>\n             <p className=\"mt-3 text-sm font-semibold text-fog-300\">\n               Mit +{fmt(totalPotential)} landest du bei {fmt(projectedScore)} Punkten.\n             </p>\n             <p className=\"mt-1 text-sm font-bold text-coral-300\">\n               Zum Überholen fehlen danach noch {fmt(neededAfterBank)} Punkte.\n             </p>\n             <div className=\"mt-4 rounded-2xl border border-ink-700 bg-ink-950/50 px-4 py-3 text-xs leading-relaxed text-fog-400\">\n               Wenn du jetzt sicherst, endet deine letzte Chance. Du kannst damit bewusst Platz {projectedRank} festhalten – oder weiterwürfeln und noch auf den Sieg gehen.\n             </div>\n             <div className=\"mt-5 grid grid-cols-2 gap-3\">\n               <button\n                 type=\"button\"\n                 onClick={() => setBankWarningOpen(false)}\n                 className=\"rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 py-3 font-black text-ink-950 shadow-lg\"\n               >\n                 Weiterwürfeln\n               </button>\n               <button\n                 type=\"button\"\n                 onClick={() => {\n                   setBankWarningOpen(false)\n                   p.onBank()\n                 }}\n                 className=\"rounded-2xl border border-ink-600 bg-ink-800 py-3 font-bold text-fog-200\"\n               >\n                 Trotzdem sichern\n               </button>\n             </div>\n           </div>\n         </div>\n       )}\n\n       {/* Risiko-Erklärung (optionaler Info-Knopf) */}\n",
    )

path.write_text(text)
