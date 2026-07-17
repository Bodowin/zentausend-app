from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one anchor in {path}, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


# Stats screen: import, state and product integration.
replace_once(
    'src/components/StatsScreen.tsx',
    "import { deleteGame, editGameEvent, pendingEventEditCount, syncAndMerge } from '../lib/cloud'\n",
    "import { deleteGame, editGameEvent, editGameEvents, pendingEventEditCount, syncAndMerge } from '../lib/cloud'\n",
)
replace_once(
    'src/components/StatsScreen.tsx',
    "import { PlayerProfileScreen } from './PlayerProfileScreen'\n",
    "import { PlayerProfileScreen } from './PlayerProfileScreen'\nimport { BulkEventAssignmentDialog } from './BulkEventAssignmentDialog'\n",
)
replace_once(
    'src/components/StatsScreen.tsx',
    "  const [editingGame, setEditingGame] = useState<GameRecord | null>(null)\n  const [editValue, setEditValue] = useState('')\n",
    "  const [editingGame, setEditingGame] = useState<GameRecord | null>(null)\n  const [editValue, setEditValue] = useState('')\n  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)\n  const [bulkAssignBusy, setBulkAssignBusy] = useState(false)\n",
)
replace_once(
    'src/components/StatsScreen.tsx',
    """  const handleSaveEvent = () => {
    if (!editingGame) return
    const trimmed = editValue.trim()
    const g = editingGame
    setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, event: trimmed } : x)))
    setEditingGame(null)
    const sync = editGameEvent(g, trimmed)
    setPendingSync(pendingEventEditCount())
    flash('Anlass lokal gespeichert · Sync läuft…')
    void sync.then((result) => {
      setPendingSync(pendingEventEditCount())
      if (result === 'ok') flash('Anlass synchronisiert.')
      else if (result === 'denied') flash('Lokal gespeichert · Clique-Code prüfen.')
      else flash('Lokal gespeichert · wird später synchronisiert.')
    })
  }

  if (profileId) {
""",
    """  const handleSaveEvent = () => {
    if (!editingGame) return
    const trimmed = editValue.trim()
    const g = editingGame
    setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, event: trimmed } : x)))
    setEditingGame(null)
    const sync = editGameEvent(g, trimmed)
    setPendingSync(pendingEventEditCount())
    flash('Anlass lokal gespeichert · Sync läuft…')
    void sync.then((result) => {
      setPendingSync(pendingEventEditCount())
      if (result === 'ok') flash('Anlass synchronisiert.')
      else if (result === 'denied') flash('Lokal gespeichert · Clique-Code prüfen.')
      else flash('Lokal gespeichert · wird später synchronisiert.')
    })
  }

  const handleBulkAssign = (selectedGames: GameRecord[], event: string) => {
    const trimmed = event.trim()
    if (!trimmed || selectedGames.length === 0 || bulkAssignBusy) return
    const selectedIds = new Set(selectedGames.map((game) => game.id))
    setGames((previous) =>
      previous.map((game) => (selectedIds.has(game.id) ? { ...game, event: trimmed } : game)),
    )
    setBulkAssignBusy(true)
    const sync = editGameEvents(selectedGames, trimmed)
    setPendingSync(pendingEventEditCount())
    flash(`${selectedGames.length} ${selectedGames.length === 1 ? 'Spiel' : 'Spiele'} lokal zugeordnet · Sync läuft…`)
    void sync.then((result) => {
      setBulkAssignBusy(false)
      setBulkAssignOpen(false)
      setPendingSync(pendingEventEditCount())
      if (result === 'ok') flash(`${selectedGames.length} ${selectedGames.length === 1 ? 'Spiel' : 'Spiele'} synchronisiert.`)
      else if (result === 'denied') flash('Lokal zugeordnet · Clique-Code prüfen.')
      else flash('Lokal zugeordnet · wird später synchronisiert.')
    })
  }

  if (profileId) {
""",
)
replace_once(
    'src/components/StatsScreen.tsx',
    """      {editingGame && (
""",
    """      {bulkAssignOpen && (
        <BulkEventAssignmentDialog
          games={games}
          events={events}
          busy={bulkAssignBusy}
          onClose={() => {
            if (!bulkAssignBusy) setBulkAssignOpen(false)
          }}
          onApply={handleBulkAssign}
        />
      )}

      {editingGame && (
""",
)
replace_once(
    'src/components/StatsScreen.tsx',
    """        <button
          type="button"
          onClick={() => setShowPlayers(true)}
          disabled={stats.length === 0}
          className="col-span-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-xs font-bold text-gold-300 transition-colors disabled:opacity-40"
        >
          👥 Spielerprofile verwalten
        </button>
      </div>
""",
    """        <button
          type="button"
          onClick={() => setShowPlayers(true)}
          disabled={stats.length === 0}
          className="col-span-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-xs font-bold text-gold-300 transition-colors disabled:opacity-40"
        >
          👥 Spielerprofile verwalten
        </button>
        <button
          type="button"
          onClick={() => setBulkAssignOpen(true)}
          disabled={games.length === 0}
          className="col-span-2 rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2.5 text-xs font-bold text-mint-300 transition-colors disabled:opacity-40"
        >
          🗓️ Mehrere Spiele einem Anlass zuordnen
        </button>
      </div>
""",
)


# Cloud layer: one local queue write and one remote batch update.
replace_once(
    'src/lib/cloud.ts',
    """function clearEventEdit(clientId: string): void {
  const edits = readPendingEventEdits()
  if (!(clientId in edits)) return
  delete edits[clientId]
  writePendingEventEdits(edits)
}

export function pendingEventEditCount(): number {
""",
    """function clearEventEdit(clientId: string): void {
  const edits = readPendingEventEdits()
  if (!(clientId in edits)) return
  delete edits[clientId]
  writePendingEventEdits(edits)
}

function queueEventEdits(clientIds: string[], event: string): void {
  const edits = readPendingEventEdits()
  for (const clientId of clientIds) edits[clientId] = event.trim()
  writePendingEventEdits(edits)
}

function clearEventEdits(clientIds: string[]): void {
  const edits = readPendingEventEdits()
  let changed = false
  for (const clientId of clientIds) {
    if (!(clientId in edits)) continue
    delete edits[clientId]
    changed = true
  }
  if (changed) writePendingEventEdits(edits)
}

export function pendingEventEditCount(): number {
""",
)
replace_once(
    'src/lib/cloud.ts',
    """}

/**
 * Speichert den Anlass sofort lokal und merkt ihn als ausstehend, bis die Cloud
""",
    """}

interface BulkEventUpdateResult {
  result: EditResult
  confirmed: string[]
}

async function updateCloudEvents(clientIds: string[], event: string): Promise<BulkEventUpdateResult> {
  const uniqueIds = [...new Set(clientIds)]
  if (uniqueIds.length === 0) return { result: 'ok', confirmed: [] }
  const supabase = getSupabase()
  if (!supabase || isOffline()) return { result: 'offline', confirmed: [] }

  const updateController = new AbortController()
  const updateTimer = window.setTimeout(() => updateController.abort(), CLOUD_TIMEOUT_MS)
  let confirmed: string[] = []
  try {
    const { data: updated, error } = await supabase
      .from('games')
      .update({ event: event.trim() })
      .in('client_id', uniqueIds)
      .select('client_id')
      .abortSignal(updateController.signal)
    if (error) {
      console.warn('Cloud-Sammelupdate fehlgeschlagen:', error.message)
      return { result: 'offline', confirmed }
    }
    confirmed = (updated ?? []).map((row) => row.client_id)
    if (confirmed.length === uniqueIds.length) return { result: 'ok', confirmed }
  } catch (error) {
    console.warn('Cloud-Sammelupdate abgebrochen (Timeout/offline):', error)
    return { result: 'offline', confirmed }
  } finally {
    window.clearTimeout(updateTimer)
  }

  const confirmedSet = new Set(confirmed)
  const unresolved = uniqueIds.filter((clientId) => !confirmedSet.has(clientId))
  const checkController = new AbortController()
  const checkTimer = window.setTimeout(() => checkController.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data: existing, error } = await supabase
      .from('games')
      .select('client_id')
      .in('client_id', unresolved)
      .abortSignal(checkController.signal)
    if (error) return { result: 'offline', confirmed }
    return { result: existing && existing.length > 0 ? 'denied' : 'offline', confirmed }
  } catch (error) {
    console.warn('Cloud-Sammelupdate-Prüfung abgebrochen:', error)
    return { result: 'offline', confirmed }
  } finally {
    window.clearTimeout(checkTimer)
  }
}

/**
 * Speichert den Anlass sofort lokal und merkt ihn als ausstehend, bis die Cloud
""",
)
replace_once(
    'src/lib/cloud.ts',
    """export async function editGameEvent(game: GameRecord, event: string): Promise<EditResult> {
  const trimmed = event.trim()
  const clientId = key(game)
  setGameEvent(game.id, trimmed)
  queueEventEdit(clientId, trimmed)

  const result = await updateCloudEvent(clientId, trimmed)
  if (result === 'ok') clearEventEdit(clientId)
  return result
}

export interface SyncResult {
""",
    """export async function editGameEvent(game: GameRecord, event: string): Promise<EditResult> {
  const trimmed = event.trim()
  const clientId = key(game)
  setGameEvent(game.id, trimmed)
  queueEventEdit(clientId, trimmed)

  const result = await updateCloudEvent(clientId, trimmed)
  if (result === 'ok') clearEventEdit(clientId)
  return result
}

/**
 * Ordnet mehrere Spiele offline-first einem gemeinsamen Anlass zu. Lokal und in
 * der Retry-Queue wird atomar pro Liste vorbereitet; die Cloud erhält ein einziges
 * Sammelupdate. Bereits bestätigte Zeilen werden auch bei Teilerfolg aus der Queue entfernt.
 */
export async function editGameEvents(games: GameRecord[], event: string): Promise<EditResult> {
  const trimmed = event.trim()
  const byId = new Map(games.map((game) => [key(game), game]))
  const clientIds = [...byId.keys()]
  for (const game of byId.values()) setGameEvent(game.id, trimmed)
  queueEventEdits(clientIds, trimmed)

  const update = await updateCloudEvents(clientIds, trimmed)
  clearEventEdits(update.confirmed)
  return update.result
}

export interface SyncResult {
""",
)
