import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Anthropic from '@anthropic-ai/sdk'
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Footer, PageNumber, LevelFormat, BorderStyle,
} from 'docx'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'

// ─── Constants ───────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
    .map((l) => l.replace(/^[\d\.\-\*•]\s*/, '').trim())
    .filter((l) => l.length > 10 && !/^(none|n\/a|no questions?)\.?$/i.test(l))

  return {
    cv: cvPart.trim(),
    cover: coverPart.trim(),
    questions,
  }
}

// Parse inline markdown (**bold**, *italic*, ***bold-italic***) into TextRun[]
function parseInline(text, baseSize = 22) {
  const runs = []
  // Pattern: ***bold+italic***, **bold**, *italic*, or plain text
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true, italics: true, size: baseSize, font: 'Calibri' }))
    } else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], bold: true, size: baseSize, font: 'Calibri' }))
    } else if (m[4] !== undefined) {
      runs.push(new TextRun({ text: m[4], italics: true, size: baseSize, font: 'Calibri' }))
    } else if (m[5] !== undefined) {
      runs.push(new TextRun({ text: m[5], size: baseSize, font: 'Calibri' }))
    }
  }
  return runs.length ? runs : [new TextRun({ text, size: baseSize, font: 'Calibri' })]
}

// Convert markdown text to an array of docx Paragraph objects
function markdownToParagraphs(text, isCV = false, userName = '') {
  const lines = text.split('\n')
  const paragraphs = []

  // CV: name header at top
  if (isCV && userName) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: userName, bold: true, size: 44, font: 'Calibri' })],
      })
    )
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Blank line → small spacer
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: '' })] }))
      continue
    }

    // # Heading 1
    if (/^# (.+)/.test(trimmed)) {
      const content = trimmed.replace(/^# /, '')
      paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: content, bold: true, size: 36, font: 'Calibri' })],
      }))
      continue
    }

    // ## Heading 2
    if (/^## (.+)/.test(trimmed)) {
      const content = trimmed.replace(/^## /, '')
      paragraphs.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: content, bold: true, size: 28, font: 'Calibri' })],
      }))
      continue
    }

    // ### Heading 3
    if (/^### (.+)/.test(trimmed)) {
      const content = trimmed.replace(/^### /, '')
      paragraphs.push(new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: content, bold: true, size: 24, font: 'Calibri' })],
      }))
      continue
    }

    // Horizontal rule (--- or ─── or ═══)
    if (/^(-{3,}|─{3,}|={3,})$/.test(trimmed)) {
      paragraphs.push(new Paragraph({
        spacing: { before: 80, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        children: [new TextRun({ text: '' })],
      }))
      continue
    }

    // Bullet point (- or * or •)
    if (/^[-*•] (.+)/.test(trimmed)) {
      const content = trimmed.replace(/^[-*•] /, '')
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInline(content),
      }))
      continue
    }

    // ALL CAPS section header (e.g. WORK EXPERIENCE, EDUCATION)
    const isCapsHeader = /^[A-Z][A-Z\s&/,\-]{3,}$/.test(trimmed) && trimmed.length < 60
    if (isCapsHeader) {
      paragraphs.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA' } },
        children: [new TextRun({ text: trimmed, bold: true, size: 24, font: 'Calibri', allCaps: true })],
      }))
      continue
    }

    // Normal paragraph with inline markdown
    paragraphs.push(new Paragraph({
      spacing: { after: 60 },
      children: parseInline(line),
    }))
  }

  return paragraphs
}

async function downloadDocx(text, filename, isCV = false, userName = '') {
  const paragraphs = markdownToParagraphs(text, isCV, userName)

  // 2.5 cm margins = 1417 twips (1 cm ≈ 567 twips)
  const margin = { top: 1417, right: 1417, bottom: 1417, left: 1417 }

  const sections = [{
    properties: { page: { margin } },
    children: paragraphs,
    ...(isCV ? {
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Calibri', color: '888888' }),
              ],
            }),
          ],
        }),
      },
    } : {}),
  }]

  const doc = new Document({ sections })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function AlexBubble({ children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
        <span className="text-white font-bold text-xs">A</span>
      </div>
      <div className="flex-1 bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-apex-text leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function JobInfoCard({ job, onClear }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-apex-blue bg-blue-50 px-2 py-0.5 rounded-full mb-2">
          ✦ Selected job
        </span>
        <h2 className="font-semibold text-apex-text text-lg">{job.title}</h2>
        <p className="text-sm text-apex-muted mt-0.5">
          {[job.company, job.location, job.type, job.salary].filter(Boolean).join(' · ')}
        </p>
        {job.description && (
          <p className="text-sm text-apex-muted mt-2 leading-relaxed line-clamp-2">{job.description}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 flex-shrink-0">
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-apex-muted border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-center">
            View listing ↗
          </a>
        )}
        <button onClick={onClear}
          className="text-xs text-apex-muted border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          Change job
        </button>
      </div>
    </div>
  )
}

function LoadingCard({ streamText }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Animated header */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <div>
            <p className="font-semibold text-apex-text text-sm">Alex is tailoring your application…</p>
            <p className="text-xs text-apex-muted">Analysing job description and reframing your CV</p>
          </div>
          <div className="ml-auto flex gap-1">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="w-2 h-2 bg-apex-blue rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-apex-blue to-apex-cyan rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>

      {/* Streaming preview */}
      {streamText && (
        <div className="max-h-64 overflow-y-auto p-5">
          <pre className="whitespace-pre-wrap font-mono text-xs text-apex-muted leading-relaxed">{streamText}</pre>
        </div>
      )}
    </div>
  )
}

function QuestionsPanel({ questions, answers, onChange, onRegenerate, loading }) {
  return (
    <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-amber-100">
        <h3 className="font-semibold text-apex-text text-sm flex items-center gap-2">
          <span className="text-amber-500">💬</span>
          Alex has a few questions to improve your tailoring
        </h3>
        <p className="text-xs text-apex-muted mt-0.5">Answer below to get a more personalised result</p>
      </div>
      <div className="p-6 space-y-5">
        <AlexBubble>
          <p className="mb-3 font-medium">To tailor your application even better, could you help me with the following?</p>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-apex-text mb-1.5">{i + 1}. {q}</p>
                <textarea
                  value={answers[q] || ''}
                  onChange={(e) => onChange(q, e.target.value)}
                  placeholder="Your answer…"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-apex-text placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none"
                />
              </div>
            ))}
          </div>
        </AlexBubble>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="w-full py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
        >
          {loading && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          ✦ Regenerate with my answers
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TailoringLab() {
  const { user, session, addApplication } = useUser()
  const location = useLocation()
  const navigate = useNavigate()
  const abortRef = useRef(null)

  const job = location.state?.job ?? null

  const [phase, setPhase] = useState('idle')      // 'idle' | 'generating' | 'done' | 'error'
  const [streamText, setStreamText] = useState('')
  const [tailoredCV, setTailoredCV] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [activeTab, setActiveTab] = useState('cv')
  const [error, setError] = useState(null)
  const [addedToTracker, setAddedToTracker] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sessionId, setSessionId] = useState(null)  // Supabase row id

  // ── Load saved answers + auto-generate on mount ───────────────────────────
  useEffect(() => {
    if (!job) return
    let cancelled = false

    const init = async () => {
      let savedAnswers = {}

      // Load existing Supabase session for this job
      if (session?.user?.id) {
        const { data } = await supabase
          .from('tailoring_sessions')
          .select('id, answers')
          .eq('user_id', session.user.id)
          .eq('job_id', String(job.id))
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

  // ── Save answers to Supabase ──────────────────────────────────────────────
  const persistAnswers = async (currentAnswers) => {
    if (!session?.user?.id || !job?.id) return
    const filled = Object.fromEntries(
      Object.entries(currentAnswers).filter(([, v]) => v?.trim())
    )
    const payload = {
      user_id:   session.user.id,
      job_id:    String(job.id),
      job_title: job.title,
      company:   job.company,
      questions: questions.join('\n'),
      answers:   filled,
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

  // ── Generate (streaming) ──────────────────────────────────────────────────
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
        messages: [{ role: 'user', content: buildUserMessage(user, job, currentAnswers) }],
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

  const handleAnswerChange = (question, value) => {
    setAnswers((prev) => ({ ...prev, [question]: value }))
  }

  const handleDownload = async (type) => {
    setDownloading(true)
    try {
      const text = type === 'cv' ? tailoredCV : coverLetter
      const label = type === 'cv' ? 'CV' : 'Cover_Letter'
      const company = job?.company?.replace(/\s+/g, '_') || 'Company'
      await downloadDocx(text, `${label}_${company}.docx`, type === 'cv', user.name)
    } catch (err) {
      console.error('[TailoringLab] Download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  const handleAddToTracker = async () => {
    if (!job) return
    await addApplication(job, tailoredCV, coverLetter)
    setAddedToTracker(true)
  }

  const handleClear = () => {
    abortRef.current?.abort?.()
    navigate('/dashboard/tailoring-lab', { replace: true, state: {} })
  }

  // ── No job selected ───────────────────────────────────────────────────────
  if (!job) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-apex-text">Tailoring Lab</h1>
          <p className="text-apex-muted mt-1">AI-powered CV and cover letter tailored to each job</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-8 py-16 text-center">
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
          <button onClick={() => navigate('/dashboard/discover')}
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity text-sm">
            Browse jobs →
          </button>
        </div>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-apex-text">Tailoring Lab</h1>
        <p className="text-apex-muted mt-1">AI-powered CV and cover letter tailored to each job</p>
      </div>

      {/* Job info */}
      <JobInfoCard job={job} onClear={handleClear} />

      {/* ── Generating (loading + stream preview) ── */}
      {phase === 'generating' && <LoadingCard streamText={streamText} />}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="bg-white rounded-xl border border-red-200 px-6 py-8 text-center">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button onClick={() => generate()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95">
            Retry
          </button>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <>
          {/* Questions panel — shown BEFORE the CV tabs */}
          {questions.length > 0 && (
            <QuestionsPanel
              questions={questions}
              answers={answers}
              onChange={handleAnswerChange}
              onRegenerate={handleRegenerate}
              loading={phase === 'generating'}
            />
          )}

          {/* Results — CV and cover letter tabs */}
          {(tailoredCV || coverLetter) && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Tab bar + actions */}
              <div className="flex items-center border-b border-slate-200 px-2">
                <div className="flex flex-1">
                  {[
                    { key: 'cv',    label: 'Tailored CV' },
                    { key: 'cover', label: 'Cover Letter' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                      className={`px-5 py-4 text-sm font-medium transition-colors ${
                        activeTab === key
                          ? 'text-apex-blue border-b-2 border-apex-blue'
                          : 'text-apex-muted hover:text-apex-text'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={handleAddToTracker}
                    disabled={addedToTracker}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      addedToTracker
                        ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                        : 'border border-slate-200 text-apex-text hover:bg-slate-50'
                    }`}>
                    {addedToTracker ? '✓ In Tracker' : 'Add to Tracker'}
                  </button>
                  <button
                    onClick={() => generate()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-apex-text hover:bg-slate-50 transition-colors">
                    ↺ Regenerate
                  </button>
                  <button
                    onClick={() => handleDownload(activeTab)}
                    disabled={downloading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center gap-1.5">
                    {downloading
                      ? <div className="w-3 h-3 rounded-full border border-white/30 border-t-white animate-spin" />
                      : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    }
                    Download .docx
                  </button>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs text-apex-muted flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Tailored for <span className="font-medium text-apex-text">{job.title}</span> at{' '}
                  <span className="font-medium text-apex-text">{job.company}</span>
                </p>
                <button
                  onClick={() => {
                    const text = activeTab === 'cv' ? tailoredCV : coverLetter
                    navigator.clipboard?.writeText(text)
                  }}
                  className="text-xs text-apex-blue hover:underline">
                  Copy to clipboard
                </button>
              </div>

              {/* Editable text area */}
              <div className="p-5">
                <textarea
                  value={activeTab === 'cv' ? tailoredCV : coverLetter}
                  onChange={(e) => activeTab === 'cv'
                    ? setTailoredCV(e.target.value)
                    : setCoverLetter(e.target.value)
                  }
                  spellCheck={false}
                  className="w-full min-h-[520px] font-mono text-sm text-apex-text leading-relaxed bg-slate-50 rounded-lg p-5 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-apex-blue/30 focus:border-apex-blue resize-y"
                />
              </div>
            </div>
          )}

          {/* If only questions, no CV yet — prompt to answer then generate */}
          {!tailoredCV && !coverLetter && questions.length > 0 && (
            <div className="text-center py-4 text-sm text-apex-muted">
              Answer Alex&apos;s questions above and click <strong>Regenerate</strong> to get your tailored documents.
            </div>
          )}
        </>
      )}
    </div>
  )
}
