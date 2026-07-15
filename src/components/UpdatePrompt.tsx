import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 30 * 60 * 1000
const OFFLINE_NOTICE_MS = 3200

/**
 * Prüft Updates nicht nur periodisch, sondern auch nach Rückkehr aus dem
 * iPhone-Hintergrund, aus dem bfcache und nach Wiederherstellung der Verbindung.
 * Ein laufendes Spiel wird niemals automatisch neu geladen.
 */
export default function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateFailed, setUpdateFailed] = useState(false)
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, nextRegistration) {
      setRegistration(nextRegistration ?? null)
    },
    onRegisterError() {
      if (navigator.onLine !== false) setUpdateFailed(true)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  useEffect(() => {
    const onOffline = () => setUpdateFailed(false)
    window.addEventListener('offline', onOffline)
    return () => window.removeEventListener('offline', onOffline)
  }, [])

  useEffect(() => {
    if (!registration) return

    const check = () => {
      if (navigator.onLine === false) {
        setUpdateFailed(false)
        return
      }
      void registration.update().then(
        () => setUpdateFailed(false),
        () => setUpdateFailed(true),
      )
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const onResume = () => check()

    const interval = window.setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener('online', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('10k-app-resumed', onResume)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('10k-app-resumed', onResume)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [registration])

  if (!needRefresh && !offlineReady && !updateFailed) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[65] flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)]" aria-live="polite">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-gold-500/40 bg-ink-900/95 px-4 py-3 shadow-lg shadow-black/50 backdrop-blur animate-pop">
        <div className="min-w-0 flex-1 leading-tight">
          {needRefresh ? (
            <>
              <div className="text-sm font-bold text-fog-100">Neue Version verfügbar</div>
              <div className="text-[11px] text-fog-500">Aktualisieren, sobald die laufende Runde sicher pausiert ist.</div>
            </>
          ) : offlineReady ? (
            <>
              <div className="text-sm font-bold text-mint-300">Offline bereit</div>
              <div className="text-[11px] text-fog-500">Die App kann auch ohne Internet geöffnet werden.</div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-gold-300">Update-Prüfung nicht möglich</div>
              <div className="text-[11px] text-fog-500">Die App funktioniert weiter. Später erneut öffnen.</div>
            </>
          )}
        </div>

        {needRefresh && (
          <>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-fog-500 transition-colors hover:text-fog-200"
            >
              Später
            </button>
            <button
              type="button"
              onClick={() => {
                setUpdateFailed(false)
                void updateServiceWorker(true).catch(() => setUpdateFailed(true))
              }}
              className="shrink-0 rounded-full bg-gold-500 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-ink-950 transition-transform active:scale-95"
            >
              Update laden
            </button>
          </>
        )}

        {!needRefresh && updateFailed && (
          <button
            type="button"
            onClick={() => {
              setUpdateFailed(false)
              void registration?.update().catch(() => setUpdateFailed(true))
            }}
            className="shrink-0 rounded-full border border-gold-500/30 px-3 py-1.5 text-xs font-bold text-gold-300"
          >
            Neu prüfen
          </button>
        )}
      </div>
    </div>
  )
}
