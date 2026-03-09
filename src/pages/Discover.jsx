import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// ─── Adzuna config ──────────────────────────────────────────────────────────
const APP_ID  = '1c090051'
const APP_KEY = '9bbfecc7ea360d1bedae18879b3748bc'

// ─── Country name → Adzuna country code ────────────────────────────────────
const COUNTRY_TO_CODE = {
  'United Kingdom': 'gb', 'UK': 'gb', 'England': 'gb', 'Britain': 'gb',
  'United States': 'us', 'USA': 'us', 'US': 'us', 'America': 'us',
  'Australia': 'au', 'Austria': 'at', 'Brazil': 'br', 'Canada': 'ca',
  'Germany': 'de', 'France': 'fr', 'India': 'in', 'Italy': 'it',
  'Mexico': 'mx', 'Netherlands': 'nl', 'Holland': 'nl', 'New Zealand': 'nz',
  'Poland': 'pl', 'Russia': 'ru', 'Singapore': 'sg', 'South Africa': 'za',
  'Spain': 'es', 'Switzerland': 'ch', 'Belgium': 'be', 'Sweden': 'se',
  'Norway': 'no', 'Denmark': 'dk', 'Finland': 'fi', 'Portugal': 'pt',
  'Argentina': 'ar', 'Chile': 'cl', 'Colombia': 'co', 'Peru': 'pe',
  'Italia': 'it', 'Deutschland': 'de', 'España': 'es',
  'Nederland': 'nl', 'Polska': 'pl', 'Sverige': 'se', 'Norge': 'no',
}

const CODE_TO_NAME = Object.fromEntries([
  ['gb','United Kingdom'],['us','United States'],['au','Australia'],
  ['at','Austria'],['br','Brazil'],['ca','Canada'],['de','Germany'],
  ['fr','France'],['in','India'],['it','Italy'],['mx','Mexico'],
  ['nl','Netherlands'],['nz','New Zealand'],['pl','Poland'],['ru','Russia'],
  ['sg','Singapore'],['za','South Africa'],['es','Spain'],['ch','Switzerland'],
  ['be','Belgium'],['se','Sweden'],['no','Norway'],['dk','Denmark'],
  ['fi','Finland'],['pt','Portugal'],['ar','Argentina'],['cl','Chile'],
  ['co','Colombia'],['pe','Peru'],
])

const SUPPORTED_COUNTRIES = Object.entries(CODE_TO_NAME)
  .map(([code, label]) => ({ code, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

const CURRENCY = {
  gb:'£', us:'$', au:'A$', ca:'C$', nz:'NZ$',
  de:'€', fr:'€', it:'€', at:'€', nl:'€', es:'€', be:'€', pt:'€', fi:'€',
  pl:'zł', br:'R$', in:'₹', mx:'$', ru:'₽', sg:'S$', za:'R',
  ch:'CHF', se:'kr', no:'kr', dk:'kr', ar:'$', cl:'$', co:'$', pe:'S/',
}

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

const CONTRACT_LABEL = {
  permanent:  'Permanent',
  contract:   'Contract',
  part_time:  'Part Time',
  full_time:  'Full Time',
  internship: 'Internship',
}

const INTERN_WORDS = ['intern', 'internship', 'stage', 'tirocinio', 'trainee', 'graduate']

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

function buildWhere(city = '') { return city.trim() }

function formatSalary(min, max, countryCode) {
  const sym = CURRENCY[countryCode] || ''
  const fmt = (n) => (n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`)
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  if (max) return `Up to ${fmt(max)}`
  return null
}

// ─── Match score ─────────────────────────────────────────────────────────────
/**
 * Additive match score based on 4 profile criteria.
 * Each criterion is included only if the user has set that preference.
 * Points are scaled proportionally so the total always sums to 100.
 *
 *   Country  30 pts  (always present — API already filters by country)
 *   City     20 pts  (only if user.city is set)
 *   Sector   25 pts  (only if user.sectors is set)
 *   Contract 25 pts  (only if user.contractType is set)
 */
function computeMatch(raw, countryCode, user) {
  const title       = (raw.title || '').toLowerCase()
  const description = (raw.description || '').replace(/<[^>]*>/g, '').toLowerCase()
  const locationStr = (raw.location?.display_name || '').toLowerCase()
  const sectors     = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []

  const criteria = []  // { weight, score } — score is 0 or 100

  // 1. Country — always added; API path already filters by country → always correct
  criteria.push({ weight: 30, score: 100 })

  // 2. City — only if user has set a city preference
  const city = (user.city || '').toLowerCase().trim()
  if (city) {
    criteria.push({ weight: 20, score: locationStr.includes(city) ? 100 : 0 })
  }

  // 3. Sector — check title AND description for sector keywords
  if (sectors.length) {
    const sectorKws = sectors
      .flatMap((s) => (SECTOR_KEYWORD[s] || s).toLowerCase().split(' '))
      .filter((kw) => kw.length > 2)
    const haystack = `${title} ${description}`
    const hits = sectorKws.filter((kw) => haystack.includes(kw)).length
    criteria.push({ weight: 25, score: hits > 0 ? 100 : 0 })
  }

  // 4. Contract type — check title for internship/non-internship signals
  const userContract = user.contractType || ''
  if (userContract) {
    const titleHasIntern = INTERN_WORDS.some((w) => title.includes(w))
    const descHasIntern  = INTERN_WORDS.some((w) => description.includes(w))

    if (userContract === 'Internship') {
      // Score 100 if title has intern word, 50 if only description, 0 otherwise
      const s = titleHasIntern ? 100 : descHasIntern ? 50 : 0
      criteria.push({ weight: 25, score: s })
    } else if (userContract === 'Full-time' || userContract === 'Part-time') {
      // Penalise jobs whose title clearly signals internship
      criteria.push({ weight: 25, score: titleHasIntern ? 0 : 100 })
    } else {
      // Freelance or other — no strong signal available
      criteria.push({ weight: 25, score: 80 })
    }
  }

  // Proportional scaling: total active weights → 100
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)
  if (!totalWeight) return 50

  const score = Math.round(
    criteria.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
  )
  return Math.min(100, Math.max(5, score))
}

function normalizeJob(raw, countryCode, user) {
  const description  = (raw.description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  const contractType = CONTRACT_LABEL[raw.contract_type] || raw.contract_type || null
  const score        = computeMatch(raw, countryCode, user)

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
    score === 100 ? 'text-white shadow-sm shadow-emerald-500/30'
    : score >= 80  ? 'text-white shadow-sm shadow-green-500/30'
    : score >= 60  ? 'bg-blue-50 text-blue-700'
    : score >= 35  ? 'bg-slate-100 text-slate-600'
    : 'bg-red-50 text-red-500'
  const gradient =
    score === 100 ? 'linear-gradient(135deg,#10b981,#059669)'
    : score >= 80  ? 'linear-gradient(135deg,#22c55e,#16a34a)'
    : null
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}
      style={gradient ? { background: gradient } : {}}
    >
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
    <div className="p-6 bg-white rounded-xl border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-700 transition-colors">{job.title}</h3>
            <MatchBadge score={job.score} />
            {job.type && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[job.type] || 'bg-slate-100 text-slate-600'}`}>
                {job.type}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm mb-3">
            <span className="font-semibold text-slate-700">{job.company}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{job.location}</span>
            {job.salary && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-emerald-600 text-xs">{job.salary}</span>
              </>
            )}
          </div>
          {job.description && (
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{job.description}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0 min-w-[148px]">
          <button
            onClick={() => onTailor(job)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
          >
            ✦ Tailor Application
          </button>
          <button
            onClick={() => onApply(job)}
            disabled={applied}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-center ${
              applied
                ? 'bg-green-50 text-green-700 border border-green-100 cursor-default'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {applied ? '✓ Applied' : 'Mark Applied'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ hasCity, hasContract, onBroaden }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-8 py-14 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 className="font-semibold text-apex-text mb-1">No jobs found</h3>
      <p className="text-sm text-apex-muted mb-5 max-w-sm mx-auto">
        No results for your current filters. Try broadening your search.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {hasCity && (
          <button onClick={() => onBroaden('where')}
            className="px-3.5 py-1.5 rounded-full text-sm border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors">
            Remove city filter
          </button>
        )}
        {hasContract && (
          <button onClick={() => onBroaden('contractType')}
            className="px-3.5 py-1.5 rounded-full text-sm border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors">
            Show all contract types
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
  const abortRef = useRef(null)

  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [banner, setBanner]         = useState(null)
  const [keyword, setKeyword]       = useState('')       // search bar input
  const [activeKeyword, setActiveKeyword] = useState('') // keyword used in last fetch
  const [appliedIds, setAppliedIds] = useState(
    () => new Set(applications.map((a) => a.id))
  )

  const [filters, setFilters] = useState(() => ({
    countryCode: resolveCountryCode(user.country),
    where:       '',   // start empty — user types city in English
    salaryMin:   user.salaryMin || '',
    salaryMax:   user.salaryMax || '',
  }))

  const sectors     = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []
  const userContract = user.contractType || ''

  const fetchJobs = async (f = filters, kw = activeKeyword) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      // `what`: keyword from search bar takes priority; fall back to sector keyword
      const sectorKw = sectors.length
        ? (SECTOR_KEYWORD[sectors[0]] || sectors[0].toLowerCase())
        : ''
      const what  = (kw.trim() || sectorKw).trim()
      const where = buildWhere(f.where)

      const params = new URLSearchParams({
        country: f.countryCode,
        app_id: APP_ID,
        app_key: APP_KEY,
        results_per_page: 20,
      })
      if (what)        params.set('what', what)
      if (where)       params.set('where', where)
      if (f.salaryMin) params.set('salary_min', f.salaryMin)
      if (f.salaryMax) params.set('salary_max', f.salaryMax)

      const url = `/api/adzuna?${params.toString()}`
      console.log('[Adzuna] GET', url.replace(APP_KEY, '***'))

      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error('[Adzuna] Error', res.status, body)
        throw new Error(`Adzuna API error ${res.status}`)
      }
      const data = await res.json()
      console.log('[Adzuna] total:', data.count, '— page results:', data.results?.length)

      let normalized = (data.results || []).map((j) => normalizeJob(j, f.countryCode, user))

      // ── Contract type hard filter ─────────────────────────────────────────
      if (userContract === 'Internship') {
        normalized = normalized.filter((j) => {
          const haystack = `${j.title} ${j.description}`.toLowerCase()
          return INTERN_WORDS.some((w) => haystack.includes(w))
        })
      } else if (userContract === 'Full-time' || userContract === 'Part-time') {
        normalized = normalized.filter((j) => {
          const title = j.title.toLowerCase()
          return !title.includes('intern') && !title.includes('trainee')
        })
      }

      normalized.sort((a, b) => b.score - a.score)
      setJobs(normalized)

      const place = where || CODE_TO_NAME[f.countryCode] || f.countryCode.toUpperCase()
      const searchDesc = [kw.trim() || sectorKw || 'All jobs', place].filter(Boolean).join(' · ')
      setBanner({ text: searchDesc, count: normalized.length })
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[Discover] fetch error:', err)
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setActiveKeyword(keyword)
    fetchJobs(filters, keyword)
  }

  const handleApply = (job) => {
    addApplication(job)
    setAppliedIds((prev) => new Set([...prev, job.id]))
  }

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }))

  const handleBroaden = (key) => {
    const updated = { ...filters }
    if (key === 'where') updated.where = ''
    setFilters(updated)
    fetchJobs(updated, activeKeyword)
  }

  return (
    <div className="p-8 page-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Discover</h1>
        <p className="text-slate-500 mt-1 text-sm">Live jobs ranked by your profile match score</p>
      </div>

      {/* ── Main search bar ── */}
      <div className="mb-4">
        <div className="flex gap-3 items-center bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-150">
          <svg className="w-5 h-5 text-apex-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="keyword-search"
            name="keyword-search"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search jobs, skills, companies…"
            className="flex-1 text-apex-text placeholder-slate-400 bg-transparent outline-none text-base"
          />
          {keyword && (
            <button
              onClick={() => { setKeyword(''); setActiveKeyword(''); fetchJobs(filters, '') }}
              className="text-slate-400 hover:text-apex-text transition-colors flex-shrink-0"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60 flex-shrink-0"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* ── Secondary filters ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="filter-country" className="block text-xs font-medium text-apex-muted mb-1.5">Country</label>
          <select
            id="filter-country"
            name="filter-country"
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
          <label htmlFor="filter-city" className="block text-xs font-medium text-apex-muted mb-1.5">City</label>
          <input
            id="filter-city"
            name="filter-city"
            value={filters.where}
            onChange={(e) => setFilter('where', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchJobs()}
            placeholder="e.g. Milan, Rome"
            className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>

        <div>
          <label htmlFor="filter-salary-min" className="block text-xs font-medium text-apex-muted mb-1.5">Min salary</label>
          <input
            id="filter-salary-min"
            name="filter-salary-min"
            type="number"
            placeholder="e.g. 25000"
            value={filters.salaryMin}
            onChange={(e) => setFilter('salaryMin', e.target.value)}
            className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>

        <div>
          <label htmlFor="filter-salary-max" className="block text-xs font-medium text-apex-muted mb-1.5">Max salary</label>
          <input
            id="filter-salary-max"
            name="filter-salary-max"
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
          className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-apex-text hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          Apply filters
        </button>
      </div>

      {/* Search context banner */}
      {banner && !loading && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5 bg-blue-50 border border-blue-100 rounded-xl text-sm">
          <svg className="w-4 h-4 text-apex-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-apex-blue font-medium">Results for:</span>
          <span className="text-apex-text">{banner.text}</span>
          <span className="ml-auto text-apex-muted flex-shrink-0">{banner.count} jobs</span>
        </div>
      )}

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
          <EmptyState
            hasCity={!!filters.where}
            hasContract={!!userContract}
            onBroaden={handleBroaden}
          />
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
