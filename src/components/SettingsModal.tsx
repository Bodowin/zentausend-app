import { useState } from 'react'
import { getCliqueCode, setCliqueCode } from '../lib/cliqueCode'
import { getAdminCode, setAdminCode } from '../lib/adminCode'
import { getPrefs, setPrefs, DICE_THEMES, type DiceTheme } from '../lib/prefs'
import { buildFamilyShareText, prepareFamilyDevice, type DeviceSetupResult } from '../lib/deviceSetup'
import { IconLock, IconX } from './Icons'

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('copy failed')
}

/** Modal für Familien-Code, Gerätewechsel, Darstellung und optionalen Admin-Code. */
export function SettingsModal({ onClose, focusAdmin = false }: { onClose: () => void; focusAdmin?: boolean }) {
  const [code, setCode] = useState(getCliqueCode())
  const [admin, setAdmin] = useState(getAdminCode())
  const [showAdmin, setShowAdmin] = useState(focusAdmin || getAdminCode().length > 0)
  const [saved, setSaved] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [deviceBusy, setDeviceBusy] = useState(false)
  const [deviceResult, setDeviceResult] = useState<DeviceSetupResult | null>(null)
  // Darstellungs-Einstellungen werden sofort gespeichert (unabhängig vom Code).
  const [prefs, setLocalPrefs] = useState(getPrefs())
  const updatePrefs = (patch: Partial<ReturnType<typeof getPrefs>>) => setLocalPrefs(setPrefs(patch))

  const save = () => {
    setCliqueCode(code)
    setAdminCode(admin)
    setSaved(true)
    window.setTimeout(onClose, 600)
  }

  const flashShare = (message: string) => {
    setShareMessage(message)
    window.setTimeout(() => setShareMessage((current) => (current === message ? '' : current)), 2600)
  }

  const shareCode = async () => {
    const cleanCode = code.trim()
    if (!cleanCode) {
      flashShare('Bitte zuerst den Familien-Code eingeben.')
      return
    }

    setCliqueCode(cleanCode)
    const text = buildFamilyShareText(cleanCode, window.location.origin)
    try {
      if (navigator.share) {
        await navigator.share({ title: '10.000 – Familiengerät einrichten', text })
        flashShare('Einrichtung geteilt ✓')
      } else {
        await copyText(text)
        flashShare('Einrichtung kopiert ✓')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      flashShare('Teilen war nicht möglich. Nutze „Code kopieren“.')
    }
  }

  const copyCode = async () => {
    const cleanCode = code.trim()
    if (!cleanCode) {
      flashShare('Bitte zuerst den Familien-Code eingeben.')
      return
    }
    try {
      setCliqueCode(cleanCode)
      await copyText(cleanCode)
      flashShare('Familien-Code kopiert ✓')
    } catch {
      flashShare('Kopieren war nicht möglich.')
    }
  }

  const prepareDevice = async () => {
    setDeviceBusy(true)
    setDeviceResult(null)
    try {
      setDeviceResult(await prepareFamilyDevice(code))
    } finally {
      setDeviceBusy(false)
    }
  }

  const deviceResultClasses =
    deviceResult?.state === 'ready'
      ? 'border-mint-500/35 bg-mint-500/10'
      : deviceResult?.state === 'denied'
        ? 'border-coral-500/40 bg-coral-500/10'
        : 'border-gold-500/35 bg-gold-500/10'

  return (
    <div className="glass fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-ink-700 bg-ink-850 p-6 shadow-2xl animate-rise safe-pb"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-fog-100">
            <IconLock className="h-5 w-5 text-gold-500" /> Familien-Code & Geräte
          </h2>
          <button onClick={onClose} className="p-1.5 text-fog-500 hover:text-fog-200" aria-label="Schließen">
            <IconX />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-fog-400">
          Der Familien-Code verbindet eure Geräte. Jedes Familienmitglied gibt ihn einmal ein. Danach werden Spiele,
          Statistiken und laufende Spielstände gemeinsam gesichert.
        </p>

        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-fog-500" htmlFor="family-code">
          Familien-Code
        </label>
        <input
          id="family-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setDeviceResult(null)
            setSaved(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Familien-Code eingeben…"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 font-mono text-fog-100 placeholder:font-sans placeholder:text-fog-600 focus:border-gold-500/70 focus:outline-none"
        />

        <section className="mb-4 rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4" aria-label="Neues Gerät einrichten">
          <h3 className="text-sm font-black text-gold-300">Neues Gerät einrichten</h3>
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-fog-400">
            <p><strong className="text-fog-200">1.</strong> Auf dem bisherigen Gerät den Code teilen oder kopieren.</p>
            <p><strong className="text-fog-200">2.</strong> Auf dem neuen Gerät die App öffnen und den Code eingeben.</p>
            <p><strong className="text-fog-200">3.</strong> „Code prüfen & Daten laden“ antippen.</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void shareCode()}
              className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-xs font-bold text-gold-300"
            >
              Code teilen
            </button>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2.5 text-xs font-bold text-fog-300"
            >
              Code kopieren
            </button>
          </div>

          <button
            type="button"
            onClick={() => void prepareDevice()}
            disabled={deviceBusy}
            className="mt-2 w-full rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-3 py-3 text-sm font-black text-ink-950 shadow-lg disabled:opacity-60"
          >
            {deviceBusy ? 'Verbindung wird geprüft…' : 'Code prüfen & Daten laden'}
          </button>

          <p className="mt-2 text-center text-[10px] text-fog-600">Der Admin-Code wird niemals geteilt.</p>

          {shareMessage && (
            <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-2 text-center text-xs font-semibold text-fog-300" aria-live="polite">
              {shareMessage}
            </div>
          )}

          {deviceResult && (
            <div className={`mt-3 rounded-xl border px-3 py-3 ${deviceResultClasses}`} aria-live="polite">
              {deviceResult.state === 'ready' && (
                <>
                  <div className="font-black text-mint-300">Dieses Gerät ist bereit</div>
                  <div className="mt-1 text-xs leading-relaxed text-fog-300">
                    {deviceResult.localCount} {deviceResult.localCount === 1 ? 'Spiel ist' : 'Spiele sind'} auf diesem Gerät verfügbar
                    {deviceResult.cloudCount !== null && <> · {deviceResult.cloudCount} in der Cloud</>}.
                  </div>
                </>
              )}
              {deviceResult.state === 'denied' && (
                <>
                  <div className="font-black text-coral-300">Code stimmt nicht</div>
                  <div className="mt-1 text-xs leading-relaxed text-fog-300">
                    Bitte Schreibweise prüfen oder den Code auf dem bisherigen Gerät erneut teilen.
                  </div>
                </>
              )}
              {deviceResult.state === 'offline' && (
                <>
                  <div className="font-black text-gold-300">Keine Internetverbindung</div>
                  <div className="mt-1 text-xs leading-relaxed text-fog-300">
                    Der Familien-Code ist auf diesem Gerät gespeichert. Tippe später erneut auf „Code prüfen & Daten laden“.
                  </div>
                </>
              )}
              {deviceResult.state === 'missing' && (
                <>
                  <div className="font-black text-gold-300">Familien-Code fehlt</div>
                  <div className="mt-1 text-xs text-fog-300">Bitte den geteilten Code oben eingeben.</div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Admin-Code: optional, nur für die Person, die löschen darf. */}
        {showAdmin ? (
          <div className="mb-4 rounded-2xl border border-coral-500/30 bg-coral-500/5 p-4">
            <div className="mb-2 text-sm font-bold text-coral-300">Admin-Code (Löschen)</div>
            <p className="mb-3 text-xs leading-relaxed text-fog-400">
              Nur mit diesem geheimen Code lassen sich Spiele aus der ewigen Tabelle
              <strong className="text-fog-200"> löschen</strong>. Lass ihn leer, wenn du nicht der Admin bist.
            </p>
            <input
              type="text"
              value={admin}
              onChange={(e) => setAdmin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="Admin-Code…"
              className="w-full rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600 focus:border-coral-500/70 focus:outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowAdmin(true)}
            className="mb-4 text-xs font-semibold text-fog-500 underline-offset-2 hover:text-fog-300 hover:underline"
          >
            Admin-Code eingeben (zum Löschen)
          </button>
        )}

        {/* Darstellung & Sound – speichert sofort, gilt für die virtuellen Würfel. */}
        <div className="mb-4 rounded-2xl border border-ink-700 bg-ink-900/40 p-4">
          <button
            type="button"
            role="switch"
            aria-checked={prefs.sound}
            onClick={() => updatePrefs({ sound: !prefs.sound })}
            className="flex w-full items-center justify-between"
          >
            <span className="flex flex-col text-left">
              <span className="text-sm font-bold text-fog-200">Sound</span>
              <span className="text-[11px] text-fog-500">Würfel-Klicks im virtuellen Modus</span>
            </span>
            <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.sound ? 'bg-mint-500' : 'bg-ink-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${prefs.sound ? 'left-[26px]' : 'left-1'}`} />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-label="Haptisches Feedback"
            aria-checked={prefs.haptics}
            onClick={() => updatePrefs({ haptics: !prefs.haptics })}
            className="mt-4 flex w-full items-center justify-between"
          >
            <span className="flex flex-col text-left">
              <span className="text-sm font-bold text-fog-200">Haptisches Feedback</span>
              <span className="text-[11px] text-fog-500">Kurzes Vibrieren bei Spielaktionen · Standard aus</span>
            </span>
            <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.haptics ? 'bg-mint-500' : 'bg-ink-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${prefs.haptics ? 'left-[26px]' : 'left-1'}`} />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-label="Schütteln zum Würfeln"
            aria-checked={prefs.shakeToRoll}
            onClick={() => updatePrefs({ shakeToRoll: !prefs.shakeToRoll })}
            className="mt-4 flex w-full items-center justify-between"
          >
            <span className="flex flex-col text-left">
              <span className="text-sm font-bold text-fog-200">Schütteln zum Würfeln</span>
              <span className="text-[11px] text-fog-500">Optional · kann einmalig Sensorzugriff anfragen</span>
            </span>
            <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.shakeToRoll ? 'bg-mint-500' : 'bg-ink-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${prefs.shakeToRoll ? 'left-[26px]' : 'left-1'}`} />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={prefs.handoff}
            onClick={() => updatePrefs({ handoff: !prefs.handoff })}
            className="mt-4 flex w-full items-center justify-between"
          >
            <span className="flex flex-col text-left">
              <span className="text-sm font-bold text-fog-200">„X ist dran“-Übergabe</span>
              <span className="text-[11px] text-fog-500">Kurze Einblendung beim Spielerwechsel</span>
            </span>
            <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.handoff ? 'bg-mint-500' : 'bg-ink-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${prefs.handoff ? 'left-[26px]' : 'left-1'}`} />
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={prefs.miniChart}
            onClick={() => updatePrefs({ miniChart: !prefs.miniChart })}
            className="mt-4 flex w-full items-center justify-between"
          >
            <span className="flex flex-col text-left">
              <span className="text-sm font-bold text-fog-200">Mini-Punktekurve</span>
              <span className="text-[11px] text-fog-500">Kleiner Verlauf in den Spieler-Kacheln</span>
            </span>
            <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.miniChart ? 'bg-mint-500' : 'bg-ink-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${prefs.miniChart ? 'left-[26px]' : 'left-1'}`} />
            </span>
          </button>

          <div className="mt-4">
            <span className="text-sm font-bold text-fog-200">Würfel-Design</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(DICE_THEMES) as DiceTheme[]).map((key) => {
                const t = DICE_THEMES[key]
                const active = prefs.diceTheme === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updatePrefs({ diceTheme: key })}
                    aria-label={t.label}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-colors ${
                      active ? 'border-gold-500/70' : 'border-ink-700 hover:border-ink-600'
                    }`}
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg shadow-inner"
                      style={{ background: `radial-gradient(120% 120% at 30% 22%, ${t.hi}, ${t.mid} 60%, ${t.lo})` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.pipA }} />
                    </span>
                    <span className="text-[9px] font-semibold text-fog-400">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <button
          onClick={save}
          className="w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3.5 font-bold text-ink-950 shadow-lg transition-all active:scale-[0.98]"
        >
          {saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>

        <p className="mt-4 text-center text-[10px] text-fog-600">Version {__BUILD_TIME__}</p>
      </div>
    </div>
  )
}
