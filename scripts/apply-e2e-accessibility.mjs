import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

const gamePath = 'src/components/GameScreen.tsx'
let game = fs.readFileSync(gamePath, 'utf8')

game = replaceOnce(
  game,
  `          key={n}\n          onClick={() => p.onAddDie(n)}\n          disabled={dice.length >= inHand || phase === 'finished'}`,
  `          key={n}\n          onClick={() => p.onAddDie(n)}\n          aria-label={\`Würfel \${n} hinzufügen\`}\n          disabled={dice.length >= inHand || phase === 'finished'}`,
  'numpad labels',
)

game = replaceOnce(
  game,
  `            onClick={p.onBust}\n            className={\`flex flex-col items-center justify-center`,
  `            onClick={p.onBust}\n            aria-label="Niete verbuchen"\n            className={\`flex flex-col items-center justify-center`,
  'idle bust label',
)

game = replaceOnce(
  game,
  `              onClick={p.onBank}\n              className={\`flex items-center justify-center gap-2`,
  `              onClick={p.onBank}\n              aria-label={\`\${fmt(totalPotential)} Punkte sichern\`}\n              className={\`flex items-center justify-center gap-2`,
  'idle bank label',
)

game = replaceOnce(
  game,
  `            onClick={p.onBust}\n            className={\`rounded-xl border border-ink-800`,
  `            onClick={p.onBust}\n            aria-label="Niete verbuchen"\n            className={\`rounded-xl border border-ink-800`,
  'invalid bust label',
)

game = replaceOnce(
  game,
  `            onClick={p.onBank}\n            disabled={!canBank}`,
  `            onClick={p.onBank}\n            aria-label={\`\${fmt(totalPotential)} Punkte sichern\`}\n            disabled={!canBank}`,
  'bank label',
)

game = replaceOnce(
  game,
  `            onClick={p.onContinue}\n            disabled={!canContinue}`,
  `            onClick={p.onContinue}\n            aria-label={usedAll ? 'Heiße Würfel – sechs neue Würfel' : \`Weiterwürfeln mit \${remainingAfter} Würfeln\`}\n            disabled={!canContinue}`,
  'continue label',
)

game = replaceOnce(
  game,
  `              key={pl.id}\n              className={\`relative inline-flex min-w-[104px] flex-col`,
  `              key={pl.id}\n              role="group"\n              aria-current={active ? 'true' : undefined}\n              aria-label={\`\${pl.name}: \${fmt(pl.score)} Punkte, \${pl.busts} Nieten\${active ? ', ist dran' : ''}\`}\n              className={\`relative inline-flex min-w-[104px] flex-col`,
  'player card semantics',
)

game = replaceOnce(
  game,
  `          <div className="glass absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-pop">`,
  `          <div\n            className="glass absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-pop"\n            role="dialog"\n            aria-modal="true"\n            aria-label={\`Spiel beendet – \${winner.name} gewinnt\`}\n          >`,
  'victory dialog semantics',
)

fs.writeFileSync(gamePath, game)

const setupPath = 'src/components/SetupScreen.tsx'
let setup = fs.readFileSync(setupPath, 'utf8')
setup = replaceOnce(
  setup,
  `                  defaultValue={name}\n                  onBlur={(e) => commitRename(name, e.target.value)}`,
  `                  defaultValue={name}\n                  aria-label={\`\${name} umbenennen\`}\n                  onBlur={(e) => commitRename(name, e.target.value)}`,
  'roster rename labels',
)
fs.writeFileSync(setupPath, setup)

console.log('E2E accessibility patch applied successfully.')
