import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import AlexChat from './AlexChat'

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-apex-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <AlexChat />
    </div>
  )
}

export default DashboardLayout
