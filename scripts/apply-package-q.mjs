import fs from 'node:fs'

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8')
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`${path}: marker not found`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: marker not unique`)
  fs.writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length))
}

function insertBefore(path, marker, insertion) {
  replaceOnce(path, marker, insertion + marker)
}

// --- Explicit persistent checkpoint before a historical correction. ---
insertBefore(
  'src/lib/activeGame.ts',
  '/**\n * Parst und validiert einen gespeicherten Spielstand.',
  `/** Legt bewusst einen gültigen Wiederherstellungspunkt an, auch wenn der Hauptstand identisch ist. */\nexport function createActiveGameCheckpoint(game: ActiveGame): void {\n  const raw = JSON.stringify(persistable(game))\n  try {\n    const backups = [raw, ...readRecoveryRaws().filter((candidate) => candidate !== raw)]\n    localStorage.setItem(RECOVERY_KEY, JSON.stringify(backups.slice(0, RECOVERY_LIMIT)))\n  } catch {\n    /* Best effort: Die Korrektur bleibt zusätzlich über den In-Memory-Undo geschützt. */\n  }\n}\n\n`,
)

replaceOnce(
  'src/lib/activeGame.test.ts',
  "import { clearActiveGame, loadActiveGame, parseActiveGame, saveActiveGame } from './activeGame'",
  "import { clearActiveGame, createActiveGameCheckpoint, loadActiveGame, parseActiveGame, saveActiveGame } from './activeGame'",
)
insertBefore(
  'src/lib/activeGame.test.ts',
  "  it('restores the newest valid copy when the primary value is damaged', () => {",
  `  it('creates an explicit checkpoint before a correction even when the primary state is unchanged', () => {\n    saveActiveGame(base)\n    createActiveGameCheckpoint(base)\n    localStorage.setItem('10k_active_game', '{broken')\n\n    const restored = loadActiveGame()\n\n    expect(restored?.players[0].score).toBe(500)\n    expect(restored?.recoveredFromBackup).toBe(true)\n  })\n\n`,
)

// --- App replay + correction orchestration. ---
replaceOnce(
  'src/App.tsx',
  `  clearActiveGame,\n  createActiveGameSessionId,`,
  `  clearActiveGame,\n  createActiveGameCheckpoint,\n  createActiveGameSessionId,`,
)
insertBefore(
  'src/App.tsx',
  "import { playerIdForName } from './lib/playerIdentity'\n",
  "import { replayCompletedTurns, TurnReplayError } from './lib/turnReplay'\n",
)
replaceOnce(
  'src/App.tsx',
  "    showToast(`${snapshot.action === 'bank' ? 'Sichern' : snapshot.action === 'bust' ? 'Niete' : 'Zocken'} rückgängig`)",
  `    const actionLabel =\n      snapshot.action === 'bank'\n        ? 'Sichern'\n        : snapshot.action === 'bust'\n          ? 'Niete'\n          : snapshot.action === 'correction'\n            ? 'Korrektur'\n            : 'Zocken'\n    showToast(\`${'${actionLabel}'} rückgängig\`)`,
)
insertBefore(
  'src/App.tsx',
  '  const acknowledgeBust = () => {',
  `  const handleCorrectTurn = (turnIndex: number, points: number, bust: boolean) => {\n    if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= turns.length) {\n      return { ok: false, message: 'Dieser Zug wurde nicht gefunden.' }\n    }\n\n    const correctedTurns = turns.map((turn, index) =>\n      index === turnIndex ? { ...turn, points: bust ? 0 : points, bust } : { ...turn },\n    )\n\n    let replay\n    try {\n      replay = replayCompletedTurns(\n        players.map(({ id, name }) => ({ id, name })),\n        correctedTurns,\n        goalScore,\n        entryMin,\n      )\n    } catch (error) {\n      const message = error instanceof TurnReplayError ? error.message : 'Korrektur konnte nicht berechnet werden.'\n      return { ok: false, message }\n    }\n\n    if (replay.phase === 'finished') {\n      return {\n        ok: false,\n        message: 'Diese Korrektur würde die Partie bereits beenden. Bitte korrigiere zuerst einen späteren Zug.',\n      }\n    }\n\n    createActiveGameCheckpoint({\n      sessionId,\n      players,\n      idx,\n      round,\n      phase,\n      target,\n      event,\n      testMode,\n      diceMode,\n      goalScore,\n      entryMin,\n      kept,\n      dice,\n      accumulated,\n      turns,\n      rolled,\n      thrown,\n      throwSeq,\n      savedAt: new Date().toISOString(),\n    })\n    takeSnapshot('correction')\n\n    setPlayers(replay.players)\n    setTurns(replay.turns)\n    setIdx(replay.idx)\n    setRound(replay.round)\n    setPhase(replay.phase)\n    setTarget(replay.target)\n    setWinner(null)\n    setAccumulated(0)\n    setKept([])\n    setDice([])\n    setRolled([])\n    setThrown([])\n    setThrowSeq((sequence) => sequence + 1)\n    setCelebration(null)\n    setHandoff(null)\n    setBustAnnounce(null)\n    showToast('Korrektur gespeichert')\n    return { ok: true, message: 'Korrektur gespeichert' }\n  }\n\n`,
)
replaceOnce(
  'src/App.tsx',
  '        onUndo={undo}\n        onExit={exitToSetup}',
  '        onUndo={undo}\n        onCorrectTurn={handleCorrectTurn}\n        onExit={exitToSetup}',
)

// --- Mobile log UI. ---
insertBefore(
  'src/components/GameScreen.tsx',
  "import { GameChart } from './GameChart'\n",
  "import { TurnLogDialog } from './TurnLogDialog'\n",
)
replaceOnce(
  'src/components/GameScreen.tsx',
  '  onUndo: () => void\n  onExit: () => void',
  `  onUndo: () => void\n  onCorrectTurn: (index: number, points: number, bust: boolean) => { ok: boolean; message: string }\n  onExit: () => void`,
)
insertBefore(
  'src/components/GameScreen.tsx',
  "  const [showRiskInfo, setShowRiskInfo] = useState(false)\n",
  "  const [showTurnLog, setShowTurnLog] = useState(false)\n",
)
insertBefore(
  'src/components/GameScreen.tsx',
  `          <button\n            onClick={p.onUndo}`,
  `          <button\n            onClick={() => setShowTurnLog(true)}\n            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-fog-400 transition-colors hover:bg-ink-800 hover:text-fog-200"\n            aria-label="Rundenprotokoll öffnen"\n          >\n            <span className="text-sm leading-none">▤</span>\n            <span className="text-[8px] font-bold uppercase tracking-wide">Verlauf</span>\n          </button>\n`,
)
insertBefore(
  'src/components/GameScreen.tsx',
  '      {/* Sieg-Overlay – oder, umgeschaltet, die Runden-Analyse desselben Spiels. */}',
  `      {showTurnLog && (\n        <TurnLogDialog\n          turns={turns}\n          onCorrectTurn={p.onCorrectTurn}\n          onClose={() => setShowTurnLog(false)}\n        />\n      )}\n\n`,
)

replaceOnce(
  'playwright.webkit.config.ts',
  '  testMatch: /(production-hardening|iphone-gameflow|setup-responsive)\\.spec\\.ts/,',
  '  testMatch: /(production-hardening|iphone-gameflow|setup-responsive|turn-corrections)\\.spec\\.ts/,',
)

console.log('Paket Q Produktpatch angewendet')
