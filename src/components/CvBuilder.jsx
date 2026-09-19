import { useState } from 'react'
import { apiFetch, PlanLimitError } from '../lib/apiFetch'

const SECTIONS = [
  {
    key: 'education',
    label: 'Education',
    placeholder: 'e.g. BSc in Economics, Bocconi University, 2022–2025 (expected). Erasmus semester in Madrid, 2024. Thesis on consumer behaviour.',
  },
  {
    key: 'experience',
    label: 'Work, internships or volunteering',
    placeholder: 'e.g. Marketing intern at Acme, summer 2024: managed the Instagram calendar and grew followers by 20%. Waiter at Bar Roma, 2022–2023. Rough notes are fine.',
  },
  {
    key: 'projects',
    label: 'Projects',
    placeholder: 'e.g. Organised a student conference with 200 attendees. Built a small website for my brother’s business.',
  },
  {
    key: 'skills',
    label: 'Skills and tools',
    placeholder: 'e.g. Excel, SQL, Figma, Canva, public speaking, teamwork',
  },
  {
    key: 'extras',
    label: 'Anything else',
    hint: '(optional)',
    placeholder: 'e.g. Certifications, awards, sports, associations, driving licence',
  },
]

const MIN_SECTIONS = 2

/**
 * CvBuilder — guided questionnaire that generates a CV for people who don't have one.
 *
 * Props:
 *   profile: { name, country, city, sectors, languages } — onboarding answers used as context
 *   value: string                 — current CV text (the generated draft)
 *   onChange: (string) => void
 */
export default function CvBuilder({ profile, value, onChange }) {
  const [answers, setAnswers] = useState({ education: '', experience: '', projects: '', skills: '', extras: '' })
  const [stage, setStage] = useState(value?.trim() ? 'preview' : 'form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filled = SECTIONS.filter((s) => answers[s.key].trim()).length
  const canGenerate = filled >= MIN_SECTIONS && !loading

  const generate = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/build-cv', {
        method: 'POST',
        body: JSON.stringify({
          profile: {
            name: profile.name,
            country: profile.country,
            city: profile.city,
            sectors: profile.sectors,
            languages: profile.languages,
          },
          answers,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.cv) {
        setError(data.error || 'Could not generate the CV. Please try again.')
        return
      }
      onChange(data.cv)
      setStage('preview')
    } catch (err) {
      setError(err instanceof PlanLimitError
        ? 'You’ve reached the free limit for building a CV. You can paste or upload one instead.'
        : 'Could not generate the CV. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const areaCls =
    'w-full px-4 py-3 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none text-sm leading-relaxed'

  if (stage === 'preview') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs font-medium text-emerald-700">Your CV draft is ready</span>
          </div>
          <button
            type="button"
            onClick={() => setStage('form')}
            className="text-xs text-apex-muted hover:text-apex-text underline underline-offset-2"
          >
            Edit my answers
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className={`${areaCls} font-mono`}
        />
        <p className="text-xs text-apex-muted">
          Built only from what you told us. Read it through and edit anything, then continue. You can refine it later in Profile.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-apex-muted">
        Answer at least {MIN_SECTIONS} sections. Rough notes are fine, we’ll polish the wording. We only use what you write and never invent anything.
      </p>

      {SECTIONS.map((s) => (
        <div key={s.key} className="space-y-1.5">
          <label className="block text-sm font-medium text-apex-text">
            {s.label}
            {s.hint && <span className="ml-1.5 text-xs font-normal text-apex-muted">{s.hint}</span>}
          </label>
          <textarea
            value={answers[s.key]}
            onChange={(e) => setAnswers((a) => ({ ...a, [s.key]: e.target.value }))}
            placeholder={s.placeholder}
            rows={3}
            maxLength={3000}
            disabled={loading}
            className={areaCls}
          />
        </div>
      ))}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-apex-muted">
          {filled} of {SECTIONS.length} sections filled
        </span>
        <div className="flex items-center gap-3">
          {value?.trim() && (
            <button
              type="button"
              onClick={() => setStage('preview')}
              className="text-xs text-apex-muted hover:text-apex-text underline underline-offset-2"
            >
              Back to draft
            </button>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="px-5 py-2.5 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition-opacity disabled:opacity-40 shadow-md shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
          >
            {loading ? 'Writing your CV…' : value?.trim() ? 'Rebuild my CV' : 'Build my CV'}
          </button>
        </div>
      </div>
    </div>
  )
}
