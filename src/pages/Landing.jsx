import { Link, Navigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

function Landing() {
  const { session, sessionLoading } = useUser()
  if (!sessionLoading && session) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/apex_full_logo.png" alt="APEX" className="h-8 w-auto object-contain" />
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-24 px-6 overflow-hidden">
        {/* Background symbol watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <img
            src="/apex_x_blue.png"
            alt=""
            aria-hidden="true"
            className="w-[600px] h-[600px] object-contain"
            style={{ opacity: 0.04 }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white mb-8"
            style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            AI-Powered Career Assistant
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-[1.05] mb-6">
            Your career,{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
            >
              elevated.
            </span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            AI-powered job matching and application tailoring built for students.
            Find the right role, craft the perfect CV, track every application.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-white text-base transition-opacity hover:opacity-90 shadow-lg shadow-blue-500/25"
              style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
            >
              Get Started — it's free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-lg font-medium text-slate-700 text-base border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-semibold text-slate-400 uppercase tracking-widest mb-16">
            Everything you need to land your next role
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
                title: 'Discover',
                desc: 'Browse real job listings with AI-powered match scores tailored to your profile, sector, and goals.',
              },
              {
                icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
                title: 'Tailor',
                desc: 'Generate custom CVs and cover letters for every application using Claude AI. No generic templates.',
              },
              {
                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                title: 'Track',
                desc: 'Monitor every application from submission to offer. Keep your CVs, cover letters, and notes in one place.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-100 p-8 hover:shadow-md hover:border-slate-200 transition-all duration-200">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 text-lg mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to level up your applications?
          </h2>
          <p className="text-slate-500 mb-10 leading-relaxed">
            Join students landing roles at top companies with APEX.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 shadow-lg shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
          >
            Start for free
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-slate-100 flex flex-col items-center gap-3">
        <img src="/apex_x_blue.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain" style={{ opacity: 0.4 }} />
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} APEX. AI-powered job application assistant.</p>
      </footer>
    </div>
  )
}

export default Landing
