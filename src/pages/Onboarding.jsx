import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useUser } from '../context/UserContext'

const SECTORS = [
  'Technology',
  'Finance',
  'Marketing',
  'Design',
  'Consulting',
  'Research',
  'Healthcare',
  'Engineering',
  'Law',
  'Other',
]

function StepIndicator({ step }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-apex-muted">Step {step} of 2</span>
        <span className="text-sm text-apex-muted">
          {step === 1 ? 'Personal info' : 'Your CV'}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-apex-blue to-apex-cyan rounded-full transition-all duration-500"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>
    </div>
  )
}

function Onboarding() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', sector: '', country: '' })
  const [cvText, setCvText] = useState('')
  const { updateProfile } = useUser()
  const navigate = useNavigate()

  const handleStep1 = (e) => {
    e.preventDefault()
    setStep(2)
  }

  const handleStep2 = (e) => {
    e.preventDefault()
    updateProfile({ ...form, cvText, onboarded: true })
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-apex-bg flex flex-col">
      <header className="p-6">
        <Link to="/" className="inline-block">
          <Logo size="lg" />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <StepIndicator step={step} />

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            {step === 1 ? (
              <>
                <h1 className="text-2xl font-semibold text-apex-text mb-1">
                  Tell us about yourself
                </h1>
                <p className="text-apex-muted text-sm mb-8">
                  We'll use this to personalize your job matches and recommendations.
                </p>

                <form onSubmit={handleStep1} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-apex-text mb-2">
                      Full name
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Sofia Rossi"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apex-text mb-2">
                      Target sector
                    </label>
                    <select
                      required
                      value={form.sector}
                      onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
                    >
                      <option value="">Select a sector…</option>
                      {SECTORS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apex-text mb-2">
                      Country
                    </label>
                    <input
                      required
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="e.g. Italy"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
                  >
                    Continue →
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-apex-text mb-1">
                  Paste your CV
                </h1>
                <p className="text-apex-muted text-sm mb-8">
                  We'll analyze it to calculate match scores and generate tailored documents.
                </p>

                <form onSubmit={handleStep2} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-apex-text mb-2">
                      CV text
                    </label>
                    <textarea
                      required
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      placeholder="Paste the full text of your CV here…&#10;&#10;Include education, work experience, skills, and any projects or extracurriculars."
                      rows={13}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-3 rounded-lg border border-slate-200 font-medium text-apex-text hover:bg-slate-50 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
                    >
                      Let's go →
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Onboarding
