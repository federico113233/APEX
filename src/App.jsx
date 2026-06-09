import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useUser } from './context/UserContext'
import DashboardLayout from './components/DashboardLayout'
import Landing from './pages/Landing'
import LoginRegister from './pages/LoginRegister'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Discover from './pages/Discover'
import TailoringLab from './pages/TailoringLab'
import Tracker from './pages/Tracker'
import Profile from './pages/Profile'
import Alex from './pages/Alex'
import InterviewStudio from './pages/InterviewStudio'

// ── Splash screen ─────────────────────────────────────────────────────────────
function SplashScreen() {
  const [fading, setFading] = useState(false)
  const [hidden, setHidden]  = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1500)
    const t2 = setTimeout(() => setHidden(true), 2050)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (hidden) return null

  return (
    <div
      className="fixed inset-0 bg-white flex items-center justify-center z-[9999]"
      style={{ transition: 'opacity 0.55s ease', opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'auto' }}
    >
      <img
        src="/apex_x_blue.png"
        alt="APEX"
        className="w-20 h-20 object-contain splash-logo-anim"
      />
    </div>
  )
}

// ── Spinner while Supabase resolves the session ───────────────────────────────
function AuthLoading() {
  return (
    <div className="min-h-dvh bg-apex-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-apex-blue/20 border-t-apex-blue animate-spin" />
        <p className="text-sm text-apex-muted font-medium">Loading…</p>
      </div>
    </div>
  )
}

// ── Redirect to /login if not authenticated ───────────────────────────────────
function RequireAuth({ children }) {
  const { session, sessionLoading } = useUser()
  if (sessionLoading) return <AuthLoading />
  if (!session) return <Navigate to="/login" replace />
  return children
}

// ── Redirect to /onboarding if authenticated but profile incomplete ───────────
function RequireOnboarded({ children }) {
  const { session, sessionLoading, user, profileLoaded } = useUser()
  // 1. Wait for session resolution first
  if (sessionLoading) return <AuthLoading />
  // 2. No session → send to login (also handles post-logout where profileLoaded=false)
  if (!session) return <Navigate to="/login" replace />
  // 3. Session exists but profile not yet loaded from Supabase — keep waiting.
  //    This prevents premature /onboarding redirects on new devices where
  //    localStorage has no onboarded flag and profile is still in-flight.
  if (!profileLoaded) return <AuthLoading />
  // 4. Profile loaded: check onboarding
  if (!user.onboarded) return <Navigate to="/onboarding" replace />
  return children
}

// ── Redirect already-authenticated users away from /login ────────────────────
function RedirectIfAuth({ children }) {
  const { session, sessionLoading } = useUser()
  if (sessionLoading) return <AuthLoading />
  if (session) return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  return (
    <>
      <SplashScreen />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={
            <RedirectIfAuth><LoginRegister /></RedirectIfAuth>
          } />

          {/* Authenticated — onboarding */}
          <Route path="/onboarding" element={
            <RequireAuth><Onboarding /></RequireAuth>
          } />

          {/* Authenticated + onboarded — dashboard */}
          <Route path="/dashboard" element={
            <RequireOnboarded><DashboardLayout /></RequireOnboarded>
          }>
            <Route index element={<Dashboard />} />
            <Route path="discover" element={<Discover />} />{/* Sidebar label: "My Jobs" */}
            <Route path="tailoring-lab" element={<TailoringLab />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="interview-studio" element={<InterviewStudio />} />
            <Route path="alex" element={<Alex />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
