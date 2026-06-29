import { useState } from 'react'
import { getCliqueCode, setCliqueCode } from '../lib/cliqueCode'
import { getAdminCode, setAdminCode } from '../lib/adminCode'
import { getPrefs, setPrefs, DICE_THEMES, type DiceTheme } from '../lib/prefs'
import { IconLock, IconX } from './Icons'

/** Modal für Clique-Code (Schreiben/Sync) und optionalen Admin-Code (Löschen). */
export function SettingsModal({ onClose, focusAdmin = false }: { onClose: () => void; focusAdmin?: boolean }) {
  const [code, setCode] = useState(getCliqueCode())
  const [admin, setAdmin] = useState(getAdminCode())
  const [showAdmin, setShowAdmin] = useState(focusAdmin || getAdminCode().length > 0)
  const [saved, setSaved] = useState(false)
  // Darstellungs-Einstellungen werden sofort gespeichert (unabhängig vom Code).
  const [prefs, setLocalPrefs] = useState(getPrefs())
  const updatePrefs = (patch: Partial<ReturnType<typeof getPrefs>>) => setLocalPrefs(setPrefs(patch))

  const save = () => {
    setCliqueCode(code)
    setAdminCode(admin)
    setSaved(true)
    window.setTimeout(onClose, 600)
  }

  return (
    <div className="glass fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-ink-700 bg-ink-850 p-6 shadow-2xl animate-rise safe-pb"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-fog-100">
            <IconLock className="h-5 w-5 text-gold-500" /> Clique-Code
          </h2>
          <button onClick={onClose} className="p-1.5 text-fog-500 hover:text-fog-200" aria-label="Schließen">
            <IconX />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-fog-400">
          Das gemeinsame Kennwort eurer Clique. Nur damit lassen sich Spiele in die ewige Tabelle
          <strong className="text-fog-200"> schreiben & synchronisieren</strong>. Lesen bleibt für alle
          offen. Jedes Clique-Mitglied gibt ihn einmal pro Gerät ein.
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Clique-Code eingeben…"
          autoCapitalize="characters"
          className="mb-4 w-full rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600 focus:border-gold-500/70 focus:outline-none"
        />

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
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${prefs.sound ? 'translate-x-[26px]' : 'translate-x-1'}`} />
            </span>
          </button>

          {/* „X ist dran"-Übergabe */}
          <button
            type="button"
            role="switch"
            aria-checked={prefs.handoff}
            onClick={() => updatePrefs({ handoff: !prefs.handoff })}
            className="mt-4 flex w-full items-center justify-between"
          >
            <span className="flex flex-col text-left">
              <span className="text-sm font-bold text-fog-200">„X ist dran"-Übergabe</span>
              <span className="text-[11px] text-fog-500">Kurze Einblendung beim Spielerwechsel</span>
            </span>
            <span className={`relative h-7 w-[52px] shrink-0 rounded-full transition-colors ${prefs.handoff ? 'bg-mint-500' : 'bg-ink-600'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${prefs.handoff ? 'translate-x-[26px]' : 'translate-x-1'}`} />
            </span>
          </button>

          {/* Mini-Punktekurve */}
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
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${prefs.miniChart ? 'translate-x-[26px]' : 'translate-x-1'}`} />
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
