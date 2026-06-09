import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import posthog from 'posthog-js'

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'apex_interview_history'

const INTERVIEW_TYPES = [
  { id: 'screening', label: 'Recruiter screening', desc: 'First-round HR call — motivation, CV walkthrough, fit' },
  { id: 'behavioral', label: 'Behavioral', desc: 'Experience-based questions with the hiring manager' },
  { id: 'technical', label: 'Technical', desc: 'Role-specific skills and practical scenarios' },
  { id: 'case', label: 'Case study', desc: 'One business case to structure and solve aloud' },
]

const DIFFICULTIES = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'standard', label: 'Standard' },
  { id: 'tough', label: 'Tough' },
]

const SILENCE_MS = 1400 // silence after speech before committing the turn

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] }
}

function saveHistoryEntry(entry) {
  try {
    const h = loadHistory()
    h.unshift(entry)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30)))
  } catch { /* ignore */ }
}

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

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function rankVoice(v) {
  let s = 0
  // Local voices are reliable; remote ones (e.g. "Google US English") are known
  // to fail silently in Chrome, especially after a speechSynthesis.cancel()
  if (v.localService) s += 4
  if (/natural|neural|premium|enhanced/i.test(v.name)) s += 2
  // On Edge the online "Natural" voices are high quality AND reliable — boost them
  if (!v.localService && /natural/i.test(v.name) && /Edg\//.test(navigator.userAgent)) s += 6
  return s
}

function pickVoice(lang) {
  const voices = window.speechSynthesis?.getVoices() || []
  const prefix = lang === 'it' ? 'it' : 'en'
  const candidates = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix))
  if (!candidates.length) return null
  return [...candidates].sort((a, b) => rankVoice(b) - rankVoice(a))[0]
}

function scoreColor(s) {
  if (s == null) return '#64748B'
  if (s >= 75) return '#16A34A'
  if (s >= 60) return '#D97706'
  return '#DC2626'
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Eyebrow({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
      {children}
    </p>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-4 py-1.5 rounded-[7px] text-[13px] font-medium transition-all active:scale-[0.98] ${
            value === o.id
              ? 'bg-white text-apex-text shadow-[0_1px_3px_rgba(15,23,42,0.08)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InterviewStudio() {
  const { user, applications, drafts } = useUser()
  const location = useLocation()

  // phase: setup | prepping | live | generating_feedback | feedback
  const [phase, setPhase] = useState('setup')

  // ── Setup state ──
  const preselected = location.state?.job || null
  const [selectedJob, setSelectedJob] = useState(preselected)
  const [manualTitle, setManualTitle] = useState('')
  const [manualCompany, setManualCompany] = useState('')
  const [type, setType] = useState('behavioral')
  const [difficulty, setDifficulty] = useState('standard')
  const [language, setLanguage] = useState('en')
  const [voiceMode, setVoiceMode] = useState(() => !!getSpeechRecognition())
  const [history] = useState(loadHistory)

  // ── Live session state ──
  const [voiceState, setVoiceState] = useState('idle') // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState([])
  const [liveCaption, setLiveCaption] = useState('')
  const [interviewerLive, setInterviewerLive] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [micError, setMicError] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [ttsFailed, setTtsFailed] = useState(false)   // TTS confirmed dead → captions-only
  const [testState, setTestState] = useState(null)    // null | playing | ok | failed

  // ── Feedback state ──
  const [report, setReport] = useState(null)
  const [feedbackError, setFeedbackError] = useState(null)

  // ── Refs (voice engine) ──
  const contextRef = useRef(null)
  const transcriptRef = useRef([])
  const voiceStateRef = useRef('idle')
  const voiceModeRef = useRef(voiceMode)
  const sessionActiveRef = useRef(false)
  const recRef = useRef(null)
  const pendingFinalRef = useRef('')
  const liveTextRef = useRef('')
  const silenceTimerRef = useRef(null)
  const abortRef = useRef(null)
  const utterancesPendingRef = useRef(0)
  const streamDoneRef = useRef(false)
  const spokenUpToRef = useRef(0)
  const assistantBufferRef = useRef('')
  const endTokenSeenRef = useRef(false)
  const timerRef = useRef(null)
  const voiceRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const ttsDeadRef = useRef(false)        // stop queueing utterances once TTS proved dead
  const ttsTurnStartedRef = useRef(false) // did any utterance actually start this turn?
  const ttsWatchdogRef = useRef(null)

  const setVState = (s) => { voiceStateRef.current = s; setVoiceState(s) }
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])

  // Preload TTS voices (Chrome loads them async)
  useEffect(() => {
    const load = () => {
      voiceRef.current = pickVoice(language)
      const total = window.speechSynthesis?.getVoices()?.length ?? 0
      console.log(`[InterviewStudio] TTS voices: ${total} available, picked:`, voiceRef.current?.name || '(browser default)')
    }
    load()
    window.speechSynthesis?.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load)
  }, [language])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, interviewerLive])

  // Cleanup on unmount
  useEffect(() => () => stopEverything(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopEverything = () => {
    sessionActiveRef.current = false
    clearTimeout(silenceTimerRef.current)
    clearTimeout(ttsWatchdogRef.current)
    clearInterval(timerRef.current)
    abortRef.current?.abort?.()
    pauseRecognition()
    window.speechSynthesis?.cancel?.()
  }

  // ── Job options ──
  const jobOptions = [
    ...applications.map((a) => ({ id: `app_${a.id}`, title: a.title, company: a.company, description: a.description, source: a.status })),
    ...(drafts || []).map((d) => ({ id: `draft_${d.id}`, title: d.job_title, company: d.company, description: d.job_description, source: 'Draft' })),
  ]

  const effectiveJob = selectedJob || (manualTitle || manualCompany
    ? { title: manualTitle, company: manualCompany, description: '' }
    : null)

  // ════════════════════════ VOICE ENGINE ═════════════════════════════════════

  // Unlock TTS inside the user-gesture call stack (required on mobile).
  // Empty-text utterance: completes instantly, satisfies the gesture
  // requirement, and — unlike a real utterance — can never wedge the queue.
  const unlockTTS = () => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      synth.getVoices()
      synth.resume()
      synth.speak(new SpeechSynthesisUtterance(''))
    } catch { /* ignore */ }
  }

  const startRecognition = () => {
    const SR = getSpeechRecognition()
    if (!SR) { setMicError('unsupported'); return }
    if (recRef.current) return

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = language === 'it' ? 'it-IT' : 'en-US'

    rec.onresult = (e) => {
      // Recognition only runs while we are listening (it is paused during TTS,
      // so the mic can never pick up the interviewer's own voice)
      if (voiceStateRef.current !== 'listening') return
      let interim = ''
      let finals = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finals += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      if (finals) pendingFinalRef.current = (pendingFinalRef.current + ' ' + finals).trim()
      liveTextRef.current = (pendingFinalRef.current + ' ' + interim).trim()
      setLiveCaption(liveTextRef.current)
      armSilenceTimer()
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicError('denied')
        setVoiceMode(false)
        voiceModeRef.current = false
      }
    }

    rec.onend = () => {
      // Chrome stops recognition periodically — keep it alive while listening
      if (sessionActiveRef.current && recRef.current === rec) {
        try { rec.start() } catch { /* already started */ }
      }
    }

    try {
      rec.start()
      recRef.current = rec
    } catch {
      setMicError('failed')
    }
  }

  const pauseRecognition = () => {
    const rec = recRef.current
    recRef.current = null // prevents the onend auto-restart
    try { rec?.abort?.() } catch { /* ignore */ }
  }

  const resumeRecognition = () => {
    if (voiceModeRef.current && sessionActiveRef.current) startRecognition()
  }

  const armSilenceTimer = () => {
    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      const text = liveTextRef.current.trim()
      if (text && voiceStateRef.current === 'listening') commitUserTurn(text)
    }, SILENCE_MS)
  }

  // ── TTS: speak completed sentences as they stream ──
  const speakNewSentences = (flush = false) => {
    const full = assistantBufferRef.current.replace('[END_INTERVIEW]', '')
    const unspoken = full.slice(spokenUpToRef.current)

    let toSpeak = ''
    if (flush) {
      toSpeak = unspoken
      spokenUpToRef.current = full.length
    } else {
      const m = unspoken.match(/^[\s\S]*[.!?…](?=\s|$)/)
      if (!m) return
      toSpeak = m[0]
      spokenUpToRef.current += m[0].length
    }

    toSpeak = toSpeak.trim()
    if (!toSpeak || ttsDeadRef.current) return

    const synth = window.speechSynthesis
    const utter = new SpeechSynthesisUtterance(toSpeak)
    utter.lang = language === 'it' ? 'it-IT' : 'en-US'
    if (voiceRef.current) utter.voice = voiceRef.current
    utter.rate = 1.04

    utterancesPendingRef.current++

    // First utterance of the turn arms a watchdog: if no audio actually starts
    // within 3s, TTS on this browser is dead — fall back to captions instead of
    // staying silent AND stuck (dead utterances never fire onend)
    if (utterancesPendingRef.current === 1 && !ttsTurnStartedRef.current) {
      clearTimeout(ttsWatchdogRef.current)
      ttsWatchdogRef.current = setTimeout(() => {
        if (ttsTurnStartedRef.current || ttsDeadRef.current) return
        console.warn('[InterviewStudio] TTS never started — falling back to captions')
        ttsDeadRef.current = true
        setTtsFailed(true)
        try { synth.cancel() } catch { /* ignore */ }
        utterancesPendingRef.current = 0
        if (streamDoneRef.current && voiceStateRef.current === 'speaking') finishInterviewerTurn()
      }, 3000)
    }

    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      utterancesPendingRef.current = Math.max(0, utterancesPendingRef.current - 1)
      if (utterancesPendingRef.current === 0 && streamDoneRef.current && voiceStateRef.current === 'speaking') {
        finishInterviewerTurn()
      }
    }
    utter.onstart = () => {
      ttsTurnStartedRef.current = true
      clearTimeout(ttsWatchdogRef.current)
      setTtsFailed(false) // audio is back — clear the captions-only banner
    }
    utter.onend = settle
    utter.onerror = (e) => {
      console.error('[InterviewStudio] TTS error:', e.error)
      settle()
    }

    synth.resume() // un-stick Chrome's queue if paused
    console.log('[InterviewStudio] queueing TTS:', JSON.stringify(toSpeak.slice(0, 50)),
      { speaking: synth.speaking, pending: synth.pending, paused: synth.paused })
    // Micro-delay dodges Chrome's "speak() swallowed right after cancel()" race
    setTimeout(() => synth.speak(utter), 30)
  }

  // ════════════════════════ SESSION FLOW ═════════════════════════════════════

  // Speaks directly inside the click handler — isolates pipeline bugs from
  // browser/OS TTS problems in one tap
  const testVoice = () => {
    const synth = window.speechSynthesis
    if (!synth) { setTestState('failed'); return }
    setTestState('playing')
    voiceRef.current = pickVoice(language)
    const u = new SpeechSynthesisUtterance(
      language === 'it'
        ? 'Ciao, sono il tuo interviewer. Se mi senti, siamo pronti.'
        : "Hi, I'm your interviewer. If you can hear me, we're ready."
    )
    u.lang = language === 'it' ? 'it-IT' : 'en-US'
    if (voiceRef.current) u.voice = voiceRef.current
    let started = false
    u.onstart = () => { started = true }
    u.onend = () => setTestState(started ? 'ok' : 'failed')
    u.onerror = (e) => { console.error('[InterviewStudio] TTS test error:', e.error); setTestState('failed') }
    synth.resume()
    synth.speak(u)
    setTimeout(() => {
      if (!started) {
        try { synth.cancel() } catch { /* ignore */ }
        setTestState('failed')
      }
    }, 3000)
  }

  const startSession = async () => {
    if (!effectiveJob) return
    unlockTTS() // must happen inside the click handler
    ttsDeadRef.current = false
    setTtsFailed(false)
    setPhase('prepping')
    posthog.capture('interview_session_started', { type, difficulty, company: effectiveJob.company, voice: voiceMode })

    // Research prep with a hard client-side timeout — the interview must start
    // even if the research hangs or fails
    let research = ''
    const prepCtrl = new AbortController()
    const prepTimeout = setTimeout(() => prepCtrl.abort(), 30_000)
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: prepCtrl.signal,
        body: JSON.stringify({ action: 'prep', company: effectiveJob.company, role: effectiveJob.title }),
      })
      if (res.ok) research = (await res.json()).research || ''
    } catch (err) {
      console.warn('[InterviewStudio] prep skipped:', err.name)
    } finally {
      clearTimeout(prepTimeout)
    }

    contextRef.current = {
      userName: user.name,
      cvText: user.cvText || '',
      job: { title: effectiveJob.title, company: effectiveJob.company, description: effectiveJob.description || '' },
      research,
      type,
      difficulty,
      language,
    }

    transcriptRef.current = []
    setTranscript([])
    setElapsed(0)
    endTokenSeenRef.current = false
    sessionActiveRef.current = true
    setPhase('live')

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

    // Warm up the mic permission WITHOUT engaging SpeechRecognition: on some
    // Chrome setups an active recognition session suppresses speechSynthesis
    // audio. Recognition itself only starts when it is the user's turn.
    if (voiceModeRef.current) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
        mic.getTracks().forEach((t) => t.stop())
      } catch {
        setMicError('denied')
        setVoiceMode(false)
        voiceModeRef.current = false
      }
    }

    await runInterviewerTurn([{
      role: 'user',
      content: language === 'it'
        ? '(Il candidato è entrato nella call. Inizia il colloquio.)'
        : '(The candidate has joined the call. Begin the interview.)',
    }])
  }

  const runInterviewerTurn = async (messagesOverride) => {
    setVState('thinking')
    pauseRecognition() // mic off while the interviewer thinks and speaks

    // Self-heal the synthesis queue: nothing of ours should be playing right
    // now, so anything still speaking/pending is a wedged leftover that would
    // block every new utterance behind it. Clear it. (The 30ms delayed speak
    // in speakNewSentences dodges Chrome's post-cancel swallow race.)
    try {
      const synth = window.speechSynthesis
      if (synth && (synth.speaking || synth.pending)) {
        console.warn('[InterviewStudio] clearing wedged TTS queue', { speaking: synth.speaking, pending: synth.pending })
        synth.cancel()
      }
    } catch { /* ignore */ }

    setInterviewerLive('')
    assistantBufferRef.current = ''
    spokenUpToRef.current = 0
    streamDoneRef.current = false
    utterancesPendingRef.current = 0
    ttsTurnStartedRef.current = false
    ttsDeadRef.current = false // retry TTS every turn — a one-off failure must not mute the whole session

    const apiMessages = messagesOverride || transcriptRef.current.map((t) => ({
      role: t.role === 'user' ? 'user' : 'assistant',
      content: t.text,
    }))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ action: 'turn', context: contextRef.current, messages: apiMessages }),
      })
      if (!res.ok) throw new Error(await res.text())

      for await (const event of parseSSE(res)) {
        if (controller.signal.aborted) return
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          assistantBufferRef.current += event.delta.text
          setInterviewerLive(assistantBufferRef.current.replace('[END_INTERVIEW]', ''))
          if (voiceStateRef.current === 'thinking') setVState('speaking')
          if (voiceModeRef.current && !ttsDeadRef.current) speakNewSentences()
        } else if (event.type === 'error') {
          throw new Error(event.error?.message || 'Stream error')
        }
      }

      streamDoneRef.current = true
      if (assistantBufferRef.current.includes('[END_INTERVIEW]')) endTokenSeenRef.current = true

      if (voiceModeRef.current && !ttsDeadRef.current) {
        speakNewSentences(true)
        if (utterancesPendingRef.current === 0) finishInterviewerTurn()
      } else {
        finishInterviewerTurn()
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[InterviewStudio] turn error:', err)
      streamDoneRef.current = true
      if (!assistantBufferRef.current) {
        setInterviewerLive(language === 'it' ? '(Problema di connessione — riprova a parlare.)' : '(Connection issue — please try speaking again.)')
      }
      finishInterviewerTurn()
    }
  }

  const finishInterviewerTurn = () => {
    if (!sessionActiveRef.current) return
    const text = assistantBufferRef.current.replace('[END_INTERVIEW]', '').trim()
    if (text) {
      transcriptRef.current = [...transcriptRef.current, { role: 'assistant', text }]
      setTranscript([...transcriptRef.current])
    }
    setInterviewerLive('')

    if (endTokenSeenRef.current) {
      endSession()
      return
    }
    pendingFinalRef.current = ''
    liveTextRef.current = ''
    setLiveCaption('')
    setVState('listening')
    resumeRecognition()
  }

  // Tap-to-interrupt while the interviewer is speaking
  const interruptInterviewer = () => {
    if (voiceStateRef.current !== 'speaking') return
    window.speechSynthesis?.cancel?.()
    abortRef.current?.abort?.()
    utterancesPendingRef.current = 0
    const partial = assistantBufferRef.current.replace('[END_INTERVIEW]', '').trim()
    if (partial) {
      transcriptRef.current = [...transcriptRef.current, { role: 'assistant', text: partial + ' —' }]
      setTranscript([...transcriptRef.current])
    }
    assistantBufferRef.current = ''
    setInterviewerLive('')
    pendingFinalRef.current = ''
    liveTextRef.current = ''
    setLiveCaption('')
    setVState('listening')
    resumeRecognition()
  }

  const commitUserTurn = (text) => {
    clearTimeout(silenceTimerRef.current)
    pendingFinalRef.current = ''
    liveTextRef.current = ''
    setLiveCaption('')
    transcriptRef.current = [...transcriptRef.current, { role: 'user', text }]
    setTranscript([...transcriptRef.current])
    runInterviewerTurn()
  }

  const sendTextTurn = () => {
    const text = textInput.trim()
    if (!text || voiceStateRef.current === 'thinking' || voiceStateRef.current === 'speaking') return
    setTextInput('')
    commitUserTurn(text)
  }

  // ── End session → feedback ──
  const endSession = async () => {
    stopEverything()
    const finalTranscript = transcriptRef.current
    setPhase('generating_feedback')
    posthog.capture('interview_session_ended', { turns: finalTranscript.length, duration_s: elapsed })

    if (finalTranscript.filter((t) => t.role === 'user').length < 2) {
      setReport(null)
      setFeedbackError('short')
      setPhase('feedback')
      return
    }

    const fbCtrl = new AbortController()
    const fbTimeout = setTimeout(() => fbCtrl.abort(), 90_000)
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: fbCtrl.signal,
        body: JSON.stringify({
          action: 'feedback',
          transcript: finalTranscript,
          job: contextRef.current.job,
          cvText: user.cvText || '',
          type,
          language,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { report: r } = await res.json()
      if (!r) throw new Error('empty report')
      setReport(r)
      setFeedbackError(null)
      saveHistoryEntry({
        date: new Date().toISOString(),
        job: contextRef.current.job,
        type,
        difficulty,
        score: r?.overall_score ?? null,
        durationS: elapsed,
      })
      posthog.capture('interview_feedback_generated', { score: r?.overall_score })
    } catch (err) {
      console.error('[InterviewStudio] feedback error:', err)
      setFeedbackError('failed')
    } finally {
      clearTimeout(fbTimeout)
    }
    setPhase('feedback')
  }

  const resetToSetup = () => {
    stopEverything()
    setPhase('setup')
    setTranscript([])
    setReport(null)
    setFeedbackError(null)
    setInterviewerLive('')
    setLiveCaption('')
    setMicError(null)
    setVState('idle')
  }

  // ════════════════════════ RENDER ═══════════════════════════════════════════

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')
  const typeMeta = INTERVIEW_TYPES.find((t) => t.id === type)

  return (
    <div className="h-full flex flex-col md:overflow-hidden page-fade-in">
      <style>{`
        @keyframes studio-ring { 0%,100% { transform: scale(1); opacity: .35 } 50% { transform: scale(1.14); opacity: .08 } }
        @keyframes studio-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.045) } }
        @keyframes studio-dot { 0%,100% { transform: translateY(0); opacity: .35 } 50% { transform: translateY(-3px); opacity: 1 } }
      `}</style>

      {/* ══════════ SETUP ══════════ */}
      {phase === 'setup' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto w-full px-5 md:px-0 py-8 md:py-14">

            <header className="mb-10">
              <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight text-apex-text leading-tight">
                Interview Studio
              </h1>
              <p className="text-[15px] text-slate-500 mt-2 leading-relaxed max-w-[46ch]">
                A realistic voice interview for a real application, with a coaching report at the end.
              </p>
            </header>

            {/* Role */}
            <section className="pb-8">
              <Eyebrow>Role</Eyebrow>
              {jobOptions.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                  {jobOptions.map((j) => {
                    const active = selectedJob && `${selectedJob.title}_${selectedJob.company}` === `${j.title}_${j.company}`
                    return (
                      <button
                        key={j.id}
                        onClick={() => { setSelectedJob(active ? null : j); setManualTitle(''); setManualCompany('') }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:scale-[0.995]"
                      >
                        <span
                          className="w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{ borderColor: active ? '#2563EB' : '#CBD5E1', borderWidth: active ? 5.5 : 1.5 }}
                        />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-apex-text truncate">{j.title}</span>
                          <span className="block text-[12.5px] text-slate-400 truncate">{j.company} · {j.source}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Role title</label>
                  <input
                    value={manualTitle}
                    onChange={(e) => { setManualTitle(e.target.value); setSelectedJob(null) }}
                    placeholder="e.g. Marketing Intern"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[14px] text-apex-text placeholder-slate-300 focus:outline-none focus:border-apex-blue focus:ring-[3px] focus:ring-blue-100 transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Company</label>
                  <input
                    value={manualCompany}
                    onChange={(e) => { setManualCompany(e.target.value); setSelectedJob(null) }}
                    placeholder="e.g. L'Oréal"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[14px] text-apex-text placeholder-slate-300 focus:outline-none focus:border-apex-blue focus:ring-[3px] focus:ring-blue-100 transition-shadow"
                  />
                </div>
              </div>
            </section>

            {/* Format */}
            <section className="pt-8 pb-8 border-t border-slate-200/80">
              <Eyebrow>Format</Eyebrow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INTERVIEW_TYPES.map((t) => {
                  const active = type === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`text-left px-4 py-3.5 rounded-xl border transition-all active:scale-[0.99] ${
                        active
                          ? 'border-apex-blue bg-white shadow-[0_0_0_3px_rgba(37,99,235,0.08)]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className={`block text-[14px] font-semibold ${active ? 'text-apex-blue' : 'text-apex-text'}`}>
                        {t.label}
                      </span>
                      <span className="block text-[12.5px] text-slate-400 mt-0.5 leading-snug">{t.desc}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Session */}
            <section className="pt-8 pb-10 border-t border-slate-200/80">
              <Eyebrow>Session</Eyebrow>
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-apex-text">Difficulty</span>
                  <Segmented options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-apex-text">Language</span>
                  <Segmented
                    options={[{ id: 'en', label: 'English' }, { id: 'it', label: 'Italiano' }]}
                    value={language}
                    onChange={setLanguage}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-apex-text">
                    Voice
                    {!getSpeechRecognition() && (
                      <span className="block text-[12px] text-slate-400">Not supported in this browser</span>
                    )}
                  </span>
                  <button
                    onClick={() => getSpeechRecognition() && setVoiceMode((v) => !v)}
                    role="switch"
                    aria-checked={voiceMode}
                    className="relative w-[44px] h-[26px] rounded-full transition-colors flex-shrink-0"
                    style={{ background: voiceMode ? '#2563EB' : '#E2E8F0' }}
                  >
                    <span
                      className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-all"
                      style={{ left: voiceMode ? 21 : 3 }}
                    />
                  </button>
                </div>
                {voiceMode && (
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-apex-text">
                      Audio check
                      {testState === 'failed' && (
                        <span className="block text-[12px] text-red-500 mt-0.5">
                          No audio from this browser — try Microsoft Edge, or check system voices
                        </span>
                      )}
                      {testState === 'ok' && (
                        <span className="block text-[12px] text-green-600 mt-0.5">Audio works</span>
                      )}
                    </span>
                    <button
                      onClick={testVoice}
                      disabled={testState === 'playing'}
                      className="px-4 py-1.5 rounded-lg text-[13px] font-medium border border-slate-200 bg-white text-apex-text hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50 flex-shrink-0"
                    >
                      {testState === 'playing' ? 'Playing…' : 'Play test'}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Start */}
            <button
              onClick={startSession}
              disabled={!effectiveJob}
              className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white transition-all active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: '#2563EB', boxShadow: '0 1px 2px rgba(15,23,42,0.1)' }}
            >
              {effectiveJob ? `Start interview · ${effectiveJob.company || effectiveJob.title}` : 'Select a role to start'}
            </button>

            {/* History */}
            {history.length > 0 && (
              <section className="mt-12 pt-8 border-t border-slate-200/80">
                <Eyebrow>Recent sessions</Eyebrow>
                <div className="divide-y divide-slate-100">
                  {history.slice(0, 5).map((h, i) => (
                    <div key={i} className="flex items-baseline gap-4 py-2.5">
                      <span className="text-[15px] font-semibold tabular-nums w-8 text-right flex-shrink-0" style={{ color: scoreColor(h.score) }}>
                        {h.score ?? '—'}
                      </span>
                      <span className="text-[14px] text-apex-text font-medium truncate">{h.job?.title}</span>
                      <span className="text-[13px] text-slate-400 truncate">{h.job?.company}</span>
                      <span className="ml-auto text-[12px] text-slate-300 tabular-nums flex-shrink-0">
                        {new Date(h.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ══════════ PREPPING / GENERATING ══════════ */}
      {(phase === 'prepping' || phase === 'generating_feedback') && (
        <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-apex-blue" style={{ animation: 'studio-ring 2s ease-in-out infinite' }} />
            <div className="absolute inset-[5px] rounded-full bg-apex-blue flex items-center justify-center">
              <span className="flex gap-1">
                {[0, 160, 320].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: `studio-dot 1.1s ${d}ms infinite` }} />
                ))}
              </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-semibold text-apex-text tracking-tight">
              {phase === 'prepping' ? 'Preparing your interviewer' : 'Reviewing your performance'}
            </p>
            <p className="text-[14px] text-slate-400 mt-1.5">
              {phase === 'prepping'
                ? `Researching how ${effectiveJob?.company || 'this company'} runs interviews`
                : 'Your coach is reading the full transcript'}
            </p>
          </div>
        </div>
      )}

      {/* ══════════ LIVE SESSION ══════════ */}
      {phase === 'live' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-slate-200/80 flex-shrink-0 bg-white">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-apex-text truncate tracking-tight">
                {contextRef.current?.job.title}
              </p>
              <p className="text-[12px] text-slate-400 truncate">
                {contextRef.current?.job.company} · {typeMeta?.label}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="text-[13px] font-medium text-slate-400 tabular-nums">{mins}:{secs}</span>
              <button
                onClick={endSession}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-apex-text border border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                End interview
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* Stage */}
            <div className="flex-1 flex flex-col items-center justify-center gap-9 px-6 py-10 relative">
              {/* Orb — tap to interrupt while speaking */}
              <button
                onClick={interruptInterviewer}
                className="relative w-32 h-32 flex items-center justify-center outline-none"
                style={{ cursor: voiceState === 'speaking' ? 'pointer' : 'default' }}
                aria-label={voiceState === 'speaking' ? 'Interrupt the interviewer' : undefined}
              >
                {(voiceState === 'listening' || voiceState === 'speaking') && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: voiceState === 'listening' ? 'rgba(37,99,235,0.18)' : 'rgba(15,23,42,0.10)',
                      animation: 'studio-ring 1.8s ease-in-out infinite',
                    }}
                  />
                )}
                <span
                  className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{
                    background: voiceState === 'listening' ? '#2563EB' : '#0F172A',
                    transition: 'background 0.4s ease',
                    animation: voiceState === 'speaking' ? 'studio-breathe 1.2s ease-in-out infinite' : 'none',
                    boxShadow: '0 10px 30px -8px rgba(15,23,42,0.3)',
                  }}
                >
                  {voiceState === 'thinking' ? (
                    <span className="flex gap-1.5">
                      {[0, 160, 320].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: `studio-dot 1.1s ${d}ms infinite` }} />
                      ))}
                    </span>
                  ) : voiceState === 'listening' ? (
                    <svg width="30" height="30" fill="none" stroke="#fff" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                    </svg>
                  ) : (
                    <svg width="30" height="30" fill="none" stroke="#fff" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </span>
              </button>

              {/* Status + captions */}
              <div className="text-center max-w-md min-h-[72px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
                  style={{ color: voiceState === 'listening' ? '#2563EB' : '#94A3B8' }}>
                  {voiceState === 'listening' ? (language === 'it' ? 'Ti ascolto' : 'Listening')
                    : voiceState === 'thinking' ? (language === 'it' ? 'Un attimo' : 'One moment')
                    : voiceState === 'speaking' ? (language === 'it' ? 'Tocca il cerchio per interrompere' : 'Tap the circle to interrupt')
                    : ''}
                </p>
                {voiceState === 'speaking' && interviewerLive && (
                  <p className="text-[15px] text-apex-text leading-relaxed">{interviewerLive}</p>
                )}
                {voiceState === 'listening' && liveCaption && (
                  <p className="text-[15px] text-slate-400 italic leading-relaxed">{liveCaption}</p>
                )}
                {ttsFailed && (
                  <p className="text-[12px] text-amber-600 mt-2">
                    {language === 'it'
                      ? 'Audio non disponibile in questo browser — segui la trascrizione a lato.'
                      : 'Audio unavailable in this browser — follow the transcript panel.'}
                  </p>
                )}
              </div>

              {/* Text fallback */}
              {(!voiceMode || micError) && (
                <div className="w-full max-w-md">
                  {micError === 'denied' && (
                    <p className="text-[12px] text-slate-400 text-center mb-2.5">
                      Microphone access denied — continuing in text.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendTextTurn() }}
                      placeholder={language === 'it' ? 'Scrivi la tua risposta' : 'Type your answer'}
                      disabled={voiceState === 'thinking' || voiceState === 'speaking'}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[14px] text-apex-text placeholder-slate-300 focus:outline-none focus:border-apex-blue focus:ring-[3px] focus:ring-blue-100 transition-shadow disabled:opacity-40"
                    />
                    <button
                      onClick={sendTextTurn}
                      disabled={!textInput.trim() || voiceState === 'thinking' || voiceState === 'speaking'}
                      className="px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-30"
                      style={{ background: '#2563EB' }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="w-full md:w-[320px] flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-200/80 flex flex-col min-h-[180px] max-h-[260px] md:max-h-none bg-white">
              <p className="px-5 pt-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 flex-shrink-0">
                Transcript
              </p>
              <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-4">
                {transcript.length === 0 && !interviewerLive && (
                  <p className="text-[13px] text-slate-300">The conversation will appear here.</p>
                )}
                {transcript.map((t, i) => (
                  <div key={i}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1"
                      style={{ color: t.role === 'user' ? '#2563EB' : '#94A3B8' }}>
                      {t.role === 'user' ? 'You' : 'Interviewer'}
                    </p>
                    <p className="text-[13px] text-apex-text leading-relaxed">{t.text}</p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ FEEDBACK REPORT ══════════ */}
      {phase === 'feedback' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto w-full px-5 md:px-0 py-8 md:py-14">

            <header className="flex items-start justify-between mb-10">
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight text-apex-text">Report</h1>
                <p className="text-[14px] text-slate-400 mt-1">
                  {contextRef.current?.job.title} · {contextRef.current?.job.company}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={resetToSetup}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-apex-text border border-slate-200 bg-white hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  New session
                </button>
                <button
                  onClick={startSession}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
                  style={{ background: '#2563EB' }}
                >
                  Practice again
                </button>
              </div>
            </header>

            {feedbackError === 'short' && (
              <div className="py-16 text-center border-t border-slate-200/80">
                <p className="text-[16px] font-semibold text-apex-text mb-1.5">Session too short to evaluate</p>
                <p className="text-[14px] text-slate-400 max-w-[40ch] mx-auto leading-relaxed">
                  Answer at least a couple of questions to get a meaningful report.
                </p>
              </div>
            )}
            {feedbackError === 'failed' && (
              <div className="py-16 text-center border-t border-slate-200/80">
                <p className="text-[16px] font-semibold text-apex-text mb-1.5">Could not generate the report</p>
                <p className="text-[14px] text-slate-400">Try "Practice again" or start a new session.</p>
              </div>
            )}

            {report && (
              <>
                {/* Score */}
                <section className="flex items-center gap-8 pb-10">
                  <div className="flex-shrink-0">
                    <p className="text-[64px] font-semibold tracking-tighter leading-none tabular-nums" style={{ color: scoreColor(report.overall_score) }}>
                      {report.overall_score ?? '—'}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 mt-1">out of 100</p>
                  </div>
                  <div className="border-l border-slate-200/80 pl-8">
                    <Eyebrow>Verdict</Eyebrow>
                    <p className="text-[14px] text-apex-text leading-relaxed">{report.verdict}</p>
                  </div>
                </section>

                {/* Categories */}
                {report.categories && (
                  <section className="pt-8 pb-10 border-t border-slate-200/80">
                    <Eyebrow>Breakdown</Eyebrow>
                    <div className="flex flex-col gap-5">
                      {Object.entries(report.categories).map(([key, c]) => (
                        <div key={key}>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className="text-[14px] font-medium text-apex-text capitalize">{key}</span>
                            <span className="text-[14px] font-semibold tabular-nums" style={{ color: scoreColor(c.score) }}>{c.score}</span>
                          </div>
                          <div className="h-[3px] rounded-full bg-slate-100 overflow-hidden mb-1.5">
                            <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: scoreColor(c.score) }} />
                          </div>
                          <p className="text-[12.5px] text-slate-400 leading-relaxed">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Strengths / fixes */}
                <section className="pt-8 pb-10 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div>
                    <Eyebrow>What worked</Eyebrow>
                    <ul className="flex flex-col gap-3">
                      {(report.strengths || []).map((s, i) => (
                        <li key={i} className="text-[13.5px] text-apex-text leading-relaxed flex gap-2.5">
                          <span className="w-1 h-1 rounded-full bg-green-600 mt-[8px] flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <Eyebrow>What to fix</Eyebrow>
                    <ul className="flex flex-col gap-4">
                      {(report.improvements || []).map((imp, i) => (
                        <li key={i} className="text-[13.5px] leading-relaxed">
                          <span className="font-medium text-apex-text">{imp.issue}</span>
                          {imp.quote && <span className="block text-[12.5px] text-slate-400 italic mt-1">"{imp.quote}"</span>}
                          <span className="block text-[12.5px] text-slate-500 mt-1">{imp.fix}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {/* Per-question */}
                {report.question_review?.length > 0 && (
                  <section className="pt-8 pb-10 border-t border-slate-200/80">
                    <Eyebrow>Question by question</Eyebrow>
                    <div className="divide-y divide-slate-100">
                      {report.question_review.map((q, i) => (
                        <div key={i} className="flex items-baseline gap-4 py-3">
                          <span className="text-[14px] font-semibold tabular-nums w-8 text-right flex-shrink-0" style={{ color: scoreColor(q.score) }}>
                            {q.score}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-apex-text">{q.question}</p>
                            <p className="text-[12.5px] text-slate-400 mt-0.5 leading-relaxed">{q.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Next steps */}
                {report.next_steps?.length > 0 && (
                  <section className="pt-8 pb-14 border-t border-slate-200/80">
                    <Eyebrow>Before your next session</Eyebrow>
                    <ol className="flex flex-col gap-2.5">
                      {report.next_steps.map((s, i) => (
                        <li key={i} className="text-[13.5px] text-apex-text leading-relaxed flex gap-3">
                          <span className="text-[13px] font-semibold text-slate-300 tabular-nums flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
