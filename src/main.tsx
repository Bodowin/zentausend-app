import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import UpdatePrompt from './components/UpdatePrompt'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { ProductionGuard } from './components/ProductionGuard'
import { installRuntimeDiagnostics } from './lib/runtimeDiagnostics'

installRuntimeDiagnostics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <ProductionGuard />
      <UpdatePrompt />
    </AppErrorBoundary>
  </StrictMode>,
)
