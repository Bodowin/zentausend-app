import fs from 'node:fs'

const path = 'src/components/PlayerManager.tsx'
let source = fs.readFileSync(path, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
  `              onChange={(event) => setSourceId(event.target.value)}`,
  `              onChange={(event) => {\n                const next = event.target.value\n                if (next === targetId) setTargetId(sourceId)\n                setSourceId(next)\n              }}`,
  'source auto swap',
)
replaceOnce(
  `<option key={player.id} value={player.id} disabled={player.id === targetId}>\n                  {player.name} · {player.games} Spiele\n                </option>`,
  `<option key={player.id} value={player.id}>\n                  {player.name} · {player.games} {player.games === 1 ? 'Spiel' : 'Spiele'}\n                </option>`,
  'source options',
)
replaceOnce(
  `              onChange={(event) => setTargetId(event.target.value)}`,
  `              onChange={(event) => {\n                const next = event.target.value\n                if (next === sourceId) setSourceId(targetId)\n                setTargetId(next)\n              }}`,
  'target auto swap',
)
replaceOnce(
  `<option key={player.id} value={player.id} disabled={player.id === sourceId}>\n                  {player.name} · {player.games} Spiele\n                </option>`,
  `<option key={player.id} value={player.id}>\n                  {player.name} · {player.games} {player.games === 1 ? 'Spiel' : 'Spiele'}\n                </option>`,
  'target options',
)

fs.writeFileSync(path, source)
console.log('Player merge direction swap applied successfully.')
