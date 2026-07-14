import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`${label}: start marker missing`)
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error(`${label}: end marker missing`)
  return source.slice(0, start) + replacement + source.slice(end)
}

const path = 'src/components/StatsScreen.tsx'
let source = fs.readFileSync(path, 'utf8')

source = replaceOnce(
  source,
  "import { PlayerManager } from './PlayerManager'\n",
  "import { PlayerManager } from './PlayerManager'\nimport { PlayerProfileScreen } from './PlayerProfileScreen'\n",
  'profile screen import',
)

source = replaceOnce(
  source,
  "  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null)\n",
  "  const [analysisGame, setAnalysisGame] = useState<GameRecord | null>(null)\n  const [profileId, setProfileId] = useState<string | null>(null)\n",
  'profile state',
)

source = replaceOnce(
  source,
  "  if (analysisGame) {\n    return <AnalysisScreen game={analysisGame} onBack={() => setAnalysisGame(null)} />\n  }\n\n",
  "  if (profileId) {\n    return (\n      <PlayerProfileScreen\n        playerId={profileId}\n        games={games}\n        event={filter || undefined}\n        onBack={() => setProfileId(null)}\n      />\n    )\n  }\n\n  if (analysisGame) {\n    return <AnalysisScreen game={analysisGame} onBack={() => setAnalysisGame(null)} />\n  }\n\n",
  'profile route',
)

const leaderboard = String.raw`          {/* Ewige Bestenliste und Einstieg in persönliche Profile */}
          <section className="mb-6">
            <div className="mb-2 flex items-end justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-fog-500">Ewige Bestenliste</h2>
              <span className="text-[10px] text-fog-600">Antippen für Profil</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-850/80">
              <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.9fr] gap-2 border-b border-ink-800 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-fog-600">
                <span>Spieler</span>
                <span className="text-right">Siege</span>
                <span className="text-right">Nieten</span>
                <span className="text-right">Bestwert</span>
              </div>
              {stats.map((s, i) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setProfileId(s.id)}
                  aria-label={'Profil von ' + s.name + ' öffnen'}
                  className="grid w-full grid-cols-[1.6fr_0.6fr_0.6fr_0.9fr] items-center gap-2 border-b border-ink-800/60 px-4 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-ink-800/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500/60"
                >
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-fog-100">
                    <span className="w-4 shrink-0 text-center text-xs">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-fog-600">{i + 1}</span>}
                    </span>
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 text-[10px] font-normal text-fog-600">{s.games} Sp.</span>
                  </span>
                  <span className="text-right font-mono font-bold text-gold-400">{s.wins}</span>
                  <span className="text-right font-mono text-coral-400">{s.bustRate.toFixed(1)}</span>
                  <span className="text-right font-mono text-fog-300">{fmt(s.bestScore)}</span>
                </button>
              ))}
            </div>
          </section>

`

source = replaceSection(
  source,
  '          {/* Ewige Bestenliste */}',
  '          {/* Verlauf */}',
  leaderboard,
  'personal leaderboard',
)

fs.writeFileSync(path, source)

const storagePath = 'src/lib/storage.ts'
let storage = fs.readFileSync(storagePath, 'utf8')
storage = replaceOnce(
  storage,
  "export function aggregateStats(history = getHistory(), event?: string): PlayerStats[] {\n  const games = event ? history.filter((g) => g.event === event) : history\n  const names = identityNameMap(games)\n",
  "export function aggregateStats(history = getHistory(), event?: string): PlayerStats[] {\n  const games = event ? history.filter((g) => g.event === event) : history\n  // Der Anlassfilter ändert nur die Kennzahlen. Der Anzeigename kommt immer\n  // aus dem vollständigen Verlauf, damit alte Events nicht auf alte Namen zurückfallen.\n  const names = identityNameMap(history)\n",
  'global identity name in event-filtered stats',
)
fs.writeFileSync(storagePath, storage)
