import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import posthog from 'posthog-js'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer, PageNumber,
} from 'docx'
import { useUser } from '../context/UserContext'
import AddJobModal from '../components/AddJobModal'

// ─── State persistence ────────────────────────────────────────────────────────
const TRACKER_KEY = 'apex_tracker_state'

function loadTrackerState() {
  try { return JSON.parse(localStorage.getItem(TRACKER_KEY)) || null }
  catch { return null }
}

function saveTrackerState(patch) {
  try {
    const prev = JSON.parse(localStorage.getItem(TRACKER_KEY)) || {}
    localStorage.setItem(TRACKER_KEY, JSON.stringify({ ...prev, ...patch }))
  } catch { /* ignore storage errors */ }
}

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

const STATUS_COLORS = {
  Applied:   { bg: '#EFF6FF', text: '#2563EB', dot: '#2563EB' },
  Interview: { bg: '#FFFBEB', text: '#D97706', dot: '#D97706' },
  Offer:     { bg: '#F0FDF4', text: '#16A34A', dot: '#16A34A' },
  Rejected:  { bg: '#FEF2F2', text: '#DC2626', dot: '#DC2626' },
}

// kept for any legacy usage
const STATUS_STYLES = {
  Applied:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  Interview: { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  Offer:     { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  Rejected:  { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    },
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

// ── Manual badge ─────────────────────────────────────────────────────────────
function ManualBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: '#F1F5F9', color: '#64748B',
      fontSize: 12, fontWeight: 600, lineHeight: 1,
    }}>
      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      Manual
    </span>
  )
}

// ── Match score badge ─────────────────────────────────────────────────────────
function MatchScoreBadge({ score, format = 'percent' }) {
  if (!score && score !== 0) return null
  const raw = Number(score)
  // Normalize: old Adzuna scores are 0-100, new ones are 0-5 — convert both to 0-100
  const n = raw > 5 ? raw : Math.round(raw * 20)
  let cls = 'bg-slate-100 text-slate-500'
  if (n >= 80) cls = 'bg-green-50 text-green-700 ring-1 ring-green-200'
  else if (n >= 60) cls = 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  // score format: normalize to 0-5 for display
  const display = format === 'score'
    ? (raw > 5 ? Math.round((raw / 100) * 5 * 10) / 10 : raw).toFixed(1) + ' / 5'
    : n + '% match'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {display}
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

// ── Status badge (shared) ─────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Applied
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: c.bg, color: c.text,
      fontSize: 12, fontWeight: 600, lineHeight: 1,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  )
}

// ── Status dropdown (custom, always white) ────────────────────────────────────
function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (s) => { setOpen(false); onChange(s) }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8,
          border: '1.5px solid #E2E8F0', background: '#fff',
          cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#334155',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          borderColor: open ? '#93C5FD' : '#E2E8F0',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[value]?.dot || '#64748b', flexShrink: 0 }} />
        {value}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: '#94a3b8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: '#fff', border: '1.5px solid #E2E8F0',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
          zIndex: 60, minWidth: 140, overflow: 'hidden',
        }}>
          {STATUSES.map((s) => {
            const c = STATUS_COLORS[s]
            const active = s === value
            return (
              <button
                key={s}
                onClick={() => select(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 14px',
                  border: 'none', background: active ? '#F8FAFC' : '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? c.text : '#334155',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = '#fff' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                {s}
                {active && (
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style={{ marginLeft: 'auto', color: c.dot }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Google Calendar helpers ────────────────────────────────────────────────────
function buildGCalUrl({ title, date, startTime, endTime, notes, location }) {
  const toGCalDate = (d, t) => {
    // d = 'YYYY-MM-DD', t = 'HH:MM'  → 'YYYYMMDDTHHMMSS'
    return `${d.replace(/-/g, '')}T${t.replace(':', '')}00`
  }
  const start = toGCalDate(date, startTime)
  const end   = toGCalDate(date, endTime)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
  })
  if (notes)    params.set('details', notes)
  if (location) params.set('location', location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function CalendarModal({ app, onClose, onAdded }) {
  const [visible, setVisible] = useState(false)
  const isMobileModal = typeof window !== 'undefined' && window.innerWidth < 768
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]           = useState(today)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime]     = useState('11:00')
  const [notes, setNotes]         = useState('')
  const [location, setLocation]   = useState('')

  const title = `Interview - ${app.title} at ${app.company}`

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  const handleAdd = () => {
    const url = buildGCalUrl({ title, date, startTime, endTime, notes, location })
    window.open(url, '_blank', 'noopener,noreferrer')
    handleClose()
    onAdded()
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    background: '#fff',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const focusStyle = (e) => {
    e.target.style.borderColor = '#16a34a'
    e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.12)'
  }
  const blurStyle = (e) => {
    e.target.style.borderColor = '#e2e8f0'
    e.target.style.boxShadow = 'none'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: visible ? 'rgba(15,23,42,0.36)' : 'transparent',
          transition: 'background 0.22s',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: visible ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s',
          zIndex: 101,
          width: isMobileModal ? 'calc(100% - 32px)' : '100%',
          maxWidth: 460,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)',
          padding: isMobileModal ? '24px 20px 20px' : '28px 28px 24px',
          boxSizing: 'border-box',
          maxHeight: 'calc(100dvh - 80px)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #16a34a, #4ade80)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Add to Google Calendar</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Schedule your interview</p>
          </div>
        </div>

        {/* Pre-filled title (read-only display) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Title
          </label>
          <div style={{
            padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0',
            fontSize: 14, color: '#334155', background: '#f8fafc', fontWeight: 500,
          }}>
            {title}
          </div>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {/* Time row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Start time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              End time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
        </div>

        {/* Location */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Location / Link <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Zoom link or office address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notes <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(optional)</span>
          </label>
          <textarea
            placeholder="e.g. Prepare portfolio, research the company…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleAdd}
            style={{
              flex: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 20px',
              borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(22,163,74,0.3)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add to Google Calendar
          </button>
          <button
            onClick={handleClose}
            style={{
              padding: '11px 20px',
              borderRadius: 12, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

// ── "Job added" toast ─────────────────────────────────────────────────────────
function JobAddedToast({ onHide }) {
  const [visible, setVisible] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onHide, 320)
    }, 3500)
    return () => clearTimeout(t)
  }, [onHide])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? 88 : 28,
        left: '50%',
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s',
        zIndex: 200,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderRadius: 14,
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        boxShadow: '0 8px 32px rgba(37,99,235,0.18), 0 0 0 1px rgba(37,99,235,0.08)',
        fontSize: 14,
        fontWeight: 600,
        color: '#1d4ed8',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="18" height="18" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Job added successfully
    </div>
  )
}

// ── Toast notification ─────────────────────────────────────────────────────────
function CalendarToast({ onHide }) {
  const [visible, setVisible] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onHide, 320)
    }, 3500)
    return () => clearTimeout(t)
  }, [onHide])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? 88 : 28,
        left: '50%',
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s',
        zIndex: 200,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderRadius: 14,
        background: '#fff',
        border: '1.5px solid #bbf7d0',
        boxShadow: '0 8px 32px rgba(22,163,74,0.18), 0 0 0 1px rgba(22,163,74,0.08)',
        fontSize: 14,
        fontWeight: 600,
        color: '#15803d',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="18" height="18" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Added to Google Calendar ✓
    </div>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ app, onClose, onStatusChange, onNotesChange, onDelete }) {
  const navigate                          = useNavigate()
  const [visible, setVisible]             = useState(false)
  const [activeTab, setActiveTab]         = useState(() => {
    const saved = loadTrackerState()?.activeTab
    if (saved) return saved
    return app.tailoredCv ? 'cv' : app.coverLetter ? 'cover' : app.description ? 'details' : 'notes'
  })
  const [notes, setNotes]                 = useState(app.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingNotes, setSavingNotes]     = useState(false)
  const [downloading, setDownloading]     = useState(null)
  const [showCalModal, setShowCalModal]   = useState(false)
  const [showToast, setShowToast]         = useState(false)
  const notesTimerRef                     = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    saveTrackerState({ activeTab })
  }, [activeTab])

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
    ...(app.description ? [{ key: 'details', label: 'Job Details' }] : []),
  ]

  // On mobile the panel anchors below the 56px mobile header so the close
  // button is never hidden behind a notch or the header bar itself.
  const MOBILE_HEADER_H = 56
  const panelTop    = isMobile ? MOBILE_HEADER_H : 0
  const panelHeight = isMobile ? `calc(100dvh - ${MOBILE_HEADER_H}px)` : '100dvh'

  return (
    <>
      {/* Overlay — starts at same top as panel so mobile header stays usable */}
      <div
        style={{
          position: 'fixed',
          top: panelTop, left: 0, right: 0, bottom: 0,
          zIndex: 40,
          transition: 'background 0.28s',
          background: visible ? 'rgba(15,23,42,0.28)' : 'transparent',
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: panelTop,
          right: 0,
          height: panelHeight,
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
        <div style={{ padding: isMobile ? '14px 16px 14px' : '28px 28px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status + match */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <StatusDropdown value={app.status} onChange={(s) => onStatusChange(app.id, s)} />
            {app.matchScore > 0 ? <MatchScoreBadge score={app.matchScore} format="score" /> : app.manual ? <ManualBadge /> : null}
            {app.status === 'Interview' && (
              <button
                onClick={() => setShowCalModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px',
                  borderRadius: 999, border: '1.5px solid #bbf7d0',
                  background: '#f0fdf4', color: '#16a34a',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,163,74,0.18)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <svg width="13" height="13" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Add to Google Calendar
              </button>
            )}
            <button
              onClick={() => {
                onClose()
                navigate('/dashboard/interview-studio', {
                  state: { job: { title: app.title, company: app.company, description: app.description || '' } },
                })
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                borderRadius: 999, border: '1.5px solid #bfdbfe',
                background: '#eff6ff', color: '#2563eb',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.18)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <svg width="13" height="13" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
              </svg>
              Practice interview
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: isMobile ? '12px 14px' : '12px 20px',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                borderBottom: activeTab === key ? '2px solid #2563eb' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === key ? '#2563eb' : '#94a3b8',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', minHeight: 280 }}>
                <svg width="44" height="44" fill="none" stroke="#e2e8f0" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 280, lineHeight: 1.5, marginBottom: app.manual ? 20 : 0 }}>
                  {app.manual
                    ? 'No tailored CV yet. Generate one with AI in the Tailoring Lab.'
                    : 'No tailored CV saved. Use the Tailoring Lab and click "Add to Tracker".'}
                </p>
                {app.manual && (
                  <button
                    onClick={() => {
                      onClose()
                      navigate('/dashboard/tailoring-lab', {
                        state: { job: { id: app.jobId, title: app.title, company: app.company, location: app.location, description: app.description, url: app.jobUrl } },
                      })
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
                      color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                  >
                    <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Tailor this job →
                  </button>
                )}
              </div>
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
              app.manual ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', minHeight: 280 }}>
                  <svg width="44" height="44" fill="none" stroke="#e2e8f0" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 280, lineHeight: 1.5, marginBottom: 20 }}>
                    No cover letter yet. Generate one with AI in the Tailoring Lab.
                  </p>
                  <button
                    onClick={() => {
                      onClose()
                      navigate('/dashboard/tailoring-lab', {
                        state: {
                          job: { id: app.jobId, title: app.title, company: app.company, location: app.location, description: app.description, url: app.jobUrl },
                          openTab: 'cover',
                        },
                      })
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
                      color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                  >
                    <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Tailor this job →
                  </button>
                </div>
              ) : (
                <EmptyTab
                  icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  hint='No cover letter saved. Use the Tailoring Lab and click "Add to Tracker".'
                />
              )
            )
          )}

          {/* Job Details tab */}
          {activeTab === 'details' && (
            <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
              {app.jobUrl && (
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: '#2563eb', fontWeight: 500,
                    marginBottom: 16, textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View job posting →
                </a>
              )}
              <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {app.description}
              </p>
            </div>
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
        <div style={{ padding: isMobile ? '12px 16px' : '14px 24px', paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 12px)' : 14, borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
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

      {/* Google Calendar modal */}
      {showCalModal && (
        <CalendarModal
          app={app}
          onClose={() => setShowCalModal(false)}
          onAdded={() => { setShowToast(true); posthog.capture('calendar_event_added', { job_title: app.title, company: app.company }) }}
        />
      )}

      {/* Toast */}
      {showToast && <CalendarToast onHide={() => setShowToast(false)} />}
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
  const [selected, setSelected]       = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showJobAddedToast, setShowJobAddedToast] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')

  // Restore selected application from localStorage after applications load
  useEffect(() => {
    if (!applications.length) return
    const savedId = loadTrackerState()?.selectedId
    if (!savedId) return
    const app = applications.find(a => a.id === savedId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (app) setSelected(app)
  }, [applications]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist selected id whenever it changes
  useEffect(() => {
    saveTrackerState({ selectedId: selected?.id || null })
  }, [selected])

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length
    return acc
  }, {})

  const filteredApplications = applications.filter((a) => {
    const matchesStatus = activeFilter === 'All' || a.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      (a.title || '').toLowerCase().includes(q) ||
      (a.company || '').toLowerCase().includes(q) ||
      (a.location || '').toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const toggleFilter = (status) => setActiveFilter((prev) => prev === status ? 'All' : status)

  const handleDelete = async (appId) => {
    await deleteApplication(appId)
    setSelected(null)
    saveTrackerState({ selectedId: null })
  }

  const handleStatusChange = async (appId, status) => {
    await updateStatus(appId, status)
    setSelected((prev) => prev?.id === appId ? { ...prev, status } : prev)
    const app = applications.find((a) => a.id === appId)
    posthog.capture('application_status_changed', { job_title: app?.title, company: app?.company, new_status: status })
  }

  const handleNotesChange = async (appId, notes) => {
    await updateApplicationNotes(appId, notes)
    setSelected((prev) => prev?.id === appId ? { ...prev, notes } : prev)
    const app = applications.find((a) => a.id === appId)
    posthog.capture('notes_saved', { job_title: app?.title })
  }

  // colors now driven by STATUS_COLORS

  return (
    <>
      <div className="p-4 md:p-8 page-fade-in h-full overflow-y-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tracker</h1>
          <p className="text-slate-500 mt-1 text-sm">Monitor every application from submission to decision</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
            transition: 'opacity 0.15s', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add job
        </button>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STATUSES.map((status) => {
          const isActive = activeFilter === status
          return (
            <div
              key={status}
              onClick={() => toggleFilter(status)}
              className="bg-white rounded-xl border p-5 hover:shadow-sm transition-all duration-150 cursor-pointer"
              style={{ borderColor: isActive ? STATUS_COLORS[status].dot : '#f1f5f9', boxShadow: isActive ? `0 0 0 2px ${STATUS_COLORS[status].dot}` : undefined }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status]?.dot, marginBottom: 12 }} />
              <p className="text-3xl font-bold text-slate-900">{counts[status]}</p>
              <p className="text-sm mt-0.5 font-medium" style={{ color: isActive ? STATUS_COLORS[status].text : '#64748b' }}>{status}</p>
            </div>
          )
        })}
      </div>

      {/* Search + filter pills */}
      <div className="mb-5 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by role or company..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Filter pills */}
        <div className="pills-scroll">
          {/* All pill */}
          <button
            onClick={() => setActiveFilter('All')}
            className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0"
            style={activeFilter === 'All'
              ? { background: '#0F172A', color: '#fff', fontWeight: 600 }
              : { background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }
            }
          >
            All
          </button>
          {STATUSES.map((status) => {
            const isActive = activeFilter === status
            return (
              <button
                key={status}
                onClick={() => toggleFilter(status)}
                className="px-3.5 py-1.5 rounded-full text-sm transition-all flex-shrink-0"
                style={isActive
                  ? { background: STATUS_COLORS[status].dot, color: '#fff', fontWeight: 600 }
                  : { background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }
                }
              >
                {status}
              </button>
            )
          })}
        </div>
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
          {filteredApplications.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-9 h-9 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <p className="text-slate-400 text-sm">No applications match your filters.</p>
            </div>
          ) : (
          <>
            {/* ── Mobile card list ── */}
            <div className="md:hidden divide-y divide-slate-50">
              {filteredApplications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setSelected(app)}
                  className={`px-4 py-4 cursor-pointer transition-colors ${
                    selected?.id === app.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                  }`}
                  style={{ minHeight: 64 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 text-sm leading-snug">{app.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{app.company}{app.location ? ` · ${app.location}` : ''}</p>
                      {app.appliedDate && <p className="text-xs text-slate-400 mt-1">{app.appliedDate}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      {app.matchScore > 0 ? <MatchScoreBadge score={app.matchScore} format="score" /> : app.manual ? <ManualBadge /> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table ── */}
            <table className="mobile-table-hide w-full">
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
              {filteredApplications.map((app) => (
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
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="py-4 px-6">
                    {app.matchScore > 0 ? <MatchScoreBadge score={app.matchScore} format="score" /> : app.manual ? <ManualBadge /> : null}
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
          </>
          )}
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

      {showAddModal && (
        <AddJobModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => setShowJobAddedToast(true)}
        />
      )}

      {showJobAddedToast && (
        <JobAddedToast onHide={() => setShowJobAddedToast(false)} />
      )}
    </>
  )
}

export default Tracker
