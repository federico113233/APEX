import { useState, useEffect, useRef, useMemo } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'

const MODEL = 'claude-sonnet-4-20250514'

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
function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function buildSystemPrompt(user, applications, drafts) {
  const sectors    = user.sectors?.join(', ') || user.sector || 'Not specified'
  const cvSummary  = user.cvText
    ? user.cvText.slice(0, 3000) + (user.cvText.length > 3000 ? '…' : '')
    : 'No CV provided'
  const appsData   = applications.length
    ? applications.slice(0, 15).map(a => {
        const base = `- ${a.title} at ${a.company} (${a.status})`
        return a.manual && a.description
          ? `${base}\n  Job description: ${a.description.slice(0, 300)}${a.description.length > 300 ? '…' : ''}`
          : base
      }).join('\n')
    : 'No applications yet'
  const salaryLine = (user.salaryMin || user.salaryMax)
    ? `${user.salaryCurrency || '€'}${user.salaryMin || ''}${user.salaryMax ? ` – ${user.salaryCurrency || '€'}${user.salaryMax}` : ''}`
    : 'Not specified'

  return `You are Alex, an expert AI career advisor built into APEX, a job application platform for university students. You are warm, direct, and highly competent — like having a senior career coach as a personal friend.

User profile:
- Name: ${user.name || 'the user'}
- Target sector: ${sectors}
- Location: ${[user.city, user.country].filter(Boolean).join(', ') || 'Not specified'}
- Contract preference: ${user.contractType || 'Not specified'}
- Work mode: ${user.workMode || 'Not specified'}
- Salary expectation: ${salaryLine}
- Languages: ${user.languages?.filter(l => l.lang).map(l => `${l.lang} (${l.level})`).join(', ') || 'Not specified'}

CV:
${cvSummary}

Current applications:
${appsData}

Drafts in progress: ${drafts?.length || 0}

RULES:
- Be concise and direct — 2-4 sentences unless more detail is clearly needed
- Always reference the user's actual data when giving advice
- Use markdown: bullet points with "- ", **bold** for emphasis, no headers unless needed
- Never make up information about companies
- When asked about interview prep, give role-specific questions based on their applications`
}

async function streamAlex({ messages, systemPrompt, onChunk, onDone, onError, abortRef }) {
  try {
    const client = getClient()
    const stream  = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })
    if (abortRef) abortRef.current = stream

    let text = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text
        onChunk(text)
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

function ConvItem({ conv, isActive, onSelect }) {
  const [hov, setHov] = useState(false)
  const date = new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <button
      onClick={() => onSelect(conv)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '9px 12px', borderRadius: 8, marginBottom: 2,
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
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', display: 'block',
      }}>
        {conv.title}
      </span>
      <span style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{date}</span>
    </button>
  )
}

function AlexSidebar({ conversations, activeId, onNew, onSelect }) {
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
            <ConvItem key={conv.id} conv={conv} isActive={conv.id === activeId} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  )
}

function ChatBubble({ role, text, isStreaming }) {
  const isAlex = role === 'assistant'

  if (isAlex) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '75%' }}>
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
        maxWidth: '75%', padding: '12px 18px',
        background: 'linear-gradient(135deg,#2563EB,#38BDF8)',
        borderRadius: '12px 4px 12px 12px',
        boxShadow: '0 2px 12px rgba(37,99,235,0.22)',
      }}>
        <p style={{ margin: 0, fontSize: 14, color: '#fff', lineHeight: 1.6 }}>{text}</p>
      </div>
    </div>
  )
}

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

function SuggestionPill({ label, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '10px 18px', background: '#fff',
        border: `1.5px solid ${hov ? '#2563EB' : '#E2E8F0'}`,
        borderRadius: 20, fontSize: 14,
        color: hov ? '#2563EB' : '#475569',
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: 'inherit', fontWeight: 500,
        boxShadow: hov ? '0 2px 8px rgba(37,99,235,0.1)' : 'none',
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
  const systemPrompt = buildSystemPrompt(user, applications, drafts)

  // Pick a random phrase once on mount
  const phrase = useMemo(
    () => DYNAMIC_PHRASES[Math.floor(Math.random() * DYNAMIC_PHRASES.length)],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Chat state
  const [messages, setMessages]       = useState([])
  const [displayMsgs, setDisplayMsgs] = useState([])
  const [input, setInput]             = useState('')
  const [streaming, setStreaming]     = useState(false)
  const [streamText, setStreamText]   = useState('')
  const [hasStarted, setHasStarted]   = useState(false)
  const abortRef    = useRef(null)
  const chatEndRef  = useRef(null)
  const inputRef    = useRef(null)    // bottom bar
  const centerRef   = useRef(null)    // center bar (empty state)
  const convIdRef   = useRef(null)

  // Conversations
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId]   = useState(null)

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

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMsgs, streamText])

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
    setDisplayMsgs(prev => [...prev, { role: 'user', text }])
    setStreaming(true)
    setStreamText('')

    await streamAlex({
      messages: newMsgs,
      systemPrompt,
      abortRef,
      onChunk: t => setStreamText(t),
      onDone: async t => {
        const full = [...newMsgs, { role: 'assistant', content: t }]
        setMessages(full)
        setDisplayMsgs(prev => [...prev, { role: 'assistant', text: t }])
        setStreamText('')
        setStreaming(false)
        await saveConversation(full)
      },
      onError: () => {
        setDisplayMsgs(prev => [...prev, {
          role: 'assistant',
          text: 'Something went wrong. Please check your connection and try again.',
        }])
        setStreamText('')
        setStreaming(false)
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
      <style>{`
        @keyframes alex-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes alex-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .alex-sidebar-scroll::-webkit-scrollbar { display: none; }
        .alex-msgs::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* Full-viewport layout */}
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* ── Alex sidebar ── */}
        <AlexSidebar
          conversations={conversations}
          activeId={activeConvId}
          onNew={handleNew}
          onSelect={handleSelectConversation}
        />

        {/* ── Chat area ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: '#F8FAFC', overflow: 'hidden', position: 'relative',
        }}>

          {/* ── EMPTY STATE (absolutely covers the area, fades out) ── */}
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '0 48px 64px',
              background: '#F8FAFC',
              opacity: hasStarted ? 0 : 1,
              pointerEvents: hasStarted ? 'none' : 'auto',
              transition: 'opacity 0.3s ease',
            }}
          >
            <div style={{ width: '100%', maxWidth: 680, textAlign: 'center' }}>

              <h1 style={{
                margin: 0, fontSize: 40, fontWeight: 700, color: '#0F172A',
                letterSpacing: '-0.04em', lineHeight: 1.1,
              }}>
                Hi {firstName}, I&apos;m Alex.
              </h1>
              <p style={{
                margin: '12px 0 40px',
                fontSize: 18, color: '#64748B',
                fontStyle: 'italic', lineHeight: 1.5,
              }}>
                {phrase}
              </p>

              <InputBar
                {...makeInputHandlers(centerRef)}
                size="center"
                placeholder="Ask Alex anything about your career..."
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18, justifyContent: 'center' }}>
                {SUGGESTION_PILLS.map(pill => (
                  <SuggestionPill key={pill} label={pill} onClick={() => sendMessage(pill)} />
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
              className="alex-msgs"
              style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                padding: '32px 48px 16px',
                display: 'flex', flexDirection: 'column', gap: 18,
                scrollbarWidth: 'none',
              }}
            >
              {displayMsgs.map((m, i) => (
                <ChatBubble key={i} role={m.role} text={m.text} />
              ))}
              {streaming && streamText && (
                <ChatBubble role="assistant" text={streamText} isStreaming />
              )}
              {streaming && !streamText && <TypingIndicator />}
              <div ref={chatEndRef} style={{ height: 4 }} />
            </div>

            {/* Bottom input bar */}
            <div style={{
              flexShrink: 0,
              padding: '14px 48px 24px',
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
