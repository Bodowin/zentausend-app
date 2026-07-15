import { Component, type ErrorInfo, type ReactNode } from 'react'
import { recordRuntimeDiagnostic, runtimeDiagnosticSummary } from '../lib/runtimeDiagnostics'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  copied: boolean
}

async function copySummary(): Promise<boolean> {
  const summary = runtimeDiagnosticSummary()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary)
      return true
    }
  } catch {
    /* fallback below */
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = summary
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch {
    return false
  }
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordRuntimeDiagnostic('render', `${error.name}: ${error.message} · ${info.componentStack || 'ohne Komponentenpfad'}`)
  }

  private reload = () => {
    window.location.reload()
  }

  private copy = async () => {
    this.setState({ copied: await copySummary() })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 px-5 py-10 text-fog-100">
        <section className="w-full max-w-md rounded-3xl border border-coral-500/40 bg-ink-900 p-6 text-center shadow-2xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-coral-500/15 text-2xl">!</div>
          <h1 className="mt-4 font-display text-2xl font-black">Die App hat sich verschluckt</h1>
          <p className="mt-3 text-sm leading-relaxed text-fog-400">
            Dein laufendes Spiel und die lokalen Sicherungen werden dadurch nicht gelöscht. Lade die App neu und setze das Spiel fort.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 w-full rounded-2xl bg-gradient-to-b from-gold-400 to-gold-500 py-3.5 font-black text-ink-950"
          >
            App neu laden
          </button>
          <button
            type="button"
            onClick={() => void this.copy()}
            className="mt-2 w-full rounded-2xl border border-ink-700 bg-ink-850 py-3 text-sm font-bold text-fog-300"
          >
            {this.state.copied ? 'Diagnose kopiert ✓' : 'Diagnose kopieren'}
          </button>
          <p className="mt-4 text-[10px] text-fog-600">Version {__BUILD_TIME__}</p>
        </section>
      </main>
    )
  }
}
