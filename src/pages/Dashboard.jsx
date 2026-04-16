import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

const ALEX_MESSAGES = [
  "62% of students spend 30+ minutes on one application. Let's fix that.",
  "Most candidates apply and hope. You prepare and win.",
  "Your next career move starts with the right words.",
  "Recruiters spend 6 seconds on a CV. Make every one count.",
  "Not automation. Amplification. There's a difference.",
  "Your experience is real. Let's make sure they see it.",
  "The job you want is one good application away.",
  "97% of students want AI help with applications. The other 3% haven't tried yet.",
  "Career advice that doesn't sound like LinkedIn.",
  "I've read your CV. I have thoughts. Good ones.",
]

const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
const todayAlexMessage = ALEX_MESSAGES[dayOfYear % ALEX_MESSAGES.length]

const STATUS_STYLE = {
  Applied:   { background: '#EFF6FF', color: '#2563EB' },
  Interview: { background: '#FFFBEB', color: '#D97706' },
  Offer:     { background: '#F0FDF4', color: '#16A34A' },
  Rejected:  { background: '#FEF2F2', color: '#DC2626' },
}

const QUICK_ACTIONS = [
  {
    to: '/dashboard/discover',
    label: 'My Jobs',
    desc: 'Your job inbox',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    to: '/dashboard/tailoring-lab',
    label: 'Tailoring Lab',
    desc: 'CV & cover letter',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  },
  {
    to: '/dashboard/tracker',
    label: 'Tracker',
    desc: 'All applications',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
]

// ── Small reusable QuickActionCard ────────────────────────────────────────────
function QuickActionCard({ to, label, desc, icon }) {
  const [hov, setHov] = useState(false)
  return (
    <Link
      to={to}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: '#fff',
        borderRadius: 10,
        border: `1.5px solid ${hov ? '#BFDBFE' : '#E2E8F0'}`,
        boxShadow: hov ? '0 4px 16px rgba(37,99,235,0.08)' : '0 1px 3px rgba(15,23,42,0.04)',
        textDecoration: 'none',
        transition: 'all 0.18s',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: hov ? '#EFF6FF' : '#F8FAFC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.18s',
      }}>
        <svg width="16" height="16" fill="none" stroke={hov ? '#2563EB' : '#64748B'} viewBox="0 0 24 24" style={{ transition: 'stroke 0.18s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d={icon} />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{label}</p>
        <p style={{ margin: '1px 0 0', fontSize: 12, color: '#94A3B8' }}>{desc}</p>
      </div>
      <svg width="13" height="13" fill="none" stroke={hov ? '#2563EB' : '#CBD5E1'} viewBox="0 0 24 24" style={{ flexShrink: 0, transition: 'stroke 0.18s' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, applications, drafts } = useUser()
  const navigate = useNavigate()

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName  = user.name?.split(' ')[0] || ''
  const interviews = applications.filter(a => a.status === 'Interview').length
  const offers     = applications.filter(a => a.status === 'Offer').length
  const draftCount = drafts?.length ?? 0

  const heroSubtitle =
    interviews > 0
      ? `You have ${interviews} interview${interviews > 1 ? 's' : ''} scheduled. Here's your overview.`
      : offers > 0
      ? `You have ${offers} offer${offers > 1 ? 's' : ''} — congratulations. Here's your overview.`
      : applications.length > 0
      ? `You have ${applications.length} active application${applications.length !== 1 ? 's' : ''}. Keep the momentum going.`
      : 'Welcome to APEX. Start exploring opportunities below.'

  const statsLine = [
    `${applications.length} application${applications.length !== 1 ? 's' : ''}`,
    `${interviews} interview${interviews !== 1 ? 's' : ''}`,
    `${draftCount} draft${draftCount !== 1 ? 's' : ''}`,
  ].join(' · ')

  // Alex card message
  const [alexHov, setAlexHov] = useState(false)

  // Fade-in animation trigger
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 40)
    return () => clearTimeout(t)
  }, [])

  const fadeStyle = (delay = 0) => ({
    opacity:   ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  return (
    <>
      <div style={{ background: '#F8FAFC', minHeight: '100dvh' }}>

        {/* ── HERO ── */}
        <div style={{
          background: '#0F172A',
          borderRadius: '0 0 28px 28px',
          paddingTop: isMobile ? '28px' : '44px',
          paddingBottom: isMobile ? '60px' : '80px',
          paddingLeft: isMobile ? 'max(16px, env(safe-area-inset-left))' : '40px',
          paddingRight: isMobile ? 'max(16px, env(safe-area-inset-right))' : '40px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Watermark */}
          <img
            src="/apex_x_blue.png"
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 32,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 200,
              height: 200,
              objectFit: 'contain',
              opacity: 0.06,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />

          <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', ...fadeStyle(0) }}>
            <h1 style={{
              margin: 0,
              fontSize: isMobile ? 28 : 36,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}>
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p style={{
              margin: '10px 0 0',
              fontSize: 15,
              color: '#94A3B8',
              lineHeight: 1.5,
            }}>
              {heroSubtitle}
            </p>
            <p style={{
              margin: '10px 0 0',
              fontSize: 13,
              color: 'rgba(255,255,255,0.58)',
              letterSpacing: '0.01em',
            }}>
              {statsLine}
            </p>
          </div>
        </div>

        {/* ── CONTENT — overlaps hero ── */}
        <div style={{
          maxWidth: 1100,
          margin: '-40px auto 0',
          padding: isMobile ? '0 16px 48px' : '0 32px 48px',
          position: 'relative',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: isMobile ? 'stretch' : 'flex-start' }}>

            {/* ── LEFT COLUMN (58%) ── */}
            <div style={{ flex: isMobile ? 'none' : '0 0 58%', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Alex Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate('/dashboard/alex')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/dashboard/alex') } }}
                onMouseEnter={() => setAlexHov(true)}
                onMouseLeave={() => setAlexHov(false)}
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #38BDF8 100%)',
                  borderRadius: 16,
                  padding: 28,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: alexHov
                    ? '0 20px 48px rgba(37,99,235,0.38)'
                    : '0 10px 32px rgba(37,99,235,0.24)',
                  transform: alexHov ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  ...fadeStyle(80),
                }}
              >
                {/* Watermark */}
                <img
                  src="/apex_x_blue.png"
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    right: 20,
                    bottom: -10,
                    height: 88,
                    width: 88,
                    objectFit: 'contain',
                    opacity: 0.12,
                    pointerEvents: 'none',
                  }}
                />

                {/* Label */}
                <p style={{
                  margin: '0 0 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.65)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Alex · AI Career Advisor
                </p>

                {/* Message */}
                <div style={{ marginBottom: 22 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 15.5,
                    fontWeight: 500,
                    color: '#fff',
                    lineHeight: 1.55,
                    letterSpacing: '-0.005em',
                  }}>
                    {todayAlexMessage}
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 18px',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#2563EB',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.92' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  onClick={e => { e.stopPropagation(); navigate('/dashboard/alex') }}
                >
                  Talk to Alex
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Quick Actions */}
              <div style={fadeStyle(160)}>
                <p style={{
                  margin: '0 0 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Quick actions
                </p>
                <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 10 } : { display: 'flex', gap: 10 }}>
                  {QUICK_ACTIONS.map(qa => (
                    <QuickActionCard key={qa.to} {...qa} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (42%) ── */}
            <div style={{ flex: isMobile ? 'none' : 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Applications */}
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #E8EDF2',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
                ...fadeStyle(120),
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px 14px',
                  borderBottom: applications.length > 0 ? '1px solid #F1F5F9' : 'none',
                }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Applications</p>
                  <Link
                    to="/dashboard/tracker"
                    style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    View all
                    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                {applications.length === 0 ? (
                  <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>Your tracker is empty — find your first opportunity.</p>
                    <Link
                      to="/dashboard/discover"
                      style={{ display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}
                    >
                      Browse My Jobs →
                    </Link>
                  </div>
                ) : (
                  applications.slice(0, 4).map((app, i) => (
                    <AppRow
                      key={app.id}
                      app={app}
                      divider={i < Math.min(applications.length, 4) - 1}
                    />
                  ))
                )}
              </div>

              {/* Active Drafts */}
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #E8EDF2',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
                ...fadeStyle(200),
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px 14px',
                  borderBottom: draftCount > 0 ? '1px solid #F1F5F9' : 'none',
                }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>In progress</p>
                  <Link
                    to="/dashboard/tailoring-lab"
                    style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    Open Lab
                    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                {draftCount === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>Pick a job and let Alex tailor your CV.</p>
                    <Link to="/dashboard/discover" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>Find a job to tailor →</Link>
                  </div>
                ) : (
                  drafts.slice(0, 3).map((draft, i) => (
                    <DraftRow
                      key={draft.id}
                      draft={draft}
                      divider={i < Math.min(draftCount, 3) - 1}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Application row ───────────────────────────────────────────────────────────
function AppRow({ app, divider }) {
  const [hov, setHov] = useState(false)
  const badge = STATUS_STYLE[app.status] || STATUS_STYLE.Applied

  return (
    <Link
      to="/dashboard/tracker"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        width: '100%',
        boxSizing: 'border-box',
        background: hov ? '#FAFBFC' : 'transparent',
        borderBottom: divider ? '1px solid #F8FAFC' : 'none',
        textDecoration: 'none',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {app.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {app.company}
          {app.appliedDate ? ` · ${app.appliedDate}` : ''}
        </p>
      </div>
      <span style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        ...badge,
      }}>
        {app.status}
      </span>
    </Link>
  )
}

// ── Draft row ─────────────────────────────────────────────────────────────────
function DraftRow({ draft, divider }) {
  const [hov, setHov] = useState(false)

  return (
    <Link
      to="/dashboard/tailoring-lab"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: hov ? '#FAFBFC' : 'transparent',
        borderBottom: divider ? '1px solid #F8FAFC' : 'none',
        textDecoration: 'none',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {draft.job_title || 'Untitled draft'}
        </p>
        {draft.company && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.company}
          </p>
        )}
      </div>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 12,
        fontWeight: 600,
        color: hov ? '#2563EB' : '#94A3B8',
        transition: 'color 0.15s',
        flexShrink: 0,
      }}>
        Continue
        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  )
}
