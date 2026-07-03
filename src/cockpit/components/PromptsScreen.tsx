// Research-Zentrale: 10 institutionelle Analyse-Prompts (automatisch mit
// Portfolio + Profil befüllt) und der KI-Daten-Import: Prompt kopieren →
// Claude/ChatGPT liefert JSON → einfügen → Kennzahlen-Bibliothek aktualisiert.

import { useMemo, useState } from 'react'
import { applyMetricsImport, buildMetricsPrompt } from '../lib/aiImport'
import { buildContext, RESEARCH_PROMPTS } from '../lib/prompts'
import type { Instrument } from '../lib/types'
import { useCockpit } from '../state'
import { Badge, Button, Card, inputClass, Modal, selectCompactClass } from './ui'

type ImportScope = 'portfolio' | 'watchlist' | 'all'

const SCOPE_LABELS: Record<ImportScope, string> = {
  portfolio: 'Depot-Positionen',
  watchlist: 'Watchlist',
  all: 'Alle Aktien',
}

export function PromptsScreen() {
  const { state, summary, notify, applyInstruments } = useCockpit()
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

  const copy = async (text: string, msg = 'Prompt kopiert – jetzt in Claude einfügen.') => {
    try {
      await navigator.clipboard.writeText(text)
      notify(msg)
    } catch {
      notify('Kopieren nicht möglich – Text manuell markieren.', 'error')
    }
  }

  // --- KI-Daten-Import ---
  const [scope, setScope] = useState<ImportScope>('portfolio')
  const [pasted, setPasted] = useState('')

  const scopeTickers = useMemo(() => {
    const label = (i: Instrument) =>
      `${i.name} (Ticker: ${i.ticker}${i.yahooSymbol ? `, Yahoo: ${i.yahooSymbol}` : ''})`
    if (scope === 'portfolio') {
      return summary.positions
        .filter((p) => p.instrument.assetClass === 'stock')
        .map((p) => label(p.instrument))
    }
    if (scope === 'watchlist') {
      return stocks.filter((s) => state.watchlist.includes(s.id)).map(label)
    }
    return stocks.map(label)
  }, [scope, stocks, summary.positions, state.watchlist])

  const importPrompt = useMemo(() => buildMetricsPrompt(scopeTickers), [scopeTickers])

  const runImport = () => {
    const result = applyMetricsImport(pasted, state.instruments)
    if (result.error) {
      notify(result.error, 'error')
      return
    }
    const count = result.updated.length + result.created.length
    applyInstruments(result.updated, result.created)
    const parts = [
      result.updated.length > 0 ? `${result.updated.length} Titel aktualisiert` : '',
      result.created.length > 0 ? `${result.created.length} neu angelegt` : '',
      result.skipped.length > 0 ? `übersprungen: ${result.skipped.join(', ')}` : '',
    ].filter(Boolean)
    notify(
      count > 0 ? `KI-Import: ${parts.join(' · ')}` : 'Nichts Importierbares gefunden.',
      count > 0 ? 'ok' : 'error',
    )
    if (count > 0) setPasted('')
  }

  return (
    <div className="space-y-4">
      {/* KI-Daten-Import */}
      <Card
        title="Kennzahlen per KI aktualisieren"
        subtitle="1) Prompt kopieren → 2) in Claude/ChatGPT ausführen → 3) JSON-Antwort unten einfügen. Aktualisiert Kurse, Kennzahlen und Dividenden-Profile; unbekannte Ticker werden neu angelegt."
        action={
          <select
            className={selectCompactClass}
            value={scope}
            onChange={(e) => setScope(e.target.value as ImportScope)}
          >
            {(Object.keys(SCOPE_LABELS) as ImportScope[]).map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABELS[s]}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex-1 rounded-xl bg-inset p-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-mute">
                Schritt 1 · Daten-Prompt ({scopeTickers.length} Titel)
              </div>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-soft">
                {scopeTickers.length > 0
                  ? importPrompt.slice(0, 600) + '\n…'
                  : 'Keine Titel im gewählten Umfang.'}
              </pre>
            </div>
            <Button
              small
              disabled={scopeTickers.length === 0}
              onClick={() => copy(importPrompt, 'Daten-Prompt kopiert – in Claude/ChatGPT ausführen.')}
            >
              📋 Daten-Prompt kopieren
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <textarea
              className={`${inputClass} min-h-40 flex-1 resize-y font-mono text-[11px]`}
              placeholder='Schritt 2 · KI-Antwort hier einfügen (JSON-Array, beginnt mit "[")…'
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <Button small variant="ghost" disabled={!pasted.trim()} onClick={runImport}>
              ⬆ Schritt 3 · Antwort importieren
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
          Hinweis: KI-Zahlen können veraltet oder ungenau sein – der Import markiert alle
          Werte mit Datum („KI-Import“), sodass du den Datenstand im Screener siehst.
          Stichproben lohnen sich.
        </p>
      </Card>

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
