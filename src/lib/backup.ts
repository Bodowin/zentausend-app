import type { GameRecord } from './types'
import { getHistory, getHistoryIntegrityBundle, recordHistoryValidation, replaceHistory } from './storage'
import { validateGameRecordArray } from './gameRecordValidation'
import {
  exportPlayerIdentityState,
  importPlayerIdentityState,
  type PlayerIdentityState,
} from './playerIdentity'
import { pushGame } from './cloud'

const FORMAT = '10000-clique-backup'
const VERSION = 2

interface BackupFile {
  format: string
  version: number
  exportedAt: string
  games: GameRecord[]
  /** Ab v2: portable, konfliktbewusst importierte Namens- und ID-Zuordnungen. */
  playerIdentity?: PlayerIdentityState
}

/** Lädt die ewige Tabelle samt Spieler-Zuordnungen als JSON-Datei herunter. */
export function exportBackup(games: GameRecord[] = getHistory()): void {
  const payload: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    games,
    playerIdentity: exportPlayerIdentityState(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `zentausend-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Exportiert Bericht, Quarantäne und Recovery-Snapshots als lesbare JSON-Datei. */
export function exportIntegrityReport(): void {
  const bundle = getHistoryIntegrityBundle()
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `zentausend-datenpruefung-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  added: number
  total: number
  pushed: number
  repaired: number
  quarantined: number
  identitiesImported: number
  identityConflicts: number
}

/**
 * Liest eine Backup-Datei, führt sie mit dem lokalen Verlauf zusammen (dedupe
 * über die Spiel-ID) und schiebt neue Spiele – falls online – in die Cloud.
 * Identitätsdaten werden additiv übernommen; widersprüchliche lokale Zuordnungen
 * werden niemals still überschrieben.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Backup ist kein gültiges JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Keine gültige Backup-Datei.')
  }
  const root = parsed as Partial<BackupFile>
  const version = typeof root.version === 'number' ? root.version : 1
  if (root.format !== FORMAT || version > VERSION) {
    throw new Error('Keine unterstützte Backup-Datei.')
  }

  const validation = validateGameRecordArray(root.games, 'backup')
  recordHistoryValidation('backup', validation)
  const incoming = validation.games
  if (incoming.length === 0) {
    const suffix = validation.quarantined.length
      ? ` · ${validation.quarantined.length} fehlerhafte Datensätze wurden protokolliert`
      : ''
    throw new Error(`Keine gültigen Spiele im Backup${suffix}.`)
  }

  const existing = getHistory()
  const byId = new Map<string, GameRecord>()
  for (const g of existing) byId.set(String(g.id), g)
  let added = 0
  for (const g of incoming) {
    const k = String(g.id)
    if (!byId.has(k)) added++
    byId.set(k, g)
  }
  const merged = [...byId.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  replaceHistory(merged)
  const identity = importPlayerIdentityState(root.playerIdentity)

  // Nur validierte neue Spiele best-effort in die Cloud heben.
  let pushed = 0
  const onlyNew = incoming.filter((g) => !existing.some((e) => String(e.id) === String(g.id)))
  const results = await Promise.allSettled(onlyNew.map((g) => pushGame(g)))
  for (const result of results) if (result.status === 'fulfilled' && result.value) pushed++

  return {
    added,
    total: merged.length,
    pushed,
    repaired: validation.repaired,
    quarantined: validation.quarantined.length,
    identitiesImported: identity.imported,
    identityConflicts: identity.conflicts,
  }
}
