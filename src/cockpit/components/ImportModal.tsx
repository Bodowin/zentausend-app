// IBKR-Import-Assistent: CSV einfügen/hochladen → Trades werden erkannt
// (Activity Statement, Flex Query oder generisches CSV), in EUR umgerechnet
// (Kurse editierbar), Instrumenten zugeordnet und als Transaktionen gebucht.
// Bereits vorhandene Buchungen (gleicher Tag/Titel/Stück/Kurs) werden übersprungen.

import { useMemo, useRef, useState } from 'react'
import { uid } from '../lib/format'
import { DEFAULT_FX_TO_EUR, parseTradesCsv, type ParsedTrade } from '../lib/ibkr'
import type { Instrument, Transaction } from '../lib/types'
import { useCockpit } from '../state'
import { Badge, Button, Modal, NumberInput, inputClass } from './ui'

type MappedStatus = 'vorhanden' | 'neu' | 'duplikat'

interface MappedTrade {
  trade: ParsedTrade
  instrument: Instrument | null // null → wird neu angelegt
  status: MappedStatus
  priceEur: number
  feesEur: number
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { state, addTransactions, notify } = useCockpit()
  const [text, setText] = useState('')
  const [fx, setFx] = useState<Record<string, number>>({ ...DEFAULT_FX_TO_EUR })
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? parseTradesCsv(text) : null), [text])

  const mapped: MappedTrade[] = useMemo(() => {
    if (!parsed) return []
    return parsed.trades.map((trade) => {
      const instrument =
        state.instruments.find(
          (i) =>
            i.ticker.toUpperCase() === trade.symbol ||
            i.id.toUpperCase() === trade.symbol ||
            (i.yahooSymbol ?? '').toUpperCase().split('.')[0] === trade.symbol,
        ) ?? null
      const rate = fx[trade.currency] ?? 1
      const priceEur = Math.round(trade.price * rate * 100) / 100
      const feesEur = Math.round(trade.fees * rate * 100) / 100
      const duplicate =
        instrument !== null &&
        state.transactions.some(
          (t) =>
            t.instrumentId === instrument.id &&
            t.date === trade.date &&
            t.type === trade.type &&
            Math.abs(t.shares - trade.shares) < 1e-6 &&
            Math.abs(t.price - priceEur) < 0.02,
        )
      return {
        trade,
        instrument,
        status: duplicate ? 'duplikat' : instrument ? 'vorhanden' : 'neu',
        priceEur,
        feesEur,
      }
    })
  }, [parsed, state.instruments, state.transactions, fx])

  const currencies = useMemo(
    () => [...new Set(mapped.map((m) => m.trade.currency))].filter((c) => c !== 'EUR'),
    [mapped],
  )
  const importable = mapped.filter((m) => m.status !== 'duplikat')

  const runImport = () => {
    const newInstruments: Instrument[] = []
    const txs: Transaction[] = []
    for (const m of importable) {
      let instrument = m.instrument
      if (!instrument) {
        instrument =
          newInstruments.find((i) => i.ticker === m.trade.symbol) ??
          ({
            id: uid(),
            ticker: m.trade.symbol,
            name: m.trade.symbol,
            assetClass: 'stock',
            sector: 'Technologie',
            region: 'Andere',
            price: m.priceEur,
            quoteCurrency: (['EUR', 'USD', 'CHF', 'DKK', 'GBP'].includes(m.trade.currency)
              ? m.trade.currency
              : 'USD') as Instrument['quoteCurrency'],
            metrics: { moat: 1, asOf: 'IBKR-Import – Kennzahlen ergänzen' },
          } as Instrument)
        if (!newInstruments.includes(instrument)) newInstruments.push(instrument)
      }
      txs.push({
        id: uid(),
        instrumentId: instrument.id,
        type: m.trade.type,
        date: m.trade.date,
        shares: m.trade.shares,
        price: m.priceEur,
        fees: m.feesEur,
        note: 'IBKR-Import',
      })
    }
    addTransactions(txs, newInstruments)
    notify(
      `${txs.length} Trades importiert${newInstruments.length > 0 ? `, ${newInstruments.length} Titel neu angelegt` : ''}${
        mapped.length - importable.length > 0
          ? ` · ${mapped.length - importable.length} Duplikate übersprungen`
          : ''
      }.`,
    )
    onClose()
  }

  return (
    <Modal title="IBKR-Trades importieren" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button small variant="ghost" onClick={() => fileRef.current?.click()}>
            📄 CSV-Datei wählen
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setText(await f.text())
              e.target.value = ''
            }}
          />
          <span className="text-xs text-ink-mute">
            Unterstützt: Activity Statement, Flex Query (Trades) und generisches CSV
            (Datum, Ticker, Typ, Stück, Kurs, Gebühren, Währung).
          </span>
        </div>

        <textarea
          className={`${inputClass} min-h-28 resize-y font-mono text-[11px]`}
          placeholder="…oder CSV-Inhalt hier einfügen"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {parsed && parsed.source === null && (
          <p className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
            Format nicht erkannt. Im IBKR-Kontoauszug muss die „Trades“-Sektion enthalten
            sein; alternativ ein CSV mit Kopfzeile (Datum, Ticker, Stück, Kurs …).
          </p>
        )}

        {parsed && parsed.trades.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="aurum">
                {parsed.source === 'ibkr-activity'
                  ? 'IBKR Activity Statement'
                  : parsed.source === 'ibkr-flex'
                    ? 'IBKR Flex Query'
                    : 'Generisches CSV'}
              </Badge>
              <span className="text-xs text-ink-soft">
                {parsed.trades.length} Trades erkannt · {importable.length} importierbar
              </span>
              {currencies.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs text-ink-soft">
                  1 {c} =
                  <span className="w-24">
                    <NumberInput
                      value={fx[c] ?? 1}
                      onChange={(v) => setFx((f) => ({ ...f, [c]: v }))}
                      step={0.005}
                      min={0}
                      suffix="€"
                    />
                  </span>
                </label>
              ))}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-edge">
              <table className="tnum w-full min-w-[560px] text-xs">
                <thead className="sticky top-0 bg-raised">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-ink-mute">
                    <th className="p-2 font-medium">Datum</th>
                    <th className="p-2 font-medium">Symbol</th>
                    <th className="p-2 font-medium">Typ</th>
                    <th className="p-2 text-right font-medium">Stück</th>
                    <th className="p-2 text-right font-medium">Kurs → EUR</th>
                    <th className="p-2 text-right font-medium">Gebühr</th>
                    <th className="p-2 text-right font-medium">Zuordnung</th>
                  </tr>
                </thead>
                <tbody>
                  {mapped.map((m, i) => (
                    <tr
                      key={i}
                      className={`border-t border-edge/50 ${m.status === 'duplikat' ? 'opacity-45' : ''}`}
                    >
                      <td className="p-2 text-ink-soft">{m.trade.date}</td>
                      <td className="p-2 font-medium text-ink">{m.trade.symbol}</td>
                      <td className="p-2">
                        <Badge tone={m.trade.type === 'buy' ? 'gain' : 'loss'}>
                          {m.trade.type === 'buy' ? 'Kauf' : 'Verkauf'}
                        </Badge>
                      </td>
                      <td className="p-2 text-right text-ink">{m.trade.shares}</td>
                      <td className="p-2 text-right text-ink">
                        {m.trade.price.toLocaleString('de-DE')} {m.trade.currency} →{' '}
                        {m.priceEur.toLocaleString('de-DE')} €
                      </td>
                      <td className="p-2 text-right text-ink-soft">
                        {m.feesEur.toLocaleString('de-DE')} €
                      </td>
                      <td className="p-2 text-right">
                        {m.status === 'duplikat' ? (
                          <Badge>schon gebucht</Badge>
                        ) : m.instrument ? (
                          <span className="text-ink-soft">→ {m.instrument.name}</span>
                        ) : (
                          <Badge tone="warn">neu anlegen</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-mute">
              Fremdwährungs-Trades werden mit den Kursen oben in EUR umgerechnet – für
              steuerlich exakte Werte den EZB-Kurs des Handelstags verwenden. Neu angelegte
              Titel bekommen Platzhalter-Stammdaten; Kennzahlen anschließend am besten über
              den KI-Import im Research-Tab füllen.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={importable.length === 0} onClick={runImport}>
            {importable.length > 0 ? `${importable.length} Trades importieren` : 'Importieren'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
