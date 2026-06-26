import { useState } from 'react'
import { getCliqueCode, setCliqueCode } from '../lib/cliqueCode'
import { IconLock, IconX } from './Icons'

/** Modal zum Setzen des Clique-Codes (Schreib-/Löschschutz der Cloud). */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState(getCliqueCode())
  const [saved, setSaved] = useState(false)

  const save = () => {
    setCliqueCode(code)
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
          <strong className="text-fog-200"> schreiben</strong> oder
          <strong className="text-fog-200"> löschen</strong>. Lesen bleibt für alle offen. Jedes
          Clique-Mitglied gibt ihn einmal pro Gerät ein.
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

        <button
          onClick={save}
          className="w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3.5 font-bold text-ink-950 shadow-lg transition-all active:scale-[0.98]"
        >
          {saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
