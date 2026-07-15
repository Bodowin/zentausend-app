import fs from 'node:fs'

const path = 'src/App.tsx'
let source = fs.readFileSync(path, 'utf8')
const before = '      celebrating: boolean,\n      suppressHandoff = false,'
const after = '      _celebrating: boolean,\n      suppressHandoff = false,'
if (!source.includes(before)) throw new Error('resolveTurn parameter marker fehlt')
source = source.replace(before, after)
fs.writeFileSync(path, source)
