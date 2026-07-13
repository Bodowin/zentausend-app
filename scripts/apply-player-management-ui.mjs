import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function update(path, transform) {
  const source = fs.readFileSync(path, 'utf8')
  const next = transform(source)
  if (next === source) throw new Error(`${path}: patch made no changes`)
  fs.writeFileSync(path, next)
}

update('src/lib/playerIdentity.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `function writeRecovery(recovery: PlayerIdentityRecoverySnapshot[]): void {\n  if (typeof localStorage === 'undefined') return\n  try {\n    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery.slice(0, MAX_RECOVERY_SNAPSHOTS)))\n  } catch {\n    /* Eine fehlgeschlagene Recovery-Speicherung verändert den aktuellen Zustand nicht. */\n  }\n}`,
    `function writeRecovery(recovery: PlayerIdentityRecoverySnapshot[]): boolean {\n  if (typeof localStorage === 'undefined') return false\n  try {\n    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery.slice(0, MAX_RECOVERY_SNAPSHOTS)))\n    return true\n  } catch {\n    return false\n  }\n}`,
    'recovery write result',
  )
  source = replaceOnce(
    source,
    `function snapshotState(state = readStoredState()): void {\n  const recovery = readRecovery()\n  recovery.unshift({ capturedAt: new Date().toISOString(), ...state })\n  writeRecovery(recovery)\n}`,
    `function snapshotState(state = readStoredState()): void {\n  const recovery = readRecovery()\n  recovery.unshift({ capturedAt: new Date().toISOString(), ...state })\n  if (!writeRecovery(recovery)) {\n    throw new Error('Sicherung konnte nicht gespeichert werden. Bitte Gerätespeicher freigeben.')\n  }\n}`,
    'mandatory recovery snapshot',
  )
  return source
})

update('src/components/StatsScreen.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `import { AnalysisScreen } from './AnalysisScreen'`,
    `import { AnalysisScreen } from './AnalysisScreen'\nimport { PlayerManager } from './PlayerManager'`,
    'player manager import',
  )
  source = replaceOnce(
    source,
    `  const [showSettings, setShowSettings] = useState(false)\n  const [focusAdmin, setFocusAdmin] = useState(false)`,
    `  const [showSettings, setShowSettings] = useState(false)\n  const [showPlayers, setShowPlayers] = useState(false)\n  const [focusAdmin, setFocusAdmin] = useState(false)`,
    'player manager state',
  )
  source = replaceOnce(
    source,
    `      if (res.quarantined > 0) notes.push(\`${'${res.quarantined}'} in Quarantäne\`)\n      setIntegrity(getHistoryIntegrityReport())`,
    `      if (res.quarantined > 0) notes.push(\`${'${res.quarantined}'} in Quarantäne\`)\n      if (res.identitiesImported > 0) notes.push(\`${'${res.identitiesImported}'} Spieler-Zuordnungen übernommen\`)\n      if (res.identityConflicts > 0) notes.push(\`${'${res.identityConflicts}'} Zuordnungs-Konflikte ausgelassen\`)\n      setIntegrity(getHistoryIntegrityReport())`,
    'identity import summary',
  )
  source = replaceOnce(
    source,
    `      {editingGame && (`,
    `      {showPlayers && (\n        <PlayerManager\n          games={games}\n          players={stats}\n          onClose={() => setShowPlayers(false)}\n          onChanged={(message) => {\n            setGames(getHistory())\n            setShowPlayers(false)\n            flash(message)\n          }}\n        />\n      )}\n\n      {editingGame && (`,
    'player manager modal',
  )
  source = replaceOnce(
    source,
    `      {/* Backup-Werkzeuge: Export sichert die ewige Tabelle, Import spielt sie zurück. */}\n      <div className="mb-4 flex items-center gap-2">`,
    `      {/* Daten-Werkzeuge: Backup und ausdrücklich kontrollierte Spieler-Zuordnung. */}\n      <div className="mb-4 grid grid-cols-2 gap-2">`,
    'data tools grid',
  )
  source = replaceOnce(
    source,
    `        <button\n          onClick={() => fileInput.current?.click()}\n          className="flex-1 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-fog-300 transition-colors hover:text-fog-100"\n        >\n          ⬆︎ Backup laden\n        </button>\n      </div>`,
    `        <button\n          onClick={() => fileInput.current?.click()}\n          className="rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-fog-300 transition-colors hover:text-fog-100"\n        >\n          ⬆︎ Backup laden\n        </button>\n        <button\n          type="button"\n          onClick={() => setShowPlayers(true)}\n          disabled={stats.length === 0}\n          className="col-span-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-xs font-bold text-gold-300 transition-colors disabled:opacity-40"\n        >\n          👥 Spielerprofile verwalten\n        </button>\n      </div>`,
    'player management button',
  )
  return source
})

console.log('Player management UI patch applied successfully.')
