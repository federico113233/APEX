import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useUser } from '../context/UserContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/dashboard/discover', label: 'My Jobs', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { to: '/dashboard/tailoring-lab', label: 'Tailoring Lab', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', badge: 'drafts' },
  { to: '/dashboard/tracker', label: 'Tracker', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/dashboard/alex', label: 'Alex', icon: null, isAlex: true },
  { to: '/dashboard/profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

function Sidebar() {
  const { user, session, signOut, drafts } = useUser()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('apex_sidebar_collapsed') === 'true'
  )

  const toggle = () => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('apex_sidebar_collapsed', String(next))
      return next
    })
  }

  const initials = user.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const email = session?.user?.email || ''
  const draftCount = drafts?.length ?? 0

  const W = collapsed ? 64 : 240

  return (
    <aside
      style={{
        width: W,
        minWidth: W,
        transition: 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
        minHeight: '100dvh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRight: '1px solid #F1F5F9',
      }}
    >
      {/* Logo + toggle */}
      <div
        style={{
          padding: collapsed ? '16px 0 12px' : '0 16px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
          height: 68,
          gap: collapsed ? 6 : 0,
        }}
      >
        {collapsed ? (
          <>
            <a href="/" onClick={(e) => { e.preventDefault(); window.location.href = '/'; }} style={{ cursor: 'pointer', lineHeight: 0 }}>
              <img src="/apex_x_blue.png" alt="APEX" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            </a>
            <ToggleButton collapsed={collapsed} onClick={toggle} />
          </>
        ) : (
          <>
            <a href="/" onClick={(e) => { e.preventDefault(); window.location.href = '/'; }} style={{ cursor: 'pointer', lineHeight: 0 }}>
              <img src="/apex_full_logo.png" alt="APEX" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            </a>
            <ToggleButton collapsed={collapsed} onClick={toggle} />
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ to, label, icon, badge, isAlex }, i) => {
          const badgeCount = badge === 'drafts' ? draftCount : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={i === 0}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
                position: 'relative',
                background: isActive ? '#EFF6FF' : 'transparent',
                color: isActive ? (isAlex ? 'transparent' : '#2563EB') : '#64748B',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && !collapsed && (
                    <span
                      style={{
                        position: 'absolute',
                        left: -4,
                        top: 4,
                        bottom: 4,
                        width: 2,
                        borderRadius: 999,
                        background: '#2563EB',
                      }}
                    />
                  )}

                  {isAlex ? (
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        flexShrink: 0,
                        background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isActive
                          ? '0 2px 6px rgba(37,99,235,0.4)'
                          : '0 1px 4px rgba(37,99,235,0.25)',
                      }}
                    >
                      <img
                        src="/apex_x_blue.png"
                        alt=""
                        style={{
                          width: 12,
                          height: 12,
                          objectFit: 'contain',
                          filter: 'brightness(0) invert(1)',
                        }}
                      />
                    </span>
                  ) : (
                    <svg
                      style={{ width: 16, height: 16, flexShrink: 0 }}
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

                  {!collapsed && (
                    <>
                      <span
                        style={
                          isAlex
                            ? {
                                flex: 1,
                                fontWeight: isActive ? 700 : 600,
                                background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                              }
                            : { flex: 1, fontWeight: isActive ? 600 : 500 }
                        }
                      >
                        {label}
                      </span>
                      {badgeCount > 0 && (
                        <span
                          style={{
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 18,
                            height: 18,
                            padding: '0 4px',
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#fff',
                            background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                          }}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </>
                  )}

                  {collapsed && badgeCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 7,
                        right: 9,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#2563EB',
                        border: '1.5px solid #fff',
                      }}
                    />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div
        style={{
          padding: collapsed ? '12px 8px' : '12px 8px',
          borderTop: '1px solid #F1F5F9',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Avatar / user info */}
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 6px' }}>
            <div
              title={user.name || email}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
          </div>
        ) : (
          (user.name || email) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 8px' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                {user.name && (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </p>
                )}
                {email && (
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </p>
                )}
              </div>
            </div>
          )
        )}

        {/* Action links — icon-only when collapsed */}
        <SidebarAction
          collapsed={collapsed}
          label="Back to Home"
          href="/"
          iconPath="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
        <SidebarAction
          collapsed={collapsed}
          label="Sign out"
          onClick={signOut}
          iconPath="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          danger
        />

      </div>
    </aside>
  )
}

function ToggleButton({ collapsed, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6,
        border: 'none', background: 'none',
        cursor: 'pointer', flexShrink: 0,
        color: hov ? '#475569' : '#94A3B8',
        transition: 'color 0.15s',
      }}
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
      </svg>
    </button>
  )
}

function SidebarAction({ collapsed, label, href, onClick, iconPath, danger }) {
  const [hovered, setHovered] = useState(false)

  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 10,
    padding: collapsed ? '8px 0' : '7px 10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.15s, color 0.15s',
    background: hovered ? (danger ? '#FEF2F2' : '#F8FAFC') : 'transparent',
    color: hovered ? (danger ? '#EF4444' : '#475569') : '#94A3B8',
  }

  const icon = (
    <svg style={{ width: 15, height: 15, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={iconPath} />
    </svg>
  )

  const content = (
    <>
      {icon}
      {!collapsed && <span>{label}</span>}
    </>
  )

  const events = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }

  if (href) {
    return (
      <a href={href} style={baseStyle} title={collapsed ? label : undefined} {...events}>
        {content}
      </a>
    )
  }

  return (
    <button onClick={onClick} style={baseStyle} title={collapsed ? label : undefined} {...events}>
      {content}
    </button>
  )
}

export default Sidebar
