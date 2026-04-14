import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
import AddJobModal from '../components/AddJobModal'
import posthog from 'posthog-js'

// ─── Browse state persistence ─────────────────────────────────────────────────
const DISCOVER_KEY = 'apex_discover_state'
function loadDiscoverState() {
  try { return JSON.parse(localStorage.getItem(DISCOVER_KEY)) || null }
  catch { return null }
}

// ─── Search history ───────────────────────────────────────────────────────────
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
function clearHistory() { localStorage.removeItem(HISTORY_KEY) }

// ─── Adzuna config ────────────────────────────────────────────────────────────
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

const SENIOR_SIGNALS = [
  'senior', 'lead', 'manager', 'responsabile', 'direttore', 'director',
  'head of', 'chief', 'principal', 'coordinatore', 'team leader',
  '5+ anni', '5 anni', '6 anni', '7 anni', '8 anni', '10 anni',
  'almeno 5', 'almeno 3', 'esperienza consolidata', 'esperienza pluriennale',
  'gestione del team', 'gestione team', 'riporta a',
]

const JUNIOR_SIGNALS = [
  'neolaureato', 'neo-laureato', 'laureando', 'laurea triennale',
  'prima esperienza', 'primo impiego', 'giovane', 'brillante',
  '0-2 anni', '0-1 anni', 'max 2 anni', 'massimo 2 anni',
  'tesi', 'curriculare', 'extracurriculare', 'tirocinio', 'stage',
  'appena laureato', 'fresco di laurea', 'entry level', 'entry-level',
  'junior', 'trainee', 'graduate',
]

const CONTRACT_OPTIONS = ['Internship','Full-time','Part-time','Freelance']
const WORK_MODE_OPTIONS = ['Remote','Hybrid','On-site']
const SECTORS_LIST = Object.keys(SECTOR_KEYWORD).sort()
const EDU_LEVELS = ['Any',"High School","Bachelor's","Master's",'PhD']
const EDU_RANK   = {'Any':0,'High School':1,"Bachelor's":2,"Master's":3,'PhD':4}
const DEFAULT_FF = { contractTypes:[], workModes:[], sector:'', minEdu:'Any' }

// ─── Source detection ─────────────────────────────────────────────────────────
function detectSource(url) {
  if (!url) return 'manual'
  try {
    const h = new URL(url).hostname.toLowerCase()
    if (h.includes('linkedin')) return 'linkedin'
    if (h.includes('indeed')) return 'indeed'
    if (h.includes('glassdoor')) return 'glassdoor'
    if (h.includes('infojobs')) return 'infojobs'
    return 'other'
  } catch { return 'other' }
}

const SOURCE_STYLES = {
  linkedin:  { bg: '#DBEAFE', color: '#0A66C2', label: 'LinkedIn' },
  indeed:    { bg: '#DBEAFE', color: '#003A9B', label: 'Indeed' },
  glassdoor: { bg: '#DCFCE7', color: '#0CAA41', label: 'Glassdoor' },
  infojobs:  { bg: '#FFEDD5', color: '#FF6B00', label: 'Infojobs' },
  manual:    { bg: '#DCFCE7', color: '#16A34A', label: 'Manual' },
  adzuna:    { bg: '#F1F5F9', color: '#64748B', label: 'Adzuna' },
  other:     { bg: '#F1F5F9', color: '#64748B', label: 'Imported' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  if (ff.contractTypes.length > 0) {
    r = r.filter(j => {
      const h = `${j.title} ${j.description}`.toLowerCase()
      const isIntern    = INTERN_WORDS.some(w => h.includes(w))
      const isPartTime  = j.type === 'Part Time'  || /part.time/.test(h)
      const isFreelance = j.type === 'Contract'   || /freelance|contractor/.test(h)
      const isFullTime  = j.type === 'Full Time'  || j.type === 'Permanent'
      if (!isIntern && !isPartTime && !isFreelance && !isFullTime) return true
      return ff.contractTypes.some(ct => {
        if (ct === 'Internship') return isIntern
        if (ct === 'Part-time')  return isPartTime
        if (ct === 'Freelance')  return isFreelance
        if (ct === 'Full-time')  return isFullTime
        return false
      })
    })
  }
  if (ff.workModes.length > 0) {
    r = r.filter(j => {
      if (j.workModes.length === 0) return true
      return ff.workModes.some(m => j.workModes.includes(m))
    })
  }
  if (hasKeyword && ff.sector) {
    const kws = (SECTOR_KEYWORD[ff.sector] || ff.sector).toLowerCase().split(' ').filter(k => k.length > 2)
    r = r.filter(j => {
      const h = `${j.title} ${j.description}`.toLowerCase()
      return kws.some(kw => h.includes(kw))
    })
  }
  if (ff.minEdu && ff.minEdu !== 'Any') {
    const selectedRank = EDU_RANK[ff.minEdu]
    r = r.filter(j => {
      if (j.education === 'Any') return true
      return EDU_RANK[j.education] <= selectedRank
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
    const titleSenior = SENIOR_SIGNALS.filter(w => title.includes(w)).length
    const descSenior  = SENIOR_SIGNALS.filter(w => description.includes(w)).length
    const titleJunior = JUNIOR_SIGNALS.filter(w => title.includes(w)).length
    const descJunior  = JUNIOR_SIGNALS.filter(w => description.includes(w)).length
    const hasSeniorSignal = titleSenior > 0 || descSenior >= 2
    const hasJuniorSignal = titleJunior > 0 || descJunior >= 1

    let contractScore
    if (uc === 'Internship') {
      if (titleIntern) contractScore = 100
      else if (descIntern) contractScore = 60
      else if (hasJuniorSignal) contractScore = 75
      else if (hasSeniorSignal) contractScore = 5
      else contractScore = 40
    } else if (uc === 'Full-time' || uc === 'Part-time') {
      if (titleIntern) contractScore = 0
      else if (hasSeniorSignal) contractScore = 100
      else if (hasJuniorSignal && !hasSeniorSignal) contractScore = 50
      else contractScore = 80
    } else {
      contractScore = 80
    }
    criteria.push({ weight: 25, score: contractScore })
  }

  const total = criteria.reduce((s,c) => s + c.weight, 0)
  if (!total) return 2.5
  const raw100 = Math.min(100, Math.max(5, Math.round(criteria.reduce((s,c) => s + c.score*c.weight, 0) / total)))
  return Math.round((raw100 / 100) * 5 * 10) / 10
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

// ─── Score helpers ────────────────────────────────────────────────────────────
function getScoreColor(score) {
  if (score >= 4.0) return '#16A34A'
  if (score >= 3.0) return '#D97706'
  return '#94A3B8'
}
function getScoreLabel(score) {
  if (score >= 4.0) return 'great match'
  if (score >= 3.0) return 'good match'
  return 'partial match'
}

// ─── Filter UI components ─────────────────────────────────────────────────────
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
          isActive
            ? 'text-white border-transparent shadow-sm'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
        style={isActive ? { background: 'linear-gradient(135deg,#2563EB,#38BDF8)' } : {}}
      >
        {label}
        <svg className={`w-3 h-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <button key={opt} type="button"
            onClick={() => onChange(on ? selected.filter(v => v !== opt) : [...selected, opt])}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${on ? 'bg-blue-50 text-apex-blue font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${on ? 'bg-apex-blue border-apex-blue' : 'border-slate-300'}`}>
              {on && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
            </span>
            {opt}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="mt-1 w-full text-xs text-center text-apex-muted hover:text-apex-text py-1 border-t border-slate-100">Clear</button>
      )}
    </div>
  )
}

function SingleSelectContent({ options, value, onChange, allLabel = 'Any' }) {
  const [search, setSearch] = useState('')
  const showSearch = options.length > 8
  const filtered = showSearch ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options
  return (
    <div className="min-w-[210px]">
      {showSearch && (
        <div className="p-2 border-b border-slate-100">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" autoFocus
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-apex-blue" />
        </div>
      )}
      <div className="p-1 max-h-52 overflow-y-auto">
        {!search && (
          <button type="button" onClick={() => onChange('')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!value ? 'bg-blue-50 text-apex-blue font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>
            {allLabel}
          </button>
        )}
        {filtered.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${value === opt ? 'bg-blue-50 text-apex-blue font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>
            {opt}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-3 px-3">No results</p>}
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
        <input type="number" placeholder="e.g. 25000" value={min} onChange={e => setMin(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-apex-blue" />
      </div>
      <div>
        <label className="text-xs text-apex-muted mb-1 block">Max salary</label>
        <input type="number" placeholder="e.g. 60000" value={max} onChange={e => setMax(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-apex-blue" />
      </div>
      <button type="button" onClick={() => onApply(min, max)}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}>Apply</button>
      {(min || max) && (
        <button type="button" onClick={() => onApply('', '')} className="w-full text-xs text-apex-muted hover:text-apex-text">Clear</button>
      )}
    </div>
  )
}

function CityContent({ city, onApply }) {
  const [val, setVal] = useState(city)
  return (
    <div className="p-3 min-w-[200px] space-y-2">
      <input type="text" placeholder="e.g. Milan, London" value={val}
        onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && onApply(val)} autoFocus
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-apex-blue" />
      <button type="button" onClick={() => onApply(val)}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}>Apply</button>
      {city && <button type="button" onClick={() => onApply('')} className="w-full text-xs text-apex-muted hover:text-apex-text">Clear</button>}
    </div>
  )
}

// ─── Score badge helpers ──────────────────────────────────────────────────────
function getMatchScoreStyle(score) {
  if (score >= 4.0) return { bg: '#DCFCE7', color: '#16A34A' }
  if (score >= 2.5) return { bg: '#FEF3C7', color: '#D97706' }
  return { bg: '#FEE2E2', color: '#DC2626' }
}

// ─── Inbox card ───────────────────────────────────────────────────────────────
function InboxCard({ job, onTailor, onSave, onRemove, isExpanded, onToggle, isNew }) {
  const src = SOURCE_STYLES[job.source] || SOURCE_STYLES.other
  const [hovered, setHovered] = useState(false)

  const hasScore    = job.match_score !== null && job.match_score !== undefined
  const isAnalyzing = !hasScore && job._scoring

  const scoreStyle = hasScore ? getMatchScoreStyle(job.match_score) : null
  const report     = job.match_report || null

  return (
    <div
      className={isNew ? 'job-fade-in' : ''}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#F8FAFC' : '#fff',
        border: '1px solid #E2E8F0',
        boxShadow: hovered ? 'inset 3px 0 0 #2563EB' : 'none',
        borderRadius: 12,
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 200ms',
      }}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', lineHeight: 1.35, margin: 0 }}>{job.title}</h3>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
            {[job.company, job.location].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: src.bg, color: src.color, letterSpacing: '0.02em' }}>
            {src.label.toUpperCase()}
          </span>
          <svg style={{ width: 14, height: 14, color: '#94A3B8', transition: 'transform 200ms', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Score row */}
      {(isAnalyzing || hasScore) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {isAnalyzing ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 500, color: '#94A3B8',
              background: '#F1F5F9', borderRadius: 6, padding: '3px 8px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Analyzing fit…
            </span>
          ) : (
            <>
              <span style={{
                fontSize: 12, fontWeight: 700,
                background: scoreStyle.bg, color: scoreStyle.color,
                borderRadius: 6, padding: '3px 8px',
              }}>
                {job.match_score.toFixed(1)} / 5
              </span>
              {report?.verdict && (
                <span style={{
                  fontSize: 12, color: '#64748B',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }}>
                  {report.verdict}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Expanded score report */}
      {isExpanded && hasScore && report && (
        <div style={{
          background: '#F8FAFC', borderRadius: 8, padding: '10px 12px',
          marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {report.strengths?.length > 0 && (
            <div>
              {report.strengths.map((s, i) => (
                <p key={i} style={{ margin: '0 0 3px', fontSize: 12, color: '#16A34A', lineHeight: 1.4 }}>
                  ✓ {s}
                </p>
              ))}
            </div>
          )}
          {report.gaps?.length > 0 && (
            <div>
              {report.gaps.map((g, i) => (
                <p key={i} style={{ margin: '0 0 3px', fontSize: 12, color: '#D97706', lineHeight: 1.4 }}>
                  ⚠ {g}
                </p>
              ))}
            </div>
          )}
          {report.salary_range && (
            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>
              Est. range: {report.salary_range}
            </p>
          )}
        </div>
      )}

      {/* Description */}
      {job.description && (
        <div style={{ marginBottom: 12 }}>
          {isExpanded ? (
            <>
              <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{job.description}</p>
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', marginTop: 8, textDecoration: 'none' }}>
                  View full listing ↗
                </a>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {job.description}
            </p>
          )}
        </div>
      )}

      {/* Action buttons — always visible */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={e => { e.stopPropagation(); onTailor(job) }}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          ✦ Tailor Application
        </button>
        <button
          onClick={e => { e.stopPropagation(); onSave(job) }}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
            background: '#fff', color: '#64748B', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
        >
          Mark Applied
        </button>
        {/* Remove button */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(job) }}
          title="Remove"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E8F0',
            background: '#fff', color: '#94A3B8', cursor: 'pointer',
            flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8' }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Browse card (compact Adzuna) ─────────────────────────────────────────────
function BrowseCard({ job, applied, onApply, onTailor, isExpanded, onToggle }) {
  const displayScore = job.score > 5 ? Math.round((job.score / 100) * 5 * 10) / 10 : job.score
  const scoreColor = getScoreColor(displayScore)
  const scoreLabel = getScoreLabel(displayScore)
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#F8FAFC' : '#fff',
        border: '1px solid #E2E8F0',
        boxShadow: hovered ? 'inset 3px 0 0 #2563EB' : 'none',
        borderRadius: 10,
        padding: '12px 14px',
        opacity: displayScore < 2.0 ? 0.55 : 1,
        transition: 'all 200ms',
      }}
    >
      {/* Header row — click to expand */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4, cursor: 'pointer' }}>
        <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0F172A', lineHeight: 1.35, margin: 0 }}>{job.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{displayScore.toFixed(1)}<span style={{ fontSize: 10, fontWeight: 500 }}>/5</span></span>
            <p style={{ fontSize: 10, color: scoreColor, margin: '1px 0 0', lineHeight: 1 }}>{scoreLabel}</p>
          </div>
          <svg style={{ width: 14, height: 14, color: '#94A3B8', transition: 'transform 200ms', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Company / location / salary */}
      <p onClick={onToggle} style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 6px', cursor: 'pointer' }}>
        {[job.company, job.location].filter(Boolean).join(' · ')}
        {job.salary && <span style={{ color: '#16A34A', marginLeft: 6 }}>{job.salary}</span>}
      </p>

      {/* Description snippet / full */}
      {job.description && (
        <div onClick={onToggle} style={{ marginBottom: 10, cursor: 'pointer' }}>
          {isExpanded ? (
            <>
              <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{job.description}</p>
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', marginTop: 6, textDecoration: 'none' }}>
                  View full listing ↗
                </a>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.55, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {job.description}
            </p>
          )}
        </div>
      )}

      {/* Action buttons — always visible */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={e => { e.stopPropagation(); onTailor(job) }}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 7, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          ✦ Tailor Application
        </button>
        <button
          onClick={e => { e.stopPropagation(); onApply(job) }}
          disabled={applied}
          style={{
            padding: '6px 12px', borderRadius: 7,
            border: applied ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
            background: applied ? '#F0FDF4' : '#fff',
            color: applied ? '#16A34A' : '#64748B',
            fontSize: 11, fontWeight: 500,
            cursor: applied ? 'default' : 'pointer',
          }}
        >
          {applied ? '✓ Applied' : 'Mark Applied'}
        </button>
      </div>
    </div>
  )
}

// ─── Browse skeleton card ─────────────────────────────────────────────────────
function BrowseSkeletonCard() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-full" />
        </div>
        <div className="w-8 space-y-1">
          <div className="h-5 bg-slate-200 rounded" />
          <div className="h-3 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="flex gap-1.5 mt-3">
        <div className="flex-1 h-7 bg-slate-200 rounded-xl" />
        <div className="w-14 h-7 bg-slate-200 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Discover() {
  const { user, session, applications, addApplication, addManualJob } = useUser()
  const navigate   = useNavigate()
  const abortRef   = useRef(null)
  const blurTimerRef = useRef(null)
  const discoverSaveTimerRef = useRef(null)
  const savedDiscoverRef = useRef(loadDiscoverState())
  const drawerBodyRef = useRef(null)

  // ── Inbox state ─────────────────────────────────────────────────────────────
  const [inboxJobs, setInboxJobs]         = useState([])
  const [inboxLoading, setInboxLoading]   = useState(true)

  // ── Import bar state ────────────────────────────────────────────────────────
  const [importBarUrl, setImportBarUrl]           = useState('')
  const [importBarLoading, setImportBarLoading]   = useState(false)
  const [importBarError, setImportBarError]       = useState('')
  const [importBarFocused, setImportBarFocused]   = useState(false)
  const [newJobId, setNewJobId]                   = useState(null)

  // ── Expanded card state ──────────────────────────────────────────────────────
  const [expandedInboxId, setExpandedInboxId] = useState(null)
  const [expandedBrowseId, setExpandedBrowseId] = useState(null)

  // ── Drawer ───────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)

  // ── Browse (Adzuna) state ───────────────────────────────────────────────────
  const [jobs, setJobs]           = useState(() => savedDiscoverRef.current?.jobs || [])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [keyword, setKeyword]     = useState(() => savedDiscoverRef.current?.keyword || '')
  const [activeKeyword, setActiveKeyword] = useState(() => savedDiscoverRef.current?.keyword || '')
  const [searchHistory, setSearchHistory] = useState(loadHistory)
  const [showHistory, setShowHistory]     = useState(false)
  const [openFilter, setOpenFilter]       = useState(null)
  const [showFilters, setShowFilters]     = useState(false)
  const [appliedIds, setAppliedIds]       = useState(() => new Set(applications.map(a => a.id)))

  const profileSectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []

  const [filters, setFilters] = useState(() => savedDiscoverRef.current?.filters || {
    countryCode: resolveCountryCode(user.country),
    where: '', salaryMin: '', salaryMax: '',
  })

  const [frontendFilters, setFrontendFilters] = useState(() => savedDiscoverRef.current?.frontendFilters || DEFAULT_FF)

  const displayedJobs = applyFrontendFilters(jobs, frontendFilters, !!activeKeyword.trim())

  const totalActive =
    frontendFilters.contractTypes.length +
    frontendFilters.workModes.length +
    (frontendFilters.sector ? 1 : 0) +
    (frontendFilters.minEdu !== 'Any' ? 1 : 0) +
    (filters.where ? 1 : 0) +
    (filters.salaryMin || filters.salaryMax ? 1 : 0)

  // ── Load inbox from Supabase ────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) { setInboxLoading(false); return }
    supabase
      .from('job_inbox')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInboxJobs(data || [])
        setInboxLoading(false)
      })
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist browse state ────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(discoverSaveTimerRef.current)
    discoverSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DISCOVER_KEY, JSON.stringify({ keyword: activeKeyword, filters, frontendFilters, jobs }))
      } catch {}
    }, 500)
  }, [activeKeyword, filters, frontendFilters, jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial browse fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (savedDiscoverRef.current?.jobs?.length) {
      return () => { if (abortRef.current) abortRef.current.abort() }
    }
    fetchJobs()
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drawer: ESC key ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [])

  // ── Drawer: body scroll lock ─────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // ── Drawer: reset scroll on open ─────────────────────────────────────────────
  useEffect(() => {
    if (drawerOpen && drawerBodyRef.current) drawerBodyRef.current.scrollTop = 0
  }, [drawerOpen])

  // ── Fetch Adzuna jobs ───────────────────────────────────────────────────────
  const fetchJobs = async (f = filters, kw = activeKeyword, ff = frontendFilters) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const kwTrimmed = kw.trim()
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
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`Adzuna ${res.status}`)
      const data = await res.json()
      const normalized = (data.results || [])
        .map(j => normalizeJob(j, f.countryCode, user))
        .sort((a, b) => b.score - a.score)
      setJobs(normalized)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError('Could not load jobs. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Scoring helpers ──────────────────────────────────────────────────────────
  const buildUserProfileString = (profile) => {
    if (!profile) return 'No profile available.'
    const parts = []
    if (profile.name)
      parts.push(`Name: ${profile.name}`)
    if (profile.city || profile.country)
      parts.push(`Location: ${[profile.city, profile.country].filter(Boolean).join(', ')}`)
    if (profile.sectors?.length)
      parts.push(`Target sectors: ${profile.sectors.join(', ')}`)
    if (profile.contract_type)
      parts.push(`Preferred contract: ${profile.contract_type}`)
    if (profile.work_mode)
      parts.push(`Work mode: ${profile.work_mode}`)
    if (profile.languages?.length) {
      const langs = profile.languages
        .filter(l => l.lang)
        .map(l => `${l.lang} (${l.level})`)
        .join(', ')
      if (langs) parts.push(`Languages: ${langs}`)
    }
    if (profile.cv_text)
      parts.push(`\nFULL CV:\n${profile.cv_text.trim()}`)
    return parts.join('\n')
  }

  const scoreJobInBackground = async (job) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      const userProfile = buildUserProfileString(profile)

      const res = await fetch('/api/score-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
          userProfile
        })
      })

      const { score, report } = await res.json()

      if (score === null) return

      await supabase
        .from('job_inbox')
        .update({ match_score: score, match_report: report })
        .eq('id', job.id)

      setInboxJobs(prev => prev.map(j =>
        j.id === job.id
          ? { ...j, match_score: score, match_report: report }
          : j
      ))

    } catch (err) {
      console.error('[scoring] caught error:', err)
    }
  }

  // ── Import bar handler ──────────────────────────────────────────────────────
  const handleInlineImport = async () => {
    if (!importBarUrl.trim() || !session?.user?.id) return
    setImportBarLoading(true)
    setImportBarError('')
    try {
      const res = await fetch('/api/import-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importBarUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')

      const { data: inserted, error: dbErr } = await supabase
        .from('job_inbox')
        .insert({
          user_id: session.user.id,
          title: data.title || '',
          company: data.company || '',
          location: data.location || '',
          description: data.description || '',
          url: importBarUrl.trim(),
          source: data.source || detectSource(importBarUrl.trim()),
          match_score: null,
          match_report: null,
        })
        .select()
        .single()

      if (dbErr) throw dbErr

      // Prepend immediately with _scoring flag to show "Analyzing…" badge
      setInboxJobs(prev => [{ ...inserted, _scoring: true }, ...prev])
      setImportBarUrl('')
      setNewJobId(inserted.id)
      setTimeout(() => setNewJobId(null), 600)
      posthog.capture('job_imported_url', { source: inserted.source })

      // Score in background — non-blocking
      scoreJobInBackground(inserted)
    } catch {
      setImportBarError('Could not read this page. Try adding manually.')
    } finally {
      setImportBarLoading(false)
    }
  }

  // ── Inbox action handlers ───────────────────────────────────────────────────
  const handleInboxTailor = async (job) => {
    await supabase.from('job_inbox').delete().eq('id', job.id)
    setInboxJobs(prev => prev.filter(j => j.id !== job.id))
    navigate('/dashboard/tailoring-lab', {
      state: { job: { id: job.id, title: job.title, company: job.company, location: job.location, description: job.description, url: job.url } },
    })
    posthog.capture('inbox_job_tailored', { title: job.title, source: job.source })
  }

  const handleInboxSave = async (job) => {
    await addManualJob({
      title: job.title, company: job.company,
      location: job.location || '', description: job.description || '', jobUrl: job.url || '',
      matchScore: job.match_score ?? null,
    })
    await supabase.from('job_inbox').delete().eq('id', job.id)
    setInboxJobs(prev => prev.filter(j => j.id !== job.id))
    posthog.capture('inbox_job_saved', { title: job.title, source: job.source })
  }

  const handleInboxRemove = async (job) => {
    await supabase.from('job_inbox').delete().eq('id', job.id)
    setInboxJobs(prev => prev.filter(j => j.id !== job.id))
    posthog.capture('inbox_job_removed', { title: job.title })
  }

  // ── Browse handlers ─────────────────────────────────────────────────────────
  const handleSearch = (kw = keyword) => {
    if (kw.trim()) {
      saveToHistory(kw.trim())
      setSearchHistory(loadHistory())
      posthog.capture('job_searched', { query: kw.trim(), country: filters.countryCode })
    }
    setKeyword(kw)
    setActiveKeyword(kw)
    setOpenFilter(null)
    setShowHistory(false)
    fetchJobs(filters, kw, frontendFilters)
  }

  const handleHistorySelect = (term) => handleSearch(term)
  const handleHistoryRemove = (term, e) => {
    e.stopPropagation()
    removeFromHistory(term)
    setSearchHistory(loadHistory())
  }
  const handleHistoryClear = () => { clearHistory(); setSearchHistory([]) }
  const handleSearchFocus  = () => { clearTimeout(blurTimerRef.current); setShowHistory(true) }
  const handleSearchBlur   = () => { blurTimerRef.current = setTimeout(() => setShowHistory(false), 200) }

  const handleApplyJob = (job) => {
    addApplication(job, '', '', job.score || 0)
    setAppliedIds(prev => new Set([...prev, job.id]))
  }

  const handleReset = () => {
    const f = { countryCode: resolveCountryCode(user.country), where: '', salaryMin: '', salaryMax: '' }
    setFilters(f)
    setFrontendFilters(DEFAULT_FF)
    setKeyword('')
    setActiveKeyword('')
    setOpenFilter(null)
    fetchJobs(f, '', DEFAULT_FF)
  }

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
    if (!activeKeyword.trim()) fetchJobs(filters, activeKeyword, ff)
  }
  const setFF    = (key, val) => setFrontendFilters(f => ({ ...f, [key]: val }))
  const toggle   = (id) => setOpenFilter(o => o === id ? null : id)

  // ── Chip labels ─────────────────────────────────────────────────────────────
  const contractLabel = frontendFilters.contractTypes.length === 0 ? 'Contract'
    : frontendFilters.contractTypes.length === 1 ? frontendFilters.contractTypes[0]
    : `Contract (${frontendFilters.contractTypes.length})`
  const workModeLabel = frontendFilters.workModes.length === 0 ? 'Work Mode'
    : frontendFilters.workModes.length === 1 ? frontendFilters.workModes[0]
    : `Work Mode (${frontendFilters.workModes.length})`
  const sectorLabel  = frontendFilters.sector || 'Sector'
  const eduLabel     = frontendFilters.minEdu !== 'Any' ? `Edu: ${frontendFilters.minEdu}` : 'Education'
  const salaryLabel  = fmtSalaryLabel(filters.salaryMin, filters.salaryMax, filters.countryCode)
  const countryLabel = CODE_TO_NAME[filters.countryCode] || filters.countryCode.toUpperCase()
  const cityLabel    = filters.where || 'City'

  // ── Render ──────────────────────────────────────────────────────────────────
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <>
      {/* ── Main page ── */}
      <div className="p-4 md:p-8 page-fade-in h-full overflow-y-auto">

        {/* Header row */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Jobs</h1>
            <p className="text-slate-500 mt-0.5 text-sm">Import any job from any source. APEX does the rest.</p>
          </div>
          {/* Browse jobs button — desktop only */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors duration-150"
            style={{ color: '#2563EB', borderColor: '#BFDBFE', background: '#EFF6FF' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EFF6FF' }}
          >
            {drawerOpen ? (
              <>
                <svg width="14" height="14" fill="none" stroke="#2563EB" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="#2563EB" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Browse jobs
              </>
            )}
          </button>
        </div>

        {/* ── Import bar ── */}
        <div className="flex-shrink-0 mb-5">
          <div style={{
            display: 'flex',
            background: '#fff',
            border: importBarFocused ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
            borderRadius: 14,
            boxShadow: importBarFocused
              ? '0 0 0 3px rgba(37,99,235,0.12), 0 1px 4px rgba(0,0,0,0.06)'
              : '0 1px 4px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            transition: 'box-shadow 200ms, border-color 200ms',
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', minWidth: 0 }}>
              <svg width="14" height="14" fill="none" stroke="#94A3B8" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                type="url"
                value={importBarUrl}
                onChange={e => { setImportBarUrl(e.target.value); setImportBarError('') }}
                onKeyDown={e => e.key === 'Enter' && handleInlineImport()}
                onFocus={() => setImportBarFocused(true)}
                onBlur={() => setImportBarFocused(false)}
                disabled={importBarLoading}
                placeholder="Paste a job URL from LinkedIn, Indeed, Glassdoor…"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#0F172A', minWidth: 0, opacity: importBarLoading ? 0.6 : 1 }}
              />
              <button
                onClick={handleInlineImport}
                disabled={importBarLoading || !importBarUrl.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
                  color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: (importBarLoading || !importBarUrl.trim()) ? 0.5 : 1,
                  transition: 'opacity 0.15s', flexShrink: 0,
                }}
              >
                {importBarLoading && (
                  <svg style={{ width: 12, height: 12, animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {importBarLoading ? 'Importing…' : 'Import'}
              </button>
            </div>
            <div style={{ width: 1, background: '#E2E8F0', margin: '10px 0', flexShrink: 0 }} />
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '0 20px', border: 'none', background: 'none',
                color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'background 150ms', flexShrink: 0, whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add manually
            </button>
          </div>

          {importBarLoading && (
            <div style={{ marginTop: 6, height: 2, background: '#EFF6FF', borderRadius: 99, overflow: 'hidden' }}>
              <div className="import-sweep" style={{ height: '100%', width: '40%', background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 px-1">
            <span className="text-[11px] text-slate-400">Works with</span>
            <span className="text-[11px] font-semibold" style={{ color: '#0A66C2' }}>LinkedIn</span>
            <span className="text-[11px] text-slate-300">·</span>
            <span className="text-[11px] font-semibold" style={{ color: '#003A9B' }}>Indeed</span>
            <span className="text-[11px] text-slate-300">·</span>
            <span className="text-[11px] font-semibold" style={{ color: '#0CAA41' }}>Glassdoor</span>
            <span className="text-[11px] text-slate-300">·</span>
            <span className="text-[11px] font-semibold" style={{ color: '#FF6B00' }}>Infojobs</span>
            <span className="text-[11px] text-slate-300">·</span>
            <span className="text-[11px] text-slate-400">any site</span>
          </div>
          {importBarError && (
            <p className="text-[11px] text-red-500 mt-1 px-1">{importBarError}</p>
          )}
        </div>

        {/* ── Inbox ── */}
        <div>
          <div className="mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              My Jobs · {inboxJobs.length}
            </span>
          </div>
          <div className="space-y-3 pb-24 md:pb-8">
            {inboxLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
              </div>
            ) : inboxJobs.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <p className="text-sm text-slate-400 font-medium">Your inbox is empty</p>
                <p className="text-xs text-slate-400 mt-1.5">Paste a job URL above, or tap Browse jobs to discover suggestions</p>
              </div>
            ) : (
              inboxJobs.map(job => (
                <InboxCard
                  key={job.id}
                  job={job}
                  onTailor={handleInboxTailor}
                  onSave={handleInboxSave}
                  onRemove={handleInboxRemove}
                  isExpanded={expandedInboxId === job.id}
                  onToggle={() => setExpandedInboxId(prev => prev === job.id ? null : job.id)}
                  isNew={newJobId === job.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile FAB — Browse jobs (mobile only) ── */}
      {!drawerOpen && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden flex items-center justify-center gap-2"
          style={{
            position: 'fixed', left: 16, right: 16, bottom: 80,
            zIndex: 35,
            padding: '14px 20px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
          }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Browse jobs ↗
        </button>
      )}

      {/* ── Backdrop ── */}
      <div
        onClick={closeDrawer}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.15)',
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'auto' : 'none',
          transition: 'opacity 300ms ease',
        }}
      />

      {/* ── Browse drawer ── */}
      <div className={`browse-drawer ${drawerOpen ? 'browse-drawer-open' : 'browse-drawer-closed'}`}>

        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-3 flex-shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#CBD5E1' }} />
        </div>

        {/* Drawer header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-base font-semibold text-slate-800">Browse suggestions</h2>
            <button
              onClick={closeDrawer}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">Jobs ranked by your profile match score</p>

          {/* Search bar */}
          <div className="relative">
            <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="flex-1 text-slate-800 placeholder-slate-400 bg-transparent outline-none text-sm"
              />
              {keyword && (
                <button onClick={() => { setKeyword(''); setActiveKeyword(''); fetchJobs(filters, '', frontendFilters) }} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-sky-400 hover:opacity-95 disabled:opacity-60 transition-opacity"
              >
                {loading ? '…' : 'Search'}
              </button>
            </div>

            {/* Search history dropdown */}
            {showHistory && searchHistory.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-[60] overflow-hidden"
                onMouseDown={e => e.preventDefault()}>
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Recent</span>
                </div>
                <ul className="py-1">
                  {searchHistory.map(term => (
                    <li key={term}>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left group"
                        onClick={() => handleHistorySelect(term)}
                      >
                        <svg className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="flex-1 text-sm text-slate-700 truncate">{term}</span>
                        <span role="button"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5"
                          onClick={e => handleHistoryRemove(term, e)}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-3 py-1.5 border-t border-slate-100">
                  <button onClick={handleHistoryClear} className="text-xs text-slate-400 hover:text-slate-600">Clear all</button>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mt-2">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                showFilters || totalActive > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Filters
              {totalActive > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">{totalActive}</span>
              )}
              <svg className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFilters && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <FilterChip label={countryLabel} isActive={filters.countryCode !== resolveCountryCode(user.country)} isOpen={openFilter === 'country'} onToggle={() => toggle('country')}>
                  <SingleSelectContent options={SUPPORTED_COUNTRIES.map(c => c.label)} value={CODE_TO_NAME[filters.countryCode]}
                    onChange={label => { const found = SUPPORTED_COUNTRIES.find(c => c.label === label); if (found) handleCountryChange(found.code) }} allLabel="All countries" />
                </FilterChip>
                <FilterChip label={cityLabel} isActive={!!filters.where} isOpen={openFilter === 'city'} onToggle={() => toggle('city')}>
                  <CityContent city={filters.where} onApply={handleCityApply} />
                </FilterChip>
                <FilterChip label={contractLabel} isActive={frontendFilters.contractTypes.length > 0} isOpen={openFilter === 'contract'} onToggle={() => toggle('contract')}>
                  <MultiSelectContent options={CONTRACT_OPTIONS} selected={frontendFilters.contractTypes} onChange={val => setFF('contractTypes', val)} />
                </FilterChip>
                <FilterChip label={workModeLabel} isActive={frontendFilters.workModes.length > 0} isOpen={openFilter === 'workMode'} onToggle={() => toggle('workMode')}>
                  <MultiSelectContent options={WORK_MODE_OPTIONS} selected={frontendFilters.workModes} onChange={val => setFF('workModes', val)} />
                </FilterChip>
                <FilterChip label={sectorLabel} isActive={!!frontendFilters.sector} isOpen={openFilter === 'sector'} onToggle={() => toggle('sector')}>
                  <SingleSelectContent options={SECTORS_LIST} value={frontendFilters.sector} onChange={handleSectorChange} allLabel="All sectors" />
                </FilterChip>
                <FilterChip label={salaryLabel} isActive={!!(filters.salaryMin || filters.salaryMax)} isOpen={openFilter === 'salary'} onToggle={() => toggle('salary')}>
                  <SalaryContent salaryMin={filters.salaryMin} salaryMax={filters.salaryMax} onApply={handleSalaryApply} />
                </FilterChip>
                <FilterChip label={eduLabel} isActive={frontendFilters.minEdu !== 'Any'} isOpen={openFilter === 'education'} onToggle={() => toggle('education')}>
                  <SingleSelectContent options={EDU_LEVELS.slice(1)} value={frontendFilters.minEdu !== 'Any' ? frontendFilters.minEdu : ''}
                    onChange={val => { setFF('minEdu', val || 'Any'); setOpenFilter(null) }} allLabel="Any level" />
                </FilterChip>
                {totalActive > 0 && (
                  <button onClick={handleReset}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-200 bg-white transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Drawer body — scrollable */}
        <div ref={drawerBodyRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {loading && Array.from({ length: 5 }).map((_, i) => <BrowseSkeletonCard key={i} />)}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400 mb-3">{error}</p>
              <button onClick={() => fetchJobs()}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-sky-400 hover:opacity-95">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && displayedJobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400 mb-2">No jobs found</p>
              <button onClick={handleReset} className="text-xs text-blue-600 hover:underline">Reset filters</button>
            </div>
          )}

          {!loading && !error && displayedJobs.map(job => (
            <BrowseCard
              key={job.id}
              job={job}
              applied={appliedIds.has(job.id)}
              onApply={handleApplyJob}
              onTailor={j => {
                setDrawerOpen(false)
                setTimeout(() => navigate('/dashboard/tailoring-lab', { state: { job: j } }), 200)
              }}
              isExpanded={expandedBrowseId === job.id}
              onToggle={() => setExpandedBrowseId(prev => prev === job.id ? null : job.id)}
            />
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddJobModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => posthog.capture('job_added_manually')}
        />
      )}
    </>
  )
}
