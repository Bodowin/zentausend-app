export interface DeviceHealthReport {
  checkedAt: string
  storageWritable: boolean
  online: boolean
  serviceWorkerSupported: boolean
  serviceWorkerControlled: boolean
  standalone: boolean
  persisted: boolean | null
  usageBytes: number | null
  quotaBytes: number | null
}

export type DeviceHealthLevel = 'ok' | 'warning' | 'error'

export function evaluateDeviceHealth(report: DeviceHealthReport): DeviceHealthLevel {
  if (!report.storageWritable) return 'error'
  if (!report.online) return 'warning'
  return 'ok'
}

function storageWritable(): boolean {
  try {
    const key = '10k_health_probe'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export async function inspectDeviceHealth(): Promise<DeviceHealthReport> {
  let persisted: boolean | null = null
  let usageBytes: number | null = null
  let quotaBytes: number | null = null

  try {
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted()
  } catch {
    persisted = null
  }

  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usageBytes = typeof estimate.usage === 'number' ? estimate.usage : null
      quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null
    }
  } catch {
    usageBytes = null
    quotaBytes = null
  }

  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  const standalone =
    iosNavigator.standalone === true ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)

  return {
    checkedAt: new Date().toISOString(),
    storageWritable: storageWritable(),
    online: navigator.onLine !== false,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    standalone,
    persisted,
    usageBytes,
    quotaBytes,
  }
}
