import { getCliqueCode } from './cliqueCode'
import { getSupabase } from './supabase'

const CLOUD_TIMEOUT_MS = 3500
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export type CliqueCodeStatus = 'valid' | 'invalid' | 'missing' | 'offline'

/**
 * Fragt ausschließlich einen booleschen Gültigkeitsstatus ab. Der gespeicherte
 * Code und sein serverseitiger Hash werden zu keinem Zeitpunkt zurückgegeben.
 */
export async function checkCliqueCode(): Promise<CliqueCodeStatus> {
  const code = getCliqueCode()
  const supabase = getSupabase()
  if (!code) return 'missing'
  if (!supabase || isOffline()) return 'offline'

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS)
  try {
    const { data, error } = await supabase.rpc('check_clique_code').abortSignal(controller.signal)
    if (error) {
      console.warn('Clique-Code konnte nicht geprüft werden:', error.message)
      return 'offline'
    }
    return data === true ? 'valid' : 'invalid'
  } catch (error) {
    console.warn('Clique-Code-Prüfung abgebrochen (Timeout/offline):', error)
    return 'offline'
  } finally {
    window.clearTimeout(timer)
  }
}
