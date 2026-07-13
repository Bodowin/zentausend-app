import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

const appPath = 'src/App.tsx'
let app = fs.readFileSync(appPath, 'utf8')
app = replaceOnce(
  app,
  "    setToast(mode === 'virtual' && reconstructedThrow.length ? 'Wurf wiederhergestellt' : '')\n    setView('game')",
  "    setToast('')\n    setView('game')\n    if (mode === 'virtual' && reconstructedThrow.length) showToast('Wurf wiederhergestellt')",
  'resume toast timeout',
)
fs.writeFileSync(appPath, app)

const statsPath = 'src/components/StatsScreen.tsx'
let stats = fs.readFileSync(statsPath, 'utf8')

stats = replaceOnce(
  stats,
  `              <button
                key={g.id}
                onClick={() => setAnalysisGame(g)}
                className="block w-full rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4 text-left transition-colors hover:border-ink-600"
              >`,
  `              <div
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => setAnalysisGame(g)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setAnalysisGame(g)
                  }
                }}
                className="block w-full cursor-pointer rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4 text-left transition-colors hover:border-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60"
              >`,
  'history card container',
)

stats = replaceOnce(
  stats,
  `                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditValue(g.event ?? '')
                        setEditingGame(g)
                      }}
                      className="p-1.5 text-fog-600 transition-colors hover:text-gold-400"
                      aria-label="Anlass bearbeiten"
                    >
                      <IconPencil className="h-4 w-4" />
                    </span>`,
  `                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditValue(g.event ?? '')
                        setEditingGame(g)
                      }}
                      className="p-1.5 text-fog-600 transition-colors hover:text-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60"
                      aria-label="Anlass bearbeiten"
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>`,
  'edit event button',
)

stats = replaceOnce(
  stats,
  `                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(g)
                      }}
                      className={\`p-1.5 text-fog-600 transition-colors hover:text-coral-400 \${
                        busyId === g.id ? 'opacity-40' : ''
                      }\`}
                      aria-label="Spiel löschen"
                    >
                      <IconTrash className="h-4 w-4" />
                    </span>`,
  `                    <button
                      type="button"
                      disabled={busyId === g.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(g)
                      }}
                      className={\`p-1.5 text-fog-600 transition-colors hover:text-coral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500/60 \${
                        busyId === g.id ? 'opacity-40' : ''
                      }\`}
                      aria-label="Spiel löschen"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>`,
  'delete game button',
)

stats = replaceOnce(
  stats,
  `                  <span className="ml-auto text-[10px] text-fog-600">Analyse ›</span>
                </div>
              </button>`,
  `                  <span className="ml-auto text-[10px] text-fog-600">Analyse ›</span>
                </div>
              </div>`,
  'history card closing tag',
)

fs.writeFileSync(statsPath, stats)
