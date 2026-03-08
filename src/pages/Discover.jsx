import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// ─── Adzuna config ─────────────────────────────────────────────────────────
const APP_ID = '1c090051'
const APP_KEY = '9bbfecc7ea360d1bedae18879b3748bc'

// ─── Country mapping ───────────────────────────────────────────────────────
const COUNTRY_NAME_TO_CODE = {
  'United Kingdom': 'gb', 'UK': 'gb', 'England': 'gb', 'Scotland': 'gb', 'Wales': 'gb', 'Britain': 'gb',
  'United States': 'us', 'USA': 'us', 'US': 'us', 'America': 'us',
  'Australia': 'au', 'Austria': 'at', 'Brazil': 'br', 'Canada': 'ca',
  'Germany': 'de', 'France': 'fr', 'India': 'in', 'Italy': 'it',
  'Mexico': 'mx', 'Netherlands': 'nl', 'Holland': 'nl', 'New Zealand': 'nz',
  'Poland': 'pl', 'Russia': 'ru', 'Singapore': 'sg', 'South Africa': 'za',
}

const SUPPORTED_COUNTRIES = [
  { code: 'gb', label: 'United Kingdom' },
  { code: 'us', label: 'United States' },
  { code: 'au', label: 'Australia' },
  { code: 'at', label: 'Austria' },
  { code: 'br', label: 'Brazil' },
  { code: 'ca', label: 'Canada' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'in', label: 'India' },
  { code: 'it', label: 'Italy' },
  { code: 'mx', label: 'Mexico' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'pl', label: 'Poland' },
  { code: 'ru', label: 'Russia' },
  { code: 'sg', label: 'Singapore' },
  { code: 'za', label: 'South Africa' },
]

const CURRENCY = {
  gb: '£', us: '$', au: 'A$', ca: 'C$', nz: 'NZ$',
  de: '€', fr: '€', it: '€', at: '€', nl: '€',
  pl: 'zł', br: 'R$', in: '₹', mx: '$', ru: '₽', sg: 'S$', za: 'R',
}

// ─── Sector → search query ─────────────────────────────────────────────────
const SECTOR_QUERIES = {
  Technology: 'software engineer developer',
  Finance: 'finance analyst',
  Marketing: 'marketing manager',
  Design: 'product designer UX',
  Consulting: 'consultant analyst',
  Research: 'research analyst scientist',
  Healthcare: 'healthcare medical',
  Engineering: 'engineer',
  Law: 'lawyer legal',
  Other: 'graduate trainee',
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function resolveCountryCode(name) {
  if (!name) return 'gb'
  const trimmed = name.trim()
  if (COUNTRY_NAME_TO_CODE[trimmed]) return COUNTRY_NAME_TO_CODE[trimmed]
  const lower = trimmed.toLowerCase()
  const entry = Object.entries(COUNTRY_NAME_TO_CODE).find(
    ([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()),
  )
  return entry ? entry[1] : 'gb'
}

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'as','is','are','was','were','be','been','have','has','had','do','does','did',
  'will','would','could','should','may','might','can','this','that','these','those',
  'you','we','they','he','she','it','our','your','their','work','role','team','about',
  'more','also','well','using','looking','strong','within','across','based','while',
  'both','into','over','some','able','join','help','good','great','experience','skills',
])

function computeMatch(jobDescription, cvText) {
  if (!cvText || !jobDescription) return 60
  const tokenize = (t) =>
    t.toLowerCase().replace(/[^a-z0-9#+.]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  const jobSet = new Set(tokenize(jobDescription))
  const cvSet = new Set(tokenize(cvText))
  const hits = [...jobSet].filter((k) => cvSet.has(k)).length
  return Math.min(99, Math.max(42, Math.round(50 + (hits / Math.max(jobSet.size, 1)) * 49)))
}

function formatSalary(min, max, countryCode) {
  const sym = CURRENCY[countryCode] || ''
  const fmt = (n) => (n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`)
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  if (max) return `Up to ${fmt(max)}`
  return null
}

const CONTRACT_LABEL = {
  permanent: 'Permanent',
  contract: 'Contract',
  part_time: 'Part Time',
  full_time: 'Full Time',
}

function normalizeJob(raw, countryCode, cvText) {
  const description = (raw.description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return {
    id: raw.id,
    title: raw.title || 'Untitled',
    company: raw.company?.display_name || 'Company',
    location: raw.location?.display_name || '',
    description,
    salary: formatSalary(raw.salary_min, raw.salary_max, countryCode),
    type: CONTRACT_LABEL[raw.contract_type] || raw.contract_type || null,
    url: raw.redirect_url,
    score: computeMatch(description, cvText),
  }
}

// ─── UI sub-components ─────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <div className="flex gap-2">
            <div className="h-5 bg-slate-200 rounded-md w-56" />
            <div className="h-5 bg-slate-200 rounded-full w-20" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
          </div>
          <div className="h-4 bg-slate-200 rounded w-40" />
          <div className="h-4 bg-slate-200 rounded w-full mt-1" />
          <div className="h-4 bg-slate-200 rounded w-4/5" />
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="h-9 bg-slate-200 rounded-lg w-36" />
          <div className="h-9 bg-slate-200 rounded-lg w-36" />
        </div>
      </div>
    </div>
  )
}

function MatchBadge({ score }) {
  const color =
    score >= 80 ? 'bg-green-100 text-green-800'
    : score >= 65 ? 'bg-blue-50 text-apex-blue'
    : 'bg-slate-100 text-apex-muted'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}% match
    </span>
  )
}

const TYPE_COLORS = {
  Permanent: 'bg-emerald-50 text-emerald-700',
  Contract: 'bg-amber-50 text-amber-700',
  'Part Time': 'bg-violet-50 text-violet-700',
  'Full Time': 'bg-emerald-50 text-emerald-700',
}

function JobCard({ job, applied, onApply, onTailor }) {
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 hover:border-apex-blue/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-apex-text">{job.title}</h3>
            <MatchBadge score={job.score} />
            {job.type && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[job.type] || 'bg-slate-100 text-slate-700'}`}>
                {job.type}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-apex-muted mb-3">
            <span className="font-medium text-apex-text">{job.company}</span>
            <span>·</span>
            <span>{job.location}</span>
            {job.salary && (
              <>
                <span>·</span>
                <span className="font-medium text-emerald-700">{job.salary}</span>
              </>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <p className="text-sm text-apex-muted leading-relaxed line-clamp-2">
              {job.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onTailor(job)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
          >
            ✦ Tailor Application
          </button>
          <button
            onClick={() => onApply(job)}
            disabled={applied}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-center ${
              applied
                ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                : 'border border-slate-200 text-apex-text hover:bg-slate-50'
            }`}
          >
            {applied ? '✓ Applied' : 'Mark Applied'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Discover() {
  const { user, applications, addApplication } = useUser()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [appliedIds, setAppliedIds] = useState(() => new Set(applications.map((a) => a.id)))

  const [filters, setFilters] = useState(() => ({
    countryCode: resolveCountryCode(user.country),
    contractType: '',
    salaryMin: '',
    salaryMax: '',
  }))

  const fetchJobs = async (f = filters) => {
    setLoading(true)
    setError(null)
    try {
      const what = SECTOR_QUERIES[user.sector] || 'graduate'
      const params = new URLSearchParams({
        app_id: APP_ID,
        app_key: APP_KEY,
        what,
        results_per_page: '10',
      })
      if (f.contractType) params.set('contract_type', f.contractType)
      if (f.salaryMin) params.set('salary_min', f.salaryMin)
      if (f.salaryMax) params.set('salary_max', f.salaryMax)

      const url = `https://api.adzuna.com/v1/api/jobs/${f.countryCode}/search/1?${params}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const normalized = (data.results || [])
        .map((j) => normalizeJob(j, f.countryCode, user.cvText))
        .sort((a, b) => b.score - a.score)
      setJobs(normalized)
    } catch (err) {
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => { fetchJobs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = (job) => {
    addApplication(job)
    setAppliedIds((prev) => new Set([...prev, job.id]))
  }

  const handleTailor = (job) => {
    navigate('/dashboard/tailoring-lab', { state: { job } })
  }

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-apex-text">Discover</h1>
        <p className="text-apex-muted mt-1">
          {user.sector
            ? `Live ${user.sector} jobs — ranked by your CV match score`
            : 'Find live jobs matched to your profile'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-apex-muted mb-1.5">Country</label>
          <select
            value={filters.countryCode}
            onChange={(e) => setFilter('countryCode', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
          >
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-apex-muted mb-1.5">Contract type</label>
          <select
            value={filters.contractType}
            onChange={(e) => setFilter('contractType', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue"
          >
            <option value="">All types</option>
            <option value="permanent">Permanent</option>
            <option value="contract">Contract</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-apex-muted mb-1.5">Min salary</label>
          <input
            type="number"
            placeholder="e.g. 25000"
            value={filters.salaryMin}
            onChange={(e) => setFilter('salaryMin', e.target.value)}
            className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-apex-muted mb-1.5">Max salary</label>
          <input
            type="number"
            placeholder="e.g. 60000"
            value={filters.salaryMax}
            onChange={(e) => setFilter('salaryMax', e.target.value)}
            className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>

        <button
          onClick={() => fetchJobs()}
          disabled={loading}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>

        {jobs.length > 0 && !loading && (
          <span className="text-xs text-apex-muted self-center ml-auto">
            {jobs.length} jobs found
          </span>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && error && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-apex-muted text-sm mb-4">{error}</p>
            <button
              onClick={() => fetchJobs()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <p className="text-apex-muted text-sm">No jobs found. Try a different country or adjust your filters.</p>
          </div>
        )}

        {!loading &&
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              applied={appliedIds.has(job.id)}
              onApply={handleApply}
              onTailor={handleTailor}
            />
          ))}
      </div>
    </div>
  )
}
