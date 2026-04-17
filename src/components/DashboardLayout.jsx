import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useUser } from '../context/UserContext'

// ── Mobile top header ─────────────────────────────────────────────────────────
function MobileHeader() {
  const { user, session, signOut } = useUser()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const email = session?.user?.email ?? ''

  // Close dropdown on outside tap
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 flex items-center justify-between"
      style={{ height: 56, paddingLeft: 16, paddingRight: 16 }}
    >
      <a href="https://apexapply.app" target="_blank" rel="noopener noreferrer">
        <img src="/apex_full_logo.png" alt="APEX" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
      </a>

      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initials}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              top: 44,
              right: 0,
              minWidth: 200,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 50,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
              {user.name && (
                <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                  {user.name}
                </p>
              )}
              {email && (
                <p style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>
                  {email}
                </p>
              )}
            </div>
            <NavLink
              to="/dashboard/profile"
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: '#0f172a',
                textDecoration: 'none',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              Edit profile
            </NavLink>
            <button
              onClick={() => { setOpen(false); signOut() }}
              style={{
                width: '100%',
                padding: '10px 16px',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 500,
                color: '#dc2626',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    to: '/dashboard',
    end: true,
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    to: '/dashboard/discover',
    label: 'My Jobs',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    to: '/dashboard/tailoring-lab',
    label: 'Lab',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    badge: 'drafts',
  },
  {
    to: '/dashboard/tracker',
    label: 'Tracker',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    to: '/dashboard/alex',
    label: 'Alex',
    isAlex: true,
  },
]

function MobileBottomNav() {
  const { drafts } = useUser()
  const draftCount = drafts?.length ?? 0

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex items-stretch"
      style={{ height: 64, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(({ to, end, label, icon, badge, isAlex }) => {
        const count = badge === 'drafts' ? draftCount : 0
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 relative ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  {isAlex ? (
                    <img
                      src="/apex_x_blue.png"
                      alt=""
                      style={{
                        width: 20,
                        height: 20,
                        objectFit: 'contain',
                        filter: isActive
                          ? 'none'
                          : 'grayscale(100%) opacity(0.45)',
                        transition: 'filter 0.15s',
                      }}
                    />
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={isActive ? 2.2 : 1.8}
                        d={icon}
                      />
                    </svg>
                  )}
                  {count > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -6,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 999,
                        background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 3px',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, lineHeight: 1 }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
function DashboardLayout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-apex-bg">
      {/* Sidebar — desktop only */}
      <div className="hidden md:block flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile UI */}
      <MobileHeader />
      <MobileBottomNav />

    </div>
  )
}

export default DashboardLayout
