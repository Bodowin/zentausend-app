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
    if (this.state.error !== null) return this.props.fallback ?? null
    return this.props.children
  }
}
