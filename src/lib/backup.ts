import type { GameRecord } from './types'
import { getHistory, replaceHistory } from './storage'
import { pushGame } from './cloud'

const FORMAT = '10000-clique-backup'
const VERSION = 1

interface BackupFile {
  format: string
  version: number
  exportedAt: string
  games: GameRecord[]
}

/** Lädt die ewige Tabelle als JSON-Datei herunter (Sicherheits-Backup). */
export function exportBackup(games: GameRecord[] = getHistory()): void {
  const payload: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    games,
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

function isGameRecord(g: unknown): g is GameRecord {
  if (!g || typeof g !== 'object') return false
  const r = g as Record<string, unknown>
  return (
    (typeof r.id === 'number' || typeof r.id === 'string') &&
    typeof r.winner === 'string' &&
    Array.isArray(r.players)
  )
}

export interface ImportResult {
  added: number
  total: number
  pushed: number
}

/**
 * Liest eine Backup-Datei, führt sie mit dem lokalen Verlauf zusammen (dedupe
 * über die Spiel-ID) und schiebt neue Spiele – falls online – in die Cloud.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text()
  const parsed = JSON.parse(text) as Partial<BackupFile>
  const incoming = Array.isArray(parsed.games) ? parsed.games.filter(isGameRecord) : []
  if (parsed.format !== FORMAT || !incoming.length) {
    throw new Error('Keine gültige Backup-Datei.')
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

  // Neue Spiele best-effort in die Cloud heben (offline bleibt es lokal).
  let pushed = 0
  const onlyNew = incoming.filter((g) => !existing.some((e) => String(e.id) === String(g.id)))
  const results = await Promise.allSettled(onlyNew.map((g) => pushGame(g)))
  for (const r of results) if (r.status === 'fulfilled' && r.value) pushed++

  return { added, total: merged.length, pushed }
}
