import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './context/UserContext'
import posthog from 'posthog-js'

posthog.init('phc_ON0cgJjdj5uXmyts3oUvvyQrbsx1QSejr8TaxIHLLEP', {
  api_host: 'https://eu.i.posthog.com',
  person_profiles: 'identified_only',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </StrictMode>,
)
