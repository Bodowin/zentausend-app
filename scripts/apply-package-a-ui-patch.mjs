import fs from 'node:fs'

const path = 'src/components/GameScreen.tsx'
let source = fs.readFileSync(path, 'utf8')

function replaceOnce(before, after, label) {
  const matches = source.split(before).length - 1
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches}`)
  }
  source = source.replace(before, after)
}

replaceOnce(
  "disabled={dice.length > 0 || rolled.length > 0}",
  "disabled={dice.length > 0 || (diceMode === 'virtual' && bowlPhase !== 'ready')}",
  'dice mode toggle guard',
)

replaceOnce(
  '<span className="text-fog-100">{leader.name} hat {fmt(goalScore)}!</span>',
  '<span className="text-fog-100">{leader.name} führt mit {fmt(leader.score)}!</span>',
  'last chance leader score',
)

fs.writeFileSync(path, source)
