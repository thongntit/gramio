import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DatabaseErrorBoundary from './components/DatabaseErrorBoundary'
import RootApp from './components/RootApp'
import { initAnalytics } from './lib/analytics'

initAnalytics()

const inner = (
  <DatabaseErrorBoundary>
    <RootApp />
  </DatabaseErrorBoundary>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {inner}
  </StrictMode>
)
