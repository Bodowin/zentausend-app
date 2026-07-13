import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

const path = 'src/components/GameScreen.tsx'
let source = fs.readFileSync(path, 'utf8')

source = replaceOnce(
  source,
  `          key={n}\n          onClick={() => p.onAddDie(n)}\n          disabled={dice.length >= inHand || phase === 'finished'}`,
  `          key={n}\n          onClick={() => p.onAddDie(n)}\n          aria-label={\`Würfel \${n} hinzufügen\`}\n          disabled={dice.length >= inHand || phase === 'finished'}`,
  'numpad labels',
)

source = replaceOnce(
  source,
  `            onClick={p.onBust}\n            className={\`flex flex-col items-center justify-center`,
  `            onClick={p.onBust}\n            aria-label="Niete verbuchen"\n            className={\`flex flex-col items-center justify-center`,
  'idle bust label',
)

source = replaceOnce(
  source,
  `              onClick={p.onBank}\n              className={\`flex items-center justify-center gap-2`,
  `              onClick={p.onBank}\n              aria-label={\`\${fmt(totalPotential)} Punkte sichern\`}\n              className={\`flex items-center justify-center gap-2`,
  'idle bank label',
)

source = replaceOnce(
  source,
  `            onClick={p.onBust}\n            className={\`rounded-xl border border-ink-800`,
  `            onClick={p.onBust}\n            aria-label="Niete verbuchen"\n            className={\`rounded-xl border border-ink-800`,
  'invalid bust label',
)

source = replaceOnce(
  source,
  `            onClick={p.onBank}\n            disabled={!canBank}`,
  `            onClick={p.onBank}\n            aria-label={\`\${fmt(totalPotential)} Punkte sichern\`}\n            disabled={!canBank}`,
  'bank label',
)

source = replaceOnce(
  source,
  `            onClick={p.onContinue}\n            disabled={!canContinue}`,
  `            onClick={p.onContinue}\n            aria-label={usedAll ? 'Heiße Würfel – sechs neue Würfel' : \`Weiterwürfeln mit \${remainingAfter} Würfeln\`}\n            disabled={!canContinue}`,
  'continue label',
)

source = replaceOnce(
  source,
  `              key={pl.id}\n              className={\`relative inline-flex min-w-[104px] flex-col`,
  `              key={pl.id}\n              role="group"\n              aria-current={active ? 'true' : undefined}\n              aria-label={\`\${pl.name}: \${fmt(pl.score)} Punkte, \${pl.busts} Nieten\${active ? ', ist dran' : ''}\`}\n              className={\`relative inline-flex min-w-[104px] flex-col`,
  'player card semantics',
)

source = replaceOnce(
  source,
  `          <div className="glass absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-pop">`,
  `          <div\n            className="glass absolute inset-0 z-50 flex flex-col items-center justify-center p-6 animate-pop"\n            role="dialog"\n            aria-modal="true"\n            aria-label={\`Spiel beendet – \${winner.name} gewinnt\`}\n          >`,
  'victory dialog semantics',
)

fs.writeFileSync(path, source)
console.log('E2E accessibility patch applied successfully.')
