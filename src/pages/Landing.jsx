import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

/* ─── Brand gradient ─── */
const grad = 'linear-gradient(135deg, #2563EB, #38BDF8)'

/* ─── Easing ─── */
const ease = [0.21, 0.47, 0.32, 0.98]
const spring = { type: 'spring', stiffness: 300, damping: 30 }

/* ─────────────────────────────────────────
   ANIMATION PRIMITIVES
───────────────────────────────────────── */

function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const dirs = { up: { y: 32 }, down: { y: -32 }, left: { x: 32 }, right: { x: -32 }, none: {} }
  const d = dirs[direction] || {}
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, filter: 'blur(4px)', ...d }}
      animate={isInView ? { opacity: 1, filter: 'blur(0px)', x: 0, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

function Stagger({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{ visible: { transition: { staggerChildren: 0.09, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  )
}

const Item = ({ children, className = '' }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
      visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease } },
    }}
  >
    {children}
  </motion.div>
)

/* Split headline into per-word spans with stagger */
function SplitWords({ text, className = '', baseDelay = 0 }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  const words = text.split(' ')
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: baseDelay + i * 0.06, ease }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  )
}

/* Gradient pill bullet */
function Bullet({ text, light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: grad }}
      >
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className={light ? 'text-slate-300' : 'text-slate-600'}>{text}</span>
    </div>
  )
}

/* Gradient CTA button */
function GradBtn({ children, onClick, className = '', full = false }) {
  return (
    <motion.button
      onClick={onClick}
      className={`text-white font-semibold rounded-xl transition-opacity ${full ? 'w-full py-3' : 'px-6 py-3'} ${className}`}
      style={{ background: grad }}
      whileHover={{ scale: 1.03, opacity: 0.93 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  )
}

/* Ghost button */
function GhostBtn({ children, onClick, className = '' }) {
  return (
    <motion.button
      onClick={onClick}
      className={`font-medium text-slate-500 hover:text-slate-800 transition-colors ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  )
}

/* ─────────────────────────────────────────
   NAVBAR — always white, Notion-style
───────────────────────────────────────── */

function Navbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 bg-white"
      style={{
        borderBottom: '1px solid rgb(241 245 249)',
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : '0 1px 0 rgb(241 245 249)',
        transition: 'box-shadow 0.25s ease',
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <motion.img
          src="/apex_full_logo.png"
          alt="APEX"
          className="h-8 w-auto object-contain cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        />

        <nav className="hidden md:flex items-center gap-8">
          {[['Features', 'features'], ['Alex', 'alex'], ['Pricing', 'pricing']].map(([label, id]) => (
            <motion.button
              key={id}
              onClick={() => scrollTo(id)}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              whileHover={{ y: -1 }}
            >
              {label}
            </motion.button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <GhostBtn onClick={() => navigate('/login')} className="text-sm">Sign in</GhostBtn>
          <GradBtn onClick={() => navigate('/login')} className="text-sm px-4 py-2 rounded-lg">
            Get Started
          </GradBtn>
        </div>
      </div>
    </motion.header>
  )
}

/* ─────────────────────────────────────────
   HERO
───────────────────────────────────────── */

function Hero() {
  const navigate = useNavigate()

  return (
    <section
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.07) 0%, transparent 68%)' }}
    >
      {/* Watermark — only covers viewport height so it stays behind headline text */}
      <div className="absolute top-0 left-0 right-0 h-screen flex items-center justify-center pointer-events-none overflow-hidden">
        <motion.img
          src="/apex_x_blue.png"
          aria-hidden="true"
          className="w-[620px] h-[620px] object-contain select-none"
          style={{ mixBlendMode: 'multiply' }}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.045, scale: 1 }}
          transition={{ duration: 1.4, ease }}
        />
      </div>

      <div className="relative z-10 pt-32 pb-20 max-w-4xl mx-auto px-6 text-center w-full">


        {/* Headline */}
        <div className="mt-6">
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 tracking-tight leading-none">
            The career advisor you never had.
          </h1>
          <p className="text-5xl md:text-7xl font-bold text-blue-600 tracking-tight leading-none mt-2">
            Now you do.
          </p>
        </div>

        {/* Sub */}
        <motion.p
          className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-7 leading-relaxed"
          initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.65, ease }}
        >
          APEX tailors your CV, writes your cover letter, and guides your career — powered by AI that actually knows who you are.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex items-center justify-center gap-3 mt-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.8, ease }}
        >
          <GradBtn onClick={() => navigate('/login')} className="text-sm shadow-lg shadow-blue-500/20">
            Get started free →
          </GradBtn>
          <GhostBtn onClick={() => navigate('/login')} className="text-sm px-6 py-3">
            Sign in
          </GhostBtn>
        </motion.div>

        {/* Trust line */}
        <motion.p
          className="text-xs text-slate-400 mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          Free during beta · No credit card required
        </motion.p>

        {/* Dashboard mockup */}
        <motion.div
          className="mt-16 max-w-5xl mx-auto"
          initial={{ scale: 0.96, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9, ease }}
        >
          {/* Gentle float loop */}
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white">
              {/* Chrome bar */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                <span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
                <span className="w-3 h-3 rounded-full bg-green-400 shrink-0" />
                <div className="bg-white border border-slate-200 rounded-md flex-1 max-w-xs mx-auto px-3 py-1 text-xs text-slate-400 text-center select-none">
                  apexapply.app
                </div>
              </div>

              {/* App shell */}
              <div className="flex" style={{ minHeight: 420 }}>

                {/* Sidebar */}
                <div className="hidden md:flex w-52 bg-white border-r border-slate-100 py-4 px-3 flex-col shrink-0">
                  <div className="px-2 mb-5">
                    <img src="/apex_full_logo.png" alt="apex" className="h-5 w-auto object-contain" />
                  </div>
                  {[
                    { label: 'Dashboard', active: true },
                    { label: 'My Jobs', active: false },
                    { label: 'Tailoring Lab', active: false, badge: '3' },
                    { label: 'Tracker', active: false },
                    { label: 'Alex', active: false },
                    { label: 'Profile', active: false },
                  ].map(({ label, active, badge }) => (
                    <div
                      key={label}
                      className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-xs mb-0.5 select-none ${
                        active ? 'text-blue-600 font-semibold bg-blue-50 border-l-2 border-blue-500' : 'text-slate-500'
                      }`}
                    >
                      <span>{label}</span>
                      {badge && (
                        <span className="text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold" style={{ background: grad }}>
                          {badge}
                        </span>
                      )}
                    </div>
                  ))}
                  <div className="mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold" style={{ background: grad }}>
                        FB
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">Federico Balucani</p>
                        <p className="text-[10px] text-slate-400 truncate">federico.balucani@gmail.com</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 px-2 select-none">← Back to Home</p>
                    <p className="text-[10px] text-slate-400 px-2 mt-1 select-none">Sign out</p>
                  </div>
                </div>

                {/* Main */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Dark header */}
                  <div className="bg-slate-900 px-5 py-4 select-none">
                    <p className="text-lg font-bold text-white leading-tight">Good morning, Federico</p>
                    <p className="text-xs text-slate-400 mt-0.5">You have 1 interview scheduled. Here's your overview.</p>
                    <p className="text-[10px] text-slate-500 mt-1">3 applications · 1 interview · 3 drafts</p>
                  </div>

                  {/* Content row */}
                  <div className="flex flex-1 bg-slate-50 min-h-0">
                    {/* Left column */}
                    <div className="flex-1 p-4 min-w-0">
                      {/* Alex card */}
                      <div className="rounded-2xl p-4 mb-3 select-none" style={{ background: grad }}>
                        <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1.5">ALEX · AI CAREER ADVISOR</p>
                        <p className="text-sm font-semibold text-white leading-snug">
                          Most candidates apply and hope. You prepare and win.
                        </p>
                        <button className="mt-3 bg-white text-blue-600 text-[11px] font-semibold px-4 py-1.5 rounded-full">
                          Talk to Alex &gt;
                        </button>
                      </div>

                      {/* Quick actions */}
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 select-none">QUICK ACTIONS</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'My Jobs', sub: 'Your job inbox' },
                          { label: 'Tailoring Lab', sub: 'CV & cover letter' },
                          { label: 'Tracker', sub: 'All applications' },
                        ].map(({ label, sub }) => (
                          <div key={label} className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 flex items-center justify-between select-none">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{label}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>
                            </div>
                            <span className="text-slate-300 text-xs ml-1 shrink-0">›</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right panel */}
                    <div className="w-52 bg-white border-l border-slate-100 p-4 shrink-0 hidden lg:block select-none">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-slate-800">Applications</p>
                        <span className="text-[10px] text-blue-600">View all ›</span>
                      </div>
                      {[
                        { role: 'Mktg Manager – Group Lead', co: 'PVJets · Mar 10', status: 'Offer', c: 'text-green-600' },
                        { role: 'Stage Marketing', co: 'Tradex Srl · Mar 10', status: 'Applied', c: 'text-blue-600' },
                        { role: 'Marketing Intern', co: 'Nordberg Medical', status: 'Interview', c: 'text-amber-600' },
                      ].map(({ role, co, status, c }) => (
                        <div key={role} className="pb-2.5 mb-2.5 border-b border-slate-50 last:border-0">
                          <p className="text-[10px] font-semibold text-slate-800 leading-tight truncate">{role}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{co}</p>
                          <span className={`text-[10px] font-semibold ${c}`}>{status}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between mt-3 mb-2">
                        <p className="text-xs font-bold text-slate-800">In progress</p>
                        <span className="text-[10px] text-blue-600">Open Lab ›</span>
                      </div>
                      {[
                        { role: 'Marketing Manager', co: 'Salt' },
                        { role: 'Trade Marketing', co: 'Azienda Anonima' },
                      ].map(({ role, co }) => (
                        <div key={role} className="flex items-center justify-between pb-2 mb-2 border-b border-slate-50 last:border-0">
                          <div className="min-w-0 mr-2">
                            <p className="text-[10px] font-semibold text-slate-800 truncate">{role}</p>
                            <p className="text-[10px] text-slate-400 truncate">{co}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">Continue ›</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────
   SOCIAL PROOF
───────────────────────────────────────── */

function SocialProof() {
  const unis = ['IULM', 'Bocconi', 'Politecnico di Milano', 'Università Cattolica']
  return (
    <section className="py-16 border-y border-slate-100 overflow-hidden">
      <Stagger className="flex flex-col items-center gap-5" delay={0}>
        <Item>
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase text-center">
            Used by students at top universities
          </p>
        </Item>
        <Item>
          <div className="flex items-center gap-6 md:gap-10 flex-wrap justify-center">
            {unis.map((uni, i, arr) => (
              <span key={uni} className="flex items-center gap-6 md:gap-10">
                <motion.span
                  className="text-base font-semibold text-slate-600 cursor-default select-none"
                  whileHover={{ color: '#0f172a', scale: 1.04 }}
                >
                  {uni}
                </motion.span>
                {i < arr.length - 1 && <span className="text-slate-200 hidden sm:inline">·</span>}
              </span>
            ))}
          </div>
        </Item>
      </Stagger>
    </section>
  )
}

/* ─────────────────────────────────────────
   WHY APEX
───────────────────────────────────────── */

function TheProblem() {
  return (
    <section id="features" className="py-32 bg-white">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeIn direction="up">
          <motion.p
            className="text-xs font-bold tracking-widest uppercase mb-8"
            style={{ color: '#2563EB' }}
          >
            WHY APEX
          </motion.p>
          <p className="text-2xl md:text-3xl font-light text-slate-500 leading-relaxed">
            "Some students navigate the job market knowing exactly what to do.{' '}
            <span className="text-slate-800 font-normal">
              The right CV. The right cover letter. The right answers in the interview room.
            </span>
            {' '}Most don't, not because they're less capable, but because{' '}
            <span className="text-slate-900">nobody showed them how.</span>
            {' '}<span className="text-slate-900 font-semibold">APEX is the advisor that does."</span>
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────
   FEATURE SECTION WRAPPER
───────────────────────────────────────── */

function FeatureLayout({ label, title, body, bullets, visual, reverse = false, bg = 'bg-white' }) {
  return (
    <section className={`py-24 ${bg}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${reverse ? 'lg:direction-rtl' : ''}`}>
          {/* Text side */}
          <div className={reverse ? 'lg:order-2' : ''}>
            <FadeIn direction={reverse ? 'left' : 'right'}>
              <p className="text-xs font-bold tracking-widest text-blue-500 uppercase mb-2">{label}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mt-3 leading-tight">{title}</h2>
              <p className="text-base text-slate-500 mt-4 leading-relaxed max-w-md">{body}</p>
              <div className="mt-6 space-y-2.5 text-sm">{bullets}</div>
            </FadeIn>
          </div>

          {/* Visual side */}
          <div className={reverse ? 'lg:order-1' : ''}>
            <FadeIn direction={reverse ? 'right' : 'left'}>
              <motion.div
                whileHover={{ y: -6, boxShadow: '0 32px 60px rgba(0,0,0,0.13)' }}
                transition={{ duration: 0.3, ease }}
              >
                {visual}
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── My Jobs mockup ─── */
function MyJobsVisual() {
  const jobs = [
    { title: 'Marketing Manager', co: 'Salt · Milano', match: '94%', green: true },
    { title: 'Product Designer', co: 'Bending Spoons · Remote', match: '87%', green: true },
    { title: 'Brand Strategist', co: 'Publicis · Milano', match: '71%', green: false },
  ]
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <p className="font-bold text-sm text-slate-800">My Jobs</p>
        <p className="text-xs text-slate-400 mt-0.5">Import any job from any source.</p>
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-[11px] text-slate-300 flex-1 truncate">Paste a job URL from LinkedIn, Indeed, Glassdoor...</span>
          <span className="text-[11px] text-white px-2.5 py-1 rounded-lg font-semibold shrink-0" style={{ background: grad }}>Import</span>
        </div>
        <div className="mt-2 flex items-center gap-1 flex-wrap text-[11px]">
          <span className="text-slate-300">Works with</span>
          <span className="text-blue-600 font-medium">LinkedIn</span>
          <span className="text-slate-200">·</span>
          <span className="text-indigo-500 font-medium">Indeed</span>
          <span className="text-slate-200">·</span>
          <span className="text-green-600 font-medium">Glassdoor</span>
          <span className="text-slate-200">·</span>
          <span className="text-orange-500 font-medium">Infojobs</span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">MY JOBS · 3</p>
        <Stagger className="space-y-2">
          {jobs.map(({ title, co, match, green }) => (
            <Item key={title}>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{co}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${green ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {match}
                  </span>
                  <div className="flex gap-1">
                    <span className="text-white text-[10px] px-2 py-1 rounded-lg font-semibold" style={{ background: grad }}>Tailor with AI</span>
                    <span className="border border-slate-200 text-slate-500 text-[10px] px-2 py-1 rounded-lg">Save</span>
                  </div>
                </div>
              </div>
            </Item>
          ))}
        </Stagger>
      </div>
    </div>
  )
}

/* ─── Tailoring Lab mockup ─── */
function TailoringVisual() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="flex" style={{ minHeight: 320 }}>
        {/* Left panel */}
        <div className="w-2/5 border-r border-slate-100 p-4 bg-slate-50 flex flex-col shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1 self-start mb-3">
            ✦ Selected job
          </span>
          <p className="font-semibold text-sm text-slate-800">Marketing Manager</p>
          <p className="text-xs text-slate-400 mt-0.5">Salt · Milano</p>
          <p className="text-xs text-slate-400 mt-3 cursor-pointer hover:text-blue-600 transition-colors">Change job ›</p>

          <div className="mt-4">
            <p className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <span style={{ color: '#2563EB' }}>✦</span> Ask Alex to edit
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['More concise', 'More impact', 'Match keywords', 'Adjust tone'].map((p) => (
                <span key={p} className="text-[10px] border border-slate-200 rounded-full px-2 py-0.5 text-slate-500 bg-white">
                  {p}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <input
                readOnly
                placeholder="Type your request..."
                className="text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 flex-1 bg-white text-slate-400"
              />
              <button className="text-white text-[10px] px-2.5 rounded-lg font-semibold shrink-0" style={{ background: grad }}>
                Send
              </button>
            </div>
          </div>

          <button className="mt-auto border border-slate-200 text-[11px] text-slate-500 rounded-xl py-2 flex items-center justify-center gap-1 hover:bg-white transition-colors">
            ↻ Regenerate
          </button>
        </div>

        {/* Right panel */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
            <span className="text-[11px] text-slate-400">Tailored CV</span>
            <span className="text-[11px] font-semibold text-blue-600 border-b-2 border-blue-600 pb-3 -mb-3">Cover Letter</span>
            <div className="ml-auto flex gap-2">
              {['Preview', 'Copy'].map((a) => (
                <span key={a} className="text-[11px] text-slate-400 cursor-pointer">{a}</span>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-3 flex-1">
            Sono da sempre affascinato dai brand che riescono a fondere heritage e innovazione, creando connessioni autentiche con i consumatori. Salt rappresenta esattamente questa filosofia — e per questo candidarsi per il ruolo di Marketing Manager...
          </p>
          <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              <button className="text-[10px] border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg">↓ CV .docx</button>
              <button className="text-[10px] border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg whitespace-nowrap">↓ Letter .docx</button>
            </div>
            <button className="text-white text-[10px] px-3 py-1.5 rounded-xl font-semibold" style={{ background: grad }}>+ Add to Tracker</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Tracker mockup ─── */
function TrackerVisual() {
  const rows = [
    { pos: 'Marketing Manager', co: 'PVJets', status: '● Offer', c: 'text-green-600', date: 'Mar 10' },
    { pos: 'Stage Marketing', co: 'Tradex Srl', status: '● Applied', c: 'text-blue-600', date: 'Mar 10' },
    { pos: 'Marketing Intern', co: 'Nordberg Medical', status: '● Interview', c: 'text-amber-600', date: 'Mar 9' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-sm text-slate-800">Tracker</p>
        <button className="text-white text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: grad }}>+ Add job</button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { dot: 'bg-blue-500', n: 2, label: 'Applied' },
          { dot: 'bg-amber-500', n: 1, label: 'Interview' },
          { dot: 'bg-green-500', n: 1, label: 'Offer' },
          { dot: 'bg-red-400', n: 0, label: 'Rejected' },
        ].map(({ dot, n, label }) => (
          <div key={label} className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className={`w-2 h-2 rounded-full ${dot} mx-auto mb-1`} />
            <p className="text-base font-bold text-slate-800 leading-none">{n}</p>
            <p className="text-[10px] text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2 mb-3">
        <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-xs text-slate-400">Search applications...</span>
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <span className="bg-slate-900 text-white rounded-full px-3 py-1 text-[11px]">All</span>
        {['Applied', 'Interview', 'Offer'].map((s) => (
          <span key={s} className="border border-slate-200 text-slate-500 rounded-full px-3 py-1 text-[11px]">{s}</span>
        ))}
      </div>
      <div className="grid grid-cols-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 pb-2 border-b border-slate-100">
        <span className="col-span-1">Role</span>
        <span>Company</span>
        <span>Status</span>
        <span>Date</span>
      </div>
      <Stagger>
        {rows.map(({ pos, co, status, c, date }) => (
          <Item key={pos}>
            <div className="py-2.5 px-2 border-b border-slate-50 grid grid-cols-4 items-center gap-1">
              <span className="text-[11px] font-medium text-slate-800 truncate">{pos}</span>
              <span className="text-[11px] text-slate-500 truncate">{co}</span>
              <span className={`text-[11px] font-semibold ${c}`}>{status}</span>
              <span className="text-[11px] text-slate-400">{date}</span>
            </div>
          </Item>
        ))}
      </Stagger>
    </div>
  )
}

/* ─────────────────────────────────────────
   FEATURE SECTIONS
───────────────────────────────────────── */

function FeatureMyJobs() {
  return (
    <FeatureLayout
      label="MY JOBS"
      title="Every job you find, in one place."
      body="Paste any job URL — from LinkedIn, Indeed, Glassdoor, or anywhere else. APEX extracts everything automatically and drops it into your inbox, ready to tailor."
      bullets={<>
        <Bullet text="Import from any job site with one URL" />
        <Bullet text="Or browse curated suggestions inside APEX" />
        <Bullet text="AI match score for every job" />
      </>}
      visual={<MyJobsVisual />}
      bg="bg-white"
    />
  )
}

function FeatureTailoring() {
  return (
    <FeatureLayout
      label="TAILORING LAB"
      title="Your CV, rewritten for every role."
      body="Paste the job URL. APEX reads the description, rewrites your CV to match — the right keywords, the right structure, ATS-ready. Then writes a cover letter that sounds like you, not a template."
      bullets={<>
        <Bullet text="CV tailored to each job description" />
        <Bullet text="Cover letter in your voice" />
        <Bullet text="Download as .docx in one click" />
      </>}
      visual={<TailoringVisual />}
      bg="bg-slate-50"
      reverse
    />
  )
}

function FeatureTracker() {
  return (
    <FeatureLayout
      label="TRACKER"
      title="Never lose track of where you stand."
      body="Every application, every status, every next step. From the moment you apply to the moment you get the offer — all in one place."
      bullets={<>
        <Bullet text="Track every application by status" />
        <Bullet text="See interview dates and deadlines" />
        <Bullet text="Notes and feedback, always accessible" />
      </>}
      visual={<TrackerVisual />}
      bg="bg-white"
    />
  )
}

/* ─────────────────────────────────────────
   ALEX SPOTLIGHT
───────────────────────────────────────── */

const alexMessages = [
  { role: 'user', text: 'How should I prep for my Goldman Sachs interview?' },
  { role: 'alex', text: "Based on your CV and the role you applied to, I'd focus on behavioral questions around your Bocconi finance projects. Want me to run a mock interview?" },
  { role: 'user', text: "Yes, let's do it." },
  { role: 'alex', text: "Perfect. Let's start: tell me about a time you had to analyze a complex dataset under a tight deadline." },
]

function AlexSpotlight() {
  return (
    <section id="alex" className="bg-slate-900 py-32 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(59,130,246,0.18) 0%, transparent 70%)' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <FadeIn direction="right">
            <p className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-2">MEET ALEX</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mt-3 leading-tight">
              Your career advisor, always on.
            </h2>
            <p className="text-base text-slate-400 mt-4 leading-relaxed max-w-md">
              Alex knows your CV, your applications, and where you want to go. Ask anything — interview prep, career direction, what to apply to next. Alex has the context a generic chatbot never will.
            </p>
            <div className="mt-6 space-y-2.5 text-sm">
              <Bullet text="Knows your CV and every application" light />
              <Bullet text="Interview prep with the actual job description" light />
              <Bullet text="Honest, direct — even when it's uncomfortable" light />
            </div>
          </FadeIn>

          {/* Chat */}
          <FadeIn direction="left">
            <motion.div
              className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.3, ease }}
            >
              <div className="border-b border-slate-700 px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: grad }}>
                  <span className="text-white text-xs font-bold">A</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">Alex</p>
                  <p className="text-xs text-slate-400">Career Advisor</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.span
                    className="w-2 h-2 rounded-full bg-green-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-xs text-green-400">Online</span>
                </div>
              </div>

              <Stagger className="p-5 space-y-4 min-h-[280px]" delay={0.2}>
                {alexMessages.map((msg, i) => (
                  <Item key={i}>
                    {msg.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]" style={{ background: grad }}>
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-blue-400 text-xs font-bold">A</span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Alex</p>
                          <div className="bg-slate-700 text-slate-100 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    )}
                  </Item>
                ))}
              </Stagger>

              <div className="border-t border-slate-700 px-4 py-3 flex gap-3 items-center">
                <div className="flex-1 bg-slate-700 rounded-xl px-4 py-2 text-sm text-slate-400">
                  Ask Alex anything about your career...
                </div>
                <motion.button
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                  style={{ background: grad }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────
   PRICING
───────────────────────────────────────── */

function Pricing() {
  const navigate = useNavigate()
  return (
    <section id="pricing" className="py-32 bg-white">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <FadeIn direction="up">
          <p className="text-xs font-bold tracking-widest text-blue-500 uppercase mb-4">PRICING</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Simple, transparent pricing.</h2>
          <p className="text-slate-400 text-lg mt-2">Free while in beta. Always fair.</p>

          <motion.div
            className="mt-12 max-w-sm mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-lg"
            whileHover={{ y: -6, boxShadow: '0 32px 60px rgba(37,99,235,0.12)' }}
            transition={{ duration: 0.3, ease }}
          >
            <span className="inline-block text-xs font-bold px-3 py-1 rounded-full text-blue-600 bg-blue-50">BETA</span>
            <div className="mt-4">
              <p className="text-5xl font-bold text-slate-900">Free</p>
              <p className="text-lg text-slate-400">for now</p>
            </div>
            <hr className="border-slate-100 my-6" />
            <div className="text-left space-y-3">
              {['Unlimited CV tailoring', 'Cover letters for every application', 'Alex career advisor', 'Application tracker', 'Priority access to future plans'].map((f) => (
                <Bullet key={f} text={f} />
              ))}
            </div>
            <GradBtn onClick={() => navigate('/login')} full className="mt-6 text-sm rounded-xl">
              Get started free →
            </GradBtn>
          </motion.div>
          <p className="text-xs text-slate-400 mt-4">No credit card required. No commitment.</p>
        </FadeIn>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────
   FINAL CTA
───────────────────────────────────────── */

function FinalCTA() {
  const navigate = useNavigate()
  return (
    <section className="py-32 bg-slate-900 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(59,130,246,0.18) 0%, transparent 70%)' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
        <FadeIn direction="up">
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Your next opportunity starts here.
          </h2>
          <p className="text-lg text-slate-400 mt-4">
            Join students already using APEX to get the roles they deserve.
          </p>
          <motion.button
            onClick={() => navigate('/login')}
            className="bg-white text-slate-900 font-semibold text-sm px-8 py-3.5 rounded-xl mt-8 inline-block hover:bg-slate-100 transition-colors"
            whileHover={{ scale: 1.04, boxShadow: '0 0 32px rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.97 }}
          >
            Get started free →
          </motion.button>
          <p className="text-xs text-slate-500 mt-4">
            Free during beta · No credit card · Takes 2 minutes
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────
   FOOTER
───────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center">
          <img
            src="/apex_x_blue.png"
            alt="APEX"
            className="h-6 w-6 object-contain"
            style={{ mixBlendMode: 'screen', opacity: 0.7 }}
          />
          <span className="text-xs text-slate-500 ml-3">© 2026 APEX</span>
        </div>
        <div className="flex items-center gap-6">
          <motion.button className="text-xs text-slate-600 hover:text-slate-400 transition-colors" whileHover={{ y: -1 }}>Privacy</motion.button>
          <motion.button className="text-xs text-slate-600 hover:text-slate-400 transition-colors" whileHover={{ y: -1 }}>Terms</motion.button>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */

export default function Landing() {
  return (
    <div className="bg-white">
      <Navbar />
      <Hero />
      <SocialProof />
      <TheProblem />
      <AlexSpotlight />
      <FeatureTailoring />
      <FeatureMyJobs />
      <FeatureTracker />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  )
}
