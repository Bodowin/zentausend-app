import fs from 'node:fs'

const path = 'src/cloudIdentityWiring.test.ts'
const source = fs.readFileSync(path, 'utf8')
const before = "expect(statsSource).toContain('Clique-Code ungültig – in Einstellungen erneuern')"
const after = "expect(statsSource).toContain('Crew-Code prüfen')"
const count = source.split(before).length - 1
if (count !== 1) throw new Error(`wording guard: expected 1 match, found ${count}`)
fs.writeFileSync(path, source.replace(before, after))
console.log('Package H wording guard updated.')
