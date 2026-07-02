// Zentraler App-Zustand: localStorage-gestützt, mit allen Aktionen
// (Transaktionen, Sparpläne, Instrumente, Kurse, Einstellungen) und
// abgeleiteten Werten (Positionen, Summen) über Context verfügbar.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { computePortfolio } from './lib/calc'
import { fetchQuotes } from './lib/quotes'
import { loadState, resetToSeed, saveState, withoutDemoData } from './lib/store'
import { todayIso } from './lib/format'
import type {
  CockpitState,
  Instrument,
  PortfolioSummary,
  SavingsPlan,
  Settings,
  Transaction,
} from './lib/types'

export interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

interface CockpitContextValue {
  state: CockpitState
  summary: PortfolioSummary
  toasts: Toast[]
  quotesLoading: boolean
  notify: (text: string, tone?: Toast['tone']) => void
  addTransaction: (tx: Transaction) => void
  deleteTransaction: (id: string) => void
  upsertInstrument: (instrument: Instrument) => void
  deleteInstrument: (id: string) => void
  addPlan: (plan: SavingsPlan) => void
  updatePlan: (plan: SavingsPlan) => void
  deletePlan: (id: string) => void
  toggleWatch: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  refreshQuotes: () => Promise<void>
  importState: (next: CockpitState) => void
  clearDemo: () => void
  resetDemo: () => void
}

const Ctx = createContext<CockpitContextValue | null>(null)

export function useCockpit(): CockpitContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCockpit außerhalb des Providers')
  return v
}

let toastId = 0

export function CockpitProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CockpitState>(() => loadState())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [quotesLoading, setQuotesLoading] = useState(false)

  useEffect(() => {
    saveState(state)
  }, [state])

  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const summary = useMemo(
    () => computePortfolio(state.instruments, state.transactions),
    [state.instruments, state.transactions],
  )

  const addTransaction = useCallback((tx: Transaction) => {
    setState((s) => ({ ...s, transactions: [...s.transactions, tx] }))
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }))
  }, [])

  const upsertInstrument = useCallback((instrument: Instrument) => {
    setState((s) => {
      const exists = s.instruments.some((i) => i.id === instrument.id)
      return {
        ...s,
        instruments: exists
          ? s.instruments.map((i) => (i.id === instrument.id ? instrument : i))
          : [...s.instruments, instrument],
      }
    })
  }, [])

  const deleteInstrument = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      instruments: s.instruments.filter((i) => i.id !== id),
      transactions: s.transactions.filter((t) => t.instrumentId !== id),
      plans: s.plans.filter((p) => p.instrumentId !== id),
      watchlist: s.watchlist.filter((w) => w !== id),
    }))
  }, [])

  const addPlan = useCallback((plan: SavingsPlan) => {
    setState((s) => ({ ...s, plans: [...s.plans, plan] }))
  }, [])

  const updatePlan = useCallback((plan: SavingsPlan) => {
    setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? plan : p)) }))
  }, [])

  const deletePlan = useCallback((id: string) => {
    setState((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== id) }))
  }, [])

  const toggleWatch = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      watchlist: s.watchlist.includes(id)
        ? s.watchlist.filter((w) => w !== id)
        : [...s.watchlist, id],
    }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const refreshQuotes = useCallback(async () => {
    setQuotesLoading(true)
    try {
      const result = await fetchQuotes(state.instruments)
      if (result.updates.length === 0) {
        notify('Keine Kurse erhalten – Symbole prüfen.', 'error')
        return
      }
      setState((s) => {
        const updated = s.instruments.map((inst) => {
          const u = result.updates.find((x) => x.instrumentId === inst.id)
          return u
            ? {
                ...inst,
                price: u.priceEur,
                dayChangePct: u.dayChangePct,
                priceUpdatedAt: new Date().toISOString(),
              }
            : inst
        })
        // Depot-Schnappschuss mit den frischen Kursen festhalten
        const sum = computePortfolio(updated, s.transactions)
        const today = todayIso()
        const snapshots = [
          ...s.snapshots.filter((x) => x.date !== today),
          { date: today, totalValue: Math.round(sum.value), invested: Math.round(sum.invested) },
        ].sort((a, b) => a.date.localeCompare(b.date))
        return { ...s, instruments: updated, snapshots }
      })
      notify(
        result.failed.length > 0
          ? `${result.updates.length} Kurse aktualisiert · ohne Kurs: ${result.failed.join(', ')}`
          : `${result.updates.length} Kurse aktualisiert (in EUR umgerechnet).`,
      )
    } catch {
      notify(
        'Live-Kurse nicht erreichbar. Im Vercel-Deployment verfügbar – bis dahin Kurse manuell pflegen.',
        'error',
      )
    } finally {
      setQuotesLoading(false)
    }
  }, [state.instruments, notify])

  const importState = useCallback(
    (next: CockpitState) => {
      setState(next)
      notify('Backup importiert.')
    },
    [notify],
  )

  const clearDemo = useCallback(() => {
    setState((s) => withoutDemoData(s))
    notify('Demo-Portfolio entfernt – Kennzahlen-Bibliothek bleibt erhalten.')
  }, [notify])

  const resetDemo = useCallback(() => {
    setState(resetToSeed())
    notify('Demo-Daten neu geladen.')
  }, [notify])

  const value: CockpitContextValue = {
    state,
    summary,
    toasts,
    quotesLoading,
    notify,
    addTransaction,
    deleteTransaction,
    upsertInstrument,
    deleteInstrument,
    addPlan,
    updatePlan,
    deletePlan,
    toggleWatch,
    updateSettings,
    refreshQuotes,
    importState,
    clearDemo,
    resetDemo,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
