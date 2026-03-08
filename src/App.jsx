import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import Landing from './pages/Landing'
import LoginRegister from './pages/LoginRegister'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Discover from './pages/Discover'
import TailoringLab from './pages/TailoringLab'
import Tracker from './pages/Tracker'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginRegister />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="discover" element={<Discover />} />
          <Route path="tailoring-lab" element={<TailoringLab />} />
          <Route path="tracker" element={<Tracker />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
