from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:100]!r}')
    file.write_text(text.replace(old, new, 1))


# App: local/cloud pause library and safe transitions.
replace_once(
    'src/App.tsx',
    "import { replayCompletedTurns, TurnReplayError } from './lib/turnReplay'\n",
    "import { replayCompletedTurns, TurnReplayError } from './lib/turnReplay'\n"
    "import {\n"
    "  deletePausedGame,\n"
    "  isArchivedPausedGame,\n"
    "  loadPausedGames,\n"
    "  savePausedGame,\n"
    "  takePausedGame,\n"
    "} from './lib/pausedGames'\n"
    "import { syncPausedGamesCloud } from './lib/pausedGamesCloud'\n",
)

replace_once(
    'src/App.tsx',
    "  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())\n"
    "  const initialResume = useRef(resumable)\n",
    "  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())\n"
    "  const [pausedGames, setPausedGames] = useState<ActiveGame[]>(() => loadPausedGames())\n"
    "  const initialResume = useRef(resumable)\n",
)

replace_once(
    'src/App.tsx',
    "  const dismissedCloudVersion = useRef<number | null>(null)\n\n"
    "  const [showIntro, setShowIntro] = useState(() => {\n",
    "  const dismissedCloudVersion = useRef<number | null>(null)\n\n"
    "  const refreshPausedLibrary = useCallback(() => {\n"
    "    setPausedGames(loadPausedGames())\n"
    "    if (!hasCliqueCode()) return\n"
    "    void syncPausedGamesCloud().then(() => setPausedGames(loadPausedGames()))\n"
    "  }, [])\n\n"
    "  const [showIntro, setShowIntro] = useState(() => {\n",
)

replace_once(
    'src/App.tsx',
    "  useEffect(() => {\n"
    "    let cancelled = false\n\n"
    "    const inspectCloudGame = () => {\n",
    "  useEffect(() => {\n"
    "    const current = loadActiveGame()\n"
    "    if (!current || !isArchivedPausedGame(current)) return\n\n"
    "    savePausedGame(current)\n"
    "    clearActiveGame()\n"
    "    initialResume.current = null\n"
    "    setResumable(null)\n"
    "    refreshPausedLibrary()\n"
    "    if (hasCliqueCode()) void clearCloudActiveGame(current.sessionId)\n"
    "  }, [refreshPausedLibrary])\n\n"
    "  useEffect(() => {\n"
    "    let cancelled = false\n\n"
    "    const inspectCloudGame = () => {\n",
)

replace_once(
    'src/App.tsx',
    "      if (!hasCliqueCode()) {\n"
    "        setCloudPrompt(null)\n"
    "        return\n"
    "      }\n"
    "      void inspectActiveGameCloud(initialResume.current).then((prompt) => {\n",
    "      if (!hasCliqueCode()) {\n"
    "        setCloudPrompt(null)\n"
    "        setPausedGames(loadPausedGames())\n"
    "        return\n"
    "      }\n"
    "      void syncPausedGamesCloud().then(() => {\n"
    "        if (!cancelled) setPausedGames(loadPausedGames())\n"
    "      })\n"
    "      void inspectActiveGameCloud(initialResume.current).then((prompt) => {\n",
)

replace_once(
    'src/App.tsx',
    "  ) => {\n"
    "    setPlayers(chosen.map((player) => ({ ...player, score: 0, busts: 0 })))\n",
    "  ) => {\n"
    "    const previous = resumable ?? loadActiveGame()\n"
    "    if (previous) {\n"
    "      savePausedGame(previous)\n"
    "      cloudSyncGeneration.current += 1\n"
    "      clearActiveGame()\n"
    "      if (hasCliqueCode()) void clearCloudActiveGame(previous.sessionId)\n"
    "      refreshPausedLibrary()\n"
    "    }\n\n"
    "    setPlayers(chosen.map((player) => ({ ...player, score: 0, busts: 0 })))\n",
)

replace_once(
    'src/App.tsx',
    "    void clearCloudActiveGame(sessionId)\n"
    "    clearActiveGame()\n"
    "    setSetupSeed({ players: ordered, event, diceMode, goalScore, entryMin })\n",
    "    void clearCloudActiveGame(sessionId)\n"
    "    deletePausedGame(sessionId)\n"
    "    clearActiveGame()\n"
    "    refreshPausedLibrary()\n"
    "    setSetupSeed({ players: ordered, event, diceMode, goalScore, entryMin })\n",
)

replace_once(
    'src/App.tsx',
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    if (discardedSession) void clearCloudActiveGame(discardedSession)\n"
    "  }\n\n"
    "  const resumeGame = (game: ActiveGame) => {\n",
    "    if (discardedSession) deletePausedGame(discardedSession)\n"
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    refreshPausedLibrary()\n"
    "    if (discardedSession) void clearCloudActiveGame(discardedSession)\n"
    "  }\n\n"
    "  const resumeGame = (game: ActiveGame) => {\n",
)

replace_once(
    'src/App.tsx',
    "    if (mode === 'virtual' && reconstructedThrow.length) showToast('Wurf wiederhergestellt')\n"
    "  }\n\n"
    "  const useCloudGame = async () => {\n",
    "    if (mode === 'virtual' && reconstructedThrow.length) showToast('Wurf wiederhergestellt')\n"
    "  }\n\n"
    "  const resumePausedGame = (requested: ActiveGame) => {\n"
    "    const current = resumable ?? loadActiveGame()\n"
    "    if (current && current.sessionId !== requested.sessionId) {\n"
    "      savePausedGame(current)\n"
    "      cloudSyncGeneration.current += 1\n"
    "      if (hasCliqueCode()) void clearCloudActiveGame(current.sessionId)\n"
    "    }\n\n"
    "    const selected = takePausedGame(requested.sessionId) ?? requested\n"
    "    clearActiveGame()\n"
    "    saveActiveGame(selected)\n"
    "    refreshPausedLibrary()\n"
    "    resumeGame(selected)\n"
    "  }\n\n"
    "  const discardPausedGame = (pausedSessionId: string) => {\n"
    "    deletePausedGame(pausedSessionId)\n"
    "    refreshPausedLibrary()\n"
    "  }\n\n"
    "  const useCloudGame = async () => {\n",
)

replace_once(
    'src/App.tsx',
    "        const game = result.snapshot?.game ?? cloudGame\n"
    "        dismissedCloudVersion.current = null\n"
    "        saveActiveGame(game)\n"
    "        setResumable(game)\n",
    "        const game = result.snapshot?.game ?? cloudGame\n"
    "        const local = loadActiveGame()\n"
    "        if (local && local.sessionId !== game.sessionId) savePausedGame(local)\n"
    "        deletePausedGame(game.sessionId)\n"
    "        clearActiveGame()\n"
    "        dismissedCloudVersion.current = null\n"
    "        saveActiveGame(game)\n"
    "        refreshPausedLibrary()\n"
    "        setResumable(game)\n",
)

replace_once(
    'src/App.tsx',
    "  const discardLocalAfterCloudClear = () => {\n"
    "    cloudSyncGeneration.current += 1\n"
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    setCloudPrompt(null)\n"
    "  }\n",
    "  const discardLocalAfterCloudClear = () => {\n"
    "    const local = loadActiveGame()\n"
    "    cloudSyncGeneration.current += 1\n"
    "    if (local) deletePausedGame(local.sessionId)\n"
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    setCloudPrompt(null)\n"
    "    refreshPausedLibrary()\n"
    "  }\n",
)

replace_once(
    'src/App.tsx',
    "          resumable={resumable}\n"
    "          onResume={resumeGame}\n"
    "          onDiscardResume={discardResume}\n",
    "          resumable={resumable}\n"
    "          pausedGames={pausedGames.filter((game) => game.sessionId !== resumable?.sessionId)}\n"
    "          onResume={resumeGame}\n"
    "          onResumePaused={resumePausedGame}\n"
    "          onDiscardResume={discardResume}\n"
    "          onDiscardPaused={discardPausedGame}\n",
)

# Setup screen: safe pause wording and library entry point.
replace_once(
    'src/components/SetupScreen.tsx',
    "import type { ActiveGame } from '../lib/activeGame'\n",
    "import type { ActiveGame } from '../lib/activeGame'\n"
    "import { PausedGamesDialog } from './PausedGamesDialog'\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "  resumable: ActiveGame | null\n"
    "  onResume: (g: ActiveGame) => void\n"
    "  onDiscardResume: () => void\n",
    "  resumable: ActiveGame | null\n"
    "  pausedGames: ActiveGame[]\n"
    "  onResume: (g: ActiveGame) => void\n"
    "  onResumePaused: (g: ActiveGame) => void\n"
    "  onDiscardResume: () => void\n"
    "  onDiscardPaused: (sessionId: string) => void\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "  resumable,\n"
    "  onResume,\n"
    "  onDiscardResume,\n",
    "  resumable,\n"
    "  pausedGames,\n"
    "  onResume,\n"
    "  onResumePaused,\n"
    "  onDiscardResume,\n"
    "  onDiscardPaused,\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "  const [discardOpen, setDiscardOpen] = useState(false)\n",
    "  const [discardOpen, setDiscardOpen] = useState(false)\n"
    "  const [pausedOpen, setPausedOpen] = useState(false)\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}\n\n",
    "      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}\n"
    "      {pausedOpen && (\n"
    "        <PausedGamesDialog\n"
    "          games={pausedGames}\n"
    "          onResume={onResumePaused}\n"
    "          onDelete={onDiscardPaused}\n"
    "          onClose={() => setPausedOpen(false)}\n"
    "        />\n"
    "      )}\n\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    'aria-label="Laufendes Spiel ersetzen?"',
    'aria-label="Aktuelles Spiel pausieren?"',
)
replace_once(
    'src/components/SetupScreen.tsx',
    '<h2 className="text-lg font-black text-fog-100">Laufendes Spiel ersetzen?</h2>',
    '<h2 className="text-lg font-black text-fog-100">Aktuelles Spiel pausieren?</h2>',
)
replace_once(
    'src/components/SetupScreen.tsx',
    "               Runde {resumable.round} mit {resumable.players.map((player) => player.name).join(', ')} ist noch gespeichert.\n"
    "               Ein neues Spiel ersetzt diesen Stand und seine Sicherheitskopien.\n",
    "               Runde {resumable.round} mit {resumable.players.map((player) => player.name).join(', ')} ist noch gespeichert.\n"
    "               Ein neues Spiel verschiebt diesen Stand sicher in „Pausierte Spiele“. Nichts wird gelöscht.\n",
)
replace_once(
    'src/components/SetupScreen.tsx',
    '              Altes Spiel fortsetzen\n',
    '              Aktuelles Spiel fortsetzen\n',
)
replace_once(
    'src/components/SetupScreen.tsx',
    "                 setStartConflictOpen(false)\n"
    "                 onDiscardResume()\n"
    "                 startConfiguredGame()\n",
    "                 setStartConflictOpen(false)\n"
    "                 startConfiguredGame()\n",
)
replace_once(
    'src/components/SetupScreen.tsx',
    'className="mt-2 w-full rounded-xl border border-coral-500/40 bg-coral-500/10 px-4 py-3 font-bold text-coral-300"',
    'className="mt-2 w-full rounded-xl border border-mint-500/40 bg-mint-500/10 px-4 py-3 font-bold text-mint-300"',
)
replace_once(
    'src/components/SetupScreen.tsx',
    '              Neues Spiel starten\n',
    '              Pausieren & neues Spiel starten\n',
)
replace_once(
    'src/components/SetupScreen.tsx',
    "               Der aktuelle Stand und alle drei lokalen Sicherheitskopien werden gelöscht.\n",
    "               Der aktuelle Stand und seine drei lokalen Sicherheitskopien werden gelöscht. Andere pausierte Spiele bleiben erhalten.\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "      <section className=\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\">\n",
    "      {pausedGames.length > 0 && (\n"
    "        <button\n"
    "          type=\"button\"\n"
    "          onClick={() => setPausedOpen(true)}\n"
    "          className=\"mb-3 flex w-full items-center justify-between rounded-2xl border border-ink-700 bg-ink-850/70 px-3.5 py-2.5 text-left transition-colors hover:border-gold-500/40\"\n"
    "          aria-label={`${resumable ? 'Weitere pausierte Spiele' : 'Pausierte Spiele'} (${pausedGames.length})`}\n"
    "        >\n"
    "          <span className=\"flex items-center gap-2 text-sm font-bold text-fog-200\">\n"
    "            <IconRefresh className=\"h-4 w-4 text-gold-400\" />\n"
    "            {resumable ? 'Weitere pausierte Spiele' : 'Pausierte Spiele'}\n"
    "          </span>\n"
    "          <span className=\"rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-black text-gold-300\">{pausedGames.length}</span>\n"
    "        </button>\n"
    "      )}\n\n"
    "      <section className=\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\">\n",
)

# Safari-like suite includes the new archive journey.
replace_once(
    'playwright.webkit.config.ts',
    'testMatch: /(production-hardening|iphone-gameflow|setup-responsive|turn-corrections)\\.spec\\.ts/,',
    'testMatch: /(production-hardening|iphone-gameflow|setup-responsive|turn-corrections|paused-games)\\.spec\\.ts/,',
)

print('Package R patch applied')
