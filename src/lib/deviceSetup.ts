import { setCliqueCode } from './cliqueCode'
import { syncAndMerge, type SyncResult } from './cloud'

export type DeviceSetupState = 'ready' | 'missing' | 'denied' | 'offline'

export interface DeviceSetupResult {
  state: DeviceSetupState
  localCount: number
  cloudCount: number | null
}

type SyncFn = () => Promise<SyncResult>

export function buildFamilyShareText(code: string, appUrl: string): string {
  const cleanCode = code.trim()
  const cleanUrl = appUrl.replace(/\/$/, '')
  return [
    '10.000 – Familiengerät einrichten',
    '',
    `Familien-Code: ${cleanCode}`,
    `App öffnen: ${cleanUrl}`,
    '',
    'In der App auf Einstellungen tippen, den Familien-Code eingeben und „Code prüfen & Daten laden“ wählen.',
  ].join('\n')
}

export async function prepareFamilyDevice(code: string, sync: SyncFn = syncAndMerge): Promise<DeviceSetupResult> {
  const cleanCode = code.trim()
  if (!cleanCode) return { state: 'missing', localCount: 0, cloudCount: null }

  setCliqueCode(cleanCode)
  const result = await sync()
  if (result.codeDenied) {
    return { state: 'denied', localCount: result.games.length, cloudCount: result.cloudCount }
  }
  if (!result.online) {
    return { state: 'offline', localCount: result.games.length, cloudCount: result.cloudCount }
  }
  return { state: 'ready', localCount: result.games.length, cloudCount: result.cloudCount }
}
