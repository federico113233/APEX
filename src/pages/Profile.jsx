import { useState } from 'react'
import { useUser } from '../context/UserContext'
import CvUploader from '../components/CvUploader'
import PillGroup from '../components/PillGroup'

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_SECTORS = [
  'Technology', 'Finance', 'Marketing', 'Design', 'Consulting',
  'Research', 'Healthcare', 'Engineering', 'Law', 'Operations',
  'Sales', 'Product', 'Data & AI', 'Education', 'Other',
]

const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Freelance']
const WORK_MODES    = ['Remote', 'Hybrid', 'Onsite']
const CURRENCIES    = ['€', '$', '£', 'CHF']
const LANG_LEVELS   = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic']

// ── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, description, children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #F1F5F9',
      padding: '24px',
      boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        {description && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8', lineHeight: 1.4 }}>{description}</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  )
}

// ── Field ─────────────────────────────────────────────────────────────────────

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

// ── Input ─────────────────────────────────────────────────────────────────────

function Input({ icon, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      {icon && (
        <span style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: '#94A3B8', display: 'flex', alignItems: 'center', pointerEvents: 'none',
        }}>
          {icon}
        </span>
      )}
      <input
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
        style={{
          width: '100%',
          padding: icon ? '10px 14px 10px 38px' : '10px 14px',
          borderRadius: 10,
          border: `1.5px solid ${focused ? '#2563EB' : '#E2E8F0'}`,
          boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          fontSize: 14,
          color: '#0F172A',
          background: '#fff',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...props.style,
        }}
      />
    </div>
  )
}

// ── Languages editor ──────────────────────────────────────────────────────────

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
        <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>No languages added yet.</p>
      )}

      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 8,
          border: '1.5px solid #DBEAFE', background: '#EFF6FF',
          color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#DBEAFE' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#EFF6FF' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add language
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, updateProfile } = useUser()

  const [form, setForm] = useState({
    name:           user.name           || '',
    sector:         user.sector         || '',
    country:        user.country        || '',
    city:           user.city           || '',
    contractType:   user.contractType   || '',
    workMode:       user.workMode       || '',
    salaryMin:      user.salaryMin      || '',
    salaryMax:      user.salaryMax      || '',
    salaryCurrency: user.salaryCurrency || '€',
    sectors:        user.sectors        || [],
    languages:      user.languages      || [],
    linkedinUrl:    user.linkedinUrl    || '',
  })
  const [cvText, setCvText] = useState(user.cvText || '')
  const [saved, setSaved]   = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const initials = form.name
    ? form.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const handleSave = async (e) => {
    e.preventDefault()
    await updateProfile({ ...form, cvText })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSave} style={{ position: 'relative' }}>
      <div style={{ padding: '32px 32px 96px', maxWidth: 1100 }} className="page-fade-in">

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Profile
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748B' }}>
            Used by APEX and the Tailoring Lab to personalise your experience.
          </p>
        </div>

        {/* ── Two-column grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
          className="profile-grid"
        >

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Personal Info */}
            <Card title="Personal Info">

              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
                    {initials}
                  </span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                    {form.name || 'Your name'}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#94A3B8' }}>
                    {form.sectors.length
                      ? form.sectors.slice(0, 2).join(' · ')
                      : form.sector || 'No sector set'}
                    {form.country ? ` · ${form.country}` : ''}
                  </p>
                </div>
              </div>

              <Field label="Full name">
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Sofia Rossi"
                />
              </Field>

              <Field label="Country">
                <Input
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  placeholder="e.g. Italy"
                />
              </Field>

              <Field label="City" hint="(write in English)">
                <Input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="e.g. Milan, Rome, Turin"
                />
              </Field>

              <Field label="LinkedIn URL" hint="(optional)">
                <Input
                  value={form.linkedinUrl}
                  onChange={(e) => set('linkedinUrl', e.target.value)}
                  placeholder="linkedin.com/in/your-profile"
                  icon={
                    <svg width="15" height="15" fill="#94A3B8" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  }
                />
              </Field>
            </Card>

            {/* CV Upload */}
            <Card
              title="Your CV"
              description={cvText
                ? `${cvText.length.toLocaleString()} characters · used by APEX & Tailoring Lab`
                : 'Upload your CV — used to personalise every application'}
            >
              {cvText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999,
                    background: '#F0FDF4', border: '1px solid #BBF7D0',
                  }}>
                    <svg width="13" height="13" fill="none" stroke="#16A34A" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>CV saved</span>
                  </div>
                </div>
              )}
              <CvUploader value={cvText} onChange={setCvText} />
            </Card>

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Job Preferences */}
            <Card
              title="Job Preferences"
              description="Helps APEX give targeted advice and filter your job matches."
            >
              <Field label="Sectors of interest" hint="(select all that apply)">
                <PillGroup
                  options={ALL_SECTORS}
                  value={form.sectors}
                  onChange={(v) => set('sectors', v)}
                  multi
                />
              </Field>

              <Field label="Contract type">
                <PillGroup
                  options={CONTRACT_TYPES}
                  value={form.contractType}
                  onChange={(v) => set('contractType', v)}
                />
              </Field>

              <Field label="Work mode">
                <PillGroup
                  options={WORK_MODES}
                  value={form.workMode}
                  onChange={(v) => set('workMode', v)}
                />
              </Field>

              <Field label="Salary range" hint="(annual gross, optional)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={form.salaryCurrency}
                    onChange={(e) => set('salaryCurrency', e.target.value)}
                    style={{
                      padding: '9px 12px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', fontSize: 14,
                      color: '#0F172A', background: '#fff',
                      outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={form.salaryMin}
                    onChange={(e) => set('salaryMin', e.target.value)}
                    placeholder="Min"
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', fontSize: 14,
                      color: '#0F172A', background: '#fff',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                    onBlur={(e)  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
                  />
                  <span style={{ color: '#94A3B8', fontSize: 14, flexShrink: 0 }}>–</span>
                  <input
                    type="number"
                    min="0"
                    value={form.salaryMax}
                    onChange={(e) => set('salaryMax', e.target.value)}
                    placeholder="Max"
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 10,
                      border: '1.5px solid #E2E8F0', fontSize: 14,
                      color: '#0F172A', background: '#fff',
                      outline: 'none', fontFamily: 'inherit',
                    }}
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
            </Card>

            {/* Languages */}
            <Card title="Languages" description="Used in your CV and cover letters.">
              <LanguagesEditor
                value={form.languages}
                onChange={(v) => set('languages', v)}
              />
            </Card>

          </div>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '14px 32px',
        background: 'rgba(248,250,252,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(226,232,240,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 16,
      }}>
        {saved && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: '#16A34A',
          }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Profile saved
          </span>
        )}
        <button
          type="submit"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 24px',
            borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(37,99,235,0.35)',
            transition: 'opacity 0.15s',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Save changes
        </button>
      </div>
    </form>
  )
}
