import { linkPlayerNames } from './playerIdentity'

const KEY = '10k_roster'

/** Stamm-Kader: die schnell auswählbaren Spielernamen. Pro Gerät anpassbar. */
const DEFAULT_ROSTER = ['Gabi', 'Mabi', 'Dana', 'Bodo']
const MAX_ROSTER = 16

export function getRoster(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return [...DEFAULT_ROSTER]
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return [...DEFAULT_ROSTER]
    return arr.filter((n) => typeof n === 'string' && n.trim()).slice(0, MAX_ROSTER)
  } catch {
    return [...DEFAULT_ROSTER]
  }
}

export function setRoster(names: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(names.slice(0, MAX_ROSTER)))
  } catch {
    /* ignore */
  }
}

const norm = (s: string) => s.trim().toLowerCase()

/** Fügt einen Namen hinzu (kein Duplikat, Groß-/Kleinschreibung egal). */
export function addToRoster(name: string): string[] {
  const n = name.trim()
  const roster = getRoster()
  if (!n || roster.length >= MAX_ROSTER || roster.some((r) => norm(r) === norm(n))) return roster
  const next = [...roster, n]
  setRoster(next)
  return next
}

export function removeFromRoster(name: string): string[] {
  const next = getRoster().filter((r) => norm(r) !== norm(name))
  setRoster(next)
  return next
}

/** Benennt einen Stamm-Spieler um (an gleicher Position). */
export function renameInRoster(oldName: string, newName: string): string[] {
  const n = newName.trim()
  const roster = getRoster()
  if (!n) return roster
  // Kollision mit anderem Eintrag verhindern.
  if (roster.some((r) => norm(r) === norm(n) && norm(r) !== norm(oldName))) return roster
  linkPlayerNames(oldName, n)
  const next = roster.map((r) => (norm(r) === norm(oldName) ? n : r))
  setRoster(next)
  return next
}
