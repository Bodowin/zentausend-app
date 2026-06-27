const KEY = '10k_admin_code'

/**
 * Der Admin-Code für destruktive Aktionen (nur Löschen aus der Cloud).
 *
 * Anders als der Clique-Code kennt ihn nur die Admin-Person. Er wird als Header
 * `x-admin-code` mitgeschickt und serverseitig per RLS geprüft. Wer ihn nicht
 * hinterlegt hat, kann Cloud-Spiele nicht löschen.
 */
export function getAdminCode(): string {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminCode(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim())
  } catch {
    /* ignore */
  }
}

export function hasAdminCode(): boolean {
  return getAdminCode().length > 0
}
