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
    `import type { GameRecord, Turn } from './types'`,
    `import type { GameRecord, Turn } from './types'\nimport { markPlayerIdentityDirty } from './playerIdentitySyncMeta'\nimport { sanitizePlayerIdentityState } from './playerIdentityState'`,
    'identity sync imports',
  )
  source = replaceOnce(
    source,
    `function writeState(state: PlayerIdentityState): void {\n  writeRecord(ALIAS_KEY, state.aliases)\n  writeRecord(REDIRECT_KEY, state.redirects)\n  writeRecord(PREFERRED_NAME_KEY, state.preferredNames)\n}`,
    `function writeState(state: PlayerIdentityState, markDirty = true): void {\n  const clean = sanitizePlayerIdentityState(state)\n  writeRecord(ALIAS_KEY, clean.aliases)\n  writeRecord(REDIRECT_KEY, clean.redirects)\n  writeRecord(PREFERRED_NAME_KEY, clean.preferredNames)\n  if (markDirty) markPlayerIdentityDirty()\n}`,
    'dirty state writes',
  )
  source = replaceOnce(
    source,
    `export function exportPlayerIdentityState(): PlayerIdentityState {\n  return readStoredState()\n}`,
    `export function exportPlayerIdentityState(): PlayerIdentityState {\n  return sanitizePlayerIdentityState(readStoredState())\n}\n\n/** Ersetzt den lokalen Zustand; Cloud-Anwendungen können Dirty-Tracking abschalten. */\nexport function replacePlayerIdentityState(state: PlayerIdentityState, markDirty = true): void {\n  writeState(sanitizePlayerIdentityState(state), markDirty)\n}`,
    'cloud state replacement',
  )
  return source
})

update('src/lib/playerIdentityCloud.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `import { getCliqueCode } from './cliqueCode'\nimport { getSupabase } from './supabase'`,
    `import { checkCliqueCode } from './cloudAccess'\nimport { getSupabase } from './supabase'`,
    'code validation import',
  )
  source = replaceOnce(
    source,
    `  let cloudVersion = fetched.row?.version ?? 0\n  let cloud = sanitizePlayerIdentityState(fetched.row?.payload ?? emptyPlayerIdentityState())\n\n  if (!meta.dirty) {\n    replacePlayerIdentityState(cloud, false)\n    setPlayerIdentitySyncBase(cloudVersion, cloud, false)\n    return { online: true, pending: 0, conflicts: 0, version: cloudVersion, denied: false }\n  }`,
    `  let cloudVersion = fetched.row?.version ?? 0\n  let cloud = sanitizePlayerIdentityState(fetched.row?.payload ?? emptyPlayerIdentityState())\n  const codeStatus = await checkCliqueCode()\n  const codeDenied = codeStatus === 'invalid' || codeStatus === 'missing'\n\n  if (!meta.dirty) {\n    replacePlayerIdentityState(cloud, false)\n    setPlayerIdentitySyncBase(cloudVersion, cloud, false)\n    return {\n      online: codeStatus !== 'offline',\n      pending: 0,\n      conflicts: 0,\n      version: cloudVersion,\n      denied: codeDenied,\n    }\n  }`,
    'validate code on clean sync',
  )
  source = replaceOnce(
    source,
    `  if (!getCliqueCode()) {\n    return {\n      online: true,\n      pending: 1,\n      conflicts: merged.conflicts,\n      version: cloudVersion,\n      denied: true,\n    }\n  }`,
    `  if (codeStatus !== 'valid') {\n    return {\n      online: codeStatus !== 'offline',\n      pending: 1,\n      conflicts: merged.conflicts,\n      version: cloudVersion,\n      denied: codeDenied,\n    }\n  }`,
    'block writes without valid code',
  )
  return source
})

update('src/lib/cloud.ts', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `import { validateGameRecordArray } from './gameRecordValidation'`,
    `import { validateGameRecordArray } from './gameRecordValidation'\nimport { syncPlayerIdentityState } from './playerIdentityCloud'\nimport { exportPlayerIdentityState } from './playerIdentity'\nimport { playerIdentitySyncPendingCount } from './playerIdentitySyncMeta'`,
    'cloud identity imports',
  )
  source = replaceOnce(
    source,
    `export function pendingEventEditCount(): number {\n  return Object.keys(readPendingEventEdits()).length\n}`,
    `export function pendingEventEditCount(): number {\n  return (\n    Object.keys(readPendingEventEdits()).length +\n    playerIdentitySyncPendingCount(exportPlayerIdentityState())\n  )\n}`,
    'combined pending count',
  )
  source = replaceOnce(
    source,
    `export interface SyncResult {\n  games: GameRecord[]\n  online: boolean\n  /** Noch nicht bestätigte lokale Änderungen. */\n  pending: number\n}`,
    `export interface SyncResult {\n  games: GameRecord[]\n  online: boolean\n  /** Noch nicht bestätigte lokale Änderungen. */\n  pending: number\n  identityConflicts: number\n  codeDenied: boolean\n}`,
    'sync result details',
  )
  source = replaceOnce(
    source,
    `  const local = getHistory()\n  const initialPending = readPendingEventEdits()\n  if (!getSupabase() || isOffline()) {\n    return { games: local, online: false, pending: Object.keys(initialPending).length }\n  }\n\n  const fetched = await fetchCloudGames()\n  if (!fetched.ok) {\n    return { games: local, online: false, pending: Object.keys(initialPending).length }\n  }`,
    `  const local = getHistory()\n  const initialPending = readPendingEventEdits()\n  const initialIdentityPending = playerIdentitySyncPendingCount(exportPlayerIdentityState())\n  if (!getSupabase() || isOffline()) {\n    return {\n      games: local,\n      online: false,\n      pending: Object.keys(initialPending).length + initialIdentityPending,\n      identityConflicts: 0,\n      codeDenied: false,\n    }\n  }\n\n  const identity = await syncPlayerIdentityState()\n  const fetched = await fetchCloudGames()\n  if (!fetched.ok) {\n    return {\n      games: local,\n      online: false,\n      pending: Object.keys(initialPending).length + identity.pending,\n      identityConflicts: identity.conflicts,\n      codeDenied: identity.denied,\n    }\n  }`,
    'sync identity before games',
  )
  source = replaceOnce(
    source,
    `  // Bereits vorhandene Cloud-Zeilen mit offenen lokalen Anlass-Änderungen aktualisieren.\n  for (const [clientId, event] of Object.entries(initialPending)) {`,
    `  let failedGameUploads = 0\n\n  // Bereits vorhandene Cloud-Zeilen mit offenen lokalen Anlass-Änderungen aktualisieren.\n  for (const [clientId, event] of Object.entries(initialPending)) {\n    if (identity.denied) break`,
    'skip denied event writes',
  )
  source = replaceOnce(
    source,
    `  const missing = local.filter((game) => !cloudIds.has(key(game)))\n  for (const game of missing) {\n    if (await pushGame(game)) {\n      cloud.push(game)\n      cloudIds.add(key(game))\n      clearEventEdit(key(game))\n    }\n  }`,
    `  const missing = local.filter((game) => !cloudIds.has(key(game)))\n  for (const game of missing) {\n    if (identity.denied) {\n      failedGameUploads += 1\n      continue\n    }\n    if (await pushGame(game)) {\n      cloud.push(game)\n      cloudIds.add(key(game))\n      clearEventEdit(key(game))\n    } else {\n      failedGameUploads += 1\n    }\n  }`,
    'track missing game uploads',
  )
  source = replaceOnce(
    source,
    `  const pending = readPendingEventEdits()\n  const games = mergeHistories(local, cloud, pending)\n  replaceHistory(games)\n  return { games, online: true, pending: Object.keys(pending).length }`,
    `  const pending = readPendingEventEdits()\n  const games = mergeHistories(local, cloud, pending)\n  replaceHistory(games)\n  return {\n    games,\n    online: true,\n    pending: Object.keys(pending).length + identity.pending + failedGameUploads,\n    identityConflicts: identity.conflicts,\n    codeDenied: identity.denied,\n  }`,
    'final cloud status',
  )
  return source
})

update('src/components/StatsScreen.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `  const [online, setOnline] = useState(false)\n  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())`,
    `  const [online, setOnline] = useState(false)\n  const [codeDenied, setCodeDenied] = useState(false)\n  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())`,
    'code status state',
  )
  source = source.replaceAll(
    `      setPendingSync(res.pending)\n      setIntegrity(getHistoryIntegrityReport())`,
    `      setPendingSync(res.pending)\n      setCodeDenied(res.codeDenied)\n      if (res.identityConflicts > 0) {\n        setMsg(\`${'${res.identityConflicts}'} Spieler-Zuordnungs-Konflikt${'${res.identityConflicts === 1 ? \'\' : \'e\'}'} lokal gelöst.\`)\n      }\n      setIntegrity(getHistoryIntegrityReport())`,
  )
  source = replaceOnce(
    source,
    `          onChanged={(message) => {\n            setGames(getHistory())\n            setShowPlayers(false)\n            flash(message)\n          }}`,
    `          onChanged={(message) => {\n            setGames(getHistory())\n            setShowPlayers(false)\n            flash(message)\n            void reload()\n          }}`,
    'sync player changes immediately',
  )
  source = replaceOnce(
    source,
    `          {loading\n            ? 'Synchronisiere mit der Cloud…'\n            : pendingSync > 0`,
    `          {loading\n            ? 'Synchronisiere mit der Cloud…'\n            : codeDenied\n              ? 'Clique-Code ungültig – in Einstellungen erneuern'\n              : pendingSync > 0`,
    'visible invalid code status',
  )
  return source
})

console.log('Cloud identity sync patch applied successfully.')
