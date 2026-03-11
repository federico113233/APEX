import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import AddJobModal from '../components/AddJobModal'

// ─── Search history ──────────────────────────────────────────────────────────
const HISTORY_KEY = 'apex_search_history'
const MAX_HISTORY = 8

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] }
  catch { return [] }
}

function saveToHistory(term) {
  if (!term.trim()) return
  const prev = loadHistory().filter(t => t !== term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify([term, ...prev].slice(0, MAX_HISTORY)))
}

function removeFromHistory(term) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter(t => t !== term)))
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

// ─── Adzuna config ───────────────────────────────────────────────────────────
const APP_ID  = '1c090051'
const APP_KEY = '9bbfecc7ea360d1bedae18879b3748bc'

const COUNTRY_TO_CODE = {
  'United Kingdom':'gb','UK':'gb','England':'gb','Britain':'gb',
  'United States':'us','USA':'us','US':'us','America':'us',
  'Australia':'au','Austria':'at','Brazil':'br','Canada':'ca',
  'Germany':'de','France':'fr','India':'in','Italy':'it',
  'Mexico':'mx','Netherlands':'nl','Holland':'nl','New Zealand':'nz',
  'Poland':'pl','Russia':'ru','Singapore':'sg','South Africa':'za',
  'Spain':'es','Switzerland':'ch','Belgium':'be','Sweden':'se',
  'Norway':'no','Denmark':'dk','Finland':'fi','Portugal':'pt',
  'Argentina':'ar','Chile':'cl','Colombia':'co','Peru':'pe',
  'Italia':'it','Deutschland':'de','España':'es',
  'Nederland':'nl','Polska':'pl','Sverige':'se','Norge':'no',
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
  gb:'£',us:'$',au:'A$',ca:'C$',nz:'NZ$',
  de:'€',fr:'€',it:'€',at:'€',nl:'€',es:'€',be:'€',pt:'€',fi:'€',
  pl:'zł',br:'R$',in:'₹',mx:'$',ru:'₽',sg:'S$',za:'R',
  ch:'CHF',se:'kr',no:'kr',dk:'kr',ar:'$',cl:'$',co:'$',pe:'S/',
}

const SECTOR_KEYWORD = {
  Technology:'software developer',Finance:'finance analyst',
  Marketing:'marketing',Design:'UX designer',Consulting:'consultant analyst',
  Research:'research analyst',Healthcare:'healthcare',Engineering:'engineer',
  Law:'legal lawyer',Operations:'operations',Sales:'sales',
  Product:'product manager','Data & AI':'data scientist',
  Education:'education',Other:'graduate',
}

const CONTRACT_LABEL = {
  permanent:'Permanent',contract:'Contract',
  part_time:'Part Time',full_time:'Full Time',internship:'Internship',
}

const INTERN_WORDS = ['intern','internship','stage','tirocinio','trainee','graduate']
const CONTRACT_OPTIONS = ['Internship','Full-time','Part-time','Freelance']
const WORK_MODE_OPTIONS = ['Remote','Hybrid','On-site']
const SECTORS_LIST = Object.keys(SECTOR_KEYWORD).sort()
const EDU_LEVELS = ['Any',"High School","Bachelor's","Master's",'PhD']
const EDU_RANK   = {'Any':0,'High School':1,"Bachelor's":2,"Master's":3,'PhD':4}

const DEFAULT_FF = { contractTypes:[], workModes:[], sector:'', minEdu:'Any' }

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function formatSalary(min, max, cc) {
  const s = CURRENCY[cc] || ''
  const f = n => n >= 1000 ? `${s}${(n/1000).toFixed(0)}k` : `${s}${n}`
  if (min && max) return `${f(min)} – ${f(max)}`
  if (min) return `From ${f(min)}`
  if (max) return `Up to ${f(max)}`
  return null
}

function fmtSalaryLabel(min, max, cc) {
  const s = CURRENCY[cc] || ''
  const f = n => n >= 1000 ? `${s}${Math.round(n/1000)}k` : `${s}${n}`
  if (min && max) return `${f(min)}–${f(max)}`
  if (min) return `≥ ${f(min)}`
  if (max) return `≤ ${f(max)}`
  return 'Salary'
}

function detectEducation(desc) {
  const d = desc.toLowerCase()
  if (/phd|doctorate|dottorato/.test(d)) return 'PhD'
  if (/\bmaster\b|mba|laurea magistrale/.test(d)) return "Master's"
  if (/bachelor|laurea triennale|\bdegree\b/.test(d)) return "Bachelor's"
  if (/high school|diploma/.test(d)) return 'High School'
  return 'Any'
}

function detectWorkMode(title, desc) {
  const h = `${title} ${desc}`.toLowerCase()
  const modes = []
  if (/remote|da remoto|fully remote|work from home|\bwfh\b/.test(h)) modes.push('Remote')
  if (/hybrid|ibrido/.test(h)) modes.push('Hybrid')
  if (/on.?site|in.?office|in office|on site|in presenza/.test(h)) modes.push('On-site')
  return modes
}

function applyFrontendFilters(jobs, ff, hasKeyword) {
  let r = jobs

  // CONTRACT TYPE — include if not explicitly specified, exclude only on explicit contradiction
  if (ff.contractTypes.length > 0) {
    r = r.filter(j => {
      const h = `${j.title} ${j.description}`.toLowerCase()
      const isIntern    = INTERN_WORDS.some(w => h.includes(w))
      const isPartTime  = j.type === 'Part Time'  || /part.time/.test(h)
      const isFreelance = j.type === 'Contract'   || /freelance|contractor/.test(h)
      const isFullTime  = j.type === 'Full Time'  || j.type === 'Permanent'
      // If no contract type is detectable → always show
      if (!isIntern && !isPartTime && !isFreelance && !isFullTime) return true
      // Explicitly detected → show only if it matches a selected type
      return ff.contractTypes.some(ct => {
        if (ct === 'Internship') return isIntern
        if (ct === 'Part-time')  return isPartTime
        if (ct === 'Freelance')  return isFreelance
        if (ct === 'Full-time')  return isFullTime
        return false
      })
    })
  }

  // WORK MODE — include if not explicitly specified, exclude only on explicit contradiction
  if (ff.workModes.length > 0) {
    r = r.filter(j => {
      if (j.workModes.length === 0) return true // not specified → always show
      return ff.workModes.some(m => j.workModes.includes(m))
    })
  }

  // Sector as frontend filter only when keyword is also active
  if (hasKeyword && ff.sector) {
    const kws = (SECTOR_KEYWORD[ff.sector] || ff.sector).toLowerCase().split(' ').filter(k => k.length > 2)
    r = r.filter(j => {
      const h = `${j.title} ${j.description}`.toLowerCase()
      return kws.some(kw => h.includes(kw))
    })
  }

  // EDUCATION — include if not specified, exclude only if job requires a HIGHER level
  if (ff.minEdu && ff.minEdu !== 'Any') {
    const selectedRank = EDU_RANK[ff.minEdu]
    r = r.filter(j => {
      if (j.education === 'Any') return true // not mentioned → always show
      return EDU_RANK[j.education] <= selectedRank // exclude only if requires MORE
    })
  }

  return r
}

// ─── Match score ──────────────────────────────────────────────────────────────
function computeMatch(raw, countryCode, user) {
  const title       = (raw.title || '').toLowerCase()
  const description = (raw.description || '').replace(/<[^>]*>/g,'').toLowerCase()
  const locationStr = (raw.location?.display_name || '').toLowerCase()
  const sectors     = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []
  const criteria    = []

  criteria.push({ weight:30, score:100 })

  const city = (user.city || '').toLowerCase().trim()
  if (city) criteria.push({ weight:20, score: locationStr.includes(city) ? 100 : 0 })

  if (sectors.length) {
    const kws = sectors.flatMap(s => (SECTOR_KEYWORD[s] || s).toLowerCase().split(' ')).filter(k => k.length > 2)
    const haystack = `${title} ${description}`
    criteria.push({ weight:25, score: kws.some(k => haystack.includes(k)) ? 100 : 0 })
  }

  const uc = user.contractType || ''
  if (uc) {
    const titleIntern = INTERN_WORDS.some(w => title.includes(w))
    const descIntern  = INTERN_WORDS.some(w => description.includes(w))
    if (uc === 'Internship') criteria.push({ weight:25, score: titleIntern ? 100 : descIntern ? 50 : 0 })
    else if (uc === 'Full-time' || uc === 'Part-time') criteria.push({ weight:25, score: titleIntern ? 0 : 100 })
    else criteria.push({ weight:25, score:80 })
  }

  const total = criteria.reduce((s,c) => s + c.weight, 0)
  if (!total) return 50
  return Math.min(100, Math.max(5, Math.round(criteria.reduce((s,c) => s + c.score*c.weight, 0) / total)))
}

function normalizeJob(raw, countryCode, user) {
  const description  = (raw.description || '').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim()
  const contractType = CONTRACT_LABEL[raw.contract_type] || raw.contract_type || null
  const title        = raw.title || 'Untitled'
  const score        = computeMatch(raw, countryCode, user)

  const profileSectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []
  let inProfileSector = true
  if (profileSectors.length > 0) {
    const kws = profileSectors
      .flatMap(s => (SECTOR_KEYWORD[s] || s).toLowerCase().split(' '))
      .filter(k => k.length > 2)
    const h = `${title} ${description}`.toLowerCase()
    inProfileSector = kws.some(k => h.includes(k))
  }

  return {
    id: raw.id, title, company: raw.company?.display_name || 'Company',
    location: raw.location?.display_name || '', description,
    salary: formatSalary(raw.salary_min, raw.salary_max, countryCode),
    type: contractType, url: raw.redirect_url, score,
    workModes: detectWorkMode(title, description),
    education: detectEducation(description),
    inProfileSector,
  }
}

// ─── UI components ────────────────────────────────────────────────────────────

function FilterChip({ label, isActive, isOpen, onToggle, children }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onToggle() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen, onToggle])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap ${
          isActive
            ? 'text-white border-transparent shadow-sm'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
        style={isActive ? { background: 'linear-gradient(135deg,#2563EB,#38BDF8)' } : {}}
      >
        {label}
        <svg
          className={`w-3 h-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl">
          {children}
        </div>
      )}
    </div>
  )
}

function MultiSelectContent({ options, selected, onChange }) {
  return (
    <div className="p-2 min-w-[180px]">
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(on ? selected.filter(v => v !== opt) : [...selected, opt])}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              on ? 'bg-blue-50 text-apex-blue font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
              on ? 'bg-apex-blue border-apex-blue' : 'border-slate-300'
            }`}>
              {on && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            {opt}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-1 w-full text-xs text-center text-apex-muted hover:text-apex-text py-1 border-t border-slate-100"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function SingleSelectContent({ options, value, onChange, allLabel = 'Any' }) {
  const [search, setSearch] = useState('')
  const showSearch = options.length > 8
  const filtered = showSearch
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <div className="min-w-[210px]">
      {showSearch && (
        <div className="p-2 border-b border-slate-100">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            autoFocus
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-apex-blue"
          />
        </div>
      )}
      <div className="p-1 max-h-52 overflow-y-auto">
        {!search && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              !value ? 'bg-blue-50 text-apex-blue font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            {allLabel}
          </button>
        )}
        {filtered.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              value === opt ? 'bg-blue-50 text-apex-blue font-medium' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opt}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-3 px-3">No results</p>
        )}
      </div>
    </div>
  )
}

function SalaryContent({ salaryMin, salaryMax, onApply }) {
  const [min, setMin] = useState(salaryMin)
  const [max, setMax] = useState(salaryMax)
  return (
    <div className="p-3 min-w-[200px] space-y-2">
      <div>
        <label className="text-xs text-apex-muted mb-1 block">Min salary</label>
        <input
          type="number"
          placeholder="e.g. 25000"
          value={min}
          onChange={e => setMin(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-apex-blue"
        />
      </div>
      <div>
        <label className="text-xs text-apex-muted mb-1 block">Max salary</label>
        <input
          type="number"
          placeholder="e.g. 60000"
          value={max}
          onChange={e => setMax(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-apex-blue"
        />
      </div>
      <button
        type="button"
        onClick={() => onApply(min, max)}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
      >
        Apply
      </button>
      {(min || max) && (
        <button type="button" onClick={() => onApply('', '')} className="w-full text-xs text-apex-muted hover:text-apex-text">
          Clear
        </button>
      )}
    </div>
  )
}

function CityContent({ city, onApply }) {
  const [val, setVal] = useState(city)
  return (
    <div className="p-3 min-w-[200px] space-y-2">
      <input
        type="text"
        placeholder="e.g. Milan, London"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onApply(val)}
        autoFocus
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-apex-blue"
      />
      <button
        type="button"
        onClick={() => onApply(val)}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
      >
        Apply
      </button>
      {city && (
        <button type="button" onClick={() => onApply('')} className="w-full text-xs text-apex-muted hover:text-apex-text">
          Clear
        </button>
      )}
    </div>
  )
}

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

function MatchBadge({ score, inProfileSector }) {
  const outside = inProfileSector === false && score < 65

  let bgClass = ''
  let gradient = null

  if (outside) {
    bgClass = 'bg-amber-50 text-amber-600 border border-amber-200'
  } else if (score === 100) {
    bgClass = 'text-white shadow-sm shadow-emerald-500/30'
    gradient = 'linear-gradient(135deg,#10b981,#059669)'
  } else if (score >= 80) {
    bgClass = 'text-white shadow-sm shadow-green-500/30'
    gradient = 'linear-gradient(135deg,#22c55e,#16a34a)'
  } else if (score >= 60) {
    bgClass = 'bg-blue-50 text-blue-700'
  } else if (score >= 35) {
    bgClass = 'bg-slate-100 text-slate-600'
  } else {
    bgClass = 'bg-red-50 text-red-500'
  }

  return (
    <span className="relative inline-flex group">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold cursor-default ${bgClass}`}
        style={gradient ? { background: gradient } : {}}
      >
        {score}% match
      </span>
      {outside && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-800 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
          Low match — outside your profile area
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  )
}

const TYPE_COLORS = {
  Permanent:'bg-emerald-50 text-emerald-700',Contract:'bg-amber-50 text-amber-700',
  'Part Time':'bg-violet-50 text-violet-700','Full Time':'bg-emerald-50 text-emerald-700',
  Internship:'bg-blue-50 text-apex-blue',
}

function JobCard({ job, applied, onApply, onTailor, expanded, onToggle }) {
  const bodyInnerRef = useRef(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    if (!bodyInnerRef.current) return
    setHeight(expanded ? bodyInnerRef.current.scrollHeight : 0)
  }, [expanded])

  return (
    <div className={`bg-white rounded-xl border-t border-r border-b transition-all duration-200 ${
      expanded
        ? 'border-t-blue-200 border-r-blue-200 border-b-blue-200 border-l-4 border-l-blue-500 shadow-md'
        : 'border-slate-100 hover:border-blue-100 hover:shadow-md border-l border-l-slate-100 hover:border-l-blue-100'
    }`}>
      <div className="p-6 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className={`font-bold text-base transition-colors ${expanded ? 'text-blue-700' : 'text-slate-900'}`}>
                {job.title}
              </h3>
              <MatchBadge score={job.score} inProfileSector={job.inProfileSector} />
              {job.type && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[job.type] || 'bg-slate-100 text-slate-600'}`}>
                  {job.type}
                </span>
              )}
              {job.workModes.map(m => (
                <span key={m} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">{m}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-sm mb-2">
              <span className="font-semibold text-slate-700">{job.company}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{job.location}</span>
              {job.salary && (
                <><span className="text-slate-300">·</span>
                <span className="font-semibold text-emerald-600 text-xs">{job.salary}</span></>
              )}
            </div>
            {!expanded && job.description && (
              <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{job.description}</p>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-slate-400 flex-shrink-0 mt-1 transition-transform duration-300 ${expanded ? 'rotate-180 text-blue-400' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div style={{ height, overflow:'hidden', transition:'height 300ms ease' }}>
        <div ref={bodyInnerRef}>
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {job.description || 'No description available.'}
            </p>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-2 text-xs text-apex-blue hover:underline">
                View full description
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <div className="flex gap-3 mt-5" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onTailor(job)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm shadow-blue-500/20"
                style={{ background:'linear-gradient(135deg,#2563EB,#38BDF8)' }}
              >
                ✦ Tailor Application
              </button>
              <button
                onClick={() => onApply(job)}
                disabled={applied}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-center ${
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
      </div>
    </div>
  )
}

function EmptyState({ onReset }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-8 py-14 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <h3 className="font-semibold text-apex-text mb-1">No jobs found</h3>
      <p className="text-sm text-apex-muted mb-5 max-w-sm mx-auto">
        No results match your current filters. Try broadening your search.
      </p>
      <button onClick={onReset}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors">
        Reset all filters
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Discover() {
  const { user, applications, addApplication } = useUser()
  const navigate  = useNavigate()
  const abortRef  = useRef(null)

  const [jobs, setJobs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [banner, setBanner]       = useState(null)
  const [keyword, setKeyword]     = useState('')
  const [activeKeyword, setActiveKeyword] = useState('')
  const [searchHistory, setSearchHistory] = useState(loadHistory)
  const [showHistory, setShowHistory]     = useState(false)
  const blurTimerRef = useRef(null)
  const [expandedId, setExpandedId] = useState(null)
  const [openFilter, setOpenFilter] = useState(null) // which chip dropdown is open
  const [appliedIds, setAppliedIds] = useState(() => new Set(applications.map(a => a.id)))
  const [showAddModal, setShowAddModal] = useState(false)

  const profileSectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []

  const [filters, setFilters] = useState(() => ({
    countryCode: resolveCountryCode(user.country),
    where: '',
    salaryMin: '',
    salaryMax: '',
  }))

  const [frontendFilters, setFrontendFilters] = useState(DEFAULT_FF)

  // ── Derived display list ──────────────────────────────────────────────────
  const displayedJobs = applyFrontendFilters(jobs, frontendFilters, !!activeKeyword.trim())

  const totalActive =
    frontendFilters.contractTypes.length +
    frontendFilters.workModes.length +
    (frontendFilters.sector ? 1 : 0) +
    (frontendFilters.minEdu !== 'Any' ? 1 : 0) +
    (filters.where ? 1 : 0) +
    (filters.salaryMin || filters.salaryMax ? 1 : 0)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchJobs = async (f = filters, kw = activeKeyword, ff = frontendFilters) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    try {
      const kwTrimmed = kw.trim()

      // what: keyword > sector filter (when no keyword) > profile sector
      let what = kwTrimmed
      if (!what) {
        const s = ff.sector || (profileSectors.length ? profileSectors[0] : '')
        what = s ? (SECTOR_KEYWORD[s] || s.toLowerCase()) : ''
      }

      const params = new URLSearchParams({ app_id: APP_ID, app_key: APP_KEY, results_per_page: 20 })
      if (what)        params.set('what', what)
      if (f.where)     params.set('where', f.where.trim())
      if (f.salaryMin) params.set('salary_min', f.salaryMin)
      if (f.salaryMax) params.set('salary_max', f.salaryMax)

      const url = `/api/adzuna/v1/api/jobs/${f.countryCode}/search/1?${params.toString()}`
      console.log('[Adzuna] GET', url.replace(APP_KEY, '***'))

      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`Adzuna API error ${res.status}`)
      const data = await res.json()

      const normalized = (data.results || [])
        .map(j => normalizeJob(j, f.countryCode, user))
        .sort((a, b) => b.score - a.score)

      setJobs(normalized)

      const place = f.where.trim() || CODE_TO_NAME[f.countryCode] || f.countryCode.toUpperCase()
      const desc  = [kwTrimmed || what || 'All jobs', place].filter(Boolean).join(' · ')
      setBanner({ text: desc, count: normalized.length })
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[Discover]', err)
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSearch = (kw = keyword) => {
    if (kw.trim()) {
      saveToHistory(kw.trim())
      setSearchHistory(loadHistory())
    }
    setKeyword(kw)
    setActiveKeyword(kw)
    setOpenFilter(null)
    setShowHistory(false)
    fetchJobs(filters, kw, frontendFilters)
  }

  const handleHistorySelect = (term) => {
    handleSearch(term)
  }

  const handleHistoryRemove = (term, e) => {
    e.stopPropagation()
    removeFromHistory(term)
    setSearchHistory(loadHistory())
  }

  const handleHistoryClear = () => {
    clearHistory()
    setSearchHistory([])
  }

  const handleSearchFocus = () => {
    clearTimeout(blurTimerRef.current)
    setShowHistory(true)
  }

  const handleSearchBlur = () => {
    blurTimerRef.current = setTimeout(() => setShowHistory(false), 200)
  }

  const handleApplyJob = (job) => {
    addApplication(job, '', '', job.score || 0)
    setAppliedIds(prev => new Set([...prev, job.id]))
  }

  const handleReset = () => {
    const f = { countryCode: resolveCountryCode(user.country), where:'', salaryMin:'', salaryMax:'' }
    setFilters(f)
    setFrontendFilters(DEFAULT_FF)
    setKeyword('')
    setActiveKeyword('')
    setOpenFilter(null)
    fetchJobs(f, '', DEFAULT_FF)
  }

  // Handlers that require re-fetch
  const handleCountryChange = (code) => {
    const f = { ...filters, countryCode: code }
    setFilters(f)
    setOpenFilter(null)
    fetchJobs(f, activeKeyword, frontendFilters)
  }

  const handleCityApply = (city) => {
    const f = { ...filters, where: city }
    setFilters(f)
    setOpenFilter(null)
    fetchJobs(f, activeKeyword, frontendFilters)
  }

  const handleSalaryApply = (min, max) => {
    const f = { ...filters, salaryMin: min, salaryMax: max }
    setFilters(f)
    setOpenFilter(null)
    fetchJobs(f, activeKeyword, frontendFilters)
  }

  const handleSectorChange = (sector) => {
    const ff = { ...frontendFilters, sector }
    setFrontendFilters(ff)
    setOpenFilter(null)
    // Only re-fetch when no keyword (sector changes the `what` API param)
    if (!activeKeyword.trim()) fetchJobs(filters, activeKeyword, ff)
  }

  // Purely reactive frontend handlers (no re-fetch)
  const setFF = (key, val) => setFrontendFilters(f => ({ ...f, [key]: val }))

  // ── Chip labels ───────────────────────────────────────────────────────────
  const contractLabel = frontendFilters.contractTypes.length === 0 ? 'Contract'
    : frontendFilters.contractTypes.length === 1 ? frontendFilters.contractTypes[0]
    : `Contract (${frontendFilters.contractTypes.length})`

  const workModeLabel = frontendFilters.workModes.length === 0 ? 'Work Mode'
    : frontendFilters.workModes.length === 1 ? frontendFilters.workModes[0]
    : `Work Mode (${frontendFilters.workModes.length})`

  const sectorLabel   = frontendFilters.sector || 'Sector'
  const eduLabel      = frontendFilters.minEdu !== 'Any' ? `Edu: ${frontendFilters.minEdu}` : 'Education'
  const salaryLabel   = fmtSalaryLabel(filters.salaryMin, filters.salaryMax, filters.countryCode)
  const countryLabel  = CODE_TO_NAME[filters.countryCode] || filters.countryCode.toUpperCase()
  const cityLabel     = filters.where || 'City'

  const toggle = (id) => setOpenFilter(o => o === id ? null : id)

  return (
  <>
    <div className="p-4 md:p-8 page-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Discover</h1>
        <p className="text-slate-500 mt-1 text-sm">Live jobs ranked by your profile match score</p>
      </div>

      {/* ── Search bar ── */}
      <div className="mb-3 relative">
        <div className="flex gap-3 items-center bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
          <svg className="w-5 h-5 text-apex-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            placeholder="Search jobs, skills, companies…"
            className="flex-1 text-apex-text placeholder-slate-400 bg-transparent outline-none text-base"
          />
          {keyword && (
            <button
              onClick={() => { setKeyword(''); setActiveKeyword(''); fetchJobs(filters, '', frontendFilters) }}
              className="text-slate-400 hover:text-apex-text transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60 flex-shrink-0"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {/* History dropdown */}
        {showHistory && searchHistory.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden"
            onMouseDown={e => e.preventDefault()}
          >
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Recent searches</span>
            </div>
            <ul className="py-1">
              {searchHistory.map((term) => (
                <li key={term}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left group"
                    onClick={() => handleHistorySelect(term)}
                  >
                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="flex-1 text-sm text-slate-700 truncate">{term}</span>
                    <span
                      role="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-slate-600"
                      onClick={(e) => handleHistoryRemove(term, e)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 py-2 border-t border-slate-100">
              <button
                onClick={handleHistoryClear}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Manual job link ── */}
      <div className="flex justify-end mb-1 -mt-1">
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 13, color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 5,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#2563EB' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Found a job elsewhere? Add it manually
        </button>
      </div>

      {/* ── Filter chips row ── */}
      <div className="flex gap-2 items-center flex-wrap mb-5">

        <FilterChip
          label={countryLabel}
          isActive={filters.countryCode !== resolveCountryCode(user.country)}
          isOpen={openFilter === 'country'}
          onToggle={() => toggle('country')}
        >
          <SingleSelectContent
            options={SUPPORTED_COUNTRIES.map(c => c.label)}
            value={CODE_TO_NAME[filters.countryCode]}
            onChange={label => {
              const found = SUPPORTED_COUNTRIES.find(c => c.label === label)
              if (found) handleCountryChange(found.code)
            }}
            allLabel="All countries"
          />
        </FilterChip>

        <FilterChip
          label={cityLabel}
          isActive={!!filters.where}
          isOpen={openFilter === 'city'}
          onToggle={() => toggle('city')}
        >
          <CityContent city={filters.where} onApply={handleCityApply} />
        </FilterChip>

        <FilterChip
          label={contractLabel}
          isActive={frontendFilters.contractTypes.length > 0}
          isOpen={openFilter === 'contract'}
          onToggle={() => toggle('contract')}
        >
          <MultiSelectContent
            options={CONTRACT_OPTIONS}
            selected={frontendFilters.contractTypes}
            onChange={val => setFF('contractTypes', val)}
          />
        </FilterChip>

        <FilterChip
          label={workModeLabel}
          isActive={frontendFilters.workModes.length > 0}
          isOpen={openFilter === 'workMode'}
          onToggle={() => toggle('workMode')}
        >
          <MultiSelectContent
            options={WORK_MODE_OPTIONS}
            selected={frontendFilters.workModes}
            onChange={val => setFF('workModes', val)}
          />
        </FilterChip>

        <FilterChip
          label={sectorLabel}
          isActive={!!frontendFilters.sector}
          isOpen={openFilter === 'sector'}
          onToggle={() => toggle('sector')}
        >
          <SingleSelectContent
            options={SECTORS_LIST}
            value={frontendFilters.sector}
            onChange={handleSectorChange}
            allLabel="All sectors"
          />
        </FilterChip>

        <FilterChip
          label={salaryLabel}
          isActive={!!(filters.salaryMin || filters.salaryMax)}
          isOpen={openFilter === 'salary'}
          onToggle={() => toggle('salary')}
        >
          <SalaryContent
            salaryMin={filters.salaryMin}
            salaryMax={filters.salaryMax}
            onApply={handleSalaryApply}
          />
        </FilterChip>

        <FilterChip
          label={eduLabel}
          isActive={frontendFilters.minEdu !== 'Any'}
          isOpen={openFilter === 'education'}
          onToggle={() => toggle('education')}
        >
          <SingleSelectContent
            options={EDU_LEVELS.slice(1)}
            value={frontendFilters.minEdu !== 'Any' ? frontendFilters.minEdu : ''}
            onChange={val => { setFF('minEdu', val || 'Any'); setOpenFilter(null) }}
            allLabel="Any level"
          />
        </FilterChip>

        {totalActive > 0 && (
          <button
            onClick={handleReset}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-200 bg-white transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reset all
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
              {totalActive}
            </span>
          </button>
        )}
      </div>

      {/* Search context banner */}
      {banner && !loading && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-5 bg-blue-50 border border-blue-100 rounded-xl text-sm">
          <svg className="w-4 h-4 text-apex-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-apex-blue font-medium">Results for:</span>
          <span className="text-apex-text">{banner.text}</span>
          <span className="ml-auto text-apex-muted flex-shrink-0">
            {displayedJobs.length !== jobs.length
              ? `${displayedJobs.length} of ${jobs.length} jobs`
              : `${jobs.length} jobs`}
          </span>
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

        {!loading && !error && displayedJobs.length === 0 && (
          <EmptyState onReset={handleReset} />
        )}

        {!loading && displayedJobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            applied={appliedIds.has(job.id)}
            onApply={handleApplyJob}
            onTailor={j => navigate('/dashboard/tailoring-lab', { state: { job: j } })}
            expanded={expandedId === job.id}
            onToggle={() => setExpandedId(prev => prev === job.id ? null : job.id)}
          />
        ))}
      </div>
    </div>

    {showAddModal && (
      <AddJobModal
        onClose={() => setShowAddModal(false)}
        onAdded={() => {}}
      />
    )}
  </>
  )
}
