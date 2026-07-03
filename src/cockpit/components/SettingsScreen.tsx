// Einstellungen: Anlegerprofil (steuert Score-Gewichtung & Prompts),
// Budget/Horizont, Backup (Export/Import) und Demo-Daten-Verwaltung.

import { useRef } from 'react'
import { fmtPct } from '../lib/format'
import { exportStateJson, parseImportedState } from '../lib/store'
import type { RiskProfile } from '../lib/types'
import { useCockpit } from '../state'
import { Badge, Button, Card, Field, NumberInput, SliderField } from './ui'

const PROFILES: { id: RiskProfile; label: string; desc: string }[] = [
  { id: 'defensiv', label: 'Defensiv', desc: 'Kapitalerhalt, Dividenden, wenig Schwankung' },
  { id: 'ausgewogen', label: 'Ausgewogen', desc: 'Mix aus Qualität, Bewertung und Ausschüttung' },
  { id: 'wachstum', label: 'Wachstum', desc: 'Qualität + Wachstum, Dividende zweitrangig' },
  { id: 'aggressiv', label: 'Aggressiv', desc: 'Maximales Wachstum, hohe Schwankung ok' },
]

export function SettingsScreen() {
  const { state, updateSettings, importState, clearDemo, resetDemo, notify } = useCockpit()
  const s = state.settings
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const blob = new Blob([exportStateJson(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invest-cockpit-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = async (file: File) => {
    const text = await file.text()
    const parsed = parseImportedState(text)
    if (parsed) importState(parsed)
    else notify('Datei nicht lesbar – ist es ein Cockpit-Backup?', 'error')
  }

  return (
    <div className="space-y-4">
      <Card title="Anlegerprofil" subtitle="steuert die Score-Gewichtung im Screener und die Research-Prompts">
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => updateSettings({ riskProfile: p.id })}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                s.riskProfile === p.id
                  ? 'border-aurum bg-aurum/10'
                  : 'border-edge bg-inset hover:border-aurum/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{p.label}</span>
                {s.riskProfile === p.id && <Badge tone="aurum">aktiv</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-ink-mute">{p.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Monatlich verfügbar (für Prompts & Planung)">
            <NumberInput value={s.monthlyBudget} onChange={(v) => updateSettings({ monthlyBudget: v })} step={50} min={0} suffix="€" />
          </Field>
          <Field label="Cash-Reserve außerhalb des Depots">
            <NumberInput value={s.cashReserve} onChange={(v) => updateSettings({ cashReserve: v })} step={500} min={0} suffix="€" />
          </Field>
          <SliderField
            label="Anlagehorizont"
            value={s.horizonYears}
            onChange={(v) => updateSettings({ horizonYears: Math.round(v) })}
            min={1}
            max={40}
            step={1}
            format={(v) => `${v} Jahre`}
          />
          <SliderField
            label="Erwartete Rendite p. a. (Projektionen)"
            value={s.expectedReturnPct}
            onChange={(v) => updateSettings({ expectedReturnPct: v })}
            min={0}
            max={12}
            step={0.5}
            format={(v) => fmtPct(v, 1)}
          />
        </div>
      </Card>

      <Card title="Daten & Backup" subtitle="alles liegt lokal in deinem Browser (localStorage) – kein Server">
        <label className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={s.autoRefreshQuotes}
            onChange={(e) => updateSettings({ autoRefreshQuotes: e.target.checked })}
          />
          Kurse beim Öffnen automatisch aktualisieren (max. alle 6 Std., nur im Deployment wirksam)
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={doExport}>
            ⬇ Backup exportieren (JSON)
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            ⬆ Backup importieren
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void doImport(f)
              e.target.value = ''
            }}
          />
          {state.demo ? (
            <Button variant="danger" onClick={clearDemo}>
              Demo-Portfolio entfernen
            </Button>
          ) : (
            <Button variant="ghost" onClick={resetDemo}>
              Demo-Daten neu laden
            </Button>
          )}
        </div>
        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-ink-mute">
          <li>• „Demo-Portfolio entfernen“ leert Transaktionen/Sparpläne/Verlauf – die Kennzahlen-Bibliothek der Aktien & ETFs bleibt.</li>
          <li>• Live-Kurse (Button oben rechts) funktionieren im Vercel-Deployment über <code className="text-ink-soft">/api/quote</code> und werden automatisch in EUR umgerechnet.</li>
          <li>• Die Kennzahlen der Bibliothek sind Beispieldaten (Stand ca. Mitte 2025) – im Screener pro Titel editierbar. Tipp: Nutze den DCF-/Screening-Prompt aus der Research-Zentrale, um sie aktuell zu halten.</li>
          <li>• Alle Angaben ohne Gewähr, keine Anlageberatung.</li>
        </ul>
      </Card>
    </div>
  )
}
