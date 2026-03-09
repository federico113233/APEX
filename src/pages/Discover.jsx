import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// ─── Adzuna config ──────────────────────────────────────────────────────────
const APP_ID  = '1c090051'
const APP_KEY = '9bbfecc7ea360d1bedae18879b3748bc'

// ─── Country name → Adzuna country code ────────────────────────────────────
const COUNTRY_TO_CODE = {
  // English names
  'United Kingdom': 'gb', 'UK': 'gb', 'England': 'gb', 'Britain': 'gb',
  'United States': 'us', 'USA': 'us', 'US': 'us', 'America': 'us',
  'Australia': 'au', 'Austria': 'at', 'Brazil': 'br', 'Canada': 'ca',
  'Germany': 'de', 'France': 'fr', 'India': 'in', 'Italy': 'it',
  'Mexico': 'mx', 'Netherlands': 'nl', 'Holland': 'nl', 'New Zealand': 'nz',
  'Poland': 'pl', 'Russia': 'ru', 'Singapore': 'sg', 'South Africa': 'za',
  'Spain': 'es', 'Switzerland': 'ch', 'Belgium': 'be', 'Sweden': 'se',
  'Norway': 'no', 'Denmark': 'dk', 'Finland': 'fi', 'Portugal': 'pt',
  'Argentina': 'ar', 'Chile': 'cl', 'Colombia': 'co', 'Peru': 'pe',
  // Native names
  'Italia': 'it', 'Deutschland': 'de', 'España': 'es', 'France': 'fr',
  'Nederland': 'nl', 'Polska': 'pl', 'Sverige': 'se', 'Norge': 'no',
}

// Code → country display name (for banner)
const CODE_TO_NAME = Object.fromEntries(
  [
    ['gb','United Kingdom'],['us','United States'],['au','Australia'],
    ['at','Austria'],['br','Brazil'],['ca','Canada'],['de','Germany'],
    ['fr','France'],['in','India'],['it','Italy'],['mx','Mexico'],
    ['nl','Netherlands'],['nz','New Zealand'],['pl','Poland'],['ru','Russia'],
    ['sg','Singapore'],['za','South Africa'],['es','Spain'],['ch','Switzerland'],
    ['be','Belgium'],['se','Sweden'],['no','Norway'],['dk','Denmark'],
    ['fi','Finland'],['pt','Portugal'],['ar','Argentina'],['cl','Chile'],
    ['co','Colombia'],['pe','Peru'],
  ]
)

const SUPPORTED_COUNTRIES = Object.entries(CODE_TO_NAME).map(([code, label]) => ({ code, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

const CURRENCY = {
  gb:'£', us:'$', au:'A$', ca:'C$', nz:'NZ$',
  de:'€', fr:'€', it:'€', at:'€', nl:'€', es:'€', be:'€', pt:'€', fi:'€',
  pl:'zł', br:'R$', in:'₹', mx:'$', ru:'₽', sg:'S$', za:'R',
  ch:'CHF', se:'kr', no:'kr', dk:'kr', ar:'$', cl:'$', co:'$', pe:'S/',
}

// ─── Sector → Adzuna `what` keyword ────────────────────────────────────────
const SECTOR_KEYWORD = {
  Technology:  'software developer',
  Finance:     'finance analyst',
  Marketing:   'marketing',
  Design:      'UX designer',
  Consulting:  'consultant analyst',
  Research:    'research analyst',
  Healthcare:  'healthcare',
  Engineering: 'engineer',
  Law:         'legal lawyer',
  Operations:  'operations',
  Sales:       'sales',
  Product:     'product manager',
  'Data & AI': 'data scientist',
  Education:   'education',
  Other:       'graduate',
}

// ─── Contract type mapping ──────────────────────────────────────────────────
// Adzuna contract_type values: permanent | contract | part_time | full_time
// Internship: pass 'internship' as the user requested, plus add "intern" to `what`
const CONTRACT_TO_ADZUNA = {
  'Full-time':  'full_time',
  'Part-time':  'part_time',
  'Freelance':  'contract',
  'Internship': 'internship',
}

const CONTRACT_LABEL = {
  permanent:   'Permanent',
  contract:    'Contract',
  part_time:   'Part Time',
  full_time:   'Full Time',
  internship:  'Internship',
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function resolveCountryCode(name) {
  if (!name) return 'gb'
  const t = name.trim()
  if (COUNTRY_TO_CODE[t]) return COUNTRY_TO_CODE[t]
  const lower = t.toLowerCase()
  const entry = Object.entries(COUNTRY_TO_CODE).find(
    ([k]) => k.toLowerCase() === lower || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  )
  return entry ? entry[1] : 'gb'
}

/** Build the `what` query: sector keyword only, no contract type modifier */
function buildWhat(sectors = []) {
  const primary = sectors[0]
  return primary ? (SECTOR_KEYWORD[primary] || primary.toLowerCase()) : ''
}

/** Build the `where` param: city only — country is already in the URL path */
function buildWhere(city = '') {
  return city.trim()
}

/** Human-readable search description for the banner */
function buildBannerText(sectors, contractType, city, countryCode) {
  const sectorLabel = sectors.length ? sectors.slice(0, 2).join(' & ') : 'All sectors'
  const contractLabel = contractType || 'all contract types'
  const place = city || CODE_TO_NAME[countryCode] || countryCode.toUpperCase()
  return `${sectorLabel} · ${contractLabel} · ${place}`
}

function formatSalary(min, max, countryCode) {
  const sym = CURRENCY[countryCode] || ''
  const fmt = (n) => (n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`)
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  if (max) return `Up to ${fmt(max)}`
  return null
}

// ─── Stop words for keyword matching ───────────────────────────────────────
const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'as','is','are','was','were','be','been','have','has','had','do','does','did',
  'will','would','could','should','may','might','can','this','that','these','those',
  'you','we','they','he','she','it','our','your','their','work','role','team','about',
  'more','also','well','using','looking','strong','within','across','based','while',
  'both','into','over','some','able','join','help','good','great','experience','skills',
])

// ─── Match score ────────────────────────────────────────────────────────────
function computeMatch(raw, countryCode, filters, user) {
  const description   = (raw.description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  const contractType  = CONTRACT_LABEL[raw.contract_type] || raw.contract_type || ''
  const locationStr   = (raw.location?.display_name || '').toLowerCase()

  // Base: CV keyword overlap (50–99)
  const tokenize = (t) =>
    t.toLowerCase().replace(/[^a-z0-9#+.]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  let score = 60
  if (user.cvText && description) {
    const jobSet = new Set(tokenize(description))
    const cvSet  = new Set(tokenize(user.cvText))
    const hits   = [...jobSet].filter((k) => cvSet.has(k)).length
    score = Math.round(50 + (hits / Math.max(jobSet.size, 1)) * 49)
  }

  // ── Contract type penalty ──────────────────────────────────────────────
  const userContract  = user.contractType || ''
  const contractLower = contractType.toLowerCase()
  const descLower     = description.toLowerCase()

  if (userContract === 'Internship') {
    const isIntern = contractLower.includes('intern') || descLower.includes('intern') || descLower.includes('stage') || descLower.includes('stagista') || descLower.includes('tirocinio')
    if (!isIntern) score -= 35
  } else if (userContract === 'Full-time') {
    if (contractLower.includes('part') || descLower.includes('internship') || contractLower.includes('intern')) score -= 30
  } else if (userContract === 'Part-time') {
    if (!contractLower.includes('part')) score -= 25
  } else if (userContract === 'Freelance') {
    if (!contractLower.includes('contract') && !contractLower.includes('freelance')) score -= 20
  }

  // ── Work mode penalty ──────────────────────────────────────────────────
  if (user.workMode === 'Remote') {
    if (!descLower.includes('remote') && !descLower.includes('work from home') && !descLower.includes('wfh'))
      score -= 15
  }

  // ── Location penalty ───────────────────────────────────────────────────
  const countryName = (CODE_TO_NAME[countryCode] || '').toLowerCase()
  if (countryName && !locationStr.includes(countryName) && locationStr.length > 0)
    score -= 20

  const city = (user.city || '').toLowerCase()
  if (city && !locationStr.includes(city))
    score -= 12

  // ── Salary penalty ─────────────────────────────────────────────────────
  if (user.salaryMin && raw.salary_max && raw.salary_max < Number(user.salaryMin))
    score -= 18

  // ── Sector match bonus ─────────────────────────────────────────────────
  const sectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []
  if (sectors.length) {
    const sectorKws = sectors.flatMap((s) => (SECTOR_KEYWORD[s] || s).toLowerCase().split(' '))
    const matches = sectorKws.filter((kw) => descLower.includes(kw)).length
    if (matches === 0) score -= 10
    else if (matches >= 2) score += 5
  }

  return Math.min(99, Math.max(10, score))
}

function normalizeJob(raw, countryCode, filters, user) {
  const description  = (raw.description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  const contractType = CONTRACT_LABEL[raw.contract_type] || raw.contract_type || null
  const score        = computeMatch(raw, countryCode, filters, user)

  return {
    id:          raw.id,
    title:       raw.title || 'Untitled',
    company:     raw.company?.display_name || 'Company',
    location:    raw.location?.display_name || '',
    description,
    salary:      formatSalary(raw.salary_min, raw.salary_max, countryCode),
    type:        contractType,
    url:         raw.redirect_url,
    score,
  }
}

// ─── UI sub-components ──────────────────────────────────────────────────────
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
    : score >= 45 ? 'bg-slate-100 text-slate-600'
    : 'bg-red-50 text-red-500'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}% match
    </span>
  )
}

const TYPE_COLORS = {
  Permanent:   'bg-emerald-50 text-emerald-700',
  Contract:    'bg-amber-50 text-amber-700',
  'Part Time': 'bg-violet-50 text-violet-700',
  'Full Time': 'bg-emerald-50 text-emerald-700',
  Internship:  'bg-blue-50 text-apex-blue',
}

function JobCard({ job, applied, onApply, onTailor }) {
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 hover:border-apex-blue/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-apex-text">{job.title}</h3>
            <MatchBadge score={job.score} />
            {job.type && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[job.type] || 'bg-slate-100 text-slate-700'}`}>
                {job.type}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-apex-muted mb-3">
            <span className="font-medium text-apex-text">{job.company}</span>
            <span>·</span>
            <span>{job.location}</span>
            {job.salary && <><span>·</span><span className="font-medium text-emerald-700">{job.salary}</span></>}
          </div>
          {job.description && (
            <p className="text-sm text-apex-muted leading-relaxed line-clamp-2">{job.description}</p>
          )}
        </div>
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

function EmptyState({ filters, onBroaden }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-8 py-14 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 className="font-semibold text-apex-text mb-1">No jobs found</h3>
      <p className="text-sm text-apex-muted mb-5 max-w-sm mx-auto">
        Adzuna didn't return results for your current filters. Try broadening your search.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {filters.where && (
          <button onClick={() => onBroaden('where')}
            className="px-3.5 py-1.5 rounded-full text-sm border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors">
            Remove location filter
          </button>
        )}
        {filters.contractType && (
          <button onClick={() => onBroaden('contractType')}
            className="px-3.5 py-1.5 rounded-full text-sm border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors">
            Remove contract type filter
          </button>
        )}
        {(filters.salaryMin || filters.salaryMax) && (
          <button onClick={() => onBroaden('salary')}
            className="px-3.5 py-1.5 rounded-full text-sm border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors">
            Remove salary filter
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function Discover() {
  const { user, applications, addApplication } = useUser()
  const navigate = useNavigate()

  const [jobs, setJobs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [banner, setBanner]       = useState(null)   // search context shown after fetch
  const [appliedIds, setAppliedIds] = useState(
    () => new Set(applications.map((a) => a.id))
  )

  // Filters — pre-populated from user profile
  const [filters, setFilters] = useState(() => ({
    countryCode:  resolveCountryCode(user.country),
    where:        user.city || '',
    contractType: CONTRACT_TO_ADZUNA[user.contractType] || '',
    salaryMin:    user.salaryMin  || '',
    salaryMax:    user.salaryMax  || '',
  }))

  const sectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []

  const fetchJobs = async (f = filters) => {
    setLoading(true)
    setError(null)
    try {
      const what  = buildWhat(sectors)   // sector keyword only, no modifiers
      const where = buildWhere(f.where)  // city only, never country name

      // Build URL manually — encodeURIComponent on all dynamic values
      // contract_type is NOT sent to Adzuna (unsupported); filtered client-side
      let query = `app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=10&content-type=application/json`
      if (what)        query += `&what=${encodeURIComponent(what)}`
      if (where)       query += `&where=${encodeURIComponent(where)}`
      if (f.salaryMin) query += `&salary_min=${encodeURIComponent(f.salaryMin)}`
      if (f.salaryMax) query += `&salary_max=${encodeURIComponent(f.salaryMax)}`

      const url = `/api/adzuna/v1/api/jobs/${f.countryCode}/search/1?${query}`
      console.log('[Adzuna] GET', url.replace(APP_KEY, '***'))

      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error('[Adzuna] Error', res.status, body)
        throw new Error(`Adzuna API error ${res.status}`)
      }
      const data = await res.json()

      let normalized = (data.results || [])
        .map((j) => normalizeJob(j, f.countryCode, f, user))

      // Client-side contract type filter (Adzuna doesn't support contract_type reliably)
      if (f.contractType) {
        const keep = f.contractType.toLowerCase().replace('_', ' ')
        normalized = normalized.filter((j) => {
          const t = (j.type || '').toLowerCase()
          return t.includes(keep) || t === keep
        })
      }

      normalized.sort((a, b) => b.score - a.score)
      setJobs(normalized)
      setBanner({
        text: buildBannerText(sectors, user.contractType, f.where, f.countryCode),
        count: normalized.length,
        what,
        where,
      })
    } catch (err) {
      console.error('[Discover] fetch error:', err)
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = (job) => {
    addApplication(job)
    setAppliedIds((prev) => new Set([...prev, job.id]))
  }

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }))

  const handleBroaden = (key) => {
    const updated = { ...filters }
    if (key === 'where')        updated.where = ''
    if (key === 'contractType') updated.contractType = ''
    if (key === 'salary')       { updated.salaryMin = ''; updated.salaryMax = '' }
    setFilters(updated)
    fetchJobs(updated)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-apex-text">Discover</h1>
        <p className="text-apex-muted mt-1">Live jobs ranked by your profile match score</p>
      </div>

      {/* Search context banner */}
      {banner && !loading && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5 bg-blue-50 border border-blue-100 rounded-xl text-sm">
          <svg className="w-4 h-4 text-apex-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-apex-blue font-medium">Showing results for:</span>
          <span className="text-apex-text">{banner.text}</span>
          <span className="ml-auto text-apex-muted flex-shrink-0">{banner.count} jobs found</span>
        </div>
      )}

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
          <label className="block text-xs font-medium text-apex-muted mb-1.5">City / Location</label>
          <input
            value={filters.where}
            onChange={(e) => setFilter('where', e.target.value)}
            placeholder="e.g. Milan"
            className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
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
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-apex-muted mb-1.5">Min salary</label>
          <input
            type="number"
            placeholder="e.g. 25000"
            value={filters.salaryMin}
            onChange={(e) => setFilter('salaryMin', e.target.value)}
            className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-apex-muted mb-1.5">Max salary</label>
          <input
            type="number"
            placeholder="e.g. 60000"
            value={filters.salaryMax}
            onChange={(e) => setFilter('salaryMax', e.target.value)}
            className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>

        <button
          onClick={() => fetchJobs()}
          disabled={loading}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
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
            <button onClick={() => fetchJobs()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <EmptyState filters={filters} onBroaden={handleBroaden} />
        )}

        {!loading && jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            applied={appliedIds.has(job.id)}
            onApply={handleApply}
            onTailor={(j) => navigate('/dashboard/tailoring-lab', { state: { job: j } })}
          />
        ))}
      </div>
    </div>
  )
}
