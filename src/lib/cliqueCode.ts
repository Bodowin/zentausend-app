const KEY = '10k_clique_code'

/**
 * Der gemeinsame Clique-Code (Schreib-/Sync-Schutz) aus dem lokalen Speicher.
 *
 * Bewusst KEIN eingebauter Default mehr: Jedes Clique-Mitglied gibt den Code
 * einmal pro Gerät ein. So steht das gemeinsame Kennwort nicht im (öffentlichen)
 * Client-Bundle. Ohne Code läuft die App lesend/offline weiter.
 */
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
