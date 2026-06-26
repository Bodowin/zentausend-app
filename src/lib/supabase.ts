import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getCliqueCode } from './cliqueCode'

/**
 * Supabase-Client für die geteilte „ewige Tabelle" der Clique.
 *
 * URL und publishable Key sind absichtlich öffentlich (der Key ist nur über
 * Row-Level-Security wirksam und darf im Client-Bundle landen). Sie lassen sich
 * per Env-Variable überschreiben:
 *
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *
 * Schreiben/Löschen ist zusätzlich durch den Clique-Code geschützt: Er wird als
 * Header `x-clique-code` mitgeschickt und serverseitig per RLS geprüft. Lesen
 * bleibt offen. Ohne gültige Werte läuft die App offline-only (nur localStorage).
 */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://xikqtpqdzmwsvybaklud.supabase.co'

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_3NVeOgr0ykKCPVkqVyRXfg_KO91XwBx'

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY)

// Der Client wird pro Clique-Code zwischengespeichert: Ändert sich der Code,
// bauen wir einen neuen Client mit aktualisiertem Header.
let cached: { code: string; client: SupabaseClient<Database> | null } | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!cloudEnabled) return null
  const code = getCliqueCode()
  if (cached && cached.code === code) return cached.client
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    global: { headers: code ? { 'x-clique-code': code } : {} },
  })
  cached = { code, client }
  return client
}
