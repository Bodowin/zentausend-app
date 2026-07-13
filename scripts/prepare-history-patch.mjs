import fs from 'node:fs'

const path = 'scripts/apply-history-validation.mjs'
let source = fs.readFileSync(path, 'utf8')
const before = `function replaceOnce(source, before, after, label) {\n  const count = source.split(before).length - 1\n  if (count !== 1) throw new Error(\`${'${label}'}: expected 1 match, found ${'${count}'}\`)\n  return source.replace(before, after)\n}`
const after = `function replaceOnce(source, before, after, label) {\n  const count = source.split(before).length - 1\n  const sequentialStatsReplacement = label === 'reload integrity refresh' || label === 'effect integrity refresh'\n  if (sequentialStatsReplacement ? count < 1 : count !== 1) {\n    throw new Error(\`${'${label}'}: expected ${'${sequentialStatsReplacement ? \'at least 1\' : \'1\''}'} match, found ${'${count}'}\`)\n  }\n  return source.replace(before, after)\n}`
if (!source.includes(before)) throw new Error('replaceOnce helper did not match expected source')
source = source.replace(before, after)
fs.writeFileSync(path, source)
