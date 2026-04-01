import { useState, useEffect } from 'react'
import { useUser } from '../context/UserContext'
import CvUploader from '../components/CvUploader'
import PillGroup from '../components/PillGroup'

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_SECTORS = [
  'Technology', 'Finance', 'Marketing', 'Design', 'Consulting',
  'Research', 'Healthcare', 'Engineering', 'Law', 'Operations',
  'Sales', 'Product', 'Data & AI', 'Education', 'Other',
]
const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Freelance']
const WORK_MODES    = ['Remote', 'Hybrid', 'Onsite']
const CURRENCIES    = ['€', '$', '£', 'CHF']
const LANG_LEVELS   = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic']

// ── Field + Input helpers ────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {label}
        {hint && <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input(props) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
      onBlur={(e)  => { setFocused(false); props.onBlur?.(e) }}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 10,
        border: `1.5px solid ${focused ? '#2563EB' : '#E2E8F0'}`,
        boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
        fontSize: 14, color: '#0F172A', background: '#fff',
        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...props.style,
      }}
    />
  )
}

// ── Languages editor ─────────────────────────────────────────────────────────

function LanguagesEditor({ value, onChange }) {
  const langs = Array.isArray(value) ? value : []
  const update = (i, patch) => onChange(langs.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const remove = (i)        => onChange(langs.filter((_, idx) => idx !== i))
  const add    = ()         => onChange([...langs, { lang: '', level: 'Fluent' }])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {langs.map((entry, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={entry.lang}
            onChange={(e) => update(i, { lang: e.target.value })}
            placeholder="Language (e.g. English)"
            style={{
              flex: 1, padding: '9px 13px', borderRadius: 10,
              border: '1.5px solid #E2E8F0', fontSize: 13, color: '#0F172A',
              outline: 'none', fontFamily: 'inherit', background: '#fff',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
            onBlur={(e)  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
          />
          <select
            value={entry.level}
            onChange={(e) => update(i, { level: e.target.value })}
            style={{
              width: 140, padding: '9px 13px', borderRadius: 10,
              border: '1.5px solid #E2E8F0', fontSize: 13, color: '#0F172A',
              outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer',
            }}
          >
            {LANG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#CBD5E1', flexShrink: 0, transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = '#FEF2F2' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {langs.length === 0 && (
        <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>No languages added yet.</p>
      )}

      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8,
          border: '1.5px solid #DBEAFE', background: '#EFF6FF',
          color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#DBEAFE' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#EFF6FF' }}
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add language
      </button>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, onSave, saving, saved, children }) {
  const [visible, setVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const panelStyle = isMobile ? {
    position: 'fixed',
    inset: 0,
    zIndex: 201,
    background: '#fff',
    borderRadius: 0,
    padding: '24px 20px 28px',
    boxSizing: 'border-box',
    overflowY: 'auto',
    transform: visible ? 'translateY(0)' : 'translateY(30px)',
    opacity: visible ? 1 : 0,
    transition: 'transform 0.25s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s',
  } : {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: visible ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.97)',
    opacity: visible ? 1 : 0,
    transition: 'transform 0.2s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s',
    zIndex: 201,
    width: '100%', maxWidth: 560,
    background: '#fff',
    borderRadius: 18,
    boxShadow: '0 24px 64px rgba(15,23,42,0.2), 0 0 0 1px rgba(15,23,42,0.06)',
    padding: '32px 32px 28px',
    boxSizing: 'border-box',
    maxHeight: '90vh', overflowY: 'auto',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: visible ? 'rgba(15,23,42,0.4)' : 'transparent',
          transition: 'background 0.2s',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Panel */}
      <div style={panelStyle}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <button
            onClick={close}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#94A3B8', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#334155' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
          >
            <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {saved && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={close}
            style={{
              padding: '10px 18px', borderRadius: 10,
              border: '1.5px solid #E2E8F0', background: '#fff',
              color: '#64748B', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.75 : 1,
              boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={(e) => { if (!saving) e.currentTarget.style.opacity = '1' }}
          >
            {saving
              ? <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', animation: 'modal-spin 0.7s linear infinite' }} />
              : <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            }
            Save changes
          </button>
        </div>
      </div>
    </>
  )
}

// ── Section modals ────────────────────────────────────────────────────────────

function PersonalModal({ onClose }) {
  const { user, updateProfile } = useUser()
  const [form, setForm] = useState({
    name:        user.name        || '',
    country:     user.country     || '',
    city:        user.city        || '',
    linkedinUrl: user.linkedinUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await updateProfile(form)
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <Modal title="Personal Info" onClose={onClose} onSave={handleSave} saving={saving} saved={saved}>
      <Field label="Full name">
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sofia Rossi" />
      </Field>
      <Field label="Country">
        <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="e.g. Italy" />
      </Field>
      <Field label="City" hint="(write in English)">
        <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Milan, Rome, Turin" />
      </Field>
      <Field label="LinkedIn URL" hint="(optional)">
        <Input value={form.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="linkedin.com/in/your-profile" />
      </Field>
    </Modal>
  )
}

function PreferencesModal({ onClose }) {
  const { user, updateProfile } = useUser()
  const [form, setForm] = useState({
    sectors:        user.sectors        || [],
    sector:         user.sector         || '',
    contractType:   user.contractType   || '',
    workMode:       user.workMode       || '',
    salaryMin:      user.salaryMin      || '',
    salaryMax:      user.salaryMax      || '',
    salaryCurrency: user.salaryCurrency || '€',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await updateProfile(form)
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <Modal title="Job Preferences" onClose={onClose} onSave={handleSave} saving={saving} saved={saved}>
      <Field label="Sectors of interest" hint="(select all that apply)">
        <PillGroup options={ALL_SECTORS} value={form.sectors} onChange={(v) => set('sectors', v)} multi />
      </Field>
      <Field label="Contract type">
        <PillGroup options={CONTRACT_TYPES} value={form.contractType} onChange={(v) => set('contractType', v)} />
      </Field>
      <Field label="Work mode">
        <PillGroup options={WORK_MODES} value={form.workMode} onChange={(v) => set('workMode', v)} />
      </Field>
      <Field label="Salary range" hint="(annual gross, optional)">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <select
              value={form.salaryCurrency}
              onChange={(e) => set('salaryCurrency', e.target.value)}
              style={{
                padding: '9px 12px', borderRadius: 10,
                border: '1.5px solid #E2E8F0', fontSize: 14,
                color: '#0F172A', background: '#fff',
                outline: 'none', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number" min="0"
              value={form.salaryMin}
              onChange={(e) => set('salaryMin', e.target.value)}
              placeholder="Min"
              style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'inherit' }}
              onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
              onBlur={(e)  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <input
            type="number" min="0"
            value={form.salaryMax}
            onChange={(e) => set('salaryMax', e.target.value)}
            placeholder="Max"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', fontFamily: 'inherit' }}
            onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
            onBlur={(e)  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
          />
        </div>
        {form.salaryMin && form.salaryMax && (
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
            {form.salaryCurrency}{parseInt(form.salaryMin).toLocaleString()} – {form.salaryCurrency}{parseInt(form.salaryMax).toLocaleString()} per year
          </p>
        )}
      </Field>
    </Modal>
  )
}

function CvModal({ onClose }) {
  const { user, updateProfile } = useUser()
  const [cvText, setCvText] = useState(user.cvText || '')
  const [saving, setSaving]  = useState(false)
  const [saved, setSaved]    = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ cvText })
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <Modal title="Your CV" onClose={onClose} onSave={handleSave} saving={saving} saved={saved}>
      <CvUploader value={cvText} onChange={setCvText} />
      {cvText && (
        <p style={{ margin: 0, fontSize: 12, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {cvText.length.toLocaleString()} characters ready
        </p>
      )}
    </Modal>
  )
}

function LanguagesModal({ onClose }) {
  const { user, updateProfile } = useUser()
  const [languages, setLanguages] = useState(user.languages || [])
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ languages })
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <Modal title="Languages" onClose={onClose} onSave={handleSave} saving={saving} saved={saved}>
      <LanguagesEditor value={languages} onChange={setLanguages} />
    </Modal>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ icon, title, subtitle, badge, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${hov ? '#2563EB' : '#E2E8F0'}`,
        padding: '26px 28px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 140,
        boxSizing: 'border-box',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hov
          ? '0 8px 24px rgba(37,99,235,0.10), 0 1px 4px rgba(15,23,42,0.06)'
          : '0 1px 3px rgba(15,23,42,0.05)',
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
      }}
    >
      {/* Icon */}
      <div style={{ color: '#2563EB', flexShrink: 0 }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
          {title}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748B', lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>

      {/* Badge */}
      {badge && (
        <div style={{ minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {badge}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Profile() {
  const { user } = useUser()
  const [openModal, setOpenModal] = useState(() => {
    try { return JSON.parse(localStorage.getItem('apex_profile_state') || '{}').openModal || null }
    catch { return null }
  })
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Persist modal state so it's restored when navigating back to Profile
  useEffect(() => {
    try { localStorage.setItem('apex_profile_state', JSON.stringify({ openModal })) }
    catch {}
  }, [openModal])

  const cvText   = user.cvText || ''
  const langCount = (user.languages || []).filter((l) => l.lang?.trim()).length

  return (
    <>
      <style>{`@keyframes modal-spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ background: '#F8FAFC', minHeight: '100dvh', padding: isMobile ? '24px 16px' : '40px 32px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Profile
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748B' }}>
              Your information, preferences and CV
            </p>
          </div>

          {/* 2 × 2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Personal Info */}
            <SummaryCard
              onClick={() => setOpenModal('personal')}
              icon={
                <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              title="Personal Info"
              subtitle="Name, location, LinkedIn"
              badge={user.name && (
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  {user.name}{user.city ? ` · ${user.city}` : ''}
                </span>
              )}
            />

            {/* Job Preferences */}
            <SummaryCard
              onClick={() => setOpenModal('preferences')}
              icon={
                <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              title="Job Preferences"
              subtitle="Sector, contract, salary"
              badge={(user.sectors?.length || user.contractType) && (
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  {[
                    user.sectors?.length ? `${user.sectors.length} sector${user.sectors.length > 1 ? 's' : ''}` : null,
                    user.contractType || null,
                    user.workMode || null,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
            />

            {/* Your CV */}
            <SummaryCard
              onClick={() => setOpenModal('cv')}
              icon={
                <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="Your CV"
              subtitle="Upload or paste your CV"
              badge={cvText ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: '#16A34A', fontWeight: 600,
                }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {cvText.length.toLocaleString()} chars · saved
                </span>
              ) : (
                <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>No CV yet</span>
              )}
            />

            {/* Languages */}
            <SummaryCard
              onClick={() => setOpenModal('languages')}
              icon={
                <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              }
              title="Languages"
              subtitle="Languages for your applications"
              badge={langCount > 0 ? (
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  {langCount} language{langCount > 1 ? 's' : ''} added
                </span>
              ) : (
                <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>None added yet</span>
              )}
            />

          </div>
        </div>
      </div>

      {/* Modals */}
      {openModal === 'personal'    && <PersonalModal    onClose={() => setOpenModal(null)} />}
      {openModal === 'preferences' && <PreferencesModal onClose={() => setOpenModal(null)} />}
      {openModal === 'cv'          && <CvModal          onClose={() => setOpenModal(null)} />}
      {openModal === 'languages'   && <LanguagesModal   onClose={() => setOpenModal(null)} />}
    </>
  )
}
