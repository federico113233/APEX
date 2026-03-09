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

// ── Small UI helpers ────────────────────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="pb-4 border-b border-slate-100">
        <h2 className="font-semibold text-apex-text">{title}</h2>
        {description && <p className="text-sm text-apex-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-apex-text">
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-apex-muted">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ── Languages sub-component ─────────────────────────────────────────────────

function LanguagesEditor({ value, onChange }) {
  const langs = Array.isArray(value) ? value : []

  const update = (i, patch) =>
    onChange(langs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const remove = (i) => onChange(langs.filter((_, idx) => idx !== i))

  const add = () => onChange([...langs, { lang: '', level: 'Fluent' }])

  const inputClass =
    'px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent'

  return (
    <div className="space-y-2">
      {langs.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={entry.lang}
            onChange={(e) => update(i, { lang: e.target.value })}
            placeholder="Language (e.g. English)"
            className={`${inputClass} flex-1`}
          />
          <select
            value={entry.level}
            onChange={(e) => update(i, { level: e.target.value })}
            className={`${inputClass} w-36`}
          >
            {LANG_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            aria-label="Remove language"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm text-apex-blue hover:text-apex-blue/80 font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add language
      </button>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function Profile() {
  const { user, updateProfile } = useUser()

  const [form, setForm] = useState({
    name:          user.name          || '',
    sector:        user.sector        || '',
    country:       user.country       || '',
    city:          user.city          || '',
    contractType:  user.contractType  || '',
    workMode:      user.workMode      || '',
    salaryMin:     user.salaryMin     || '',
    salaryMax:     user.salaryMax     || '',
    salaryCurrency: user.salaryCurrency || '€',
    sectors:       user.sectors       || [],
    languages:     user.languages     || [],
    linkedinUrl:   user.linkedinUrl   || '',
  })
  const [cvText, setCvText] = useState(user.cvText || '')
  const [saved, setSaved] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const initials = form.name
    ? form.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const handleSave = (e) => {
    e.preventDefault()
    updateProfile({ ...form, cvText })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent'

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-apex-text">Profile</h1>
        <p className="text-apex-muted mt-1">
          Used by Alex and the Tailoring Lab to personalise your experience.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Personal info ── */}
        <Section title="Personal info">
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-xl">{initials}</span>
            </div>
            <div>
              <p className="font-semibold text-apex-text">{form.name || 'Your name'}</p>
              <p className="text-sm text-apex-muted">
                {form.sectors.length ? form.sectors.slice(0, 2).join(' · ') : form.sector || 'No sector set'}
                {form.country ? ` · ${form.country}` : ''}
              </p>
            </div>
          </div>

          <Field label="Full name">
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Sofia Rossi"
              className={inputClass}
            />
          </Field>

          <Field label="Country">
            <input
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="e.g. Italy"
              className={inputClass}
            />
          </Field>

          <Field label="City" hint="(optional)">
            <input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="e.g. Milan"
              className={inputClass}
            />
          </Field>

          <Field label="LinkedIn URL" hint="(optional)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-muted">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </span>
              <input
                value={form.linkedinUrl}
                onChange={(e) => set('linkedinUrl', e.target.value)}
                placeholder="linkedin.com/in/your-profile"
                className={`${inputClass} pl-9`}
              />
            </div>
          </Field>
        </Section>

        {/* ── Job preferences ── */}
        <Section
          title="Job preferences"
          description="Helps Alex give you targeted advice and filters your job matches."
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
            <div className="flex items-center gap-2">
              <select
                value={form.salaryCurrency}
                onChange={(e) => set('salaryCurrency', e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-slate-200 text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={form.salaryMin}
                onChange={(e) => set('salaryMin', e.target.value)}
                placeholder="Min"
                className="w-32 px-3 py-2.5 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
              />
              <span className="text-apex-muted text-sm">–</span>
              <input
                type="number"
                min="0"
                value={form.salaryMax}
                onChange={(e) => set('salaryMax', e.target.value)}
                placeholder="Max"
                className="w-32 px-3 py-2.5 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
              />
            </div>
            {form.salaryMin && form.salaryMax && (
              <p className="text-xs text-apex-muted mt-1">
                {form.salaryCurrency}{parseInt(form.salaryMin).toLocaleString()} – {form.salaryCurrency}{parseInt(form.salaryMax).toLocaleString()} per year
              </p>
            )}
          </Field>
        </Section>

        {/* ── Languages ── */}
        <Section title="Languages" description="Used in your CV and cover letters.">
          <LanguagesEditor
            value={form.languages}
            onChange={(v) => set('languages', v)}
          />
        </Section>

        {/* ── CV ── */}
        <Section
          title="Your CV"
          description={
            cvText
              ? `${cvText.length.toLocaleString()} characters · used by Alex & Tailoring Lab`
              : 'No CV added yet'
          }
        >
          {cvText && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 w-fit">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium text-emerald-700">CV saved</span>
            </div>
          )}
          <CvUploader value={cvText} onChange={setCvText} />
        </Section>

        {/* ── Save ── */}
        <div className="flex items-center gap-4 pb-8">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
          >
            Save changes
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Profile saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
