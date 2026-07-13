import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

// storage.ts — central validation, recovery snapshot, quarantine and report
{
  const path = 'src/lib/storage.ts'
  let source = fs.readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `import type { GameRecord, Player, PlayerStats, Turn } from './types'\n\nconst HISTORY_KEY = '10k_history_v3'\nconst MAX_RECORDS = 200\n\nexport function getHistory(): GameRecord[] {\n  try {\n    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as GameRecord[]\n  } catch {\n    return []\n  }\n}`,
    `import type { GameRecord, Player, PlayerStats, Turn } from './types'\nimport {\n  validateGameRecordArray,\n  type GameRecordSource,\n  type GameRecordValidationBatch,\n  type QuarantinedGameRecord,\n} from './gameRecordValidation'\n\nconst HISTORY_KEY = '10k_history_v3'\nconst QUARANTINE_KEY = '10k_history_quarantine_v1'\nconst RECOVERY_KEY = '10k_history_recovery_v1'\nconst INTEGRITY_REPORT_KEY = '10k_history_integrity_report_v1'\nconst MAX_RECORDS = 200\nconst MAX_QUARANTINE_RECORDS = 100\nconst MAX_RECOVERY_SNAPSHOTS = 3\n\ninterface StoredQuarantineRecord extends QuarantinedGameRecord {\n  capturedAt: string\n}\n\ninterface HistoryRecoverySnapshot {\n  capturedAt: string\n  source: GameRecordSource\n  raw: string\n}\n\nexport interface HistoryIntegrityReport {\n  checkedAt: string\n  source: GameRecordSource\n  repaired: number\n  quarantined: number\n  quarantineTotal: number\n  recoverySaved: boolean\n  quarantineStored: boolean\n}\n\nexport interface HistoryIntegrityBundle {\n  report: HistoryIntegrityReport | null\n  quarantine: StoredQuarantineRecord[]\n  recovery: HistoryRecoverySnapshot[]\n}\n\nfunction readArray<T>(key: string): T[] {\n  try {\n    const parsed = JSON.parse(localStorage.getItem(key) || '[]') as unknown\n    return Array.isArray(parsed) ? (parsed as T[]) : []\n  } catch {\n    return []\n  }\n}\n\nfunction serialise(value: unknown): string {\n  try {\n    return JSON.stringify(value) ?? String(value)\n  } catch {\n    return String(value)\n  }\n}\n\nfunction quarantineSignature(entry: QuarantinedGameRecord): string {\n  return [entry.source, entry.id ?? '', entry.reasons.join('|'), serialise(entry.raw)].join('::')\n}\n\nexport function recordHistoryValidation(\n  source: GameRecordSource,\n  validation: GameRecordValidationBatch,\n  recoveryRaw?: string,\n): HistoryIntegrityReport | null {\n  if (validation.repaired === 0 && validation.quarantined.length === 0) return null\n\n  const checkedAt = new Date().toISOString()\n  let recoverySaved = false\n  if (recoveryRaw !== undefined) {\n    try {\n      const recovery = readArray<HistoryRecoverySnapshot>(RECOVERY_KEY)\n      if (recovery[0]?.raw !== recoveryRaw) {\n        recovery.unshift({ capturedAt: checkedAt, source, raw: recoveryRaw })\n      }\n      localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery.slice(0, MAX_RECOVERY_SNAPSHOTS)))\n      recoverySaved = true\n    } catch {\n      recoverySaved = false\n    }\n  }\n\n  const existing = readArray<StoredQuarantineRecord>(QUARANTINE_KEY)\n  const known = new Set(existing.map(quarantineSignature))\n  const additions = validation.quarantined\n    .filter((entry) => !known.has(quarantineSignature(entry)))\n    .map((entry) => ({ ...entry, capturedAt: checkedAt }))\n  const quarantine = [...additions, ...existing].slice(0, MAX_QUARANTINE_RECORDS)\n  let quarantineStored = true\n  try {\n    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(quarantine))\n  } catch {\n    quarantineStored = false\n  }\n\n  const report: HistoryIntegrityReport = {\n    checkedAt,\n    source,\n    repaired: validation.repaired,\n    quarantined: validation.quarantined.length,\n    quarantineTotal: quarantine.length,\n    recoverySaved,\n    quarantineStored,\n  }\n  try {\n    localStorage.setItem(INTEGRITY_REPORT_KEY, JSON.stringify(report))\n  } catch {\n    /* Bericht bleibt über den Rückgabewert verfügbar. */\n  }\n  return report\n}\n\nexport function getHistoryIntegrityReport(): HistoryIntegrityReport | null {\n  try {\n    const parsed = JSON.parse(localStorage.getItem(INTEGRITY_REPORT_KEY) || 'null') as unknown\n    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null\n    return parsed as HistoryIntegrityReport\n  } catch {\n    return null\n  }\n}\n\nexport function clearHistoryIntegrityReport(): void {\n  try {\n    localStorage.removeItem(INTEGRITY_REPORT_KEY)\n  } catch {\n    /* ignore */\n  }\n}\n\nexport function getHistoryIntegrityBundle(): HistoryIntegrityBundle {\n  return {\n    report: getHistoryIntegrityReport(),\n    quarantine: readArray<StoredQuarantineRecord>(QUARANTINE_KEY),\n    recovery: readArray<HistoryRecoverySnapshot>(RECOVERY_KEY),\n  }\n}\n\nexport function getHistory(): GameRecord[] {\n  let raw = '[]'\n  try {\n    raw = localStorage.getItem(HISTORY_KEY) || '[]'\n  } catch {\n    return []\n  }\n\n  let parsed: unknown\n  try {\n    parsed = JSON.parse(raw)\n  } catch {\n    const invalidRoot = validateGameRecordArray(raw, 'local')\n    recordHistoryValidation('local', invalidRoot, raw)\n    return []\n  }\n\n  const validation = validateGameRecordArray(parsed, 'local')\n  if (validation.repaired > 0 || validation.quarantined.length > 0) {\n    recordHistoryValidation('local', validation, raw)\n    try {\n      localStorage.setItem(HISTORY_KEY, JSON.stringify(validation.games.slice(0, MAX_RECORDS)))\n    } catch {\n      /* Recovery und Quarantäne bleiben erhalten. */\n    }\n  }\n  return validation.games.slice(0, MAX_RECORDS)\n}`,
    'storage header',
  )
  source = replaceOnce(
    source,
    `export function replaceHistory(games: GameRecord[]): void {\n  try {\n    localStorage.setItem(HISTORY_KEY, JSON.stringify(games.slice(0, MAX_RECORDS)))\n  } catch {\n    /* ignore */\n  }\n}`,
    `export function replaceHistory(games: GameRecord[]): void {\n  const validation = validateGameRecordArray(games, 'local')\n  if (validation.repaired > 0 || validation.quarantined.length > 0) {\n    let previous: string | undefined\n    try {\n      previous = localStorage.getItem(HISTORY_KEY) ?? undefined\n    } catch {\n      previous = undefined\n    }\n    recordHistoryValidation('local', validation, previous)\n  }\n  try {\n    localStorage.setItem(HISTORY_KEY, JSON.stringify(validation.games.slice(0, MAX_RECORDS)))\n  } catch {\n    /* ignore */\n  }\n}`,
    'replaceHistory validation',
  )
  fs.writeFileSync(path, source)
}

// backup.ts — validate every imported game and export the full integrity report
{
  const path = 'src/lib/backup.ts'
  let source = fs.readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `import { getHistory, replaceHistory } from './storage'\nimport { pushGame } from './cloud'`,
    `import { getHistory, getHistoryIntegrityBundle, recordHistoryValidation, replaceHistory } from './storage'\nimport { validateGameRecordArray } from './gameRecordValidation'\nimport { pushGame } from './cloud'`,
    'backup imports',
  )
  source = replaceOnce(
    source,
    `function isGameRecord(g: unknown): g is GameRecord {\n  if (!g || typeof g !== 'object') return false\n  const r = g as Record<string, unknown>\n  return (\n    (typeof r.id === 'number' || typeof r.id === 'string') &&\n    typeof r.winner === 'string' &&\n    Array.isArray(r.players)\n  )\n}\n\n`,
    '',
    'remove weak backup guard',
  )
  source = replaceOnce(
    source,
    `export interface ImportResult {\n  added: number\n  total: number\n  pushed: number\n}`,
    `export interface ImportResult {\n  added: number\n  total: number\n  pushed: number\n  repaired: number\n  quarantined: number\n}`,
    'extend import result',
  )
  source = replaceOnce(
    source,
    `export async function importBackup(file: File): Promise<ImportResult> {\n  const text = await file.text()\n  const parsed = JSON.parse(text) as Partial<BackupFile>\n  const incoming = Array.isArray(parsed.games) ? parsed.games.filter(isGameRecord) : []\n  if (parsed.format !== FORMAT || !incoming.length) {\n    throw new Error('Keine gültige Backup-Datei.')\n  }\n\n  const existing = getHistory()\n  const byId = new Map<string, GameRecord>()\n  for (const g of existing) byId.set(String(g.id), g)\n  let added = 0\n  for (const g of incoming) {\n    const k = String(g.id)\n    if (!byId.has(k)) added++\n    byId.set(k, g)\n  }\n  const merged = [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))\n  replaceHistory(merged)\n\n  // Neue Spiele best-effort in die Cloud heben (offline bleibt es lokal).\n  let pushed = 0\n  const onlyNew = incoming.filter((g) => !existing.some((e) => String(e.id) === String(g.id)))\n  const results = await Promise.allSettled(onlyNew.map((g) => pushGame(g)))\n  for (const r of results) if (r.status === 'fulfilled' && r.value) pushed++\n\n  return { added, total: merged.length, pushed }\n}`,
    `export async function importBackup(file: File): Promise<ImportResult> {\n  const text = await file.text()\n  let parsed: unknown\n  try {\n    parsed = JSON.parse(text)\n  } catch {\n    throw new Error('Backup ist kein gültiges JSON.')\n  }\n  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {\n    throw new Error('Keine gültige Backup-Datei.')\n  }\n  const root = parsed as Partial<BackupFile>\n  const version = typeof root.version === 'number' ? root.version : 1\n  if (root.format !== FORMAT || version > VERSION) {\n    throw new Error('Keine unterstützte Backup-Datei.')\n  }\n\n  const validation = validateGameRecordArray(root.games, 'backup')\n  recordHistoryValidation('backup', validation)\n  const incoming = validation.games\n  if (incoming.length === 0) {\n    const suffix = validation.quarantined.length\n      ? \` · \${validation.quarantined.length} fehlerhafte Datensätze wurden protokolliert\`\n      : ''\n    throw new Error(\`Keine gültigen Spiele im Backup\${suffix}.\`)\n  }\n\n  const existing = getHistory()\n  const byId = new Map<string, GameRecord>()\n  for (const g of existing) byId.set(String(g.id), g)\n  let added = 0\n  for (const g of incoming) {\n    const k = String(g.id)\n    if (!byId.has(k)) added++\n    byId.set(k, g)\n  }\n  const merged = [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))\n  replaceHistory(merged)\n\n  // Nur validierte neue Spiele best-effort in die Cloud heben.\n  let pushed = 0\n  const onlyNew = incoming.filter((g) => !existing.some((e) => String(e.id) === String(g.id)))\n  const results = await Promise.allSettled(onlyNew.map((g) => pushGame(g)))\n  for (const result of results) if (result.status === 'fulfilled' && result.value) pushed++\n\n  return {\n    added,\n    total: merged.length,\n    pushed,\n    repaired: validation.repaired,\n    quarantined: validation.quarantined.length,\n  }\n}`,
    'validated backup import',
  )
  source = replaceOnce(
    source,
    `}\n\nexport interface ImportResult`,
    `}\n\n/** Exportiert Bericht, Quarantäne und Recovery-Snapshots als lesbare JSON-Datei. */\nexport function exportIntegrityReport(): void {\n  const bundle = getHistoryIntegrityBundle()\n  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })\n  const url = URL.createObjectURL(blob)\n  const stamp = new Date().toISOString().slice(0, 10)\n  const a = document.createElement('a')\n  a.href = url\n  a.download = \`zentausend-datenpruefung-\${stamp}.json\`\n  document.body.appendChild(a)\n  a.click()\n  a.remove()\n  URL.revokeObjectURL(url)\n}\n\nexport interface ImportResult`,
    'integrity report export',
  )
  fs.writeFileSync(path, source)
}

// cloud.ts — validate JSON columns before merge/storage
{
  const path = 'src/lib/cloud.ts'
  let source = fs.readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `import { getHistory, removeGame, replaceHistory, setGameEvent } from './storage'\nimport type { GameRecord } from './types'`,
    `import { getHistory, recordHistoryValidation, removeGame, replaceHistory, setGameEvent } from './storage'\nimport { validateGameRecordArray } from './gameRecordValidation'\nimport type { GameRecord } from './types'`,
    'cloud validation imports',
  )
  source = replaceOnce(
    source,
    `function fromRow(row: Row): GameRecord {\n  return {\n    id: Number(row.client_id) || Date.parse(row.played_at),\n    date: row.played_at,\n    event: row.event ?? '',\n    winner: row.winner,\n    winnerScore: row.winner_score,\n    players: (Array.isArray(row.players) ? row.players : []) as GameRecord['players'],\n    turns: (Array.isArray(row.turns) ? row.turns : undefined) as GameRecord['turns'],\n  }\n}`,
    `function rowCandidate(row: Row): unknown {\n  return {\n    id: row.client_id,\n    date: row.played_at,\n    event: row.event ?? '',\n    winner: row.winner,\n    winnerScore: row.winner_score,\n    players: row.players,\n    turns: row.turns,\n  }\n}`,
    'replace cloud casts',
  )
  source = replaceOnce(
    source,
    `    return { games: (data ?? []).map(fromRow), ok: true }`,
    `    const validation = validateGameRecordArray((data ?? []).map(rowCandidate), 'cloud')\n    recordHistoryValidation('cloud', validation)\n    return { games: validation.games, ok: true }`,
    'validate cloud rows',
  )
  fs.writeFileSync(path, source)
}

// StatsScreen.tsx — surface repairs/quarantine and exportable report
{
  const path = 'src/components/StatsScreen.tsx'
  let source = fs.readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `import { aggregateStats, computeAwards, computeForm, computeHeadToHead, computeNemesis, getEvents, getHistory } from '../lib/storage'`,
    `import {\n  aggregateStats,\n  clearHistoryIntegrityReport,\n  computeAwards,\n  computeForm,\n  computeHeadToHead,\n  computeNemesis,\n  getEvents,\n  getHistory,\n  getHistoryIntegrityReport,\n} from '../lib/storage'`,
    'stats storage imports',
  )
  source = replaceOnce(
    source,
    `import { exportBackup, importBackup } from '../lib/backup'`,
    `import { exportBackup, exportIntegrityReport, importBackup } from '../lib/backup'`,
    'stats backup imports',
  )
  source = replaceOnce(
    source,
    `  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())\n  const [filter, setFilter] = useState<string>('')`,
    `  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())\n  const [integrity, setIntegrity] = useState(() => getHistoryIntegrityReport())\n  const [filter, setFilter] = useState<string>('')`,
    'integrity state',
  )
  source = replaceOnce(
    source,
    `      setPendingSync(res.pending)\n      setLoading(false)`,
    `      setPendingSync(res.pending)\n      setIntegrity(getHistoryIntegrityReport())\n      setLoading(false)`,
    'reload integrity refresh',
  )
  source = replaceOnce(
    source,
    `      setPendingSync(res.pending)\n      setLoading(false)`,
    `      setPendingSync(res.pending)\n      setIntegrity(getHistoryIntegrityReport())\n      setLoading(false)`,
    'effect integrity refresh',
  )
  source = replaceOnce(
    source,
    `      flash(\`\${res.added} neu importiert · \${res.total} gesamt\`)`,
    `      const notes = [\`\${res.added} neu importiert\`, \`\${res.total} gesamt\`]\n      if (res.repaired > 0) notes.push(\`\${res.repaired} repariert\`)\n      if (res.quarantined > 0) notes.push(\`\${res.quarantined} in Quarantäne\`)\n      setIntegrity(getHistoryIntegrityReport())\n      flash(notes.join(' · '))`,
    'import result details',
  )
  source = replaceOnce(
    source,
    `      {msg && (\n        <div className="mb-4 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-center text-xs font-semibold text-gold-300 animate-pop">\n          {msg}\n        </div>\n      )}\n\n      {/* Sync-Status */}`,
    `      {msg && (\n        <div className="mb-4 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-center text-xs font-semibold text-gold-300 animate-pop">\n          {msg}\n        </div>\n      )}\n\n      {integrity && (integrity.repaired > 0 || integrity.quarantined > 0) && (\n        <div className="mb-4 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-3 text-xs text-fog-300">\n          <div className="font-bold text-gold-300">Datenprüfung abgeschlossen</div>\n          <div className="mt-1 leading-relaxed">\n            {integrity.repaired > 0 && <span>{integrity.repaired} repariert</span>}\n            {integrity.repaired > 0 && integrity.quarantined > 0 && <span> · </span>}\n            {integrity.quarantined > 0 && <span>{integrity.quarantined} sicher isoliert</span>}\n            {integrity.recoverySaved && <span> · Originalstand gesichert</span>}\n          </div>\n          {!integrity.quarantineStored && (\n            <div className="mt-1 font-semibold text-coral-400">Quarantäne konnte wegen Gerätespeicher nicht vollständig geschrieben werden.</div>\n          )}\n          <div className="mt-3 grid grid-cols-2 gap-2">\n            <button\n              type="button"\n              onClick={exportIntegrityReport}\n              className="rounded-xl border border-gold-500/30 bg-ink-900/60 px-2 py-2 font-semibold text-gold-300"\n            >\n              Prüfbericht sichern\n            </button>\n            <button\n              type="button"\n              onClick={() => {\n                clearHistoryIntegrityReport()\n                setIntegrity(null)\n              }}\n              className="rounded-xl border border-ink-700 bg-ink-900/60 px-2 py-2 font-semibold text-fog-400"\n            >\n              Hinweis ausblenden\n            </button>\n          </div>\n        </div>\n      )}\n\n      {/* Sync-Status */}`,
    'integrity status card',
  )
  fs.writeFileSync(path, source)
}
