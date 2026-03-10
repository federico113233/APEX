import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer, PageNumber,
} from 'docx'
import { useUser } from '../context/UserContext'

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

const STATUS_STYLES = {
  Applied:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  Interview: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  Offer:     { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  Rejected:  { bg: 'bg-slate-100', text: 'text-slate-500',  dot: 'bg-slate-400'  },
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderInline(text) {
  // bold+italic, bold, italic
  const parts = []
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}><em>{m[2]}</em></strong>)
    else if (m[3]) parts.push(<strong key={m.index}>{m[3]}</strong>)
    else if (m[4]) parts.push(<em key={m.index}>{m[4]}</em>)
    else if (m[5]) parts.push(<code key={m.index} className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{m[5]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? text : parts
}

function MarkdownContent({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-4 border-slate-200" />)
      i++; continue
    }

    // Headings
    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h1) {
      elements.push(<h1 key={i} className="text-lg font-bold text-slate-900 mt-5 mb-2">{renderInline(h1[1])}</h1>)
      i++; continue
    }
    if (h2) {
      elements.push(<h2 key={i} className="text-base font-bold text-slate-800 mt-4 mb-1.5">{renderInline(h2[1])}</h2>)
      i++; continue
    }
    if (h3) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-slate-700 mt-3 mb-1 uppercase tracking-wide">{renderInline(h3[1])}</h3>)
      i++; continue
    }

    // Bullet list — collect consecutive items
    if (/^[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(<li key={i} className="text-sm text-slate-700 leading-relaxed">{renderInline(lines[i].replace(/^[-*]\s+/, ''))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-2 pl-1">{items}</ul>)
      continue
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(<li key={i} className="text-sm text-slate-700 leading-relaxed">{renderInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-2 pl-1">{items}</ol>)
      continue
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
      i++; continue
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-sm text-slate-700 leading-relaxed">{renderInline(line)}</p>
    )
    i++
  }

  return <div className="py-5 px-6 space-y-0.5">{elements}</div>
}

// ── Match score badge ─────────────────────────────────────────────────────────
function MatchScoreBadge({ score }) {
  if (!score && score !== 0) return null
  const n = Number(score)
  let cls = 'bg-slate-100 text-slate-500'
  if (n >= 80) cls = 'bg-green-50 text-green-700 ring-1 ring-green-200'
  else if (n >= 60) cls = 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {n}% match
    </span>
  )
}

// ── docx helpers ──────────────────────────────────────────────────────────────
function textToParagraphs(text) {
  return text.split('\n').map((line) =>
    new Paragraph({
      children: [new TextRun({ text: line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'), size: 22, font: 'Calibri' })],
      spacing: { after: 120 },
    })
  )
}

async function downloadDocx(text, filename, isCV = false) {
  const paragraphs = textToParagraphs(text)
  const margin = { top: 1417, right: 1417, bottom: 1417, left: 1417 }
  const sections = [{
    properties: { page: { margin } },
    children: paragraphs,
    ...(isCV ? {
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Calibri', color: '888888' })],
          })],
        }),
      },
    } : {}),
  }]
  const doc = new Document({ sections })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ app, onClose, onStatusChange, onNotesChange, onDelete }) {
  const [visible, setVisible]             = useState(false)
  const [activeTab, setActiveTab]         = useState(app.tailoredCv ? 'cv' : app.coverLetter ? 'cover' : 'notes')
  const [notes, setNotes]                 = useState(app.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingNotes, setSavingNotes]     = useState(false)
  const [downloading, setDownloading]     = useState(null)
  const notesTimerRef                     = useRef(null)
  const st = STATUS_STYLES[app.status] || STATUS_STYLES.Applied
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleNotesChange = (val) => {
    setNotes(val)
    clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(async () => {
      setSavingNotes(true)
      await onNotesChange(app.id, val)
      setSavingNotes(false)
    }, 1000)
  }

  useEffect(() => () => clearTimeout(notesTimerRef.current), [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const handleDownload = async (type) => {
    const text = type === 'cv' ? app.tailoredCv : app.coverLetter
    if (!text) return
    setDownloading(type)
    const label   = type === 'cv' ? 'CV' : 'CoverLetter'
    const company = (app.company || 'Application').replace(/\s+/g, '_')
    await downloadDocx(text, `${label}_${company}.docx`, type === 'cv')
    setDownloading(null)
  }

  const tabs = [
    { key: 'cv',    label: 'Tailored CV' },
    { key: 'cover', label: 'Cover Letter' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 40, transition: 'background 0.28s', background: visible ? 'rgba(15,23,42,0.28)' : 'transparent' }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: isMobile ? '100vw' : 500,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          boxShadow: '-4px 0 40px rgba(15,23,42,0.12)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {app.title}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
                {[app.company, app.location].filter(Boolean).join(' · ')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Applied {app.appliedDate}
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status + match */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <select
              value={app.status}
              onChange={(e) => onStatusChange(app.id, e.target.value)}
              className={`${st.bg} ${st.text}`}
              style={{ border: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {app.matchScore > 0 && <MatchScoreBadge score={app.matchScore} />}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '12px 20px',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                borderBottom: activeTab === key ? '2px solid #2563eb' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === key ? '#2563eb' : '#94a3b8',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* CV tab */}
          {activeTab === 'cv' && (
            app.tailoredCv ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
                  <MarkdownContent text={app.tailoredCv} />
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
                  <DownloadButton
                    label="Download Tailored CV .docx"
                    loading={downloading === 'cv'}
                    onClick={() => handleDownload('cv')}
                  />
                </div>
              </div>
            ) : (
              <EmptyTab
                icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                hint='No tailored CV saved. Use the Tailoring Lab and click "Add to Tracker".'
              />
            )
          )}

          {/* Cover Letter tab */}
          {activeTab === 'cover' && (
            app.coverLetter ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
                  <MarkdownContent text={app.coverLetter} />
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
                  <DownloadButton
                    label="Download Cover Letter .docx"
                    loading={downloading === 'cover'}
                    onClick={() => handleDownload('cover')}
                  />
                </div>
              </div>
            ) : (
              <EmptyTab
                icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                hint='No cover letter saved. Use the Tailoring Lab and click "Add to Tracker".'
              />
            )
          )}

          {/* Notes tab */}
          {activeTab === 'notes' && (
            <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, margin: '0 0 10px' }}>
                Personal notes — auto-saved as you type.
              </p>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder={'e.g. Interview on March 15 at 10:00\nContact: mario@company.com\nRequested: portfolio + GitHub'}
                style={{
                  flex: 1,
                  minHeight: 220,
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1.5px solid #e2e8f0',
                  fontSize: 14,
                  color: '#1e293b',
                  lineHeight: 1.65,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }}
              />
              {savingNotes && (
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #cbd5e1', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Saving…
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <p style={{ flex: 1, fontSize: 14, color: '#334155', margin: 0 }}>Remove this application?</p>
              <button
                onClick={() => onDelete(app.id)}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#fca5a5', fontSize: 13, cursor: 'pointer', padding: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#fca5a5' }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete application
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function DownloadButton({ label, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 18px',
        borderRadius: 10,
        border: 'none',
        background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      ) : (
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {label}
    </button>
  )
}

function EmptyTab({ icon, hint }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', minHeight: 280 }}>
      <svg width="44" height="44" fill="none" stroke="#e2e8f0" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
      <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 280, lineHeight: 1.5 }}>{hint}</p>
    </div>
  )
}

// ── Main Tracker ──────────────────────────────────────────────────────────────
function Tracker() {
  const { applications, updateStatus, updateApplicationNotes, deleteApplication } = useUser()
  const [selected, setSelected] = useState(null)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length
    return acc
  }, {})

  const handleDelete = async (appId) => {
    await deleteApplication(appId)
    setSelected(null)
  }

  const handleStatusChange = async (appId, status) => {
    await updateStatus(appId, status)
    setSelected((prev) => prev?.id === appId ? { ...prev, status } : prev)
  }

  const handleNotesChange = async (appId, notes) => {
    await updateApplicationNotes(appId, notes)
    setSelected((prev) => prev?.id === appId ? { ...prev, notes } : prev)
  }

  const statusDot = { Applied: 'bg-blue-500', Interview: 'bg-orange-500', Offer: 'bg-green-500', Rejected: 'bg-slate-400' }
  const statusStyle = { Applied: 'bg-blue-50 text-blue-700', Interview: 'bg-orange-50 text-orange-700', Offer: 'bg-green-50 text-green-700', Rejected: 'bg-slate-100 text-slate-500' }

  return (
    <>
      <div className="p-4 md:p-8 page-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Tracker</h1>
        <p className="text-slate-500 mt-1 text-sm">Monitor every application from submission to decision</p>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STATUSES.map((status) => (
          <div key={status} className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-sm transition-all duration-150">
            <div className={`w-2 h-2 rounded-full ${statusDot[status]} mb-3`} />
            <p className="text-3xl font-bold text-slate-900">{counts[status]}</p>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">{status}</p>
          </div>
        ))}
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-400 text-sm mb-4">No applications yet.</p>
          <Link
            to="/dashboard/discover"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-blue-600 to-sky-400 hover:opacity-95 transition-opacity text-sm"
          >
            Browse jobs in Discover →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Position</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Company</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Match</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-3.5 px-6" />
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setSelected(app)}
                  className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors duration-100 ${
                    selected?.id === app.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="py-4 px-6">
                    <span className="font-semibold text-slate-800 text-sm">{app.title}</span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500">{app.company}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[app.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot[app.status]}`} />
                      {app.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {app.matchScore > 0 && <MatchScoreBadge score={app.matchScore} />}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-400">{app.appliedDate}</td>
                  <td className="py-4 px-6 text-slate-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </div>

      {selected && (
        <DetailPanel
          key={selected.id}
          app={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}

export default Tracker
