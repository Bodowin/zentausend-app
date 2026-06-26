const KEY = '10k_clique_code'

/**
 * Eingebauter Standard-Code, damit die App für die ganze Clique ohne manuelle
 * Eingabe synchronisiert. Wer einen eigenen, geheimeren Code möchte, kann ihn in
 * den Einstellungen überschreiben (siehe SettingsModal).
 */
export const DEFAULT_CLIQUE_CODE = 'FAMILY'

/** Der gemeinsame Clique-Code (Schreib-/Löschschutz) aus dem lokalen Speicher. */
export function getCliqueCode(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_CLIQUE_CODE
  } catch {
    return DEFAULT_CLIQUE_CODE
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
