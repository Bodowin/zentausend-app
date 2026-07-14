import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  return source.replace(before, after)
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`${label}: start marker missing`)
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error(`${label}: end marker missing`)
  return source.slice(0, start) + replacement + source.slice(end)
}

function update(path, transform) {
  const source = fs.readFileSync(path, 'utf8')
  const next = transform(source)
  if (next === source) throw new Error(`${path}: patch made no changes`)
  fs.writeFileSync(path, next)
}

const activeGameSource = `import type { DiceMode, GameState, Player, Turn } from './types'

const KEY = '10k_active_game'
const RECOVERY_KEY = '10k_active_game_recovery_v1'
const CORRUPT_KEY = '10k_active_game_corrupt_v1'
const RECOVERY_LIMIT = 3

/** Vollständiger Zustand eines laufenden Spiels, um es später fortzusetzen. */
export interface ActiveGame {
  players: Player[]
  idx: number
  round: number
  phase: GameState
  target: number
  event: string
  testMode: boolean
  diceMode: DiceMode
  /** Konfiguriertes Ziel + Einstiegsgrenze (ältere Stände: undefined → Standard). */
  goalScore?: number
  entryMin?: number
  kept: number[]
  dice: number[]
  accumulated: number
  turns: Turn[]
  /** Im virtuellen Modus: noch nicht ausgewählte Würfel des aktuellen Wurfs. */
  rolled: number[]
  /** Unveränderliches Ergebnis des aktuellen virtuellen Wurfs. */
  thrown?: number[]
  /** Sequenznummer zum frischen Mounten der Würfelschale. */
  throwSeq?: number
  savedAt: string
  /** Nur zur Anzeige: Der Hauptstand war beschädigt und wurde aus einer Sicherung repariert. */
  recoveredFromBackup?: boolean
}

const isDie = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6
const isNonNegativeInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0
const isPositiveInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0

function isPlayer(p: unknown): p is Player {
  if (!p || typeof p !== 'object') return false
  const v = p as Partial<Player>
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    v.name.trim().length > 0 &&
    typeof v.score === 'number' &&
    Number.isFinite(v.score) &&
    v.score >= 0 &&
    isNonNegativeInt(v.busts)
  )
}

function isTurn(t: unknown): t is Turn {
  if (!t || typeof t !== 'object') return false
  const v = t as Partial<Turn>
  return (
    isPositiveInt(v.round) &&
    typeof v.player === 'string' &&
    v.player.trim().length > 0 &&
    typeof v.points === 'number' &&
    Number.isFinite(v.points) &&
    v.points >= 0 &&
    typeof v.bust === 'boolean'
  )
}

function sameDiceBag(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sort = (xs: number[]) => [...xs].sort((x, y) => x - y)
  const aa = sort(a)
  const bb = sort(b)
  return aa.every((v, i) => v === bb[i])
}

function readRecoveryRaws(): string[] {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function persistable(game: ActiveGame): Omit<ActiveGame, 'recoveredFromBackup'> {
  const { recoveredFromBackup: _recovered, ...stored } = game
  return stored
}

/**
 * Speichert den aktuellen Stand und rotiert vorherige, gültige Versionen als
 * lokale Sicherheitskopien. Maximal drei Stände bleiben erhalten.
 */
export function saveActiveGame(game: ActiveGame): void {
  const nextRaw = JSON.stringify(persistable(game))

  try {
    const previousRaw = localStorage.getItem(KEY)
    if (previousRaw && previousRaw !== nextRaw && parseActiveGame(previousRaw)) {
      const backups = [previousRaw, ...readRecoveryRaws().filter((raw) => raw !== previousRaw)]
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(backups.slice(0, RECOVERY_LIMIT)))
    }
  } catch {
    /* Sicherungsrotation darf den primären Autosave nie verhindern. */
  }

  try {
    localStorage.setItem(KEY, nextRaw)
  } catch {
    /* ignore */
  }
}

/**
 * Parst und validiert einen gespeicherten Spielstand. Als eigene pure Funktion
 * exportiert, damit beschädigte/alte Speicherstände ohne Browser getestet werden
 * können. Legacy-Stände ohne \`thrown\` bleiben gültig und werden beim Fortsetzen
 * aus \`dice + rolled\` rekonstruiert.
 */
export function parseActiveGame(raw: string | null): ActiveGame | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ActiveGame>
    const phase = value.phase
    if (phase !== 'active' && phase !== 'lastChance') return null

    const players = value.players
    if (!Array.isArray(players) || players.length < 2 || !players.every(isPlayer)) return null
    if (!isNonNegativeInt(value.idx) || value.idx >= players.length) return null
    if (!isPositiveInt(value.round)) return null
    if (typeof value.target !== 'number' || !Number.isFinite(value.target) || value.target < 0) return null
    if (typeof value.accumulated !== 'number' || !Number.isFinite(value.accumulated) || value.accumulated < 0) return null

    const diceMode: DiceMode = value.diceMode === 'virtual' ? 'virtual' : 'real'
    const kept = Array.isArray(value.kept) ? value.kept : []
    const dice = Array.isArray(value.dice) ? value.dice : []
    const rolled = Array.isArray(value.rolled) ? value.rolled : []
    const thrown = Array.isArray(value.thrown) ? value.thrown : []
    if (![...kept, ...dice, ...rolled, ...thrown].every(isDie)) return null
    if (kept.length + dice.length > 6 || kept.length > 6) return null

    // Neue virtuelle Stände müssen exakt denselben Würfel-Multiset in der Schale,
    // Auswahl und Restmenge enthalten. So kann kein beschädigter Speicherstand
    // beim Fortsetzen Würfel duplizieren oder verschwinden lassen.
    if (thrown.length > 0) {
      if (diceMode !== 'virtual' || thrown.length !== 6 - kept.length) return null
      if (!sameDiceBag(thrown, [...dice, ...rolled])) return null
    }

    const turns = Array.isArray(value.turns) ? value.turns : []
    if (!turns.every(isTurn)) return null
    if (value.goalScore !== undefined && (!isPositiveInt(value.goalScore) || value.goalScore > 1_000_000)) return null
    if (value.entryMin !== undefined && (!isNonNegativeInt(value.entryMin) || value.entryMin > 100_000)) return null

    return {
      players,
      idx: value.idx,
      round: value.round,
      phase,
      target: value.target,
      event: typeof value.event === 'string' ? value.event : '',
      testMode: value.testMode === true,
      diceMode,
      goalScore: value.goalScore,
      entryMin: value.entryMin,
      kept,
      dice,
      accumulated: value.accumulated,
      turns,
      rolled,
      thrown,
      throwSeq: isNonNegativeInt(value.throwSeq) ? value.throwSeq : 0,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Liest den Hauptstand. Ist er beschädigt, wird das Original separat gesichert
 * und die jüngste gültige Sicherheitskopie automatisch wiederhergestellt.
 * Ohne Hauptstand erfolgt bewusst keine Wiederherstellung, damit ein absichtlich
 * verworfenes Spiel nicht erneut auftaucht.
 */
export function loadActiveGame(): ActiveGame | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const current = parseActiveGame(raw)
    if (current) return current

    try {
      localStorage.setItem(CORRUPT_KEY, raw)
    } catch {
      /* Diagnosekopie ist best effort. */
    }

    for (const candidate of readRecoveryRaws()) {
      const restored = parseActiveGame(candidate)
      if (!restored) continue
      try {
        localStorage.setItem(KEY, candidate)
      } catch {
        /* Anzeige ist auch möglich, wenn das Zurückschreiben fehlschlägt. */
      }
      return { ...restored, recoveredFromBackup: true }
    }
    return null
  } catch {
    return null
  }
}

/** Bewusstes Verwerfen entfernt Hauptstand, Sicherungen und Diagnosekopie. */
export function clearActiveGame(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(RECOVERY_KEY)
    localStorage.removeItem(CORRUPT_KEY)
  } catch {
    /* ignore */
  }
}
`

fs.writeFileSync('src/lib/activeGame.ts', activeGameSource)

update('src/components/SetupScreen.tsx', (input) => {
  let source = input
  source = replaceOnce(
    source,
    `const ENTRY_PRESETS = [0, 350, 500, 1000]\n`,
    `const ENTRY_PRESETS = [0, 350, 500, 1000]\n\nconst formatResumeTime = (savedAt: string) => {\n  const date = new Date(savedAt)\n  if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt'\n  return new Intl.DateTimeFormat('de-AT', {\n    day: '2-digit',\n    month: '2-digit',\n    hour: '2-digit',\n    minute: '2-digit',\n  }).format(date)\n}\n`,
    'resume timestamp helper',
  )
  source = replaceOnce(
    source,
    `  const [showSettings, setShowSettings] = useState(false)\n`,
    `  const [showSettings, setShowSettings] = useState(false)\n  const [startConflictOpen, setStartConflictOpen] = useState(false)\n  const [discardOpen, setDiscardOpen] = useState(false)\n`,
    'resume dialog state',
  )
  source = replaceOnce(
    source,
    `  return (\n`,
    `  const startConfiguredGame = () => {\n    setPrefs({ lastEvent: event.trim() })\n    onStart(players, event, testMode, diceMode, goalScore, entryMin)\n  }\n\n  const requestStart = () => {\n    if (resumable) {\n      setStartConflictOpen(true)\n      return\n    }\n    startConfiguredGame()\n  }\n\n  return (\n`,
    'safe start handler',
  )
  source = replaceOnce(
    source,
    `      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}\n`,
    `      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}\n\n      {startConflictOpen && resumable && (\n        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="presentation">\n          <div\n            role="dialog"\n            aria-modal="true"\n            aria-label="Laufendes Spiel ersetzen?"\n            className="w-full max-w-sm rounded-3xl border border-gold-500/40 bg-ink-900 p-5 shadow-2xl"\n          >\n            <h2 className="text-lg font-black text-fog-100">Laufendes Spiel ersetzen?</h2>\n            <p className="mt-2 text-sm leading-relaxed text-fog-400">\n              Runde {resumable.round} mit {resumable.players.map((player) => player.name).join(', ')} ist noch gespeichert.\n              Ein neues Spiel ersetzt diesen Stand und seine Sicherheitskopien.\n            </p>\n            <button\n              type="button"\n              onClick={() => {\n                setStartConflictOpen(false)\n                onResume(resumable)\n              }}\n              className="mt-5 w-full rounded-xl bg-gold-500 px-4 py-3 font-bold text-ink-950"\n            >\n              Altes Spiel fortsetzen\n            </button>\n            <button\n              type="button"\n              onClick={() => {\n                setStartConflictOpen(false)\n                onDiscardResume()\n                startConfiguredGame()\n              }}\n              className="mt-2 w-full rounded-xl border border-coral-500/40 bg-coral-500/10 px-4 py-3 font-bold text-coral-300"\n            >\n              Neues Spiel starten\n            </button>\n            <button\n              type="button"\n              onClick={() => setStartConflictOpen(false)}\n              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-fog-500"\n            >\n              Abbrechen\n            </button>\n          </div>\n        </div>\n      )}\n\n      {discardOpen && resumable && (\n        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="presentation">\n          <div\n            role="dialog"\n            aria-modal="true"\n            aria-label="Laufendes Spiel verwerfen?"\n            className="w-full max-w-sm rounded-3xl border border-coral-500/40 bg-ink-900 p-5 shadow-2xl"\n          >\n            <h2 className="text-lg font-black text-fog-100">Laufendes Spiel verwerfen?</h2>\n            <p className="mt-2 text-sm leading-relaxed text-fog-400">\n              Der aktuelle Stand und alle drei lokalen Sicherheitskopien werden gelöscht.\n            </p>\n            <button\n              type="button"\n              onClick={() => {\n                setDiscardOpen(false)\n                onDiscardResume()\n              }}\n              className="mt-5 w-full rounded-xl bg-coral-500 px-4 py-3 font-bold text-white"\n            >\n              Endgültig verwerfen\n            </button>\n            <button\n              type="button"\n              onClick={() => setDiscardOpen(false)}\n              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-fog-400"\n            >\n              Spiel behalten\n            </button>\n          </div>\n        </div>\n      )}\n`,
    'safe resume dialogs',
  )

  const resumeCard = `      {resumable && (\n        <div className="mb-5 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4 animate-rise">\n          {resumable.recoveredFromBackup && (\n            <div className="mb-3 rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-xs font-bold text-mint-300">\n              Sicherheitskopie wiederhergestellt\n            </div>\n          )}\n          <div className="flex items-start gap-3">\n            <button onClick={() => onResume(resumable)} className="flex min-w-0 flex-1 items-start gap-3 text-left">\n              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-400">\n                <IconRefresh className="h-5 w-5" />\n              </span>\n              <span className="flex min-w-0 flex-1 flex-col">\n                <span className="font-bold text-fog-100">Spiel fortsetzen</span>\n                <span className="mt-0.5 text-xs text-fog-400">\n                  Runde {resumable.round} · {resumable.players[resumable.idx]?.name ?? 'Unbekannt'} ist dran\n                  {resumable.testMode ? ' · TEST' : ''}\n                </span>\n                <span className="mt-1 truncate text-[11px] text-fog-500">\n                  {resumable.players.map((player) => player.name + ' ' + player.score.toLocaleString('de-DE')).join(' · ')}\n                </span>\n                <span className="mt-1 text-[10px] text-fog-600">Gespeichert: {formatResumeTime(resumable.savedAt)}</span>\n              </span>\n            </button>\n            <button\n              onClick={() => setDiscardOpen(true)}\n              className="shrink-0 p-1.5 text-fog-600 transition-colors hover:text-coral-400"\n              aria-label="Laufendes Spiel verwerfen"\n            >\n              <IconX />\n            </button>\n          </div>\n        </div>\n      )}\n\n`
  source = replaceSection(
    source,
    `      {resumable && (\n`,
    `      <section className="mb-5 rounded-3xl`,
    resumeCard,
    'resume card',
  )
  source = replaceOnce(
    source,
    `          onClick={() => {\n            setPrefs({ lastEvent: event.trim() })\n            onStart(players, event, testMode, diceMode, goalScore, entryMin)\n          }}\n`,
    `          onClick={requestStart}\n`,
    'safe start button',
  )
  return source
})

update('src/lib/activeGame.test.ts', (input) => {
  let source = replaceOnce(
    input,
    `import { describe, expect, it } from 'vitest'\nimport { parseActiveGame } from './activeGame'\n`,
    `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'\nimport { clearActiveGame, loadActiveGame, parseActiveGame, saveActiveGame } from './activeGame'\n`,
    'active game test imports',
  )
  source += `\n\ndescribe('active game recovery', () => {\n  beforeEach(() => {\n    const values = new Map<string, string>()\n    const storage = {\n      get length() { return values.size },\n      clear: () => values.clear(),\n      getItem: (key: string) => values.get(key) ?? null,\n      key: (index: number) => [...values.keys()][index] ?? null,\n      removeItem: (key: string) => { values.delete(key) },\n      setItem: (key: string, value: string) => { values.set(key, value) },\n    } satisfies Storage\n    vi.stubGlobal('localStorage', storage)\n  })\n\n  afterEach(() => vi.unstubAllGlobals())\n\n  it('rotates at most three valid safety copies', () => {\n    for (let round = 1; round <= 5; round++) {\n      saveActiveGame({ ...base, round, savedAt: '2026-07-13T12:0' + round + ':00.000Z' })\n    }\n\n    const backups = JSON.parse(localStorage.getItem('10k_active_game_recovery_v1') || '[]') as string[]\n    expect(backups).toHaveLength(3)\n    expect(backups.map((raw) => JSON.parse(raw).round)).toEqual([4, 3, 2])\n  })\n\n  it('restores the newest valid copy when the primary value is damaged', () => {\n    const validRaw = JSON.stringify(base)\n    localStorage.setItem('10k_active_game', '{broken')\n    localStorage.setItem('10k_active_game_recovery_v1', JSON.stringify([validRaw]))\n\n    const restored = loadActiveGame()\n\n    expect(restored?.round).toBe(2)\n    expect(restored?.recoveredFromBackup).toBe(true)\n    expect(localStorage.getItem('10k_active_game')).toBe(validRaw)\n    expect(localStorage.getItem('10k_active_game_corrupt_v1')).toBe('{broken')\n  })\n\n  it('does not resurrect an intentionally discarded game', () => {\n    saveActiveGame(base)\n    saveActiveGame({ ...base, round: 3 })\n    clearActiveGame()\n\n    expect(loadActiveGame()).toBeNull()\n    expect(localStorage.getItem('10k_active_game_recovery_v1')).toBeNull()\n    expect(localStorage.getItem('10k_active_game_corrupt_v1')).toBeNull()\n  })\n})\n`
  return source
})

update('e2e/app.spec.ts', (input) => {
  const insertAt = input.lastIndexOf('\n})')
  if (insertAt < 0) throw new Error('e2e suite closing marker missing')
  const tests = `\n\n  test('protects a running game before another one is started', async ({ page }) => {\n    const activeGame = {\n      players: [\n        { id: 'player:name:gabi', name: 'Gabi', score: 850, busts: 1 },\n        { id: 'player:name:mabi', name: 'Mabi', score: 500, busts: 0 },\n      ],\n      idx: 1,\n      round: 3,\n      phase: 'active',\n      target: 0,\n      event: 'Familienabend',\n      testMode: false,\n      diceMode: 'real',\n      goalScore: 10000,\n      entryMin: 350,\n      kept: [],\n      dice: [],\n      accumulated: 0,\n      turns: [],\n      rolled: [],\n      thrown: [],\n      throwSeq: 0,\n      savedAt: '2026-07-14T08:00:00.000Z',\n    }\n    await openCleanApp(page, { '10k_active_game': JSON.stringify(activeGame) })\n    await choosePlayers(page)\n\n    await page.getByRole('button', { name: 'Spiel starten · 2 Spieler' }).click()\n    const dialog = page.getByRole('dialog', { name: 'Laufendes Spiel ersetzen?' })\n    await expect(dialog).toBeVisible()\n    await dialog.getByRole('button', { name: 'Altes Spiel fortsetzen' }).click()\n\n    await expect(page.getByText('Runde 3', { exact: true })).toBeVisible()\n    await expect(page.locator('[aria-current="true"]')).toContainText('Mabi')\n  })\n\n  test('restores a safety copy when the main active-game value is damaged', async ({ page }) => {\n    const activeGame = {\n      players: [\n        { id: 'player:name:gabi', name: 'Gabi', score: 1200, busts: 0 },\n        { id: 'player:name:mabi', name: 'Mabi', score: 900, busts: 2 },\n      ],\n      idx: 0,\n      round: 4,\n      phase: 'active',\n      target: 0,\n      event: 'Recovery Test',\n      testMode: true,\n      diceMode: 'real',\n      goalScore: 5000,\n      entryMin: 0,\n      kept: [],\n      dice: [],\n      accumulated: 0,\n      turns: [],\n      rolled: [],\n      thrown: [],\n      throwSeq: 0,\n      savedAt: '2026-07-14T08:30:00.000Z',\n    }\n    await openCleanApp(page, {\n      '10k_active_game': '{broken',\n      '10k_active_game_recovery_v1': JSON.stringify([JSON.stringify(activeGame)]),\n    })\n\n    await expect(page.getByText('Sicherheitskopie wiederhergestellt', { exact: true })).toBeVisible()\n    await page.getByRole('button', { name: /Spiel fortsetzen/ }).click()\n    await expect(page.getByText('Runde 4', { exact: true })).toBeVisible()\n    await expect(page.locator('[aria-current="true"]')).toContainText('Gabi')\n  })\n`
  return input.slice(0, insertAt) + tests + input.slice(insertAt)
})

fs.writeFileSync('src/safeResumeWiring.test.ts', `import { describe, expect, it } from 'vitest'\nimport { readFileSync } from 'node:fs'\n\ndescribe('safe resume wiring', () => {\n  const active = readFileSync('src/lib/activeGame.ts', 'utf8')\n  const setup = readFileSync('src/components/SetupScreen.tsx', 'utf8')\n\n  it('keeps bounded backups and restores only a damaged primary value', () => {\n    expect(active).toContain('const RECOVERY_LIMIT = 3')\n    expect(active).toContain('if (!raw) return null')\n    expect(active).toContain('recoveredFromBackup: true')\n  })\n\n  it('requires an explicit decision before replacing or discarding a running game', () => {\n    expect(setup).toContain('Laufendes Spiel ersetzen?')\n    expect(setup).toContain('Altes Spiel fortsetzen')\n    expect(setup).toContain('Endgültig verwerfen')\n    expect(setup).not.toContain("window.confirm('Laufendes Spiel verwerfen?")\n  })\n})\n`)

fs.writeFileSync('docs/package-j-safe-resume.md', `# Paket J – Sichere Spielwiederaufnahme\n\n## Problem\n\nEin bereits gespeichertes laufendes Spiel konnte bisher durch den Start eines neuen Spiels ohne zusätzliche Warnung überschrieben werden. Außerdem gab es bei einem beschädigten localStorage-Hauptwert keinen automatischen Rückfall auf einen älteren gültigen Stand.\n\n## Lösung\n\n- Vor jedem neuen Autosave wird der vorherige gültige Stand in einer Rotation von maximal drei lokalen Sicherheitskopien erhalten.\n- Ist der Hauptstand vorhanden, aber beschädigt, wird die jüngste gültige Kopie automatisch wiederhergestellt und sichtbar gekennzeichnet.\n- Fehlt der Hauptstand vollständig, wird keine Kopie reaktiviert. So bleibt bewusstes Verwerfen endgültig.\n- Vor dem Start eines neuen Spiels muss zwischen Fortsetzen, Abbrechen und bewusstem Ersetzen gewählt werden.\n- Das Verwerfen nutzt einen eigenen In-App-Dialog und löscht Hauptstand, Sicherungen und Diagnosekopie gemeinsam.\n- Die Fortsetzen-Karte zeigt Runde, aktuellen Spieler, Punktestände und Speicherzeitpunkt.\n\n## Abnahme\n\nUnit-Tests prüfen Rotation, Wiederherstellung und endgültiges Verwerfen. Browser-Tests prüfen den Konfliktdialog und die sichtbare Wiederherstellung einer beschädigten Sitzung.\n`)

console.log('Safe resume package applied.')
