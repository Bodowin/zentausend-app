import { useRegisterSW } from 'virtual:pwa-register/react'

// Wie oft im Hintergrund nach einer neuen Version gesucht wird (1 h).
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Zeigt einen dezenten Hinweis, sobald eine neue Version bereitsteht – mit
 * sichtbarem „Update laden"-Button. Gerade in der iOS-Standalone-PWA bleibt
 * sonst gern ein alter Cache aktiv. Statt automatischem Reload (der mitten im
 * Spiel stören würde) entscheidet die Spielerin selbst, wann aktualisiert wird.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Periodisch nach Updates schauen, damit der Hinweis auch ohne Neustart kommt.
      setInterval(() => {
        void registration.update()
      }, CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-gold-500/40 bg-ink-900/95 px-4 py-3 shadow-lg shadow-black/50 backdrop-blur animate-pop">
        <div className="flex-1 leading-tight">
          <div className="text-sm font-bold text-fog-100">Neue Version verfügbar</div>
          <div className="text-[11px] text-fog-500">Tippe, um die App zu aktualisieren.</div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded-full px-3 py-1.5 text-xs font-bold text-fog-500 transition-colors hover:text-fog-200"
        >
          Später
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded-full bg-gold-500 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-ink-950 transition-transform active:scale-95"
        >
          Update laden
        </button>
      </div>
    </div>
  )
}
