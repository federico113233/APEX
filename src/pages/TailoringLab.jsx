import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Anthropic from '@anthropic-ai/sdk'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer, PageNumber, BorderStyle,
} from 'docx'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-20250514'

const SYSTEM_PROMPT = `You are an expert career coach and CV writer with 15 years of experience helping students land jobs at top companies. Your task is to tailor a student's CV and write a cover letter for a specific job posting.

STRICT RULES:
- NEVER invent experience, skills, or qualifications not present in the original CV
- ONLY reframe, reorder, and rephrase what already exists in the CV
- Optimize naturally for ATS by integrating exact keywords from the job description
- Adapt the narrative tone to the company culture (startup=bold/results-driven, corporate=structured/methodical, creative=innovative/passionate)
- Rewrite bullet points with strong action verbs and quantifiable results where possible
- If information is missing or unclear, ask the student targeted clarifying questions BEFORE generating

OUTPUT FORMAT:
First output the tailored CV in clean format.
Then output exactly this separator: |||COVER_LETTER|||
Then output the cover letter.
Then output exactly this separator: |||QUESTIONS|||
Then output any clarifying questions you have for the student (empty if none).`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in .env.local')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
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
  const [cvPart = '', rest = ''] = raw.split('|||COVER_LETTER|||')
  const [coverPart = '', qPart = ''] = rest.split('|||QUESTIONS|||')

  const questions = qPart
    .split('\n')
    .map((l) => l.replace(/^[\d.\-*•]\s*/, '').trim())
    .filter((l) => l.length > 10 && !/^(none|n\/a|no questions?)\.?$/i.test(l))

  return { cv: cvPart.trim(), cover: coverPart.trim(), questions }
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function TailoringLab() {
  const { user, session, addApplication, drafts, saveDraft, deleteDraft } = useUser()
  const location = useLocation()
  const navigate  = useNavigate()
  const abortRef  = useRef(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab]           = useState('new')
  const [activeJob, setActiveJob]       = useState(location.state?.job ?? null)
  const [phase, setPhase]               = useState('idle')
  const [streamText, setStreamText]     = useState('')
  const [tailoredCV, setTailoredCV]     = useState('')
  const [coverLetter, setCoverLetter]   = useState('')
  const [questions, setQuestions]       = useState([])
  const [answers, setAnswers]           = useState({})
  const [activeDocTab, setActiveDocTab] = useState('cv')
  const [error, setError]               = useState(null)
  const [addedToTracker, setAddedToTracker] = useState(false)
  const [downloading, setDownloading]   = useState(null)
  const [sessionId, setSessionId]       = useState(null)
  const [activeDraftId, setActiveDraftId] = useState(null)
  const [descExpanded, setDescExpanded] = useState(false)

  // Accordion height for job description
  const descInnerRef = useRef(null)
  const [descHeight, setDescHeight]     = useState(0)
  useLayoutEffect(() => {
    if (!descInnerRef.current) return
    setDescHeight(descExpanded ? descInnerRef.current.scrollHeight : 0)
  }, [descExpanded])

  // ── Load saved answers + auto-generate on mount ────────────────────────────
  useEffect(() => {
    if (!activeJob || tailoredCV) return
    let cancelled = false

    const init = async () => {
      let savedAnswers = {}
      if (session?.user?.id) {
        const { data } = await supabase
          .from('tailoring_sessions')
          .select('id, answers')
          .eq('user_id', session.user.id)
          .eq('job_id', String(activeJob.id))
          .maybeSingle()

        if (data) {
          setSessionId(data.id)
          savedAnswers = data.answers || {}
          setAnswers(savedAnswers)
        }
      }
      if (!cancelled) await generate(savedAnswers)
    }

    init()
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

  // ── Generate (streaming) ───────────────────────────────────────────────────
  const generate = async (currentAnswers = answers) => {
    setPhase('generating')
    setStreamText('')
    setError(null)

    let fullText = ''
    try {
      const client = getClient()
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(user, activeJob, currentAnswers) }],
      })
      abortRef.current = stream

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text
          setStreamText(fullText)
        }
      }

      const parsed = parseResponse(fullText)
      setTailoredCV(parsed.cv)
      setCoverLetter(parsed.cover)
      setQuestions(parsed.questions)
      setPhase('done')

      // Auto-save draft
      await persistDraft(parsed.cv, parsed.cover)
    } catch (err) {
      if (err.name === 'AbortError') return
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
    setDescExpanded(false)
    setMainTab('new')
  }

  const handleChangeJob = () => {
    abortRef.current?.abort?.()
    setActiveJob(null)
    setTailoredCV('')
    setCoverLetter('')
    setPhase('idle')
    setActiveDraftId(null)
    setAddedToTracker(false)
    navigate('/dashboard/tailoring-lab', { replace: true, state: {} })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 page-fade-in flex flex-col min-h-0">
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
            </div>
          ) : (
            /* ── Two-column layout ── */
            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">

              {/* ─ LEFT COLUMN (35%) ─ */}
              <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4">

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

                {/* Alex questions (only when done and questions exist) */}
                {phase === 'done' && questions.length > 0 && (
                  <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-amber-100 bg-amber-50/50">
                      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                        <span>💬</span> Alex has questions
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Answer to get a better result</p>
                    </div>
                    <div className="p-4 space-y-4">
                      <AlexBubble>
                        <p className="text-xs font-medium mb-2.5">To tailor your application better:</p>
                        <div className="space-y-3">
                          {questions.map((q, i) => (
                            <div key={i}>
                              <p className="text-xs font-medium text-apex-text mb-1">{i + 1}. {q}</p>
                              <textarea
                                value={answers[q] || ''}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                                placeholder="Your answer…"
                                rows={2}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none"
                              />
                            </div>
                          ))}
                        </div>
                      </AlexBubble>
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
                    {questions.length > 0 ? 'Regenerate with answers' : 'Regenerate'}
                  </button>
                )}
              </div>

              {/* ─ RIGHT COLUMN (flex-1) ─ */}
              <div className="flex-1 min-w-0 flex flex-col">

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
                      <div className="ml-auto px-4">
                        <button
                          onClick={() => navigator.clipboard?.writeText(activeDocTab === 'cv' ? tailoredCV : coverLetter)}
                          className="text-xs text-slate-400 hover:text-apex-blue transition-colors"
                        >
                          Copy to clipboard
                        </button>
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className="flex-1 p-5">
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

                    {/* Bottom action bar */}
                    <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                      {/* Download buttons */}
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

                {/* Only questions, no CV yet */}
                {phase === 'done' && !tailoredCV && !coverLetter && questions.length > 0 && (
                  <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-center p-8">
                    <div>
                      <p className="text-sm text-slate-500 mb-4">
                        Answer Alex's questions on the left, then click <strong className="text-slate-700">Regenerate</strong>.
                      </p>
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
