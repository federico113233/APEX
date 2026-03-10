import { NavLink } from 'react-router-dom'
import { useUser } from '../context/UserContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/dashboard/discover', label: 'Discover', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { to: '/dashboard/tailoring-lab', label: 'Tailoring Lab', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', badge: 'drafts' },
  { to: '/dashboard/tracker', label: 'Tracker', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/dashboard/profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

function Sidebar() {
  const { user, session, signOut, drafts } = useUser()

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const email = session?.user?.email || ''
  const draftCount = drafts?.length ?? 0

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-white border-r border-slate-100" style={{ minHeight: '100vh' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <img src="/apex_full_logo.png" alt="APEX" className="h-8 w-auto object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, label, icon, badge }, i) => {
          const badgeCount = badge === 'drafts' ? draftCount : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={i === 0}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-600"
                      style={{ left: '-4px' }}
                    />
                  )}
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.2 : 1.8} d={icon} />
                  </svg>
                  <span className="flex-1">{label}</span>
                  {badgeCount > 0 && (
                    <span
                      className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* User + actions */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-1">
        {(user.name || email) && (
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              {user.name && <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>}
              {email && <p className="text-xs text-slate-400 truncate">{email}</p>}
            </div>
          </div>
        )}

        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </NavLink>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>

        <div className="flex justify-center pt-3">
          <img
            src="/apex_x_blue.png"
            alt=""
            aria-hidden="true"
            className="w-6 h-6 object-contain"
            style={{ opacity: 0.35 }}
          />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
