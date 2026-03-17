import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer, PageNumber, BorderStyle,
} from 'docx'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
import posthog from 'posthog-js'

// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-20250514'

const ANALYSIS_SYSTEM_PROMPT = `You are an expert career coach analyzing a student's CV against a job description. Your only task is to identify if there is any specific information missing from the CV that would meaningfully improve the tailoring quality. Think about: career motivations, specific skills not mentioned, relevant experiences that might not be in the CV, preferences about tone or emphasis. If you have 1-3 genuinely useful questions, output them as a numbered list. If you have everything you need, output exactly: NO_QUESTIONS. Be strict — only ask if the answer would actually change the output. Never ask obvious or generic questions.`

const SYSTEM_PROMPT = `You are an expert career coach and CV writer with 15 years of experience helping students land jobs at top companies. Your task is to tailor a student's CV and write a cover letter for a specific job posting.

LANGUAGE DETECTION:
Detect the primary language of the job description provided. Generate ALL outputs (tailored CV, cover letter, and changelog) in that same language. For Italian job postings, write in professional Italian. For English job postings, write in professional English. When the language is mixed or uncertain, default to Italian (the primary target market).

STRICT RULES:
- NEVER invent experience, skills, or qualifications not present in the original CV
- ONLY reframe, reorder, and rephrase what already exists in the CV
- Optimize naturally for ATS by integrating exact keywords from the job description
- Adapt the narrative tone to the company culture (startup=bold/results-driven, corporate=structured/methodical, creative=innovative/passionate)
- Rewrite bullet points with strong action verbs and quantifiable results where possible

CV TAILORING HIERARCHY — apply this logic to every experience, project, or activity:

TIER 1 — Core experiences: directly relevant to this specific role and company.
Action: Keep fully, expand bullet points to 4-5, emphasize keywords from the job description.

TIER 2 — Transferable experiences: not identical to the role but demonstrate applicable skills (leadership, coordination, international exposure, budget management, communication, etc.).
Action: Keep but compress to 2-3 bullet points maximum. Never eliminate entirely — transferable skills matter to recruiters.

TIER 3 — Low relevance experiences: no meaningful skill overlap with the target role.
Action: If CV fits in one page, compress to 1 line only (role + company + dates, no bullets). If CV still exceeds one page after compression, remove entirely — but only as last resort.

THE ONE PAGE RULE: A tailored CV must never exceed one page. Apply compression in this order: first compress Tier 3, then Tier 2, never Tier 1. If still too long, remove Tier 3 entirely before touching Tier 2.

NEVER remove an experience without documenting it in the changelog. The candidate must always know what was changed and why.

COVER LETTER — THREE-QUESTION FRAMEWORK:
A great cover letter must implicitly answer three questions, woven naturally into the narrative without explicit section headers or labels:

1. WHY THIS COMPANY: Show genuine knowledge of the company — reference their industry, mission, recent work, or culture. Never generic praise. If company info is available in the job description, use it specifically.

2. WHY ME: Connect the candidate's unique background and specific experiences directly to what this company needs. Highlight what makes this candidate distinct, not just qualified.

3. WHY THIS ROLE: Show genuine motivation for this specific position (not just any job). Connect the role to the candidate's trajectory and ambitions.

These three elements must be present and interwoven naturally. The cover letter should read as a coherent personal narrative, not as three separate answers. Never use these as section titles or explicit labels.

COVER LETTER STRUCTURE (MANDATORY):
The cover letter MUST always include all four of these parts — never skip any:
1. Strong opening paragraph that hooks the reader immediately (NEVER skip or abbreviate this)
2. 2-3 body paragraphs that weave in the three-question framework naturally
3. Closing paragraph with a clear, confident call to action
The opening paragraph is non-negotiable — it must always be present and strong.

COVER LETTER QUALITY RULES:
- First sentence must be strong and specific — NEVER start with "I am writing to apply for..."
- Tone: confident but not arrogant, personal but professional
- Length: 350-450 words. Never sacrifice quality or completeness for brevity.
- Every claim must be grounded in the candidate's actual CV — never invent or embellish
- End with a clear, confident call to action

OUTPUT FORMAT:
First output the tailored CV in clean format.
Then output exactly this separator: |||CHANGES|||
Then output the structured changelog using ONLY these prefixes, one item per line:
EXPANDED: [experience name] — [why: directly relevant for this role, which skills emphasized]
COMPRESSED: [experience name] — [why: transferable skills kept, what was reduced]
REMOVED: [experience name] — [why: no meaningful skill overlap, removed to fit one page]
REWRITTEN: [section name] — [what changed and why]
Maximum 6 changelog items. Always explain WHY in plain language. Write changelog in the same language as the CV. Tone: direct and helpful, like a career advisor explaining their choices.
Then output exactly this separator: |||COVER_LETTER|||
Then output the cover letter.`

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function* parseSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try { yield JSON.parse(line.slice(6)) } catch { /* skip */ }
    }
  }
}

function buildUserMessage(user, job, answers = {}) {
  const sectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []
  const langs = user.languages?.filter((l) => l.lang).map((l) => `${l.lang} (${l.level})`).join(', ')
  const salary = (user.salaryMin || user.salaryMax)
    ? `${user.salaryCurrency || '€'}${user.salaryMin || '?'} – ${user.salaryCurrency || '€'}${user.salaryMax || '?'}`
    : null

  let msg = `STUDENT PROFILE:
Name: ${user.name || 'Not provided'}
Location: ${[user.city, user.country].filter(Boolean).join(', ') || 'Not provided'}
Sectors of interest: ${sectors.join(', ') || 'Not specified'}
Contract preference: ${user.contractType || 'Not specified'}
Work mode: ${user.workMode || 'Not specified'}
${langs ? `Languages: ${langs}\n` : ''}${salary ? `Salary expectation: ${salary}\n` : ''}${user.linkedinUrl ? `LinkedIn: ${user.linkedinUrl}\n` : ''}
STUDENT'S CV:
${user.cvText?.trim() || '[No CV provided — use the profile information above and create a strong draft that the student can then personalise]'}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Full Job Description:
${job.description || 'Not provided'}`

  const answeredPairs = Object.entries(answers).filter(([, v]) => v?.trim())
  if (answeredPairs.length) {
    msg += `\n\nSTUDENT'S ANSWERS TO YOUR PREVIOUS CLARIFYING QUESTIONS:\n`
    answeredPairs.forEach(([q, a]) => { msg += `Q: ${q}\nA: ${a}\n\n` })
  }

  msg += `\nPlease tailor the CV and write the cover letter following your output format exactly.`
  return msg
}

function parseResponse(raw) {
  // CV section may contain a |||CHANGES||| block before |||COVER_LETTER|||
  const [cvAndChanges = '', afterCV = ''] = raw.split('|||COVER_LETTER|||')
  const [cvPart = '', changesPart = ''] = cvAndChanges.split('|||CHANGES|||')
  const [coverPart = '', qPart = ''] = afterCV.split('|||QUESTIONS|||')

  const questions = qPart
    .split('\n')
    .map((l) => l.replace(/^[\d.\-*•]\s*/, '').trim())
    .filter((l) => l.length > 10 && !/^(none|n\/a|no questions?)\.?$/i.test(l))

  const changes = changesPart
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(EXPANDED|COMPRESSED|REMOVED|REWRITTEN):/.test(l))
    .map((l) => {
      const m = l.match(/^(EXPANDED|COMPRESSED|REMOVED|REWRITTEN):\s*(.+)/)
      return m ? { type: m[1], text: m[2].trim() } : null
    })
    .filter(Boolean)
    .slice(0, 6)

  return { cv: cvPart.trim(), cover: coverPart.trim(), questions, changes }
}

function parseAnalysisQuestions(raw) {
  if (!raw || /NO_QUESTIONS/i.test(raw)) return []
  return raw
    .split('\n')
    .map(l => l.replace(/^[\d.\-*•]+\.?\s*/, '').trim())
    .filter(l => l.length > 10)
    .slice(0, 3)
}

function parseInline(text, baseSize = 22) {
  const runs = []
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], bold: true, italics: true, size: baseSize, font: 'Calibri' }))
    else if (m[3] !== undefined) runs.push(new TextRun({ text: m[3], bold: true, size: baseSize, font: 'Calibri' }))
    else if (m[4] !== undefined) runs.push(new TextRun({ text: m[4], italics: true, size: baseSize, font: 'Calibri' }))
    else if (m[5] !== undefined) runs.push(new TextRun({ text: m[5], size: baseSize, font: 'Calibri' }))
  }
  return runs.length ? runs : [new TextRun({ text, size: baseSize, font: 'Calibri' })]
}

function markdownToParagraphs(text, isCV = false, userName = '') {
  const lines = text.split('\n')
  const paragraphs = []

  if (isCV && userName) {
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: userName, bold: true, size: 44, font: 'Calibri' })],
    }))
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { paragraphs.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: '' })] })); continue }
    if (/^# (.+)/.test(trimmed)) { paragraphs.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: trimmed.replace(/^# /, ''), bold: true, size: 36, font: 'Calibri' })] })); continue }
    if (/^## (.+)/.test(trimmed)) { paragraphs.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text: trimmed.replace(/^## /, ''), bold: true, size: 28, font: 'Calibri' })] })); continue }
    if (/^### (.+)/.test(trimmed)) { paragraphs.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: trimmed.replace(/^### /, ''), bold: true, size: 24, font: 'Calibri' })] })); continue }
    if (/^(-{3,}|─{3,}|={3,})$/.test(trimmed)) { paragraphs.push(new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, children: [new TextRun({ text: '' })] })); continue }
    if (/^[-*•] (.+)/.test(trimmed)) { paragraphs.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: parseInline(trimmed.replace(/^[-*•] /, '')) })); continue }
    const isCapsHeader = /^[A-Z][A-Z\s&/,\-]{3,}$/.test(trimmed) && trimmed.length < 60
    if (isCapsHeader) { paragraphs.push(new Paragraph({ spacing: { before: 200, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA' } }, children: [new TextRun({ text: trimmed, bold: true, size: 24, font: 'Calibri', allCaps: true })] })); continue }
    paragraphs.push(new Paragraph({ spacing: { after: 60 }, children: parseInline(line) }))
  }
  return paragraphs
}

async function downloadDocx(text, filename, isCV = false, userName = '') {
  const paragraphs = markdownToParagraphs(text, isCV, userName)
  const margin = { top: 1417, right: 1417, bottom: 1417, left: 1417 }
  const sections = [{
    properties: { page: { margin } },
    children: paragraphs,
    ...(isCV ? {
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Calibri', color: '888888' })],
          })],
        }),
      },
    } : {}),
  }]
  const doc = new Document({ sections })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function AlexBubble({ children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
        <span className="text-white font-bold text-[10px]">A</span>
      </div>
      <div className="flex-1 bg-slate-50 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-apex-text leading-relaxed border border-slate-100">
        {children}
      </div>
    </div>
  )
}

function LoadingCard({ streamText }) {
  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <div>
            <p className="font-semibold text-apex-text text-sm">Alex is tailoring your application…</p>
            <p className="text-xs text-apex-muted">Analysing job description and reframing your CV</p>
          </div>
          <div className="ml-auto flex gap-1">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="w-2 h-2 bg-apex-blue rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-apex-blue to-apex-cyan rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
      {streamText && (
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="whitespace-pre-wrap font-mono text-xs text-apex-muted leading-relaxed">{streamText}</pre>
        </div>
      )}
    </div>
  )
}

function DraftCard({ draft, onLoad, onDelete }) {
  const date = new Date(draft.updated_at || draft.created_at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-slate-900 text-sm leading-snug">{draft.job_title}</h3>
          <button
            onClick={onDelete}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
            title="Delete draft"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500">{draft.company}{draft.location ? ` · ${draft.location}` : ''}</p>
        <p className="text-xs text-slate-400 mt-1">{date}</p>
      </div>

      {draft.cv_text && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-mono text-[11px] text-slate-500 leading-relaxed line-clamp-3">
            {draft.cv_text.slice(0, 180)}
          </p>
        </div>
      )}

      <button
        onClick={onLoad}
        className="mt-auto w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
      >
        Continue editing →
      </button>
    </div>
  )
}

// ─── Markdown renderer for CV / Cover Letter preview ─────────────────────────
function MarkdownContent({ text }) {
  const elements = []
  let listBuf = []
  let key = 0

  const flush = () => {
    if (!listBuf.length) return
    elements.push(
      <ul key={key++} style={{ listStyle: 'disc', paddingLeft: 20, margin: '0 0 12px' }}>
        {listBuf.map((item, i) => (
          <li key={i} style={{ fontSize: 14, color: '#1E293B', lineHeight: 1.7, marginBottom: 2 }}
            dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
        ))}
      </ul>
    )
    listBuf = []
  }

  for (const line of text.split('\n')) {
    if (/^### /.test(line)) {
      flush()
      elements.push(<h3 key={key++} style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.replace(/^### /, '')) }} />)
    } else if (/^## /.test(line)) {
      flush()
      elements.push(<h2 key={key++} style={{ margin: '18px 0 4px', fontSize: 15, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.replace(/^## /, '')) }} />)
    } else if (/^# /.test(line)) {
      flush()
      elements.push(<h1 key={key++} style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.replace(/^# /, '')) }} />)
    } else if (/^---+$/.test(line.trim())) {
      flush()
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '16px 0' }} />)
    } else if (/^[•\-*] /.test(line)) {
      listBuf.push(line.replace(/^[•\-*] /, ''))
    } else if (line.trim() === '') {
      flush()
      elements.push(<div key={key++} style={{ height: 6 }} />)
    } else {
      flush()
      elements.push(<p key={key++} style={{ margin: '0 0 12px', fontSize: 14, color: '#1E293B', lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />)
    }
  }
  flush()

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {elements}
    </div>
  )
}

function inlineMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;font-size:12.5px;font-family:monospace">$1</code>')
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TailoringLab() {
  const { user, session, addApplication, applications, drafts, saveDraft, deleteDraft } = useUser()
  const location = useLocation()
  const navigate  = useNavigate()
  const abortRef  = useRef(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab]           = useState('new')
  const [activeJob, setActiveJob]       = useState(() => {
    if (location.state?.job) return location.state.job
    try { return JSON.parse(localStorage.getItem('apex_lab_state') || '{}').activeJob || null }
    catch { return null }
  })
  const [phase, setPhase]               = useState(() => {
    if (location.state?.job) return 'idle'
    try {
      const s = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
      if (s.tailoredCV) return 'done'
      if (s.questions?.length) return 'questioning'
      return 'idle'
    } catch { return 'idle' }
  })
  const [streamText, setStreamText]     = useState('')
  const [tailoredCV, setTailoredCV]     = useState(() => {
    if (location.state?.job) return ''
    try { return JSON.parse(localStorage.getItem('apex_lab_state') || '{}').tailoredCV || '' }
    catch { return '' }
  })
  const [coverLetter, setCoverLetter]   = useState(() => {
    if (location.state?.job) return ''
    try { return JSON.parse(localStorage.getItem('apex_lab_state') || '{}').coverLetter || '' }
    catch { return '' }
  })
  const [questions, setQuestions]       = useState(() => {
    if (location.state?.job) return []
    try { return JSON.parse(localStorage.getItem('apex_lab_state') || '{}').questions || [] }
    catch { return [] }
  })
  const [answers, setAnswers]           = useState({})
  const [activeDocTab, setActiveDocTab] = useState(() => {
    if (location.state?.openTab) return location.state.openTab
    try { return JSON.parse(localStorage.getItem('apex_lab_state') || '{}').activeDocTab || 'cv' }
    catch { return 'cv' }
  })
  const [viewMode, setViewMode]         = useState('preview') // 'preview' | 'edit'
  const [error, setError]               = useState(null)
  const [addedToTracker, setAddedToTracker] = useState(false)
  const [downloading, setDownloading]   = useState(null)
  const [copied, setCopied]             = useState(false)
  const [sessionId, setSessionId]       = useState(null)
  const [activeDraftId, setActiveDraftId] = useState(null)
  const [descExpanded, setDescExpanded]   = useState(false)
  const [alexInput, setAlexInput]         = useState('')
  const [alexLoading, setAlexLoading]     = useState(false)
  const [alexBanner, setAlexBanner]       = useState(null) // { text, prevCv, prevCover }
  const [changelog, setChangelog]         = useState([])   // [{ type, text }]
  const [changelogOpen, setChangelogOpen] = useState(false)
  const ALEX_PILLS = ['Make it more concise', 'Add more impact', 'Match keywords better', 'Adjust tone']

  // Accordion height for job description
  const descInnerRef = useRef(null)
  const [descHeight, setDescHeight]     = useState(0)
  useLayoutEffect(() => {
    if (!descInnerRef.current) return
    setDescHeight(descExpanded ? descInnerRef.current.scrollHeight : 0)
  }, [descExpanded])

  // ── State persistence ──────────────────────────────────────────────────────
  const scrollRef      = useRef(null)
  const scrollTimerRef = useRef(null)
  const restoredRef    = useRef(false)

  // Save activeDocTab whenever it changes
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
      localStorage.setItem('apex_lab_state', JSON.stringify({ ...saved, activeDocTab }))
    } catch {}
  }, [activeDocTab])

  // Save activeJob, tailoredCV, coverLetter, questions (debounced)
  const labSaveTimerRef = useRef(null)
  useEffect(() => {
    clearTimeout(labSaveTimerRef.current)
    labSaveTimerRef.current = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
        localStorage.setItem('apex_lab_state', JSON.stringify({
          ...saved,
          activeJob,
          tailoredCV,
          coverLetter,
          questions,
        }))
      } catch {}
    }, 500)
  }, [activeJob, tailoredCV, coverLetter, questions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore scroll position once phase becomes 'done' (content is in DOM)
  useEffect(() => {
    if (phase === 'done' && scrollRef.current && !restoredRef.current) {
      restoredRef.current = true
      try {
        const { scrollTop } = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
        if (scrollTop) scrollRef.current.scrollTop = scrollTop
      } catch {}
    }
  }, [phase])

  // Re-sync scroll when coming back to this browser tab
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && scrollRef.current) {
        try {
          const { scrollTop } = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
          if (scrollTop !== undefined) scrollRef.current.scrollTop = scrollTop
        } catch {}
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  const handleDocScroll = useCallback(() => {
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      if (scrollRef.current) {
        try {
          const saved = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
          localStorage.setItem('apex_lab_state', JSON.stringify({ ...saved, scrollTop: scrollRef.current.scrollTop }))
        } catch {}
      }
    }, 200)
  }, [])

  // ── Auto-start analysis on fresh Discover navigation ──────────────────────
  useEffect(() => {
    // Only auto-start when job was passed fresh from Discover (location.state?.job).
    // On localStorage restore (no location.state), skip — UI already shows correct phase.
    if (!activeJob || tailoredCV) return
    if (!location.state?.job) return
    let cancelled = false
    const run = async () => { if (!cancelled) await startFlow() }
    run()
    return () => {
      cancelled = true
      abortRef.current?.abort?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist Q&A session ────────────────────────────────────────────────────
  const persistAnswers = async (currentAnswers) => {
    if (!session?.user?.id || !activeJob?.id) return
    const filled = Object.fromEntries(Object.entries(currentAnswers).filter(([, v]) => v?.trim()))
    const payload = {
      user_id: session.user.id, job_id: String(activeJob.id),
      job_title: activeJob.title, company: activeJob.company,
      questions: questions.join('\n'), answers: filled,
      updated_at: new Date().toISOString(),
    }
    if (sessionId) {
      const { data } = await supabase.from('tailoring_sessions').update(payload).eq('id', sessionId).select('id').single()
      if (data) setSessionId(data.id)
    } else {
      const { data } = await supabase.from('tailoring_sessions').insert(payload).select('id').single()
      if (data) setSessionId(data.id)
    }
  }

  // ── Auto-save draft after generation ──────────────────────────────────────
  const persistDraft = async (cv, cover) => {
    if (!activeJob) return
    const jobId = String(activeJob.id || `${activeJob.title}_${activeJob.company}`.replace(/\W+/g, '_'))
    const saved = await saveDraft({
      job_id: jobId,
      job_title: activeJob.title || '',
      company: activeJob.company || '',
      location: activeJob.location || '',
      job_description: activeJob.description || '',
      job_url: activeJob.url || '',
      cv_text: cv,
      cover_letter_text: cover,
    })
    if (saved) setActiveDraftId(saved.id)
  }

  // ── Step 1: Analysis (non-streaming) ───────────────────────────────────────
  const startFlow = async () => {
    if (!activeJob) return
    setPhase('analyzing')
    setError(null)
    try {
      const res = await fetch('/api/tailoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `CV:\n${user.cvText?.trim() || 'Not provided'}\n\nJob title: ${activeJob.title}\nCompany: ${activeJob.company}\nJob description: ${activeJob.description || 'Not provided'}\n\nDo you need any clarifying information to tailor this CV optimally? If yes, list max 3 specific questions. If no, output NO_QUESTIONS.`,
          }],
          systemPrompt: ANALYSIS_SYSTEM_PROMPT,
          stream: false,
          maxTokens: 500,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const rawText = data?.content?.[0]?.text ?? data?.text ?? ''
      const qs = parseAnalysisQuestions(rawText)
      if (qs.length === 0) {
        await generate()
      } else {
        setQuestions(qs)
        setAnswers({})
        setPhase('questioning')
      }
    } catch (err) {
      if (err.name === 'AbortError') { setPhase('idle'); return }
      console.error('[TailoringLab] Analysis error:', err)
      await generate() // fall back to direct generation
    }
  }

  // ── Step 3: Generate (streaming) ───────────────────────────────────────────
  const generate = async (currentAnswers = answers) => {
    setPhase('generating')
    setStreamText('')
    setError(null)
    posthog.capture('tailoring_started', { job_title: activeJob?.title, company: activeJob?.company })

    const controller = new AbortController()
    abortRef.current = controller

    let fullText = ''
    try {
      const res = await fetch('/api/tailoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: 'user', content: buildUserMessage(user, activeJob, currentAnswers) }],
          systemPrompt: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          stream: true,
          maxTokens: 4096,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      for await (const event of parseSSE(res)) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullText += event.delta.text
          setStreamText(fullText)
        }
      }

      const parsed = parseResponse(fullText)
      setTailoredCV(parsed.cv)
      setCoverLetter(parsed.cover)
      setChangelog(parsed.changes)
      setChangelogOpen(false)
      setPhase('done')

      // Immediately persist to localStorage so a tab-reload/discard shows 'done', not re-generates
      try {
        const saved = JSON.parse(localStorage.getItem('apex_lab_state') || '{}')
        localStorage.setItem('apex_lab_state', JSON.stringify({
          ...saved,
          activeJob,
          tailoredCV: parsed.cv,
          coverLetter: parsed.cover,
          questions: [],
        }))
      } catch { /* ignore */ }
      if (parsed.cv) posthog.capture('cv_generated', { job_title: activeJob?.title, company: activeJob?.company })
      if (parsed.cover) posthog.capture('cover_letter_generated', { job_title: activeJob?.title, company: activeJob?.company })

      // Auto-save draft
      await persistDraft(parsed.cv, parsed.cover)
    } catch (err) {
      if (err.name === 'AbortError') {
        // Stream was aborted (tab switch / navigate away). Reset to idle so
        // the restored state (from localStorage) drives the UI, not 'generating'.
        setPhase('idle')
        setStreamText('')
        return
      }
      console.error('[TailoringLab] API error:', err)
      setError(err.message || 'An error occurred. Please try again.')
      setPhase('error')
    }
  }

  const handleRegenerate = async () => {
    await persistAnswers(answers)
    await generate(answers)
  }

  const handleDownload = async (type) => {
    setDownloading(type)
    try {
      const text  = type === 'cv' ? tailoredCV : coverLetter
      const label = type === 'cv' ? 'CV' : 'Cover_Letter'
      const company = activeJob?.company?.replace(/\s+/g, '_') || 'Company'
      await downloadDocx(text, `${label}_${company}.docx`, type === 'cv', user.name)
      if (type === 'cv') posthog.capture('cv_downloaded', { job_title: activeJob?.title, company: activeJob?.company })
    } catch (err) {
      console.error('[TailoringLab] Download error:', err)
    } finally {
      setDownloading(null)
    }
  }

  const handleAddToTracker = async () => {
    if (!activeJob) return
    await addApplication(activeJob, tailoredCV, coverLetter, activeJob.score || 0)
    if (activeDraftId) {
      await deleteDraft(activeDraftId)
      setActiveDraftId(null)
    }
    posthog.capture('added_to_tracker_from_lab', { job_title: activeJob?.title, company: activeJob?.company })
    setAddedToTracker(true)
  }

  const handleLoadDraft = (draft) => {
    setActiveJob({
      id: draft.job_id,
      title: draft.job_title,
      company: draft.company,
      location: draft.location,
      description: draft.job_description,
      url: draft.job_url,
    })
    setTailoredCV(draft.cv_text)
    setCoverLetter(draft.cover_letter_text)
    setPhase('done')
    setActiveDraftId(draft.id)
    setAddedToTracker(false)
    setAnswers({})
    setQuestions([])
    setChangelog([])
    setChangelogOpen(false)
    setDescExpanded(false)
    setMainTab('new')
  }

  const handleAlexEdit = async (requestText) => {
    const req = (requestText ?? alexInput).trim()
    if (!req || alexLoading) return
    setAlexInput('')
    setAlexLoading(true)
    setAlexBanner(null)

    const doc     = activeDocTab === 'cv' ? tailoredCV : coverLetter
    const docType = activeDocTab === 'cv' ? 'CV' : 'Cover Letter'

    try {
      const res = await fetch('/api/tailoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Here is the current ${docType}:\n\n${doc}\n\nUser request: ${req}\n\nPlease apply the edit and return the full modified ${docType}.` }],
          systemPrompt: `You are Alex, an expert CV and cover letter editor. The user wants you to edit their ${docType}.\nReturn ONLY the modified document text — no explanations, no preamble, no markdown code blocks, just the document.\nAfter the document, output exactly: |||ALEX_MSG|||\nThen output one short sentence (max 15 words) describing what you changed, starting with "Done!"`,
          stream: true,
          maxTokens: 4096,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      let fullText = ''
      for await (const event of parseSSE(res)) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullText += event.delta.text
        }
      }

      const [newDoc, msgPart = ''] = fullText.split('|||ALEX_MSG|||')
      const cleanDoc = newDoc.trim()
      const alexMsg  = msgPart.trim() || 'Done! I\'ve updated the document.'

      const prevCv    = tailoredCV
      const prevCover = coverLetter

      if (activeDocTab === 'cv') setTailoredCV(cleanDoc)
      else setCoverLetter(cleanDoc)

      setAlexBanner({ text: alexMsg, prevCv, prevCover })
    } catch (err) {
      console.error('[Alex edit]', err)
      setAlexBanner({ text: 'Something went wrong. Please try again.', prevCv: null, prevCover: null })
    } finally {
      setAlexLoading(false)
    }
  }

  const handleAlexUndo = () => {
    if (!alexBanner) return
    if (alexBanner.prevCv !== null)    setTailoredCV(alexBanner.prevCv)
    if (alexBanner.prevCover !== null) setCoverLetter(alexBanner.prevCover)
    setAlexBanner(null)
  }

  const handleChangeJob = () => {
    localStorage.removeItem('apex_lab_state')
    abortRef.current?.abort?.()
    setActiveJob(null)
    setTailoredCV('')
    setCoverLetter('')
    setQuestions([])
    setAnswers({})
    setChangelog([])
    setChangelogOpen(false)
    setError(null)
    setPhase('idle')
    setActiveDraftId(null)
    setAddedToTracker(false)
    setDescExpanded(false)
    setAlexBanner(null)
    navigate('/dashboard/tailoring-lab', { replace: true, state: {} })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 page-fade-in flex flex-col md:h-screen md:overflow-hidden">
      {/* Header */}
      <div className="mb-5 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">Tailoring Lab</h1>
        <p className="text-slate-500 mt-1 text-sm">AI-powered CV and cover letter tailored to each job</p>
      </div>

      {/* ── Main tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 flex-shrink-0">
        {[
          { key: 'new', label: 'New Application' },
          { key: 'drafts', label: `Drafts${drafts.length > 0 ? ` (${drafts.length})` : ''}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              mainTab === key
                ? 'text-apex-blue border-apex-blue'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: NEW APPLICATION ══════════════ */}
      {mainTab === 'new' && (
        <>
          {!activeJob ? (
            /* No job selected empty state */
            (() => {
              const manualJobs = applications.filter(a => a.manual)
              return (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 px-8 py-16 text-center">
                  <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center shadow-sm">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-apex-text mb-2">No job selected</h3>
                  <p className="text-sm text-apex-muted mb-6 max-w-sm mx-auto">
                    Browse jobs in Discover, then click{' '}
                    <span className="font-semibold text-apex-blue">✦ Tailor Application</span>{' '}
                    to generate your personalised CV and cover letter with AI.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => navigate('/dashboard/discover')}
                      className="px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity text-sm">
                      Browse jobs →
                    </button>
                    {drafts.length > 0 && (
                      <button onClick={() => setMainTab('drafts')}
                        className="px-6 py-2.5 rounded-lg font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors text-sm">
                        View Drafts ({drafts.length})
                      </button>
                    )}
                  </div>
                  {manualJobs.length > 0 && (
                    <div className="mt-8 max-w-sm mx-auto text-left">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Manually added jobs</p>
                      <div className="flex flex-col gap-2">
                        {manualJobs.map(app => (
                          <button
                            key={app.id}
                            onClick={() => setActiveJob({ id: app.jobId, title: app.title, company: app.company, location: app.location, description: app.description, url: app.jobUrl })}
                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100">
                              <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{app.title}</p>
                              <p className="text-xs text-slate-400 truncate">{app.company}{app.location ? ` · ${app.location}` : ''}</p>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
          ) : (
            /* ── Two-column layout ── */
            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 md:overflow-hidden">

              {/* ─ LEFT COLUMN (35%) ─ */}
              <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4 md:overflow-y-auto md:h-[calc(100vh-200px)]">

                {/* Job info card */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-apex-blue bg-blue-50 px-2.5 py-1 rounded-full mb-3">
                    ✦ Selected job
                  </span>
                  <h2 className="font-bold text-slate-900 text-base leading-snug">{activeJob.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {[activeJob.company, activeJob.location].filter(Boolean).join(' · ')}
                  </p>

                  {/* Collapsible description */}
                  {activeJob.description && (
                    <div className="mt-3">
                      <button
                        onClick={() => setDescExpanded(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-medium text-apex-blue hover:opacity-80 transition-opacity"
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-300 ${descExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {descExpanded ? 'Hide description' : 'View full description'}
                      </button>
                      <div style={{ height: descHeight, overflow: 'hidden', transition: 'height 300ms ease' }}>
                        <div ref={descInnerRef}>
                          <p className="text-xs text-slate-500 leading-relaxed mt-2 whitespace-pre-line">
                            {activeJob.description}
                          </p>
                          {activeJob.url && (
                            <a href={activeJob.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-apex-blue hover:underline">
                              View listing ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                    {activeJob.url && !activeJob.description && (
                      <a href={activeJob.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                        View listing ↗
                      </a>
                    )}
                    <button onClick={handleChangeJob}
                      className="text-xs text-slate-400 hover:text-apex-text transition-colors">
                      Change job
                    </button>
                  </div>
                </div>

                {/* ── Ask Alex to edit ── */}
                {phase === 'done' && (tailoredCV || coverLetter) && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Divider header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-slate-700">Ask Alex to edit</span>
                      <span className="text-xs text-slate-400 ml-0.5">
                        · {activeDocTab === 'cv' ? 'Tailored CV' : 'Cover Letter'}
                      </span>
                    </div>

                    {/* Alex response banner */}
                    {alexBanner && (
                      <div style={{
                        margin: '12px 12px 0',
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#EFF6FF',
                        border: '1px solid #DBEAFE',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <svg width="14" height="14" fill="none" stroke="#2563EB" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span style={{ fontSize: 12, color: '#1D4ED8', flex: 1, lineHeight: 1.4 }}>{alexBanner.text}</span>
                        {alexBanner.prevCv !== null || alexBanner.prevCover !== null ? (
                          <button
                            onClick={handleAlexUndo}
                            style={{ fontSize: 11, fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: '2px 6px', borderRadius: 6 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            Undo
                          </button>
                        ) : null}
                      </div>
                    )}

                    <div className="p-3 space-y-2.5">
                      {/* Quick pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {ALEX_PILLS.map(pill => (
                          <button
                            key={pill}
                            onClick={() => handleAlexEdit(pill)}
                            disabled={alexLoading}
                            className="px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 transition-colors disabled:opacity-50"
                          >
                            {pill}
                          </button>
                        ))}
                      </div>

                      {/* Free text input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={alexInput}
                          onChange={e => setAlexInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAlexEdit() }}
                          placeholder="Or type your request…"
                          disabled={alexLoading}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent transition-shadow disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleAlexEdit()}
                          disabled={!alexInput.trim() || alexLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-opacity"
                          style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
                        >
                          {alexLoading ? (
                            <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                          ) : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Regenerate button */}
                {phase === 'done' && (
                  <button
                    onClick={handleRegenerate}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                )}
              </div>

              {/* ─ RIGHT COLUMN (flex-1) ─ */}
              <div className="flex-1 min-w-0 flex flex-col md:overflow-hidden">

                {/* Idle */}
                {phase === 'idle' && (
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center p-8 text-center gap-5">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center shadow-sm">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 mb-1">Pronto per la personalizzazione</p>
                      <p className="text-sm text-slate-500 max-w-xs">Alex riscriverà il tuo CV e preparerà una lettera di presentazione su misura per questo ruolo.</p>
                    </div>
                    <button
                      onClick={() => startFlow()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:opacity-90 transition-opacity"
                      style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Genera con Alex
                    </button>
                  </div>
                )}

                {/* Analyzing */}
                {phase === 'analyzing' && (
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-8">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-bold text-xs">A</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Alex sta analizzando…</p>
                        <p className="text-xs text-slate-400">Lettura del CV e della descrizione del ruolo</p>
                      </div>
                      <div className="flex gap-1 ml-1">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1.5 h-1.5 bg-apex-blue rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Questioning */}
                {phase === 'questioning' && (
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-bold text-xs">A</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Prima di iniziare, ho alcune domande</p>
                        <p className="text-xs text-slate-400">Rispondimi per un risultato migliore — oppure salta direttamente alla generazione</p>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {questions.map((q, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-sm font-medium text-slate-800 mb-2">{i + 1}. {q}</p>
                          <textarea
                            value={answers[q] || ''}
                            onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                            placeholder="La tua risposta…"
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 flex flex-col items-center gap-2">
                      <button
                        onClick={() => generate(answers)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:opacity-90 transition-opacity"
                        style={{ background: 'linear-gradient(135deg,#2563EB,#38BDF8)' }}
                      >
                        Genera ora
                      </button>
                      <button
                        onClick={() => generate({})}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Salta e genera
                      </button>
                    </div>
                  </div>
                )}

                {/* Generating */}
                {phase === 'generating' && <LoadingCard streamText={streamText} />}

                {/* Error */}
                {phase === 'error' && (
                  <div className="flex-1 bg-white rounded-xl border border-red-200 flex flex-col items-center justify-center p-8 text-center">
                    <svg className="w-10 h-10 text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-500 text-sm mb-4">{error}</p>
                    <button onClick={() => generate()}
                      className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95">
                      Retry
                    </button>
                  </div>
                )}

                {/* Done — full editor */}
                {phase === 'done' && (tailoredCV || coverLetter) && (
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">

                    {/* Doc tab bar */}
                    <div className="flex items-center border-b border-slate-200 px-1 flex-shrink-0">
                      {[
                        { key: 'cv',    label: 'Tailored CV' },
                        { key: 'cover', label: 'Cover Letter' },
                      ].map(({ key, label }) => (
                        <button key={key} onClick={() => setActiveDocTab(key)}
                          className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeDocTab === key
                              ? 'text-apex-blue border-apex-blue'
                              : 'text-slate-400 border-transparent hover:text-slate-700'
                          }`}>
                          {label}
                        </button>
                      ))}
                      <div className="ml-auto flex items-center gap-3 px-4">
                        {/* Preview / Edit toggle */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                          {['preview', 'edit'].map(mode => (
                            <button
                              key={mode}
                              onClick={() => setViewMode(mode)}
                              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                                viewMode === mode
                                  ? 'bg-white text-slate-800 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(activeDocTab === 'cv' ? tailoredCV : coverLetter)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                          className={`text-xs transition-colors ${copied ? 'text-green-600' : 'text-slate-400 hover:text-apex-blue'}`}
                        >
                          {copied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Preview or Edit */}
                    <div className="flex-1 overflow-y-auto" ref={scrollRef} onScroll={handleDocScroll}>
                      {viewMode === 'preview' ? (
                        <div className="p-6">
                          <MarkdownContent
                            text={activeDocTab === 'cv' ? tailoredCV : coverLetter}
                          />
                          {/* Changelog panel — CV tab only */}
                          {activeDocTab === 'cv' && changelog.length > 0 && (
                            <div className="mt-6 rounded-xl border border-slate-200 overflow-hidden">
                              <button
                                onClick={() => setChangelogOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                              >
                                <span className="text-[13px] font-semibold text-slate-700">
                                  {/^[A-Z]/.test(changelog[0]?.text?.slice(0, 2) ?? '') && changelog[0]?.text?.match(/[àèìòùÀÈÌÒÙ]/)
                                    ? 'Cosa ha modificato Alex'
                                    : 'What Alex changed'}
                                </span>
                                <svg
                                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${changelogOpen ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              {changelogOpen && (
                                <div className="divide-y divide-slate-100">
                                  {changelog.map((item, i) => {
                                    const dot = {
                                      EXPANDED:   '#16A34A',
                                      COMPRESSED: '#D97706',
                                      REMOVED:    '#DC2626',
                                      REWRITTEN:  '#2563EB',
                                    }[item.type] ?? '#94A3B8'
                                    return (
                                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 4 }} />
                                        <p className="text-[13px] text-slate-600 leading-relaxed">
                                          <span className="font-semibold text-slate-800">{item.type.charAt(0) + item.type.slice(1).toLowerCase()}</span>
                                          {': '}
                                          {item.text}
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-5 h-full">
                          <textarea
                            value={activeDocTab === 'cv' ? tailoredCV : coverLetter}
                            onChange={(e) => activeDocTab === 'cv'
                              ? setTailoredCV(e.target.value)
                              : setCoverLetter(e.target.value)
                            }
                            spellCheck={false}
                            className="w-full h-full min-h-[500px] font-mono text-[13px] text-slate-800 leading-relaxed bg-slate-50/60 rounded-xl p-5 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-apex-blue/20 focus:border-apex-blue/30 resize-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Bottom action bar */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                      {/* Download buttons — only shown when content exists */}
                      {tailoredCV && (
                        <button
                          onClick={() => handleDownload('cv')}
                          disabled={downloading === 'cv'}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 transition-all disabled:opacity-60"
                        >
                          {downloading === 'cv'
                            ? <div className="w-3.5 h-3.5 rounded-full border border-slate-400/30 border-t-slate-500 animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                          }
                          CV .docx
                        </button>
                      )}

                      {coverLetter && (
                        <button
                          onClick={() => handleDownload('cover')}
                          disabled={downloading === 'cover'}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 transition-all disabled:opacity-60"
                        >
                          {downloading === 'cover'
                            ? <div className="w-3.5 h-3.5 rounded-full border border-slate-400/30 border-t-slate-500 animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                          }
                          Cover Letter .docx
                        </button>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Add to Tracker */}
                      <button
                        onClick={handleAddToTracker}
                        disabled={addedToTracker}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                          addedToTracker
                            ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                            : 'text-white shadow-sm shadow-blue-500/20 hover:opacity-90'
                        }`}
                        style={!addedToTracker ? { background: 'linear-gradient(135deg,#2563EB,#38BDF8)' } : {}}
                      >
                        {addedToTracker ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Added to Tracker
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add to Tracker
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════ TAB: DRAFTS ══════════════ */}
      {mainTab === 'drafts' && (
        <div className="flex-1">
          {drafts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-8 py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-apex-text mb-1">No drafts yet</h3>
              <p className="text-sm text-apex-muted mb-5 max-w-xs mx-auto">
                Drafts are saved automatically every time Alex generates a CV and cover letter.
              </p>
              <button onClick={() => setMainTab('new')}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity">
                Start new application
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">{drafts.length} draft{drafts.length !== 1 ? 's' : ''} in progress</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    onLoad={() => handleLoadDraft(draft)}
                    onDelete={() => deleteDraft(draft.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
