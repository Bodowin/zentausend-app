import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`Marker fehlt: ${label}`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Marker mehrfach gefunden: ${label}`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

let app = fs.readFileSync('src/App.tsx', 'utf8')

app = replaceOnce(app, "const CELEBRATION_HANDOFF_DELAY_MS = 2000\n", '', 'alte Handoff-Verzoegerung')

app = replaceOnce(
  app,
  `interface BustAnnounce {\n  name: string\n  lost: number\n  nextName: string | null\n}\n`,
  `interface BustAnnounce {\n  name: string\n  lost: number\n  nextName: string | null\n}\n\ninterface TurnHandoff {\n  scoredName: string\n  points: number\n  total: number\n  nextName: string\n}\n`,
  'TurnHandoff-Typ',
)

app = replaceOnce(
  app,
  `  const [handoff, setHandoff] = useState<string | null>(null)\n`,
  `  const [handoff, setHandoff] = useState<TurnHandoff | null>(null)\n`,
  'Handoff-State',
)

app = replaceOnce(
  app,
  `  useEffect(() => {\n    if (!handoff) return\n    const timer = window.setTimeout(() => setHandoff(null), 2000)\n    return () => window.clearTimeout(timer)\n  }, [handoff])\n\n`,
  '',
  'automatisches Handoff-Schliessen',
)

app = replaceOnce(
  app,
  `      celebrating: boolean,\n      suppressHandoff = false,\n    ) => {`,
  `      celebrating: boolean,\n      suppressHandoff = false,\n      turnPoints = 0,\n      scoredName = '',\n    ) => {`,
  'resolveTurn-Signatur',
)

app = replaceOnce(
  app,
  `        if (!suppressHandoff && getPrefs().handoff) {\n          const name = nextPlayers[nextIdx].name\n          if (celebrating) window.setTimeout(() => setHandoff(name), CELEBRATION_HANDOFF_DELAY_MS)\n          else setHandoff(name)\n        }`,
  `        if (!suppressHandoff && getPrefs().handoff) {\n          setHandoff({\n            scoredName,\n            points: turnPoints,\n            total: justScored,\n            nextName: nextPlayers[nextIdx].name,\n          })\n        }`,
  'Handoff-Erzeugung',
)

app = replaceOnce(
  app,
  `      !winner &&\n      thrown.length === 0 &&`,
  `      !winner &&\n      !celebration &&\n      !handoff &&\n      !bustAnnounce &&\n      thrown.length === 0 &&`,
  'Wurfblocker',
)

app = replaceOnce(
  app,
  `  }, [diceMode, view, phase, winner, thrown.length, dice.length, kept.length, newThrow])`,
  `  }, [\n    diceMode,\n    view,\n    phase,\n    winner,\n    celebration,\n    handoff,\n    bustAnnounce,\n    thrown.length,\n    dice.length,\n    kept.length,\n    newThrow,\n  ])`,
  'Wurfblocker-Abhaengigkeiten',
)

app = replaceOnce(
  app,
  `    resolveTurn(nextPlayers, nextPlayers[idx].score, nextTurns, Boolean(special))`,
  `    resolveTurn(nextPlayers, nextPlayers[idx].score, nextTurns, Boolean(special), false, pot, players[idx].name)`,
  'Sichern-Uebergabe',
)

app = replaceOnce(
  app,
  `  const acknowledgeBust = () => {\n    const nextName = bustAnnounce?.nextName ?? null\n    setBustAnnounce(null)\n    if (nextName && getPrefs().handoff) setHandoff(nextName)\n  }`,
  `  const acknowledgeBust = () => {\n    setBustAnnounce(null)\n  }`,
  'Nieten-Doppeluebergabe',
)

const oldHandoff = `      {handoff && (\n        <button\n          type="button"\n          onClick={() => setHandoff(null)}\n          aria-label="Übergabe überspringen"\n          className="glass fixed inset-0 z-[55] flex items-center justify-center px-6 animate-pop"\n        >\n          <div\n            className="flex flex-col items-center gap-3 rounded-3xl border-2 px-12 py-9 text-center shadow-2xl shadow-black/50"\n            style={{ borderColor: \`\${playerColor(handoff)}80\`, backgroundColor: \`\${playerColor(handoff)}14\` }}\n          >\n            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: playerColor(handoff) }} />\n            <span className="font-display text-5xl font-black tracking-tight" style={{ color: playerColor(handoff) }}>\n              {handoff}\n            </span>\n            <span className="text-lg font-bold uppercase tracking-[0.2em] text-fog-300">ist dran</span>\n            <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-fog-600">\n              Tippen zum Fortfahren\n            </span>\n          </div>\n        </button>\n      )}`

const newHandoff = `      {handoff && !celebration && (\n        <div\n          className="glass fixed inset-0 z-[55] flex items-center justify-center px-5 py-[max(env(safe-area-inset-top),1.25rem)] animate-pop"\n          role="dialog"\n          aria-modal="true"\n          aria-labelledby="turn-handoff-title"\n        >\n          <div\n            className="flex w-full max-w-sm flex-col items-center rounded-3xl border-2 bg-ink-900/95 px-6 py-7 text-center shadow-2xl shadow-black/60"\n            style={{ borderColor: \`\${playerColor(handoff.nextName)}80\` }}\n          >\n            <span className="text-xs font-black uppercase tracking-[0.2em] text-fog-500">\n              {handoff.scoredName} sichert\n            </span>\n            <span className="mt-2 font-mono text-6xl font-black tracking-tighter text-mint-400">\n              +{handoff.points.toLocaleString('de-DE')}\n            </span>\n            <span className="mt-1 text-sm font-bold text-fog-400">\n              Gesamt {handoff.total.toLocaleString('de-DE')} Punkte\n            </span>\n\n            <div className="my-6 h-px w-full bg-ink-700" />\n\n            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: playerColor(handoff.nextName) }} />\n            <span\n              id="turn-handoff-title"\n              className="mt-2 max-w-full break-words font-display text-4xl font-black tracking-tight"\n              style={{ color: playerColor(handoff.nextName) }}\n            >\n              {handoff.nextName}\n            </span>\n            <span className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-fog-300">ist dran</span>\n\n            <button\n              type="button"\n              onClick={() => setHandoff(null)}\n              className="mt-6 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-3.5 font-black text-ink-950 shadow-lg transition-all active:scale-[0.98]"\n            >\n              Würfeln starten →\n            </button>\n          </div>\n        </div>\n      )}`

app = replaceOnce(app, oldHandoff, newHandoff, 'neue Sichern-Uebergabe')
fs.writeFileSync('src/App.tsx', app)

let screen = fs.readFileSync('src/components/GameScreen.tsx', 'utf8')

screen = replaceOnce(
  screen,
  `    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col overflow-hidden border-x border-ink-800/60 safe-pb lg:landscape:h-screen lg:landscape:max-w-6xl">`,
  `    <div className="relative mx-auto flex h-[100dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden border-ink-800/60 safe-pb sm:border-x lg:landscape:max-w-6xl">`,
  'Spielscreen-Hoehe',
)

screen = replaceOnce(
  screen,
  `        className={\`flex items-center justify-between border-b px-4 pt-[max(env(safe-area-inset-top),0.75rem)] transition-colors \${\n          virtual ? 'pb-2' : 'pb-3'\n        } \${lastChance ? 'border-coral-500/30 bg-coral-500/10' : 'border-ink-800 bg-ink-900/80'}\`}`,
  `        className={\`flex shrink-0 items-center justify-between border-b px-4 pt-[max(env(safe-area-inset-top),0.5rem)] transition-colors \${\n          virtual ? 'pb-1.5' : 'pb-2.5'\n        } \${lastChance ? 'border-coral-500/30 bg-coral-500/10' : 'border-ink-800 bg-ink-900/80'}\`}`,
  'Header kompakt und fixiert',
)

screen = replaceOnce(
  screen,
  `        className={\`scrollbar-hide flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-ink-800 px-3 \${\n          virtual ? 'py-1.5' : 'py-3'\n        }\`}`,
  `        className={\`scrollbar-hide flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-ink-800 px-3 \${\n          virtual ? 'py-1' : 'py-2.5'\n        }\`}`,
  'Spielerleiste fixiert',
)

screen = replaceOnce(
  screen,
  `        className={\`flex flex-1 flex-col px-4 lg:landscape:min-h-0 lg:landscape:flex-row lg:landscape:gap-5 lg:landscape:px-6 \${\n          virtual ? 'pb-2 pt-2' : 'pb-3 pt-3'\n        } lg:landscape:pb-4 lg:landscape:pt-3\`}`,
  `        className={\`flex min-h-0 flex-1 flex-col overflow-hidden px-3 lg:landscape:flex-row lg:landscape:gap-5 lg:landscape:px-6 \${\n          virtual ? 'pb-1.5 pt-1.5' : 'pb-2 pt-2'\n        } lg:landscape:pb-4 lg:landscape:pt-3\`}`,
  'Spielfeld ohne Seiten-Scroll',
)

const oldScoreStart = `            <div className="mb-1.5 flex items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900/40 px-3 py-1.5">\n              <div className="flex shrink-0 flex-col leading-none">\n                <span className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-fog-500">\n                  Diese Würfel\n                </span>\n                <span\n                  key={result.score}\n                  className={\`font-mono text-2xl font-black leading-none animate-pop \${\n                    result.score > 0 ? (result.isValid ? 'text-mint-400' : 'text-coral-400') : 'text-fog-600'\n                  }\`}\n                >\n                  +{fmt(result.score)}\n                </span>\n              </div>\n              {/* Gruppiert nach Wert (gold = zählt, rot = ungültig, Pasch markiert). */}\n              <div className="flex min-h-[30px] flex-1 flex-wrap items-center justify-center gap-1">`

const newScoreStart = `            <div className="mb-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-ink-800 bg-ink-900/40 px-3 py-1.5">\n              <div className="min-w-0">\n                <span className="block truncate text-[8px] font-bold uppercase tracking-widest text-fog-500">Auswahl</span>\n              </div>\n              <div className="flex flex-col items-center leading-none">\n                <span\n                  key={result.score}\n                  className={\`font-mono text-3xl font-black leading-none animate-pop \${\n                    result.score > 0 ? (result.isValid ? 'text-mint-400' : 'text-coral-400') : 'text-fog-600'\n                  }\`}\n                >\n                  +{fmt(result.score)}\n                </span>\n                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-fog-500">Punkte</span>\n              </div>\n              <div className="flex min-w-0 flex-col items-end leading-none">\n                <span className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-fog-500">Zug gesamt</span>\n                <span className="font-mono text-lg font-black leading-none text-gold-400">{fmt(totalPotential)}</span>\n              </div>\n            </div>\n\n            {/* Ausgelegte Würfel separat und zentriert, damit die Punktzahl immer wirklich mittig bleibt. */}\n            <div className="mb-1 flex min-h-[30px] flex-wrap items-center justify-center gap-1">`

screen = replaceOnce(screen, oldScoreStart, newScoreStart, 'zentrierte Punktezeile Anfang')

const oldScoreEnd = `              </div>\n              <div className="flex shrink-0 flex-col items-end leading-none">\n                <span className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-fog-500">\n                  Zug gesamt\n                </span>\n                <span className="font-mono text-xl font-black leading-none text-gold-400">\n                  {fmt(totalPotential)}\n                </span>\n              </div>\n            </div>\n\n            <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-3xl border border-ink-800 bg-ink-950/40">`

const newScoreEnd = `              </div>\n\n            <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-ink-800 bg-ink-950/40">`

screen = replaceOnce(screen, oldScoreEnd, newScoreEnd, 'zentrierte Punktezeile Ende')

screen = replaceOnce(
  screen,
  `<div className="lg:landscape:hidden">\n          <div className={virtual ? 'mb-2' : 'mb-3'}>{renderRiskMeter(false)}</div>\n          <div className={\`mt-auto \${virtual ? 'space-y-2' : 'space-y-3'}\`}>`,
  `<div className="shrink-0 lg:landscape:hidden">\n          <div className={virtual ? 'mb-1.5' : 'mb-2.5'}>{renderRiskMeter(false)}</div>\n          <div className={\`mt-auto \${virtual ? 'space-y-1.5' : 'space-y-2.5'}\`}>`,
  'untere Aktionen fixiert',
)

fs.writeFileSync('src/components/GameScreen.tsx', screen)

let css = fs.readFileSync('src/index.css', 'utf8')
css = replaceOnce(
  css,
  `html,\nbody,\n#root {\n  height: 100%;\n}`,
  `html,\nbody,\n#root {\n  height: 100%;\n  min-height: 100%;\n}\n\nhtml,\nbody {\n  width: 100%;\n  overflow-x: hidden;\n}`,
  'globale iPhone-Breite',
)
fs.writeFileSync('src/index.css', css)

console.log('Paket O Patch angewendet')
