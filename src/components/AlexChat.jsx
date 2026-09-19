import { useState, useRef, useEffect, useMemo } from 'react'
import { useUser } from '../context/UserContext'
import { apiFetch, PlanLimitError } from '../lib/apiFetch'
import LimitReachedModal from './LimitReachedModal'

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

function buildSystemPrompt(user, applications) {
  let prompt =
    "You are Alex, an expert university career advisor with 15 years of experience helping students find jobs. " +
    "You know the student's full profile, preferences, CV, and job applications. Be warm, direct, and give concrete actionable advice. " +
    "Never be generic. Always refer to the student's specific situation when possible. " +
    "Keep responses concise — 2-4 sentences unless more detail is clearly needed."

  if (user.name)    prompt += `\n\nStudent: ${user.name}`
  if (user.country) prompt += `\nCountry: ${user.country}`

  const sectors = user.sectors?.length ? user.sectors : user.sector ? [user.sector] : []
  if (sectors.length) prompt += `\nSectors of interest: ${sectors.join(', ')}`

  if (user.contractType) prompt += `\nPreferred contract: ${user.contractType}`
  if (user.workMode)     prompt += `\nWork mode preference: ${user.workMode}`

  if (user.salaryMin || user.salaryMax) {
    const cur = user.salaryCurrency || '€'
    const range = [user.salaryMin && `${cur}${user.salaryMin}`, user.salaryMax && `${cur}${user.salaryMax}`]
      .filter(Boolean).join(' – ')
    prompt += `\nSalary expectation: ${range} (annual gross)`
  }

  if (user.languages?.length) {
    const langs = user.languages.filter((l) => l.lang).map((l) => `${l.lang} (${l.level})`).join(', ')
    if (langs) prompt += `\nLanguages: ${langs}`
  }

  if (user.linkedinUrl) prompt += `\nLinkedIn: ${user.linkedinUrl}`

  if (user.cvText) prompt += `\n\nStudent's CV:\n${user.cvText.substring(0, 3000)}`

  if (applications.length > 0) {
    prompt += '\n\nCurrent applications:\n'
    applications.forEach((app) => {
      prompt += `• ${app.title} @ ${app.company} (${app.status})\n`
    })
  }

  prompt +=
    '\n\nWhen the student mentions a rejection, interview invite, or offer, acknowledge it warmly and confirm the tracker has been updated.'

  prompt +=
    '\n\nYOUR AGENT TEAM: you lead two specialist agents, reachable via your tools. ' +
    'Use research_company when up-to-date company facts would genuinely change your advice (interview prep, company culture, news) — skip it for passing company mentions, and never invent company facts. ' +
    'Use review_document when the student wants CV or cover letter feedback. ' +
    'Synthesize their findings into your own advice and never mention the internal tool names.'

  return prompt
}

// Detect tracker-relevant phrases in student messages
function detectTrackerUpdate(text, applications) {
  const lower = text.toLowerCase()
  for (const app of applications) {
    const company = app.company.toLowerCase()
    if (!lower.includes(company)) continue

    if (
      lower.includes('reject') ||
      lower.includes('rifiut') ||
      lower.includes('not selected') ||
      lower.includes('scartato') ||
      lower.includes('no offer') ||
      lower.includes('unsuccessful')
    ) {
      return { appId: app.id, status: 'Rejected', company: app.company }
    }
    if (
      lower.includes('interview') ||
      lower.includes('colloquio') ||
      lower.includes('chiamata') ||
      lower.includes('assessment') ||
      lower.includes('chiamano')
    ) {
      return { appId: app.id, status: 'Interview', company: app.company }
    }
    if (
      lower.includes('offer') ||
      lower.includes('offerta') ||
      lower.includes('got the job') ||
      lower.includes('hired') ||
      lower.includes('assunto')
    ) {
      return { appId: app.id, status: 'Offer', company: app.company }
    }
  }
  return null
}

const STATUS_COLORS = {
  Rejected: 'bg-red-50 text-red-600 border-red-200',
  Interview: 'bg-blue-50 text-apex-blue border-blue-200',
  Offer: 'bg-green-50 text-green-700 border-green-200',
}

export default function AlexChat() {
  const { user, applications, updateStatus } = useUser()
  const [open, setOpen] = useState(false)

  const greeting = useMemo(
    () =>
      user.name
        ? `Hey ${user.name}! I'm Alex, your APEX career advisor. I know your profile and applications — ask me anything about CVs, interviews, or your search strategy.`
        : "Hey! I'm Alex, your APEX career advisor. Ask me anything about CVs, applications, interviews, or your job search strategy.",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // computed once on mount — greeting doesn't change mid-session
  )

  const [messages, setMessages] = useState([{ id: 'init', from: 'alex', text: greeting }])
  // Conversation history for Claude API (excludes initial greeting)
  const historyRef = useRef([])
  const [streaming, setStreaming] = useState(false)
  const [input, setInput] = useState('')
  const [trackerToast, setTrackerToast] = useState(null)
  const [limitReached, setLimitReached] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  // Abort any in-flight stream when component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort?.()
    }
  }, [])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, messages])

  useEffect(() => {
    if (trackerToast) {
      const t = setTimeout(() => setTrackerToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [trackerToast])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    // Check for tracker update before sending
    const trackerUpdate = detectTrackerUpdate(text, applications)
    if (trackerUpdate) {
      updateStatus(trackerUpdate.appId, trackerUpdate.status)
      setTrackerToast(trackerUpdate)
    }

    const userMsg = { id: Date.now(), from: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    // Add to history
    historyRef.current = [...historyRef.current, { role: 'user', content: text }]

    // Placeholder streaming message
    const alexId = Date.now() + 1
    setMessages((prev) => [...prev, { id: alexId, from: 'alex', text: '', pending: true }])
    setStreaming(true)

    let fullText = ''
    try {
      const controller = new AbortController()
      abortRef.current = controller

      const res = await apiFetch('/api/alexchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyRef.current,
          systemPrompt: [{ type: 'text', text: buildSystemPrompt(user, applications), cache_control: { type: 'ephemeral' } }],
          stream: true,
          maxTokens: 1024,
        }),
      })

      if (!res.ok) throw new Error(await res.text())

      for await (const event of parseSSE(res)) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullText += event.delta.text
          setMessages((prev) =>
            prev.map((m) => (m.id === alexId ? { ...m, text: fullText, pending: false, agentStatus: null } : m))
          )
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        } else if (event.type === 'apex_agent') {
          const label = event.status !== 'start' ? null
            : event.agent === 'research'
              ? `Checking up-to-date info${event.company ? ` on ${event.company}` : ''}…`
              : `Reviewing your ${event.docType === 'cover_letter' ? 'cover letter' : 'CV'}…`
          setMessages((prev) =>
            prev.map((m) => (m.id === alexId && !fullText ? { ...m, agentStatus: label } : m))
          )
        }
      }

      // Save assistant turn to history
      if (fullText) {
        historyRef.current = [
          ...historyRef.current,
          { role: 'assistant', content: fullText },
        ]
      }
    } catch (err) {
      if (err instanceof PlanLimitError) {
        setMessages((prev) => prev.filter((m) => m.id !== alexId))
        setLimitReached(true)
      } else if (err.name !== 'AbortError') {
        console.error('[AlexChat] API error:', err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === alexId ? { ...m, text: `Something went wrong. Please try again.`, pending: false, error: true } : m
          )
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <LimitReachedModal isOpen={limitReached} onClose={() => setLimitReached(false)} />
      {/* Tracker update toast */}
      {trackerToast && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium shadow-lg flex items-center gap-2 transition-all ${STATUS_COLORS[trackerToast.status]}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Tracker updated — {trackerToast.company}: {trackerToast.status}
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="w-[340px] bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/80 flex flex-col overflow-hidden"
          style={{ height: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-100">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-apex-text text-sm leading-tight">Alex</p>
              <p className="text-xs text-apex-muted leading-tight">Career Advisor · APEX</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-apex-muted hover:bg-slate-100 hover:text-apex-text transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.from === 'alex' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <span className="text-white font-bold text-[10px]">A</span>
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'user'
                      ? 'bg-gradient-to-r from-apex-blue to-apex-cyan text-white rounded-tr-sm'
                      : msg.error
                      ? 'bg-red-50 text-red-600 rounded-tl-sm border border-red-100'
                      : 'bg-slate-100 text-apex-text rounded-tl-sm'
                  }`}
                >
                  {msg.pending && !msg.text ? (
                    msg.agentStatus ? (
                      <span className="flex gap-1.5 items-center text-xs text-apex-blue font-medium">
                        <svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                        {msg.agentStatus}
                      </span>
                    ) : (
                    <span className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    )
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts — only shown when no conversation yet */}
          {messages.length === 1 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {['Review my CV', 'Interview tips', 'Cover letter help'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt)
                    setTimeout(() => inputRef.current?.focus(), 50)
                  }}
                  className="px-2.5 py-1 rounded-full text-xs border border-slate-200 text-apex-muted hover:border-apex-blue hover:text-apex-blue transition-colors bg-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
              }}
              onKeyDown={handleKey}
              placeholder="Ask Alex anything…"
              rows={1}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue/30 focus:border-apex-blue resize-none leading-relaxed overflow-hidden"
              style={{ minHeight: '36px', maxHeight: '80px' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-apex-blue to-apex-cyan text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-35 flex-shrink-0"
              aria-label="Send"
            >
              {streaming ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan shadow-lg shadow-blue-500/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Chat with Alex"
      >
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <span className="text-white font-bold text-xl tracking-tight">A</span>
        )}
      </button>
    </div>
  )
}
