const DIAGNOSTICS_KEY = '10k_runtime_diagnostics_v1'
const MAX_ENTRIES = 20
const MAX_MESSAGE_LENGTH = 320

type DiagnosticKind = 'render' | 'error' | 'promise'

export interface RuntimeDiagnostic {
  at: string
  kind: DiagnosticKind
  message: string
  source?: string
  line?: number
  column?: number
  build: string
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function sanitizeDiagnosticMessage(value: unknown): string {
  const raw = value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? 'Unbekannter Fehler')
  return raw
    .replace(/\b(?:FAMILIE|FAMILY|ADMIN|CLIQUE)-[A-Z0-9-]+\b/gi, '[CODE]')
    .replace(/([?&](?:code|token|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH)
}

export function readRuntimeDiagnostics(storage: StorageLike | null = browserStorage()): RuntimeDiagnostic[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(DIAGNOSTICS_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is RuntimeDiagnostic => {
        if (!entry || typeof entry !== 'object') return false
        const candidate = entry as Partial<RuntimeDiagnostic>
        return (
          typeof candidate.at === 'string' &&
          (candidate.kind === 'render' || candidate.kind === 'error' || candidate.kind === 'promise') &&
          typeof candidate.message === 'string' &&
          typeof candidate.build === 'string'
        )
      })
      .slice(-MAX_ENTRIES)
  } catch {
    return []
  }
}

export function recordRuntimeDiagnostic(
  kind: DiagnosticKind,
  error: unknown,
  details: Partial<Pick<RuntimeDiagnostic, 'source' | 'line' | 'column'>> = {},
  storage: StorageLike | null = browserStorage(),
): RuntimeDiagnostic {
  const entry: RuntimeDiagnostic = {
    at: new Date().toISOString(),
    kind,
    message: sanitizeDiagnosticMessage(error),
    source: details.source?.slice(0, 180),
    line: details.line,
    column: details.column,
    build: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'unknown',
  }

  if (!storage) return entry
  try {
    const entries = [...readRuntimeDiagnostics(storage), entry].slice(-MAX_ENTRIES)
    storage.setItem(DIAGNOSTICS_KEY, JSON.stringify(entries))
  } catch {
    /* Diagnostics must never interfere with gameplay. */
  }
  return entry
}

export function runtimeDiagnosticSummary(storage: StorageLike | null = browserStorage()): string {
  const entries = readRuntimeDiagnostics(storage).slice(-5)
  if (entries.length === 0) return `10.000 · Build ${typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'unknown'}\nKeine Diagnoseeinträge.`
  return [
    `10.000 · Build ${typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'unknown'}`,
    ...entries.map((entry) => `${entry.at} · ${entry.kind} · ${entry.message}`),
  ].join('\n')
}

export function clearRuntimeDiagnostics(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(DIAGNOSTICS_KEY)
  } catch {
    /* ignore */
  }
}

let installed = false

export function installRuntimeDiagnostics(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    recordRuntimeDiagnostic('error', event.error ?? event.message, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    recordRuntimeDiagnostic('promise', event.reason)
  })
}
