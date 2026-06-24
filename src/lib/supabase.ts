import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Supabase-Client für die geteilte „ewige Tabelle" der Clique.
 *
 * URL und publishable Key sind absichtlich öffentlich (der Key ist nur über
 * Row-Level-Security wirksam und darf im Client-Bundle landen). Sie lassen sich
 * per Env-Variable überschreiben (z. B. auf Vercel oder in einer lokalen .env):
 *
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *
 * Ohne gültige Werte läuft die App offline-only (nur localStorage).
 */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://xikqtpqdzmwsvybaklud.supabase.co'

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_3NVeOgr0ykKCPVkqVyRXfg_KO91XwBx'

export const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      })
    : null

export const cloudEnabled = supabase !== null
