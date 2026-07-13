import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function replaceSection(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) throw new Error(`${label}: section markers not found`)
  return `${source.slice(0, startIndex)}${replacement.trim()}\n\n${source.slice(endIndex)}`
}

function update(path, transform) {
  const source = fs.readFileSync(path, 'utf8')
  const next = transform(source)
  if (next === source) throw new Error(`${path}: patch made no changes`)
  fs.writeFileSync(path, next)
}

update('src/lib/types.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  player: string\n  /** Gesicherte Punkte dieses Zugs (0 bei Niete). */`,
    `  player: string\n  /** Stabile Identität; bei Altspielen ohne ID optional. */\n  playerId?: string\n  /** Gesicherte Punkte dieses Zugs (0 bei Niete). */`,
    'turn playerId',
  )
  source = replaceOnce(
    source,
    `  players: { name: string; score: number; busts: number }[]`,
    `  players: { playerId?: string; name: string; score: number; busts: number }[]`,
    'historical playerId',
  )
  source = replaceOnce(
    source,
    `export interface PlayerStats {\n  name: string`,
    `export interface PlayerStats {\n  /** Stabile Identität für Duelle, Filter und React-Keys. */\n  id: string\n  name: string`,
    'player stats id',
  )
  return source
})

update('src/App.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `import { getPrefs } from './lib/prefs'`,
    `import { getPrefs } from './lib/prefs'\nimport { playerIdForName } from './lib/playerIdentity'`,
    'app identity import',
  )
  source = replaceOnce(
    source,
    `          makePlayer={(name) => ({ id: uid(), name, score: 0, busts: 0 })}`,
    `          makePlayer={(name) => ({ id: playerIdForName(name), name, score: 0, busts: 0 })}`,
    'stable player creation',
  )
  source = replaceOnce(
    source,
    `    const nextTurns = [...turns, { round, player: players[idx].name, points: pot, bust: false }]`,
    `    const nextTurns = [\n      ...turns,\n      { round, player: players[idx].name, playerId: players[idx].id, points: pot, bust: false },\n    ]`,
    'bank turn identity',
  )
  source = replaceOnce(
    source,
    `    const nextTurns = [...turns, { round, player: bustedName, points: 0, bust: true }]`,
    `    const nextTurns = [\n      ...turns,\n      { round, player: bustedName, playerId: players[idx].id, points: 0, bust: true },\n    ]`,
    'bust turn identity',
  )
  return source
})

update('src/lib/roster.ts', (input) => {
  let source = input
  source = replaceOnce(source, `const KEY = '10k_roster'`, `import { linkPlayerNames } from './playerIdentity'\n\nconst KEY = '10k_roster'`, 'roster identity import')
  source = replaceOnce(
    source,
    `  if (roster.some((r) => norm(r) === norm(n) && norm(r) !== norm(oldName))) return roster\n  const next = roster.map((r) => (norm(r) === norm(oldName) ? n : r))`,
    `  if (roster.some((r) => norm(r) === norm(n) && norm(r) !== norm(oldName))) return roster\n  linkPlayerNames(oldName, n)\n  const next = roster.map((r) => (norm(r) === norm(oldName) ? n : r))`,
    'roster rename alias',
  )
  return source
})

update('src/lib/gameRecordValidation.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `      const name = textValue(candidate.name)\n      const score = integerValue(candidate.score, 0)\n      const busts = candidate.busts === undefined ? { value: 0, repaired: true } : integerValue(candidate.busts, 0)\n      if (!name) errors.push(\`players[\${index}].name fehlt\`)\n      if (score.value === null) errors.push(\`players[\${index}].score ist ungültig\`)\n      if (busts.value === null) errors.push(\`players[\${index}].busts ist ungültig\`)\n      if (!name || score.value === null || busts.value === null) return\n      if (score.repaired) repairs.push(\`players[\${index}].score wurde normalisiert\`)\n      if (busts.repaired) repairs.push(\`players[\${index}].busts wurde ergänzt oder normalisiert\`)\n      players.push({ name, score: score.value, busts: busts.value })`,
    `      const name = textValue(candidate.name)\n      const playerId = textValue(candidate.playerId)\n      const score = integerValue(candidate.score, 0)\n      const busts = candidate.busts === undefined ? { value: 0, repaired: true } : integerValue(candidate.busts, 0)\n      if (!name) errors.push(\`players[\${index}].name fehlt\`)\n      if (candidate.playerId !== undefined && !playerId) repairs.push(\`players[\${index}].playerId war ungültig und wurde ausgelassen\`)\n      if (score.value === null) errors.push(\`players[\${index}].score ist ungültig\`)\n      if (busts.value === null) errors.push(\`players[\${index}].busts ist ungültig\`)\n      if (!name || score.value === null || busts.value === null) return\n      if (score.repaired) repairs.push(\`players[\${index}].score wurde normalisiert\`)\n      if (busts.repaired) repairs.push(\`players[\${index}].busts wurde ergänzt oder normalisiert\`)\n      players.push({ ...(playerId ? { playerId } : {}), name, score: score.value, busts: busts.value })`,
    'validator player identity',
  )
  source = replaceOnce(
    source,
    `  let bust: boolean | null = typeof value.bust === 'boolean' ? value.bust : null`,
    `  const playerId = textValue(value.playerId)\n  if (value.playerId !== undefined && !playerId) repairs.push(\`turns[\${index}].playerId war ungültig und wurde ausgelassen\`)\n\n  let bust: boolean | null = typeof value.bust === 'boolean' ? value.bust : null`,
    'validator turn player id',
  )
  source = replaceOnce(
    source,
    `    turn: { round: round.value, player: matchedPlayer, points: points.value, bust },`,
    `    turn: { round: round.value, player: matchedPlayer, ...(playerId ? { playerId } : {}), points: points.value, bust },`,
    'normalized turn identity',
  )
  source = replaceOnce(
    source,
    `  if (duplicateNames.length > 0) errors.push('Spieler-Namen sind innerhalb des Spiels nicht eindeutig')`,
    `  if (duplicateNames.length > 0) errors.push('Spieler-Namen sind innerhalb des Spiels nicht eindeutig')\n\n  const duplicatePlayerIds = players\n    .map((player) => player.playerId)\n    .filter((id): id is string => Boolean(id))\n    .filter((id, index, all) => all.indexOf(id) !== index)\n  if (duplicatePlayerIds.length > 0) errors.push('Spieler-IDs sind innerhalb des Spiels nicht eindeutig')`,
    'duplicate player ids',
  )
  return source
})

update('src/lib/storage.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `} from './gameRecordValidation'`,
    `} from './gameRecordValidation'\nimport {\n  identityNameMap,\n  playerIdentityKey,\n  resolveIdentitySelector,\n  turnIdentityKey,\n  winnerIdentityKey,\n} from './playerIdentity'`,
    'storage identity imports',
  )
  source = replaceOnce(
    source,
    `    players: allPlayers.map((p) => ({ name: p.name, score: p.score, busts: p.busts })),`,
    `    players: allPlayers.map((p) => ({ playerId: p.id, name: p.name, score: p.score, busts: p.busts })),`,
    'save player ids',
  )
  source = replaceSection(
    source,
    `export function aggregateStats(`,
    `export interface GamePlayerStat`,
    `export function aggregateStats(history = getHistory(), event?: string): PlayerStats[] {
  const games = event ? history.filter((g) => g.event === event) : history
  const names = identityNameMap(games)
  const map = new Map<string, PlayerStats>()

  for (const game of games) {
    const winnerId = winnerIdentityKey(game)
    for (const p of game.players) {
      const id = playerIdentityKey(p)
      const s =
        map.get(id) ??
        {
          id,
          name: names.get(id) ?? p.name,
          games: 0,
          wins: 0,
          totalScore: 0,
          bestScore: 0,
          busts: 0,
          bustRate: 0,
          winRate: 0,
        }
      s.name = names.get(id) ?? s.name
      s.games += 1
      s.totalScore += p.score
      s.busts += p.busts ?? 0
      s.bestScore = Math.max(s.bestScore, p.score)
      if (winnerId === id) s.wins += 1
      map.set(id, s)
    }
  }

  const list = [...map.values()].map((s) => ({
    ...s,
    bustRate: s.games ? s.busts / s.games : 0,
    winRate: s.games ? s.wins / s.games : 0,
  }))

  list.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.bestScore - a.bestScore)
  return list
}
`,
    'aggregate stats',
  )
  source = replaceOnce(
    source,
    `export interface PlayerForm {\n  name: string`,
    `export interface PlayerForm {\n  id: string\n  name: string`,
    'player form id',
  )
  source = replaceSection(
    source,
    `export function computeForm(`,
    `export interface HeadToHead`,
    `export function computeForm(history = getHistory(), event?: string, limit = 5): PlayerForm[] {
  const games = (event ? history.filter((g) => g.event === event) : history)
    .slice()
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  const names = identityNameMap(games)
  const map = new Map<string, boolean[]>()

  for (const game of games) {
    const winnerId = winnerIdentityKey(game)
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      const results = map.get(id) ?? []
      if (results.length < limit) results.push(winnerId === id)
      map.set(id, results)
    }
  }

  return [...map.entries()]
    .map(([id, results]) => ({ id, name: names.get(id) ?? id, results, games: results.length }))
    .filter((form) => form.games >= 2)
    .sort(
      (a, b) =>
        b.results.filter(Boolean).length - a.results.filter(Boolean).length || b.games - a.games,
    )
}
`,
    'current form',
  )
  source = replaceSection(
    source,
    `export function computeHeadToHead(`,
    `/**\n * „Angstgegner"`,
    `export function computeHeadToHead(
  a: string,
  b: string,
  history = getHistory(),
  event?: string,
): HeadToHead {
  const games = event ? history.filter((g) => g.event === event) : history
  const names = identityNameMap(games)
  const aId = resolveIdentitySelector(a, games)
  const bId = resolveIdentitySelector(b, games)
  const h: HeadToHead = {
    a: names.get(aId) ?? a,
    b: names.get(bId) ?? b,
    games: 0,
    aAhead: 0,
    bAhead: 0,
    aWins: 0,
    bWins: 0,
    aBest: 0,
    bBest: 0,
    aAvg: 0,
    bAvg: 0,
  }
  if (aId === bId) return h

  let aSum = 0
  let bSum = 0
  for (const game of games) {
    const pa = game.players.find((player) => playerIdentityKey(player) === aId)
    const pb = game.players.find((player) => playerIdentityKey(player) === bId)
    if (!pa || !pb) continue
    h.games += 1
    aSum += pa.score
    bSum += pb.score
    h.aBest = Math.max(h.aBest, pa.score)
    h.bBest = Math.max(h.bBest, pb.score)
    if (pa.score > pb.score) h.aAhead += 1
    else if (pb.score > pa.score) h.bAhead += 1
    const winnerId = winnerIdentityKey(game)
    if (winnerId === aId) h.aWins += 1
    if (winnerId === bId) h.bWins += 1
  }
  h.aAvg = h.games ? Math.round(aSum / h.games) : 0
  h.bAvg = h.games ? Math.round(bSum / h.games) : 0
  return h
}
`,
    'head to head',
  )
  source = replaceSection(
    source,
    `export function computeNemesis(`,
    `export interface Award`,
    `export function computeNemesis(
  selector: string,
  history = getHistory(),
  event?: string,
): { id: string; name: string; ahead: number; of: number } | null {
  const allGames = event ? history.filter((g) => g.event === event) : history
  const targetId = resolveIdentitySelector(selector, allGames)
  const names = identityNameMap(allGames)
  const games = allGames.filter((game) => game.players.some((player) => playerIdentityKey(player) === targetId))
  const tally = new Map<string, { ahead: number; of: number }>()

  for (const game of games) {
    const me = game.players.find((player) => playerIdentityKey(player) === targetId)
    if (!me) continue
    for (const player of game.players) {
      const id = playerIdentityKey(player)
      if (id === targetId) continue
      const result = tally.get(id) ?? { ahead: 0, of: 0 }
      result.of += 1
      if (player.score > me.score) result.ahead += 1
      tally.set(id, result)
    }
  }

  let best: { id: string; name: string; ahead: number; of: number } | null = null
  for (const [id, result] of tally) {
    if (result.of < 2 || result.ahead === 0) continue
    if (
      !best ||
      result.ahead / result.of > best.ahead / best.of ||
      (result.ahead / result.of === best.ahead / best.of && result.ahead > best.ahead)
    ) {
      best = { id, name: names.get(id) ?? id, ahead: result.ahead, of: result.of }
    }
  }
  return best
}
`,
    'nemesis',
  )

  const awardsStart = source.indexOf(`export function computeAwards(`)
  if (awardsStart < 0) throw new Error('awards: start marker not found')
  source = `${source.slice(0, awardsStart)}${`export function computeAwards(history = getHistory(), event?: string): Award[] {
  const games = event ? history.filter((g) => g.event === event) : history
  if (games.length === 0) return []

  const names = identityNameMap(games)
  const stats = aggregateStats(games)
  const awards: Award[] = []

  const champ = stats.find((s) => s.wins > 0)
  if (champ) {
    awards.push({
      key: 'wins',
      emoji: '👑',
      title: event ? \`${'${event}'}-Champion\` : 'Meiste Siege',
      name: champ.name,
      detail: \`${'${champ.wins}'} ${'${champ.wins === 1 ? \'Sieg\' : \'Siege\'}'}\`,
    })
  }

  const pech = [...stats].sort((a, b) => b.busts - a.busts)[0]
  if (pech && pech.busts > 0) {
    awards.push({ key: 'busts', emoji: '💀', title: 'Pechvogel', name: pech.name, detail: \`${'${pech.busts}'} Nieten\` })
  }

  const record = [...games].sort((a, b) => b.winnerScore - a.winnerScore)[0]
  if (record) {
    const winnerId = winnerIdentityKey(record)
    awards.push({
      key: 'record',
      emoji: '🎯',
      title: 'Rekord-Endstand',
      name: winnerId ? names.get(winnerId) ?? record.winner : record.winner,
      detail: record.winnerScore.toLocaleString('de-DE'),
    })
  }

  const minGames = stats.some((s) => s.games >= 2) ? 2 : 1
  const avg = stats
    .filter((s) => s.games >= minGames)
    .map((s) => ({ name: s.name, value: Math.round(s.totalScore / s.games) }))
    .sort((a, b) => b.value - a.value)[0]
  if (avg) {
    awards.push({ key: 'avg', emoji: '📈', title: 'Bester Schnitt', name: avg.name, detail: \`Ø ${'${avg.value.toLocaleString(\'de-DE\')}'}\` })
  }

  let bestTurn = { id: '', name: '', points: 0 }
  for (const game of games) {
    for (const turn of game.turns ?? []) {
      if (turn.points <= bestTurn.points) continue
      const id = turnIdentityKey(turn, game)
      bestTurn = { id, name: names.get(id) ?? turn.player, points: turn.points }
    }
  }
  if (bestTurn.points > 0) {
    awards.push({
      key: 'bestturn',
      emoji: '🚀',
      title: 'Bester Einzelzug',
      name: bestTurn.name,
      detail: bestTurn.points.toLocaleString('de-DE'),
    })
  }

  let fastest = { id: '', name: '', rounds: Infinity }
  for (const game of games) {
    const turns = game.turns ?? []
    if (!turns.length) continue
    const rounds = Math.max(...turns.map((turn) => turn.round))
    if (rounds >= fastest.rounds) continue
    const id = winnerIdentityKey(game) ?? ''
    fastest = { id, name: (id && names.get(id)) ?? game.winner, rounds }
  }
  if (fastest.rounds !== Infinity && fastest.rounds > 0) {
    awards.push({
      key: 'fastest',
      emoji: '⚡',
      title: 'Schnellster Sieg',
      name: fastest.name,
      detail: \`${'${fastest.rounds}'} ${'${fastest.rounds === 1 ? \'Runde\' : \'Runden\'}'}\`,
    })
  }

  const byDate = [...games].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  let best = { id: '', name: '', len: 0 }
  let current = { id: '', name: '', len: 0 }
  for (const game of byDate) {
    const id = winnerIdentityKey(game) ?? \`winner:${'${game.winner}'}\`
    const name = names.get(id) ?? game.winner
    current = id === current.id ? { id, name, len: current.len + 1 } : { id, name, len: 1 }
    if (current.len > best.len) best = { ...current }
  }
  if (best.len >= 2) {
    awards.push({
      key: 'streak',
      emoji: '🔥',
      title: 'Längste Serie',
      name: best.name,
      detail: \`${'${best.len}'} Siege in Folge\`,
    })
  }

  return awards
}
`}`
  return source
})

update('src/components/StatsScreen.tsx', (input) => {
  let source = input
  source = replaceOnce(source, `                    key={f.name}`, `                    key={f.id}`, 'form react key')
  source = replaceOnce(
    source,
    `            <DuelSection names={stats.map((s) => s.name)} games={games} event={filter || undefined} />`,
    `            <DuelSection players={stats.map((s) => ({ id: s.id, name: s.name }))} games={games} event={filter || undefined} />`,
    'duel identity options',
  )
  source = replaceOnce(source, `                  key={s.name}`, `                  key={s.id}`, 'stats react key')
  source = replaceSection(
    source,
    `function DuelSection({`,
    `function DuelRow({`,
    `function DuelSection({
  players,
  games,
  event,
}: {
  players: { id: string; name: string }[]
  games: GameRecord[]
  event?: string
}) {
  const [a, setA] = useState(players[0]?.id ?? '')
  const [b, setB] = useState(players[1]?.id ?? '')

  const aId = players.some((player) => player.id === a) ? a : players[0]?.id ?? ''
  const bId =
    players.some((player) => player.id === b) && b !== aId
      ? b
      : players.find((player) => player.id !== aId)?.id ?? ''
  const aPlayer = players.find((player) => player.id === aId)
  const bPlayer = players.find((player) => player.id === bId)

  const h = useMemo(() => computeHeadToHead(aId, bId, games, event), [aId, bId, games, event])
  const nemA = useMemo(() => computeNemesis(aId, games, event), [aId, games, event])
  const nemB = useMemo(() => computeNemesis(bId, games, event), [bId, games, event])

  if (!aPlayer || !bPlayer) return null
  const aheadTotal = h.aAhead + h.bAhead
  const aPct = aheadTotal ? Math.round((h.aAhead / aheadTotal) * 100) : 50

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-fog-500">Duell</h2>
      <div className="rounded-2xl border border-ink-700/80 bg-ink-850/80 p-4">
        <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            value={aId}
            onChange={(e) => setA(e.target.value)}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-2.5 py-2 text-sm font-bold text-gold-400"
          >
            {players.map((player) => (
              <option key={player.id} value={player.id} disabled={player.id === bId}>
                {player.name}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-black text-fog-600">vs</span>
          <select
            value={bId}
            onChange={(e) => setB(e.target.value)}
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-2.5 py-2 text-right text-sm font-bold text-mint-400"
          >
            {players.map((player) => (
              <option key={player.id} value={player.id} disabled={player.id === aId}>
                {player.name}
              </option>
            ))}
          </select>
        </div>

        {h.games === 0 ? (
          <p className="py-3 text-center text-xs text-fog-500">Noch kein gemeinsames Spiel.</p>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="text-gold-400">{h.aAhead}×</span>
              <span className="text-fog-600">öfter vorn</span>
              <span className="text-mint-400">{h.bAhead}×</span>
            </div>
            <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-ink-900">
              <div className="bg-gold-500/70" style={{ width: \`${'${aPct}'}%\` }} />
              <div className="bg-mint-400/70" style={{ width: \`${'${100 - aPct}'}%\` }} />
            </div>

            <DuelRow label="Spiele zusammen" a={h.games} b={h.games} same />
            <DuelRow label="Siege" a={h.aWins} b={h.bWins} />
            <DuelRow label="Bestwert" a={fmt(h.aBest)} b={fmt(h.bBest)} cmp={[h.aBest, h.bBest]} />
            <DuelRow label="Ø Punkte" a={fmt(h.aAvg)} b={fmt(h.bAvg)} cmp={[h.aAvg, h.bAvg]} />

            {(nemA || nemB) && (
              <div className="mt-3 border-t border-ink-800 pt-3 text-[11px] text-fog-500">
                {nemA && (
                  <p>
                    😨 <span className="font-semibold text-fog-300">{aPlayer.name}</span>s Angstgegner:{' '}
                    <span className="font-semibold text-coral-400">{nemA.name}</span> ({nemA.ahead}/{nemA.of} vorn)
                  </p>
                )}
                {nemB && (
                  <p className="mt-0.5">
                    😨 <span className="font-semibold text-fog-300">{bPlayer.name}</span>s Angstgegner:{' '}
                    <span className="font-semibold text-coral-400">{nemB.name}</span> ({nemB.ahead}/{nemB.of} vorn)
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
`,
    'duel component',
  )
  return source
})

console.log('Player identity patch applied successfully.')
