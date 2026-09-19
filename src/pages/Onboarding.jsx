import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import CvUploader from '../components/CvUploader'
import CvBuilder from '../components/CvBuilder'
import PillGroup from '../components/PillGroup'
import { useUser } from '../context/UserContext'
import posthog from 'posthog-js'

// ── Constants ───────────────────────────────────────────────────────────────

const ALL_SECTORS = [
  'Technology', 'Finance', 'Marketing', 'Design', 'Consulting',
  'Research', 'Healthcare', 'Engineering', 'Law', 'Operations',
  'Sales', 'Product', 'Data & AI', 'Education', 'Other',
]
const CONTRACT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Freelance']
const WORK_MODES     = ['Remote', 'Hybrid', 'Onsite']
const CURRENCIES     = ['€', '$', '£', 'CHF']
const LANG_LEVELS    = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic']

const STEPS = [
  { n: 1, label: 'Personal info' },
  { n: 2, label: 'Job preferences' },
  { n: 3, label: 'Salary & languages' },
  { n: 4, label: 'Your CV' },
]
const TOTAL = STEPS.length

// ── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
          >
            {step}
          </span>
          <span className="text-sm font-semibold text-slate-700 truncate">{STEPS[step - 1].label}</span>
        </div>
        <span className="text-xs text-slate-400 font-medium flex-shrink-0 ml-2">{step} of {TOTAL}</span>
      </div>
      <div className="flex gap-1.5">
        {STEPS.map(({ n }) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              n < step ? 'bg-blue-500' : n === step ? 'bg-blue-400' : 'bg-slate-200'
            }`}
            style={n <= step ? { background: 'linear-gradient(90deg, #2563EB, #38BDF8)' } : {}}
          />
        ))}
      </div>
    </div>
  )
}

// ── Field wrapper ───────────────────────────────────────────────────────────

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

// ── CV path chooser card ────────────────────────────────────────────────────

function PathCard({ title, desc, iconPath, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-apex-blue hover:bg-blue-50/40 transition-colors"
    >
      <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-apex-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={iconPath} />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-apex-text">{title}</span>
        <span className="block text-xs text-apex-muted mt-0.5 leading-relaxed">{desc}</span>
      </span>
    </button>
  )
}

// ── Languages editor ────────────────────────────────────────────────────────

function LanguagesEditor({ value, onChange }) {
  const langs = Array.isArray(value) ? value : []
  const update = (i, patch) => onChange(langs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i) => onChange(langs.filter((_, idx) => idx !== i))
  const add = () => onChange([...langs, { lang: '', level: 'Fluent' }])

  const inputCls =
    'px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent'

  return (
    <div className="space-y-2">
      {langs.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={entry.lang}
            onChange={(e) => update(i, { lang: e.target.value })}
            placeholder="Language (e.g. English)"
            className={`${inputCls} flex-1 min-w-0`}
          />
          <select
            value={entry.level}
            onChange={(e) => update(i, { level: e.target.value })}
            className={`${inputCls} w-28 flex-shrink-0`}
          >
            {LANG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
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
        className="flex items-center gap-1.5 text-sm text-apex-blue hover:opacity-80 font-medium"
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

export default function Onboarding() {
  const { user, updateProfile } = useUser()
  const navigate = useNavigate()

  // If already onboarded, skip straight to dashboard
  useEffect(() => {
    if (user.onboarded) navigate('/dashboard', { replace: true })
  }, [user.onboarded, navigate])

  const [step, setStep] = useState(1)
  // Which way the user chose to provide a CV: 'have' | 'linkedin' | 'build' | null (not chosen yet)
  const [cvPath, setCvPath] = useState(null)

  // All form state in one object so it persists across steps
  const [form, setForm] = useState({
    // step 1
    name: '',
    country: '',
    city: '',
    linkedinUrl: '',
    // step 2
    sectors: [],
    contractType: '',
    workMode: '',
    // step 3
    salaryCurrency: '€',
    salaryMin: '',
    salaryMax: '',
    languages: [],
    // step 4 (cv)
    cvText: '',
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const inputCls =
    'w-full px-4 py-3 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-base'

  // `skipCv` finishes onboarding without a CV (it can be added later in Profile)
  const handleFinish = async ({ skipCv = false } = {}) => {
    const cvText = skipCv ? '' : form.cvText
    await updateProfile({
      name:           form.name,
      country:        form.country,
      city:           form.city,
      linkedinUrl:    form.linkedinUrl,
      sectors:        form.sectors,
      sector:         form.sectors[0] || '',
      contractType:   form.contractType,
      workMode:       form.workMode,
      salaryCurrency: form.salaryCurrency,
      salaryMin:      form.salaryMin,
      salaryMax:      form.salaryMax,
      languages:      form.languages,
      cvText,
      onboarded:      true,
    })
    posthog.capture('onboarding_completed', { cv_path: skipCv || !cvText.trim() ? 'skipped' : cvPath })
    navigate('/dashboard')
  }

  const chooseCvPath = (path) => {
    setCvPath(path)
    posthog.capture('onboarding_cv_path_chosen', { cv_path: path })
  }

  const canContinue = {
    1: form.name.trim() && form.country.trim(),
    2: form.sectors.length > 0 && !!form.contractType && !!form.workMode,
    3: true,  // salary + languages are optional
    4: !!form.cvText.trim(),
  }

  // ── Render steps ──────────────────────────────────────────────────────────

  const steps = {
    1: (
      <>
        <h1 className="text-2xl font-semibold text-apex-text mb-1">Tell us about yourself</h1>
        <p className="text-apex-muted text-sm mb-7">
          We'll use this to personalise your job matches and power Alex's advice.
        </p>
        <div className="space-y-5">
          <Field label="Full name">
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Sofia Rossi"
              className={inputCls}
            />
          </Field>
          <Field label="Country">
            <input
              required
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="e.g. Italy"
              className={inputCls}
            />
          </Field>
          <Field label="City" hint="(optional — write in English)">
            <input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="e.g. Milan, Rome, Turin"
              className={inputCls}
            />
          </Field>
          <Field label="LinkedIn URL" hint="(optional)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </span>
              <input
                value={form.linkedinUrl}
                onChange={(e) => set('linkedinUrl', e.target.value)}
                placeholder="linkedin.com/in/your-profile"
                className={`${inputCls} pl-9`}
              />
            </div>
          </Field>
        </div>
      </>
    ),

    2: (
      <>
        <h1 className="text-2xl font-semibold text-apex-text mb-1">Your job preferences</h1>
        <p className="text-apex-muted text-sm mb-7">
          These filter your job results in Discover and help Alex give targeted advice.
        </p>
        <div className="space-y-6">
          <Field label="Sectors of interest" hint="(select all that apply)">
            <PillGroup
              options={ALL_SECTORS}
              value={form.sectors}
              onChange={(v) => set('sectors', v)}
              multi
            />
            {form.sectors.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Select at least one sector to continue.</p>
            )}
          </Field>
          <Field label="Preferred contract type">
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
        </div>
      </>
    ),

    3: (
      <>
        <h1 className="text-2xl font-semibold text-apex-text mb-1">Salary & languages</h1>
        <p className="text-apex-muted text-sm mb-7">
          Optional — Alex and Discover use these to calibrate recommendations.
        </p>
        <div className="space-y-6">
          <Field label="Salary range" hint="(annual gross, optional)">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={form.salaryCurrency}
                  onChange={(e) => set('salaryCurrency', e.target.value)}
                  className="px-3 py-3 rounded-lg border border-slate-200 text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue flex-shrink-0"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number"
                  min="0"
                  value={form.salaryMin}
                  onChange={(e) => set('salaryMin', e.target.value)}
                  placeholder="Min"
                  className="flex-1 min-w-0 px-3 py-3 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
                />
              </div>
              <input
                type="number"
                min="0"
                value={form.salaryMax}
                onChange={(e) => set('salaryMax', e.target.value)}
                placeholder="Max"
                className="w-full px-3 py-3 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
              />
            </div>
            {form.salaryMin && form.salaryMax && (
              <p className="text-xs text-apex-muted mt-1">
                {form.salaryCurrency}{parseInt(form.salaryMin).toLocaleString()} – {form.salaryCurrency}{parseInt(form.salaryMax).toLocaleString()} / year
              </p>
            )}
          </Field>

          <Field label="Languages spoken">
            <LanguagesEditor
              value={form.languages}
              onChange={(v) => set('languages', v)}
            />
          </Field>
        </div>
      </>
    ),

    4: (
      <>
        <h1 className="text-2xl font-semibold text-apex-text mb-1">Your CV</h1>

        {!cvPath && (
          <>
            <p className="text-apex-muted text-sm mb-6">
              Alex and the Tailoring Lab use it to personalise everything. How do you want to start?
            </p>
            <div className="space-y-3">
              <PathCard
                title="I have a CV"
                desc="Upload a PDF or Word file, or paste the text."
                iconPath="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                onClick={() => chooseCvPath('have')}
              />
              <PathCard
                title="I have a LinkedIn profile"
                desc="Download your profile as a PDF and we’ll read it. Takes 30 seconds."
                iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                onClick={() => chooseCvPath('linkedin')}
              />
              <PathCard
                title="I don’t have a CV yet"
                desc="Answer a few questions and we’ll write one for you. No blank page."
                iconPath="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                onClick={() => chooseCvPath('build')}
              />
            </div>
          </>
        )}

        {cvPath && (
          <button
            type="button"
            onClick={() => setCvPath(null)}
            className="text-xs text-apex-muted hover:text-apex-text underline underline-offset-2 mb-5"
          >
            ← Choose another way
          </button>
        )}

        {cvPath === 'have' && (
          <>
            <p className="text-apex-muted text-sm mb-4">
              Upload a PDF or Word file, or paste the text.
            </p>
            <CvUploader value={form.cvText} onChange={(v) => set('cvText', v)} compact />
          </>
        )}

        {cvPath === 'linkedin' && (
          <>
            <ol className="text-sm text-apex-text space-y-1.5 mb-4 list-decimal list-inside bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
              <li>Open your profile on LinkedIn</li>
              <li>Click <span className="font-medium">Resources</span> (or <span className="font-medium">More</span>) below your name</li>
              <li>Choose <span className="font-medium">Save to PDF</span></li>
              <li>Upload that PDF here</li>
            </ol>
            <CvUploader value={form.cvText} onChange={(v) => set('cvText', v)} compact />
          </>
        )}

        {cvPath === 'build' && (
          <>
            <p className="text-apex-muted text-sm mb-4">
              We’ll turn your answers into a clean, one-page CV.
            </p>
            <CvBuilder profile={form} value={form.cvText} onChange={(v) => set('cvText', v)} />
          </>
        )}
      </>
    ),
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col pb-24 md:pb-0">
      <header className="px-5 md:px-6 py-5 flex-shrink-0">
        <Link to="/">
          <img src="/apex_full_logo.png" alt="APEX" className="h-8 w-auto object-contain" />
        </Link>
      </header>

      <main className="flex-1 flex items-start md:items-center justify-center px-5 md:px-6 py-6 md:py-10">
        <div className="w-full max-w-lg">
          <StepIndicator step={step} />

          {step >= 3 && (
            <p className="text-xs text-slate-400 -mt-4 mb-6">Almost there — this helps Alex give you better advice.</p>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-8">
            {steps[step]}

            {/* Navigation — hidden on mobile (shown in fixed footer below) */}
            <div className="hidden md:flex gap-3 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="px-5 py-3 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors text-sm"
                >
                  ← Back
                </button>
              )}

              {step < TOTAL ? (
                <button
                  type="button"
                  disabled={!canContinue[step]}
                  onClick={() => setStep((s) => s + 1)}
                  className="flex-1 py-3 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-40 shadow-md shadow-blue-500/20"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canContinue[4]}
                  onClick={() => handleFinish()}
                  className="flex-1 py-3 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-40 shadow-md shadow-blue-500/20"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
                >
                  Enter APEX →
                </button>
              )}
            </div>

            {/* Desktop skip CV */}
            {step === TOTAL && !form.cvText && (
              <p className="hidden md:block text-center mt-3">
                <button
                  type="button"
                  onClick={() => handleFinish({ skipCv: true })}
                  className="text-sm text-apex-muted hover:text-apex-text underline underline-offset-2"
                >
                  Skip for now — I'll add it later in Profile
                </button>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ── Mobile: fixed bottom navigation bar ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-5 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-5 py-3.5 rounded-xl border border-slate-200 font-semibold text-slate-600 bg-white text-sm min-h-[48px] flex-shrink-0"
            >
              ← Back
            </button>
          )}
          {step < TOTAL ? (
            <button
              type="button"
              disabled={!canContinue[step]}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-3.5 rounded-xl font-semibold text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-40 min-h-[48px]"
              style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              disabled={!canContinue[4]}
              onClick={() => handleFinish()}
              className="flex-1 py-3.5 rounded-xl font-semibold text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-40 min-h-[48px]"
              style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
            >
              Enter APEX →
            </button>
          )}
        </div>
        {step === TOTAL && !form.cvText && (
          <p className="text-center mt-2 pb-1">
            <button
              type="button"
              onClick={() => handleFinish({ skipCv: true })}
              className="text-sm text-apex-muted hover:text-apex-text underline underline-offset-2"
            >
              Skip for now
            </button>
          </p>
        )}
      </div>

      <footer className="hidden md:flex justify-center pb-8 pt-4">
        <img src="/apex_x_blue.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" style={{ opacity: 0.35 }} />
      </footer>
    </div>
  )
}
