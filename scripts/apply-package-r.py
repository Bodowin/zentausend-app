from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Anchor not found in {path}: {old[:100]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'Anchor not unique in {path}: {old[:100]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


# App imports and state.
replace_once(
    'src/App.tsx',
    "import { replayCompletedTurns, TurnReplayError } from './lib/turnReplay'\n",
    "import { replayCompletedTurns, TurnReplayError } from './lib/turnReplay'\n"
    "import {\n"
    "  consumePausedGame,\n"
    "  deletePausedGame,\n"
    "  listPausedGames,\n"
    "  loadPausedGameStore,\n"
    "  pauseActiveGame,\n"
    "  persistPausedGameStore,\n"
    "  type PausedGameStore,\n"
    "} from './lib/pausedGames'\n"
    "import { syncPausedGamesToCloud } from './lib/pausedGamesCloud'\n",
)

replace_once(
    'src/App.tsx',
    "  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())\n"
    "  const initialResume = useRef(resumable)\n",
    "  const [resumable, setResumable] = useState<ActiveGame | null>(() => loadActiveGame())\n"
    "  const [pausedStore, setPausedStore] = useState<PausedGameStore>(() => loadPausedGameStore())\n"
    "  const pausedLists = useMemo(() => listPausedGames(pausedStore), [pausedStore])\n"
    "  const pausedSyncGeneration = useRef(0)\n"
    "  const initialResume = useRef(resumable)\n",
)

replace_once(
    'src/App.tsx',
    "  const showToast = useCallback((msg: string) => {\n"
    "    setToast(msg)\n"
    "    window.setTimeout(() => setToast((current) => (current === msg ? '' : current)), 1800)\n"
    "  }, [])\n\n",
    "  const showToast = useCallback((msg: string) => {\n"
    "    setToast(msg)\n"
    "    window.setTimeout(() => setToast((current) => (current === msg ? '' : current)), 1800)\n"
    "  }, [])\n\n"
    "  const syncPausedLibrary = useCallback((source?: PausedGameStore) => {\n"
    "    const local = source ?? loadPausedGameStore()\n"
    "    const persisted = persistPausedGameStore(local) ?? local\n"
    "    setPausedStore(persisted)\n"
    "    if (!hasCliqueCode()) return\n\n"
    "    const generation = ++pausedSyncGeneration.current\n"
    "    void syncPausedGamesToCloud(persisted).then((result) => {\n"
    "      if (pausedSyncGeneration.current !== generation) return\n"
    "      const merged = persistPausedGameStore(result.store)\n"
    "      if (merged) setPausedStore(merged)\n"
    "    })\n"
    "  }, [])\n\n"
    "  useEffect(() => {\n"
    "    const sync = () => syncPausedLibrary()\n"
    "    sync()\n"
    "    window.addEventListener('10k-clique-code-changed', sync)\n"
    "    window.addEventListener('online', sync)\n"
    "    return () => {\n"
    "      window.removeEventListener('10k-clique-code-changed', sync)\n"
    "      window.removeEventListener('online', sync)\n"
    "    }\n"
    "  }, [syncPausedLibrary])\n\n",
)

replace_once(
    'src/App.tsx',
    "  const discardResume = () => {\n"
    "    const discardedSession = resumable?.sessionId ?? ''\n"
    "    cloudSyncGeneration.current += 1\n"
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    if (discardedSession) void clearCloudActiveGame(discardedSession)\n"
    "  }\n\n",
    "  const pauseResume = () => {\n"
    "    const current = resumable ?? loadActiveGame()\n"
    "    if (!current) return true\n"
    "    const next = pauseActiveGame(current)\n"
    "    if (!next) {\n"
    "      showToast('Spiel konnte nicht pausiert werden')\n"
    "      return false\n"
    "    }\n"
    "    syncPausedLibrary(next)\n"
    "    cloudSyncGeneration.current += 1\n"
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    void clearCloudActiveGame(current.sessionId)\n"
    "    return true\n"
    "  }\n\n"
    "  const discardResume = () => {\n"
    "    const discardedSession = resumable?.sessionId ?? ''\n"
    "    cloudSyncGeneration.current += 1\n"
    "    clearActiveGame()\n"
    "    setResumable(null)\n"
    "    if (discardedSession) void clearCloudActiveGame(discardedSession)\n"
    "  }\n\n"
    "  const handleDeletePausedGame = (pausedSessionId: string) => {\n"
    "    const next = deletePausedGame(pausedSessionId)\n"
    "    if (!next) {\n"
    "      showToast('Pausiertes Spiel konnte nicht gelöscht werden')\n"
    "      return\n"
    "    }\n"
    "    syncPausedLibrary(next)\n"
    "  }\n\n",
)

replace_once(
    'src/App.tsx',
    "    if (mode === 'virtual' && reconstructedThrow.length) showToast('Wurf wiederhergestellt')\n"
    "  }\n\n"
    "  const useCloudGame = async () => {\n",
    "    if (mode === 'virtual' && reconstructedThrow.length) showToast('Wurf wiederhergestellt')\n"
    "  }\n\n"
    "  const resumePausedGame = async (pausedSessionId: string) => {\n"
    "    const current = resumable ?? loadActiveGame()\n"
    "    if (current && current.sessionId !== pausedSessionId) {\n"
    "      const paused = pauseActiveGame(current)\n"
    "      if (!paused) {\n"
    "        showToast('Aktuelles Spiel konnte nicht pausiert werden')\n"
    "        return\n"
    "      }\n"
    "      syncPausedLibrary(paused)\n"
    "      cloudSyncGeneration.current += 1\n"
    "      clearActiveGame()\n"
    "      setResumable(null)\n"
    "      await clearCloudActiveGame(current.sessionId)\n"
    "    }\n\n"
    "    const consumed = consumePausedGame(pausedSessionId)\n"
    "    if (!consumed) {\n"
    "      showToast('Pausiertes Spiel konnte nicht geöffnet werden')\n"
    "      return\n"
    "    }\n"
    "    syncPausedLibrary(consumed.store)\n"
    "    saveActiveGame(consumed.game)\n"
    "    resumeGame(consumed.game)\n"
    "  }\n\n"
    "  const useCloudGame = async () => {\n",
)

replace_once(
    'src/App.tsx',
    "          resumable={resumable}\n"
    "          onResume={resumeGame}\n"
    "          onDiscardResume={discardResume}\n",
    "          resumable={resumable}\n"
    "          pausedGames={pausedLists.paused}\n"
    "          archivedGames={pausedLists.archived}\n"
    "          onResume={resumeGame}\n"
    "          onPauseResume={pauseResume}\n"
    "          onDiscardResume={discardResume}\n"
    "          onResumePaused={resumePausedGame}\n"
    "          onDeletePaused={handleDeletePausedGame}\n",
)

# Setup-screen imports, props, conflict action and library panel.
replace_once(
    'src/components/SetupScreen.tsx',
    "import type { ActiveGame } from '../lib/activeGame'\n",
    "import type { ActiveGame } from '../lib/activeGame'\n"
    "import type { PausedGameItem } from '../lib/pausedGames'\n"
    "import { PausedGamesPanel } from './PausedGamesPanel'\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "  resumable: ActiveGame | null\n"
    "  onResume: (g: ActiveGame) => void\n"
    "  onDiscardResume: () => void\n",
    "  resumable: ActiveGame | null\n"
    "  pausedGames: PausedGameItem[]\n"
    "  archivedGames: PausedGameItem[]\n"
    "  onResume: (g: ActiveGame) => void\n"
    "  onPauseResume: () => boolean\n"
    "  onDiscardResume: () => void\n"
    "  onResumePaused: (sessionId: string) => void\n"
    "  onDeletePaused: (sessionId: string) => void\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "  resumable,\n"
    "  onResume,\n"
    "  onDiscardResume,\n",
    "  resumable,\n"
    "  pausedGames,\n"
    "  archivedGames,\n"
    "  onResume,\n"
    "  onPauseResume,\n"
    "  onDiscardResume,\n"
    "  onResumePaused,\n"
    "  onDeletePaused,\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "            <h2 className=\"text-lg font-black text-fog-100\">Laufendes Spiel ersetzen?</h2>\n"
    "            <p className=\"mt-2 text-sm leading-relaxed text-fog-400\">\n"
    "              Runde {resumable.round} mit {resumable.players.map((player) => player.name).join(', ')} ist noch gespeichert.\n"
    "              Ein neues Spiel ersetzt diesen Stand und seine Sicherheitskopien.\n"
    "            </p>\n",
    "            <h2 className=\"text-lg font-black text-fog-100\">Laufendes Spiel pausieren?</h2>\n"
    "            <p className=\"mt-2 text-sm leading-relaxed text-fog-400\">\n"
    "              Runde {resumable.round} mit {resumable.players.map((player) => player.name).join(', ')} ist noch gespeichert.\n"
    "              Das neue Spiel überschreibt nichts: Dieser Stand bleibt 14 Tage in der Pausenliste und danach im Archiv.\n"
    "            </p>\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "              onClick={() => {\n"
    "                setStartConflictOpen(false)\n"
    "                onDiscardResume()\n"
    "                startConfiguredGame()\n"
    "              }}\n"
    "              className=\"mt-2 w-full rounded-xl border border-coral-500/40 bg-coral-500/10 px-4 py-3 font-bold text-coral-300\"\n"
    "            >\n"
    "              Neues Spiel starten\n"
    "            </button>\n",
    "              onClick={() => {\n"
    "                if (!onPauseResume()) return\n"
    "                setStartConflictOpen(false)\n"
    "                startConfiguredGame()\n"
    "              }}\n"
    "              className=\"mt-2 w-full rounded-xl border border-mint-500/40 bg-mint-500/10 px-4 py-3 font-bold text-mint-300\"\n"
    "            >\n"
    "              Spiel pausieren & neues starten\n"
    "            </button>\n",
)

replace_once(
    'src/components/SetupScreen.tsx',
    "      <section className=\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\">\n",
    "      <PausedGamesPanel\n"
    "        paused={pausedGames}\n"
    "        archived={archivedGames}\n"
    "        onResume={onResumePaused}\n"
    "        onDelete={onDeletePaused}\n"
    "      />\n\n"
    "      <section className=\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\">\n",
)

replace_once(
    'playwright.webkit.config.ts',
    "  testMatch: /(production-hardening|iphone-gameflow|setup-responsive)\\.spec\\.ts/,\n",
    "  testMatch: /(production-hardening|iphone-gameflow|setup-responsive|paused-games)\\.spec\\.ts/,\n",
)

print('Package R paused-game integration applied.')
