import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReloadPrompt from './components/ReloadPrompt'
import DatabaseErrorBoundary from './components/DatabaseErrorBoundary'
import OfflineIndicator from './components/OfflineIndicator'
import RootApp from './components/RootApp'
import { initAnalytics } from './lib/analytics'

initAnalytics()

const inner = (
  <DatabaseErrorBoundary>
    <ReloadPrompt />
    <RootApp />
    <OfflineIndicator />
  </DatabaseErrorBoundary>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {inner}
  </StrictMode>
)
