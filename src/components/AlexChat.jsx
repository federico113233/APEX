import { useState, useEffect, useRef } from 'react'
import { useUser } from '../context/UserContext'

const INITIAL_MESSAGE = {
  id: 1,
  from: 'alex',
  text: "Hi! I'm Alex, your APEX career advisor 👋 I can help with your CV, application strategy, interview prep, and more. What's on your mind?",
}

const AUTO_REPLIES = [
  {
    keywords: ['cv', 'resume', 'curriculum vitae'],
    reply:
      "A strong CV should highlight quantified achievements — e.g. 'Led a team of 4 to deliver X, increasing efficiency by 30%' beats a generic responsibility list. Make sure every bullet starts with a strong action verb. Want tips on a specific section?",
  },
  {
    keywords: ['cover letter', 'covering letter'],
    reply:
      "Great cover letters are 3 paragraphs max: (1) why this company, (2) why you're the right fit, (3) a confident close. Mirror keywords from the job description — it helps with ATS filters and shows genuine interest.",
  },
  {
    keywords: ['interview', 'interviews'],
    reply:
      "Prep 3–5 strong stories using the STAR method (Situation, Task, Action, Result). Research the company's recent news, their values, and the team. Practice out loud — it makes a bigger difference than most people expect.",
  },
  {
    keywords: ['match', 'score', 'percentage', '%'],
    reply:
      "Match scores are calculated by comparing your CV keywords and target sector to each job's requirements. To boost your score, make sure your CV clearly reflects the skills and terminology used in your target sector.",
  },
  {
    keywords: ['tailoring', 'tailor', 'customize', 'personaliz'],
    reply:
      "Head to the Tailoring Lab — select a job from the list and click Generate. APEX will produce a CV and cover letter optimized for that specific role. Even small tweaks per application significantly improve your chances.",
  },
  {
    keywords: ['tracker', 'track', 'application', 'applied'],
    reply:
      "The Tracker shows all your applications and their status. When you click Apply in Discover, it's added automatically. Update statuses as you move through each process — it keeps you organized and lets you spot patterns.",
  },
  {
    keywords: ['linkedin', 'network', 'networking', 'connect'],
    reply:
      "Always connect with the recruiter or hiring manager on LinkedIn after applying. A brief, genuine note — 'I just applied for X and wanted to connect — I'm really excited about the team's work on Y' — can get your name remembered.",
  },
  {
    keywords: ['internship', 'intern', 'internships'],
    reply:
      "For internships, companies expect less experience. What stands out is genuine curiosity, a clear motivation for that specific company, and 1–2 relevant projects or experiences. Show enthusiasm and coachability.",
  },
  {
    keywords: ['rejection', 'rejected', 'ghosted', 'no response'],
    reply:
      "Rejections are part of every job search — even the most successful candidates face them. The key is volume + quality: broad search in Discover, tailored applications per role. A follow-up email after rejection is also perfectly fine and sometimes opens doors.",
  },
  {
    keywords: ['salary', 'pay', 'compensation', 'negotiate'],
    reply:
      "For internships, salaries are often fixed — but for full-time roles, always negotiate. Research market rates (Glassdoor, Levels.fyi), anchor high, and justify with specific value you bring. Most companies expect negotiation.",
  },
]

const FALLBACKS = [
  "That's a great question! To give you the best advice, could you share which role or company you're targeting?",
  "I'd love to help. Can you tell me more — are you at the application stage, preparing for interviews, or something else?",
  "Good thinking to ask! One universal tip: always tailor your application to the specific job description. Generic applications rarely land interviews.",
  "I'm here to help you navigate every step. Could you give me a bit more context so I can point you in the right direction?",
]

let fallbackIndex = 0

function getReply(input) {
  const lower = input.toLowerCase()
  const match = AUTO_REPLIES.find((r) => r.keywords.some((k) => lower.includes(k)))
  if (match) return match.reply
  const reply = FALLBACKS[fallbackIndex % FALLBACKS.length]
  fallbackIndex++
  return reply
}

export default function AlexChat() {
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, messages])

  const send = () => {
    const text = input.trim()
    if (!text) return

    const userMsg = { id: Date.now(), from: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    setTimeout(() => {
      const reply = getReply(text)
      setMessages((prev) => [...prev, { id: Date.now() + 1, from: 'alex', text: reply }])
      setTyping(false)
    }, 900)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden"
          style={{ height: '440px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-apex-blue to-apex-cyan">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-none">Alex</p>
              <p className="text-white/70 text-xs mt-0.5">Career Advisor · APEX</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.from === 'alex' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-xs">A</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'user'
                      ? 'bg-gradient-to-r from-apex-blue to-apex-cyan text-white rounded-br-sm'
                      : 'bg-slate-100 text-apex-text rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Alex anything…"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
            />
            <button
              onClick={send}
              disabled={!input.trim() || typing}
              className="w-8 h-8 rounded-lg bg-gradient-to-r from-apex-blue to-apex-cyan text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bubble toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-apex-blue to-apex-cyan shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Open Alex chat"
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <span className="text-white font-bold text-xl">A</span>
        )}
      </button>
    </div>
  )
}
