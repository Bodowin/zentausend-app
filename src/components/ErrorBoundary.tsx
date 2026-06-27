import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (message: string) => void
}

/** Fängt Render-/Effekt-Fehler (z. B. WebGL/3D) ab, statt die App zu killen. */
export class ErrorBoundary extends Component<Props, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error instanceof Error ? error.message : String(error))
  }

  render() {
    if (this.state.error !== null) {
      return (
        this.props.fallback ?? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <div className="mb-2 text-sm font-bold text-coral-400">3D nicht verfügbar</div>
              <div className="break-words text-[11px] leading-relaxed text-fog-400">{this.state.error}</div>
              <div className="mt-2 text-[10px] text-fog-600">
                (Bitte Screenshot schicken. „Überspringen" → Spiel läuft normal weiter.)
              </div>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
