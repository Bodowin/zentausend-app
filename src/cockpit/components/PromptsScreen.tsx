// Research-Zentrale: 10 institutionelle Analyse-Prompts, automatisch mit
// Portfolio + Profil befüllt – kopieren, in Claude einfügen, Report erhalten.

import { useMemo, useState } from 'react'
import { buildContext, RESEARCH_PROMPTS } from '../lib/prompts'
import type { Instrument } from '../lib/types'
import { useCockpit } from '../state'
import { Badge, Button, Card, Modal, selectCompactClass } from './ui'

export function PromptsScreen() {
  const { state, summary, notify } = useCockpit()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const stocks = state.instruments.filter((i) => i.assetClass === 'stock')
  const [ticker, setTicker] = useState<string>(state.watchlist[0] ?? stocks[0]?.id ?? '')
  const instrument: Instrument | null = stocks.find((i) => i.id === ticker) ?? null

  const ctx = useMemo(
    () => buildContext(state, summary, instrument),
    [state, summary, instrument],
  )

  const selected = RESEARCH_PROMPTS.find((p) => p.id === selectedId) ?? null
  const promptText = selected ? selected.build(ctx) : ''

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify('Prompt kopiert – jetzt in Claude einfügen.')
    } catch {
      notify('Kopieren nicht möglich – Text manuell markieren.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Research-Zentrale"
        subtitle="Profi-Analyse-Frameworks, automatisch mit deinem Depot und Profil befüllt. Kopieren → in Claude einfügen → Report erhalten."
        action={
          <select className={selectCompactClass} value={ticker} onChange={(e) => setTicker(e.target.value)}>
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ticker} · {s.name}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESEARCH_PROMPTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="card flex flex-col items-start gap-1.5 border-edge bg-inset p-4 text-left transition-colors hover:border-aurum/50"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-2xl">{p.icon}</span>
                {p.needs === 'ticker' && <Badge tone="aurum">{ctx.ticker}</Badge>}
                {p.needs === 'sector' && <Badge tone="aurum">{ctx.sector}</Badge>}
                {p.needs === 'none' && <Badge>Depot-Daten</Badge>}
              </div>
              <div className="text-sm font-semibold text-ink">{p.title}</div>
              <div className="text-xs leading-snug text-ink-mute">{p.subtitle}</div>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-mute">
          Tipp: Der gewählte Titel oben rechts steuert die Ticker-/Sektor-Prompts. Die
          Depot-Prompts enthalten automatisch alle Positionen, Sparpläne und dein
          Risikoprofil aus den Einstellungen.
        </p>
      </Card>

      {selected && (
        <Modal title={`${selected.icon} ${selected.title}`} onClose={() => setSelectedId(null)} wide>
          <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-inset p-4 font-mono text-xs leading-relaxed text-ink-soft">
            {promptText}
          </pre>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-mute">
              {promptText.length.toLocaleString('de-DE')} Zeichen · Platzhalter in
              [KLAMMERN] ggf. noch ausfüllen
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Schließen
              </Button>
              <Button onClick={() => copy(promptText)}>📋 Prompt kopieren</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
