// App-Shell des Invest-Cockpits: Sidebar mit Sektionen (Desktop) /
// Bottom-Tabs + „Mehr“-Menü (Mobil), Kopfzeile mit Live-Kurs-Update,
// Toasts und Screen-Routing.

import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { DcfScreen } from './components/DcfScreen'
import { DividendsScreen } from './components/DividendsScreen'
import { PortfolioScreen } from './components/PortfolioScreen'
import { PromptsScreen } from './components/PromptsScreen'
import { RebalanceScreen } from './components/RebalanceScreen'
import { RiskScreen } from './components/RiskScreen'
import { ScreenerScreen } from './components/ScreenerScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { TaxScreen } from './components/TaxScreen'
import { CockpitProvider, useCockpit } from './state'

type Tab =
  | 'cockpit'
  | 'portfolio'
  | 'screener'
  | 'dcf'
  | 'risiko'
  | 'dividenden'
  | 'rebalancing'
  | 'steuer'
  | 'research'
  | 'settings'

interface TabDef {
  id: Tab
  label: string
  icon: string
}

const SECTIONS: { title: string; tabs: TabDef[] }[] = [
  {
    title: 'Übersicht',
    tabs: [
      { id: 'cockpit', label: 'Cockpit', icon: '◆' },
      { id: 'portfolio', label: 'Portfolio', icon: '▤' },
    ],
  },
  {
    title: 'Analyse',
    tabs: [
      { id: 'screener', label: 'Screener', icon: '⌕' },
      { id: 'dcf', label: 'DCF', icon: '∑' },
      { id: 'risiko', label: 'Risiko', icon: '⛨' },
    ],
  },
  {
    title: 'Planung',
    tabs: [
      { id: 'dividenden', label: 'Dividenden', icon: '💶' },
      { id: 'rebalancing', label: 'Rebalancing', icon: '⚖' },
      { id: 'steuer', label: 'Steuer', icon: '§' },
    ],
  },
  {
    title: 'Mehr',
    tabs: [
      { id: 'research', label: 'Research', icon: '✦' },
      { id: 'settings', label: 'Einstellungen', icon: '⚙' },
    ],
  },
]

const ALL_TABS = SECTIONS.flatMap((s) => s.tabs)
const MOBILE_MAIN: Tab[] = ['cockpit', 'portfolio', 'screener', 'dividenden']

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--color-raised)" />
        <path
          d="M10 44 L24 30 L33 37 L52 17"
          fill="none"
          stroke="var(--color-aurum)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M42 16 L53 16 L53 27" fill="none" stroke="var(--color-aurum)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="44" r="4" fill="var(--color-gain)" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-wide text-ink">
          Invest-<span className="text-aurum">Cockpit</span>
        </div>
        <div className="text-[10px] text-ink-mute">Screener · Portfolio · Analyse</div>
      </div>
    </div>
  )
}

function Shell() {
  const { toasts, quotesLoading, refreshQuotes } = useCockpit()
  const [tab, setTab] = useState<Tab>('cockpit')
  const [dcfInstrumentId, setDcfInstrumentId] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const openDcf = (id: string) => {
    setDcfInstrumentId(id)
    setTab('dcf')
  }
  const go = (t: Tab) => {
    setTab(t)
    setMoreOpen(false)
  }

  const activeLabel = ALL_TABS.find((t) => t.id === tab)?.label

  return (
    <div className="min-h-dvh bg-abyss lg:pl-56">
      {/* Sidebar (Desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col overflow-y-auto border-r border-edge bg-card p-4 lg:flex">
        <Logo />
        <nav className="mt-6 flex flex-col gap-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
                {section.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => go(t.id)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      tab === t.id
                        ? 'bg-aurum/12 font-semibold text-aurum'
                        : 'text-ink-soft hover:bg-raised hover:text-ink'
                    }`}
                  >
                    <span className="w-4 text-center text-xs">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto space-y-2 pt-4 text-[10px] leading-relaxed text-ink-mute">
          <p>Alle Daten lokal im Browser. Kennzahlen = Beispieldaten, editierbar.</p>
          <p>Keine Anlage- oder Steuerberatung.</p>
        </div>
      </aside>

      {/* Kopfzeile */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-edge bg-abyss/90 px-4 py-3 backdrop-blur lg:px-6">
        <div className="lg:hidden">
          <Logo />
        </div>
        <h1 className="hidden text-sm font-semibold text-ink-soft lg:block">{activeLabel}</h1>
        <button
          onClick={() => void refreshQuotes()}
          disabled={quotesLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-edge bg-raised px-3 py-1.5 text-xs font-medium text-ink hover:border-aurum/50 disabled:opacity-50"
          title="Live-Kurse holen (im Vercel-Deployment) und in EUR umrechnen"
        >
          <span className={quotesLoading ? 'inline-block animate-spin' : ''}>⟳</span>
          {quotesLoading ? 'Aktualisiere…' : 'Kurse aktualisieren'}
        </button>
      </header>

      {/* Inhalt */}
      <main className="fade-in mx-auto w-full max-w-6xl px-4 pb-24 pt-4 lg:px-6 lg:pb-8" key={tab}>
        {tab === 'cockpit' && <Dashboard onNavigate={(t) => go(t as Tab)} />}
        {tab === 'portfolio' && <PortfolioScreen />}
        {tab === 'screener' && <ScreenerScreen onOpenDcf={openDcf} />}
        {tab === 'dcf' && <DcfScreen instrumentId={dcfInstrumentId} onSelect={setDcfInstrumentId} />}
        {tab === 'risiko' && <RiskScreen />}
        {tab === 'dividenden' && <DividendsScreen />}
        {tab === 'rebalancing' && <RebalanceScreen />}
        {tab === 'steuer' && <TaxScreen />}
        {tab === 'research' && <PromptsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      {/* Bottom-Tabs (Mobil): 4 Haupt-Tabs + „Mehr“ */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-edge bg-card/95 px-1 py-1.5 backdrop-blur lg:hidden">
        {MOBILE_MAIN.map((id) => {
          const t = ALL_TABS.find((x) => x.id === id)!
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] ${
                tab === t.id && !moreOpen ? 'font-semibold text-aurum' : 'text-ink-mute'
              }`}
            >
              <span className="text-sm leading-none">{t.icon}</span>
              {t.label}
            </button>
          )
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] ${
            moreOpen || !MOBILE_MAIN.includes(tab) ? 'font-semibold text-aurum' : 'text-ink-mute'
          }`}
        >
          <span className="text-sm leading-none">⋯</span>
          Mehr
        </button>
      </nav>

      {/* „Mehr“-Menü (Mobil) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-abyss/70 backdrop-blur-sm lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-3 bottom-16 rounded-2xl border border-edge bg-card p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {ALL_TABS.filter((t) => !MOBILE_MAIN.includes(t.id)).map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs ${
                    tab === t.id ? 'bg-aurum/12 font-semibold text-aurum' : 'bg-inset text-ink-soft'
                  }`}
                >
                  <span className="text-base leading-none">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`fade-in rounded-xl border px-4 py-2 text-sm shadow-xl ${
              t.tone === 'error'
                ? 'border-loss/40 bg-raised text-loss'
                : 'border-gain/40 bg-raised text-ink'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <CockpitProvider>
      <Shell />
    </CockpitProvider>
  )
}
