const KEY = '10k_clique_code'

/** Der gemeinsame Clique-Code (Schreib-/Löschschutz) aus dem lokalen Speicher. */
export function getCliqueCode(): string {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setCliqueCode(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim())
  } catch {
    /* ignore */
  }
}

export function hasCliqueCode(): boolean {
  return getCliqueCode().length > 0
}
