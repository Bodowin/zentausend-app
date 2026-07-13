import fs from 'node:fs'

const path = 'src/App.tsx'
const source = fs.readFileSync(path, 'utf8')
const before = `const uid = () => \`${'${Date.now().toString(36)}'}-${'${Math.floor(Math.random() * 1e6).toString(36)}'}\`\n`
const count = source.split(before).length - 1
if (count !== 1) throw new Error(`unused uid: expected 1 match, found ${count}`)
fs.writeFileSync(path, source.replace(before, ''))
