import { useCallback, useEffect, useState } from 'react'
import { evaluateDeviceHealth, inspectDeviceHealth, type DeviceHealthReport } from '../lib/deviceHealth'

export function ProductionGuard() {
  const [health, setHealth] = useState<DeviceHealthReport | null>(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      setHealth(await inspectDeviceHealth())
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void check()

    const onResume = () => void check()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }

    window.addEventListener('online', onResume)
    window.addEventListener('offline', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('10k-app-resumed', onResume)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('online', onResume)
      window.removeEventListener('offline', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('10k-app-resumed', onResume)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [check])

  if (!health || evaluateDeviceHealth(health) !== 'error') return null

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[max(env(safe-area-inset-top),0.75rem)]" role="alert">
      <div className="w-full max-w-md rounded-2xl border border-coral-500/50 bg-ink-900/95 px-4 py-3 shadow-xl backdrop-blur">
        <div className="text-sm font-black text-coral-300">Gerätespeicher nicht verfügbar</div>
        <p className="mt-1 text-xs leading-relaxed text-fog-300">
          Ein laufendes Spiel kann auf diesem Gerät gerade nicht sicher gespeichert werden. Bitte Speicherplatz freigeben und danach erneut prüfen.
        </p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="mt-3 rounded-xl bg-coral-500 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
        >
          {checking ? 'Wird geprüft…' : 'Erneut prüfen'}
        </button>
      </div>
    </div>
  )
}
