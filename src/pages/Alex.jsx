import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
import { apiFetch, PlanLimitError } from '../lib/apiFetch'
import LimitReachedModal from '../components/LimitReachedModal'
import posthog from 'posthog-js'
import { HEC_KNOWLEDGE } from '../lib/hecKnowledge'

// ─── State persistence ────────────────────────────────────────────────────────
const ALEX_KEY = 'apex_alex_state'

function loadAlexState() {
  try { return JSON.parse(localStorage.getItem(ALEX_KEY)) || null }
  catch { return null }
}

const MODEL = 'claude-sonnet-4-6'

const DYNAMIC_PHRASES = [
  "Your CV is good. Your cover letter? We need to talk.",
  "Let's get you that job before your parents ask again.",
  "Most candidates are unprepared. You won't be.",
  "Your next interview is closer than you think.",
  "Let's turn your experience into opportunity.",
  "Career advice that doesn't sound like LinkedIn.",
]

const SUGGESTION_PILLS = [
  "Prepare me for my interview",
  "Review my CV",
  "What jobs suit me?",
  "Write a cover letter",
]

// ── API helpers ───────────────────────────────────────────────────────────────
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

function buildSystemPrompt(user, drafts, applications) {
  const sectors = user.sectors?.length ? user.sectors.join(', ') : user.sector || 'Not specified'
  const langs = user.languages?.filter(l => l.lang).map(l => `${l.lang} (${l.level})`).join(', ') || 'Not specified'
  const salaryLine = (user.salaryMin || user.salaryMax)
    ? `${user.salaryCurrency || '€'}${user.salaryMin || '?'} – ${user.salaryCurrency || '€'}${user.salaryMax || '?'}`
    : 'Not specified'

  const appsData = applications?.length
    ? applications.map(a => {
        const base = `- ${a.title} at ${a.company}${a.location ? ` (${a.location})` : ''} — Status: ${a.status}${a.appliedDate ? `, applied ${a.appliedDate}` : ''}${a.matchScore ? `, match score: ${a.matchScore}` : ''}${a.notes ? `\n  Notes: ${a.notes}` : ''}`
        const hasDescription = a.description && a.description.trim().length > 20
        return hasDescription
          ? `${base}\n  Job description excerpt: ${a.description.slice(0, 600)}…`
          : base
      }).join('\n')
    : 'No applications yet.'

  const cvSummary = user.cvText?.trim()
    ? user.cvText.trim().slice(0, 3000)
    : 'No CV uploaded yet.'

  return `You are Alex, an expert AI career advisor built into APEX, a job application platform for university students and recent graduates. You are warm, direct, and highly competent — like having a senior career coach as a trusted personal friend who knows your full situation.

USER PROFILE:
- Name: ${user.name || 'the user'}
- Target sectors: ${sectors}
- Location: ${[user.city, user.country].filter(Boolean).join(', ') || 'Not specified'}
- Contract preference: ${user.contractType || 'Not specified'}
- Work mode: ${user.workMode || 'Not specified'}
- Salary expectation: ${salaryLine}
- Languages: ${langs}

CV (up to 3000 chars):
${cvSummary}

APPLICATIONS (${applications?.length || 0} total, ${drafts?.length || 0} drafts in progress):
${appsData}

YOUR ROLE AND CAPABILITIES:
You are not a generic chatbot. You are a career advisor who knows this specific person's CV, their active applications, where each one stands, and what they need to do next. Use this context actively — do not give generic advice when specific advice is possible.

YOUR AGENT TEAM:
You lead a team of two specialist agents. Delegate to them via your tools, then synthesize their findings into your own advice — you make the final call as the career advisor.
- research_company: a Company Research Agent that searches the web for up-to-date, reliable information about companies. Use it when current facts would genuinely change your advice — interview prep for a company, questions about its culture, news, or hiring. Skip it for passing company mentions (status updates, general questions): research takes time, so use it only when it adds real value. Never invent company facts — if you have not researched and are unsure, say so.
- review_document: a Document Quality Agent — a senior recruiter specialized in CV and cover letter quality. Use it when the user asks for feedback on their CV or cover letter, or before giving advice that depends on document quality. Pass the full document text (the CV above, or text the user provides) and the job description when available.
Do not mention the internal tool names to the user — refer to them naturally ("let me check the latest on X", "I had your CV reviewed in depth"). Integrate their findings with what you know about the user's profile and applications.

You can help with:
- Job search strategy: which roles fit this profile, which to prioritize, how to position themselves
- Application review: analyze their CV or cover letter for a specific role and give concrete improvement suggestions
- Interview preparation: generate role-specific questions based on actual job descriptions, coach on how to answer them using their real experience
- Follow-up strategy: when and how to follow up on specific applications based on their status and timeline
- Career development: honest assessment of skill gaps, what to learn, how to grow toward their goals
- Offer evaluation: help think through decisions when they have competing options

RESPONSE RULES:
- Be concise and direct. Default to 2–4 sentences for simple questions. Use more depth only when the question genuinely requires it (e.g. full interview prep, detailed CV feedback).
- Always reference the user's actual data when giving advice. Never give advice that ignores what you know about them.
- When you notice something important in their data that they haven't asked about — a stale application, a mismatch between their profile and their target roles, a strong opportunity they might be underestimating — mention it briefly and offer to go deeper.
- Use markdown: bullet points with "- ", **bold** for emphasis. Use headers (##) only for responses with 3 or more distinct sections.
- Never make up information about companies or roles.
- When asked about interview prep for a specific role, generate questions grounded in the actual job description if available. Always connect suggested answers back to the user's real CV.
- Be honest even when it's uncomfortable. If their CV is weak for a role, say so clearly and explain what to do about it. A good advisor does not just validate.`
}

async function streamAlex({ messages, systemPrompt, onChunk, onDone, onError, onAgent, abortRef }) {
  const controller = new AbortController()
  if (abortRef) abortRef.current = controller

  try {
    const res = await apiFetch('/api/alex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages,
        systemPrompt: [
          { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: HEC_KNOWLEDGE, cache_control: { type: 'ephemeral' } },
        ],
        stream: true,
        maxTokens: 2048,
      }),
    })

    if (!res.ok) throw new Error(await res.text())

    let text = ''
    for await (const event of parseSSE(res)) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text
        onChunk(text)
      } else if (event.type === 'apex_agent') {
        onAgent?.(event)
      } else if (event.type === 'error') {
        throw new Error(event.error?.message || 'Stream error')
      }
    }
    onDone(text)
  } catch (err) {
    if (err.name !== 'AbortError') { console.error('[Alex]', err); onError(err) }
  }
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function inlineMd(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#E2E8F0;padding:1px 6px;border-radius:4px;font-size:12.5px;font-family:monospace">$1</code>')
}

function MarkdownText({ text }) {
  const elements = []
  let listBuf = []
  let key = 0

  const flushList = () => {
    if (!listBuf.length) return
    elements.push(
      <ul key={key++} style={{ margin: '6px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {listBuf.map((item, i) => (
          <li key={i} style={{ fontSize: 14, color: '#0F172A', lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
        ))}
      </ul>
    )
    listBuf = []
  }

  for (const line of text.split('\n')) {
    if (/^[-*] /.test(line)) {
      listBuf.push(line.replace(/^[-*] /, ''))
    } else if (line.trim() === '') {
      flushList()
      elements.push(<div key={key++} style={{ height: 5 }} />)
    } else {
      flushList()
      elements.push(
        <p key={key++} style={{ margin: 0, fontSize: 14, color: '#0F172A', lineHeight: 1.65 }}
          dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />
      )
    }
  }
  flushList()
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{elements}</div>
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConvItem({ conv, isActive, onSelect, onRename, onDelete, openMenuId, setOpenMenuId }) {
  const [hov, setHov] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(conv.title)
  const [fading, setFading] = useState(false)
  const renameInputRef = useRef(null)
  const menuOpen = openMenuId === conv.id
  const date = new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const startRename = (e) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setRenameVal(conv.title)
    setRenaming(true)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  const commitRename = () => {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== conv.title) onRename(conv.id, trimmed)
    setRenaming(false)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setFading(true)
    setTimeout(() => onDelete(conv.id), 300)
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease', marginBottom: 2 }}
    >
      {renaming ? (
        <div style={{
          padding: '9px 9px', borderRadius: 8,
          background: '#EFF6FF', borderLeft: '3px solid #2563EB',
        }}>
          <input
            ref={renameInputRef}
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={commitRename}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 13.5, fontWeight: 600, color: '#1D4ED8',
              background: 'transparent', fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, display: 'block' }}>{date}</span>
        </div>
      ) : (
        <button
          onClick={() => onSelect(conv)}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            padding: '9px 12px', borderRadius: 8,
            background: (isActive || hov) ? '#EFF6FF' : 'transparent',
            borderTop: 'none', borderRight: 'none', borderBottom: 'none',
            borderLeft: (isActive || hov) ? '3px solid #2563EB' : '3px solid transparent',
            paddingLeft: (isActive || hov) ? 9 : 12,
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <span style={{
            fontSize: 13.5, fontWeight: isActive ? 700 : 400,
            color: isActive ? '#1D4ED8' : hov ? '#1E40AF' : '#475569',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            width: (hov || menuOpen) ? 'calc(100% - 24px)' : '100%', display: 'block',
          }}>
            {conv.title}
          </span>
          <span style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{date}</span>
        </button>
      )}

      {/* ··· button */}
      {!renaming && (hov || menuOpen) && (
        <button
          onClick={e => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : conv.id) }}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: menuOpen ? '#DBEAFE' : 'transparent',
            cursor: 'pointer', color: '#64748B', transition: 'background 0.15s',
            zIndex: 1,
          }}
          onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = '#E2E8F0' }}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>···</span>
        </button>
      )}

      {/* Dropdown */}
      {menuOpen && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
          position: 'absolute', right: 4, top: 'calc(100% + 2px)', zIndex: 100,
          background: '#fff', borderRadius: 8, border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15,23,42,0.1)', minWidth: 120, overflow: 'hidden',
        }}>
          <button
            onClick={startRename}
            style={{
              width: '100%', padding: '9px 14px', textAlign: 'left', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#0F172A',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>
          <button
            onClick={handleDelete}
            style={{
              width: '100%', padding: '9px 14px', textAlign: 'left', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#EF4444',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function MobileConvItem({ conv, isActive, onSelect, onRename, onDelete, openMenuId, setOpenMenuId }) {
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(conv.title)
  const [fading, setFading] = useState(false)
  const renameInputRef = useRef(null)
  const menuOpen = openMenuId === conv.id
  const date = new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const startRename = (e) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setRenameVal(conv.title)
    setRenaming(true)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  const commitRename = () => {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== conv.title) onRename(conv.id, trimmed)
    setRenaming(false)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    setOpenMenuId(null)
    setFading(true)
    setTimeout(() => onDelete(conv.id), 300)
  }

  return (
    <div style={{ position: 'relative', opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease' }}>
      {renaming ? (
        <div style={{ padding: '14px 20px', background: '#EFF6FF', borderLeft: '3px solid #2563EB' }}>
          <input
            ref={renameInputRef}
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={commitRename}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 14, fontWeight: 600, color: '#1D4ED8',
              background: 'transparent', fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, display: 'block' }}>{date}</span>
        </div>
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center',
            borderBottom: '1px solid #F1F5F9',
            background: isActive ? '#EFF6FF' : 'transparent',
          }}
        >
          <button
            onClick={() => onSelect(conv)}
            style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '14px 12px 14px 20px',
              border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              fontSize: 14, fontWeight: isActive ? 600 : 500,
              color: isActive ? '#1D4ED8' : '#1E293B',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              width: '100%', display: 'block',
            }}>
              {conv.title}
            </span>
            <span style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{date}</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : conv.id) }}
            style={{
              flexShrink: 0, width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: menuOpen ? '#DBEAFE' : 'transparent',
              cursor: 'pointer', color: '#64748B', marginRight: 8, borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1 }}>···</span>
          </button>
        </div>
      )}

      {menuOpen && !renaming && (
        <div
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: 8, top: 'calc(100% - 2px)', zIndex: 100,
            background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
            boxShadow: '0 4px 20px rgba(15,23,42,0.12)', minWidth: 130, overflow: 'hidden',
          }}
        >
          <button
            onClick={startRename}
            style={{
              width: '100%', padding: '13px 16px', textAlign: 'left', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#0F172A',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>
          <button
            onClick={handleDelete}
            style={{
              width: '100%', padding: '13px 16px', textAlign: 'left', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#EF4444',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function AlexSidebar({ conversations, activeId, onNew, onSelect, onRename, onDelete }) {
  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    if (!openMenuId) return
    const close = () => setOpenMenuId(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenuId])

  return (
    <div style={{
      width: 260, minWidth: 260, height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#F8FAFC', borderRight: '1px solid #E2E8F0', overflow: 'hidden',
    }}>
      {/* New chat */}
      <div style={{ padding: '16px 12px 10px', flexShrink: 0 }}>
        <button
          onClick={onNew}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', background: '#2563EB', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2563EB' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      {/* Conversation list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 8px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {conversations.length === 0 ? (
          <p style={{ margin: '12px 4px', fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
            No conversations yet
          </p>
        ) : (
          conversations.map(conv => (
            <ConvItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          ))
        )}
      </div>
    </div>
  )
}

const ChatBubble = memo(function ChatBubble({ role, text, isStreaming, isMobile }) {
  const isAlex = role === 'assistant'

  if (isAlex) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: isMobile ? '85%' : '75%' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
        }}>
          <img src="/apex_x_blue.png" alt="Alex" style={{ height: 16, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <div style={{
          padding: '13px 18px', background: '#F1F5F9',
          borderRadius: '4px 12px 12px 12px',
          boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
          willChange: isStreaming ? 'contents' : undefined,
          minHeight: isStreaming ? 40 : undefined,
        }}>
          <MarkdownText text={text} />
          {isStreaming && (
            <span style={{
              display: 'inline-block', width: 7, height: 13, background: '#2563EB',
              borderRadius: 2, marginLeft: 2,
              animation: 'alex-blink 0.9s step-end infinite', verticalAlign: 'text-bottom',
            }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        maxWidth: isMobile ? '85%' : '75%', padding: '12px 18px',
        background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
        borderRadius: '12px 4px 12px 12px',
        boxShadow: '0 2px 12px rgba(37,99,235,0.22)',
      }}>
        <p style={{ margin: 0, fontSize: 14, color: '#fff', lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  )
})

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src="/apex_x_blue.png" alt="Alex" style={{ height: 16, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </div>
      <div style={{
        padding: '14px 18px', background: '#F1F5F9',
        borderRadius: '4px 12px 12px 12px',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 150, 300].map(d => (
          <span key={d} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#94A3B8',
            display: 'inline-block',
            animation: 'alex-bounce 1.2s infinite ease-in-out',
            animationDelay: `${d}ms`,
          }} />
        ))}
      </div>
    </div>
  )
}

const AGENT_ACTIVITY_LABELS = {
  research: (a) => `Research Agent — checking up-to-date info${a.company ? ` on ${a.company}` : ''}…`,
  review: (a) => `Quality Agent — reviewing your ${a.docType === 'cover_letter' ? 'cover letter' : 'CV'}…`,
}

function AgentActivityIndicator({ activity }) {
  const label = (AGENT_ACTIVITY_LABELS[activity.agent] || (() => 'Specialist agent working…'))(activity)
  const isResearch = activity.agent === 'research'
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src="/apex_x_blue.png" alt="Alex" style={{ height: 16, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
      </div>
      <div style={{
        padding: '11px 16px', background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: '4px 12px 12px 12px',
        display: 'flex', gap: 9, alignItems: 'center',
      }}>
        <svg width="14" height="14" fill="none" stroke="#2563EB" viewBox="0 0 24 24"
          style={{ animation: isResearch ? 'alex-spin 1.5s linear infinite' : 'alex-bounce 1.2s infinite ease-in-out', flexShrink: 0 }}>
          {isResearch ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-6.219-8.56" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          )}
        </svg>
        <span style={{ fontSize: 13, color: '#1D4ED8', fontWeight: 500 }}>{label}</span>
      </div>
    </div>
  )
}

function SendButton({ onClick, enabled }) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        width: 38, height: 38, borderRadius: 10, border: 'none', flexShrink: 0,
        background: enabled ? 'linear-gradient(135deg,#2563EB,#38BDF8)' : '#F1F5F9',
        color: enabled ? '#fff' : '#CBD5E1',
        cursor: enabled ? 'pointer' : 'not-allowed',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        boxShadow: enabled ? '0 2px 10px rgba(37,99,235,0.3)' : 'none',
      }}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    </button>
  )
}

function SuggestionPill({ label, onClick, mobile }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: mobile ? '12px 16px' : '10px 18px',
        width: mobile ? '100%' : undefined,
        textAlign: mobile ? 'left' : undefined,
        background: '#fff',
        border: `1.5px solid ${hov ? '#2563EB' : '#E2E8F0'}`,
        borderRadius: 20, fontSize: mobile ? 13 : 14,
        color: hov ? '#2563EB' : '#475569',
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: 'inherit', fontWeight: 500,
        boxShadow: hov ? '0 2px 8px rgba(37,99,235,0.1)' : 'none',
        minHeight: 44,
      }}
    >
      {label}
    </button>
  )
}

function InputBar({ inputRef, value, onChange, onKeyDown, disabled, placeholder, onSend, canSend, size = 'bottom' }) {
  const isCenter = size === 'center'
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-end',
      background: '#fff',
      border: '1.5px solid #E2E8F0',
      borderRadius: isCenter ? 16 : 14,
      padding: isCenter ? '14px 14px 14px 20px' : '10px 10px 10px 18px',
      boxShadow: isCenter ? '0 6px 28px rgba(15,23,42,0.08)' : '0 2px 12px rgba(15,23,42,0.05)',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
      onFocus={() => {}}
      onBlur={() => {}}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder || 'Ask Alex anything about your career...'}
        rows={1}
        disabled={disabled}
        style={{
          flex: 1, border: 'none', outline: 'none',
          fontSize: isCenter ? 16 : 15,
          color: '#0F172A', background: 'transparent',
          resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
          minHeight: isCenter ? 26 : 22,
          maxHeight: 120, overflowY: 'auto',
        }}
      />
      <SendButton onClick={onSend} enabled={canSend} />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Alex() {
  const { user, applications, drafts, session } = useUser()
  const userId     = session?.user?.id
  const firstName  = user.name?.split(' ')[0] || 'there'
  const systemPrompt = buildSystemPrompt(user, drafts, applications)

  // Pick a random phrase once on mount
  const phrase = useMemo(
    () => DYNAMIC_PHRASES[Math.floor(Math.random() * DYNAMIC_PHRASES.length)],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileMenuId, setMobileMenuId] = useState(null)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Close mobile menu on outside tap
  useEffect(() => {
    if (!mobileMenuId) return
    const close = () => setMobileMenuId(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [mobileMenuId])

  // Chat state
  const [messages, setMessages]       = useState([])
  const [displayMsgs, setDisplayMsgs] = useState([])
  const [input, setInput]             = useState('')
  const [streaming, setStreaming]     = useState(false)
  const [streamText, setStreamText]   = useState('')
  const [agentActivity, setAgentActivity] = useState(null) // { agent, company?, docType? } while a sub-agent runs
  const [hasStarted, setHasStarted]   = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const abortRef        = useRef(null)
  const chatEndRef      = useRef(null)
  const msgsContainerRef = useRef(null)
  const inputRef        = useRef(null)    // bottom bar
  const centerRef       = useRef(null)    // center bar (empty state)
  const convIdRef       = useRef(null)

  // Conversations
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId]   = useState(null)
  const restoredConvRef = useRef(false)

  // Save activeConvId to localStorage
  useEffect(() => {
    try { localStorage.setItem(ALEX_KEY, JSON.stringify({ activeConvId })) } catch {}
  }, [activeConvId])

  // Load conversation list
  const loadConversations = async () => {
    if (!userId) return
    const { data } = await supabase
      .from('alex_conversations')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setConversations(data)
  }

  useEffect(() => { loadConversations() }, [userId]) // eslint-disable-line

  // Smooth scroll when a new message is added to the list
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMsgs])

  // During streaming: only scroll if the user is already near the bottom
  useEffect(() => {
    if (!streaming || !streamText) return
    const container = msgsContainerRef.current
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    if (scrollHeight - scrollTop - clientHeight < 150) {
      chatEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [streamText, streaming])

  // Focus bottom input after transition to chat
  useEffect(() => {
    if (hasStarted) {
      const t = setTimeout(() => inputRef.current?.focus(), 320)
      return () => clearTimeout(t)
    }
  }, [hasStarted])

  // Save / update conversation in Supabase
  const saveConversation = async (msgs) => {
    if (!userId || !msgs.length) return
    const firstUser = msgs.find(m => m.role === 'user')?.content || ''
    const words = firstUser.trim().split(/\s+/)
    const title = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '')

    if (!convIdRef.current) {
      const { data } = await supabase
        .from('alex_conversations')
        .insert({ user_id: userId, title, messages: msgs })
        .select('id')
        .single()
      if (data?.id) {
        convIdRef.current = data.id
        setActiveConvId(data.id)
        loadConversations()
      }
    } else {
      await supabase
        .from('alex_conversations')
        .update({ messages: msgs })
        .eq('id', convIdRef.current)
    }
  }

  const handleSelectConversation = async (conv) => {
    const { data } = await supabase
      .from('alex_conversations')
      .select('messages')
      .eq('id', conv.id)
      .single()
    if (data?.messages) {
      setMessages(data.messages)
      setDisplayMsgs(data.messages.map(m => ({ role: m.role, text: m.content })))
      convIdRef.current = conv.id
      setActiveConvId(conv.id)
      setHasStarted(true)
      setInput('')
      setStreamText('')
    }
  }

  // Restore active conversation after list loads (declared after handleSelectConversation)
  useEffect(() => {
    if (!conversations.length || restoredConvRef.current) return
    const savedId = loadAlexState()?.activeConvId
    if (!savedId) return
    restoredConvRef.current = true
    const conv = conversations.find(c => c.id === savedId)
    if (conv) handleSelectConversation(conv)
  }, [conversations]) // eslint-disable-line

  const handleRenameConv = async (id, newTitle) => {
    console.log('[Alex] handleRenameConv', id, newTitle)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c))
    await supabase.from('alex_conversations').update({ title: newTitle }).eq('id', id)
  }

  const handleDeleteConv = async (id) => {
    console.log('[Alex] handleDeleteConv', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (convIdRef.current === id) {
      setMessages([])
      setDisplayMsgs([])
      setInput('')
      setStreamText('')
      setHasStarted(false)
      convIdRef.current = null
      setActiveConvId(null)
    }
    await supabase.from('alex_conversations').delete().eq('id', id)
  }

  const handleNew = () => {
    setMessages([])
    setDisplayMsgs([])
    setInput('')
    setStreamText('')
    setHasStarted(false)
    convIdRef.current = null
    setActiveConvId(null)
    setTimeout(() => centerRef.current?.focus(), 350)
  }

  const sendMessage = async (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || streaming) return

    setInput('')
    if (inputRef.current)  inputRef.current.style.height  = 'auto'
    if (centerRef.current) centerRef.current.style.height = 'auto'

    if (!hasStarted) setHasStarted(true)

    const userMsg = { role: 'user', content: text }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    posthog.capture('alex_message_sent', { conversation_length: newMsgs.length })
    setDisplayMsgs(prev => [...prev, { role: 'user', text }])
    setStreaming(true)
    setStreamText('')

    await streamAlex({
      messages: newMsgs,
      systemPrompt,
      abortRef,
      onChunk: t => setStreamText(t),
      onAgent: a => setAgentActivity(a.status === 'start' ? a : null),
      onDone: async t => {
        const full = [...newMsgs, { role: 'assistant', content: t }]
        setMessages(full)
        setDisplayMsgs(prev => [...prev, { role: 'assistant', text: t }])
        setStreamText('')
        setStreaming(false)
        setAgentActivity(null)
        await saveConversation(full)
      },
      onError: (err) => {
        if (err instanceof PlanLimitError) { setLimitReached(true); setStreamText(''); setStreaming(false); setAgentActivity(null); return }
        setDisplayMsgs(prev => [...prev, {
          role: 'assistant',
          text: 'Something went wrong. Please check your connection and try again.',
        }])
        setStreamText('')
        setStreaming(false)
        setAgentActivity(null)
      },
    })
  }

  const makeInputHandlers = (ref) => ({
    inputRef: ref,
    value: input,
    onChange: e => {
      setInput(e.target.value)
      e.target.style.height = 'auto'
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    },
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    },
    disabled: streaming,
    onSend: () => sendMessage(),
    canSend: !!input.trim() && !streaming,
  })

  return (
    <>
      <LimitReachedModal isOpen={limitReached} onClose={() => setLimitReached(false)} />
      <style>{`
        @keyframes alex-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes alex-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes alex-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .alex-sidebar-scroll::-webkit-scrollbar { display: none; }
        .alex-msgs::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* ── Mobile bottom sheet backdrop + panel ── */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.4)',
              opacity: drawerOpen ? 1 : 0,
              pointerEvents: drawerOpen ? 'auto' : 'none',
              transition: 'opacity 300ms',
            }}
          />
          {/* Bottom sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '70vh',
            background: '#fff',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 40px rgba(15,23,42,0.15)',
            zIndex: 50,
            overflowY: 'auto',
            transform: drawerOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 300ms ease',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 4, background: '#CBD5E1', borderRadius: 999 }} />
            </div>
            {/* New chat button */}
            <div style={{ padding: '0 16px 16px' }}>
              <button
                onClick={() => { handleNew(); setDrawerOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
                  border: 'none', borderRadius: 12, color: '#fff',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New chat
              </button>
            </div>
            {/* Conversation list */}
            {conversations.length === 0 ? (
              <p style={{ margin: '0 20px 16px', fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>
                No conversations yet
              </p>
            ) : (
              conversations.map(conv => (
                <MobileConvItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeConvId}
                  onSelect={(c) => { handleSelectConversation(c); setDrawerOpen(false) }}
                  onRename={handleRenameConv}
                  onDelete={handleDeleteConv}
                  openMenuId={mobileMenuId}
                  setOpenMenuId={setMobileMenuId}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Full-viewport layout */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: isMobile ? 'calc(100dvh - 120px)' : '100dvh',
        overflow: 'hidden',
      }}>

        {/* ── Desktop sidebar ── */}
        {!isMobile && (
          <AlexSidebar
            conversations={conversations}
            activeId={activeConvId}
            onNew={handleNew}
            onSelect={handleSelectConversation}
            onRename={handleRenameConv}
            onDelete={handleDeleteConv}
          />
        )}

        {/* ── Mobile sub-header ── */}
        {isMobile && (
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#fff',
            borderBottom: '1px solid #E2E8F0',
          }}>
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8, minHeight: 44,
                border: '1.5px solid #E2E8F0', background: '#fff',
                color: '#0F172A', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Chats
            </button>
            <button
              onClick={handleNew}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8, minHeight: 44,
                border: 'none', background: '#2563EB',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>
        )}

        {/* ── Chat area ── */}
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          background: '#F8FAFC', overflow: 'hidden', position: 'relative',
        }}>

          {/* ── EMPTY STATE (absolutely covers the area, fades out) ── */}
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: isMobile ? '0 20px' : '0 48px',
              background: '#F8FAFC',
              opacity: hasStarted ? 0 : 1,
              pointerEvents: hasStarted ? 'none' : 'auto',
              transition: 'opacity 0.3s ease',
            }}
          >
            <div style={{ width: '100%', maxWidth: 680, textAlign: 'center' }}>

              <h1 style={{
                margin: 0,
                fontSize: isMobile ? 28 : 40,
                fontWeight: 700, color: '#0F172A',
                letterSpacing: '-0.04em', lineHeight: 1.1,
              }}>
                Hi {firstName}, I&apos;m Alex.
              </h1>
              <p style={{
                margin: isMobile ? '10px 0 28px' : '12px 0 40px',
                fontSize: isMobile ? 15 : 18, color: '#64748B',
                fontStyle: 'italic', lineHeight: 1.5,
              }}>
                {phrase}
              </p>

              <InputBar
                {...makeInputHandlers(centerRef)}
                size="center"
                placeholder="Ask Alex anything about your career..."
              />

              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                flexWrap: isMobile ? undefined : 'wrap',
                gap: 8,
                marginTop: 18,
                justifyContent: isMobile ? undefined : 'center',
              }}>
                {SUGGESTION_PILLS.map(pill => (
                  <SuggestionPill key={pill} label={pill} onClick={() => sendMessage(pill)} mobile={isMobile} />
                ))}
              </div>
            </div>
          </div>

          {/* ── CHAT STATE (always rendered below, fades in) ── */}
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', zIndex: 1,
            opacity: hasStarted ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}>
            {/* Messages */}
            <div
              ref={msgsContainerRef}
              className="alex-msgs"
              style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                padding: isMobile ? '16px 16px 12px' : '32px 48px 16px',
                display: 'flex', flexDirection: 'column', gap: 18,
                scrollbarWidth: 'none',
              }}
            >
              {displayMsgs.map((m, i) => (
                <ChatBubble key={i} role={m.role} text={m.text} isMobile={isMobile} />
              ))}
              {streaming && streamText && (
                <ChatBubble role="assistant" text={streamText} isStreaming isMobile={isMobile} />
              )}
              {streaming && agentActivity && <AgentActivityIndicator activity={agentActivity} />}
              {streaming && !streamText && !agentActivity && <TypingIndicator />}
              <div ref={chatEndRef} style={{ height: 4 }} />
            </div>

            {/* Bottom input bar */}
            <div style={{
              flexShrink: 0,
              padding: isMobile ? '12px 16px 16px' : '14px 48px 24px',
              background: '#F8FAFC',
              borderTop: '1px solid #E8EDF2',
            }}>
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <InputBar
                  {...makeInputHandlers(inputRef)}
                  size="bottom"
                  placeholder="Ask Alex anything about your career..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
