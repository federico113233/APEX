import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

function Landing() {
  return (
    <div className="min-h-screen bg-apex-bg">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="lg" />
          <div className="flex items-center gap-4">
            <Link 
              to="/login" 
              className="text-sm font-medium text-apex-muted hover:text-apex-text transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-apex-text tracking-tight mb-6">
              Land your dream job with{' '}
              <span className="bg-gradient-to-r from-apex-blue to-apex-cyan bg-clip-text text-transparent">
                AI-powered precision
              </span>
            </h1>
            <p className="text-xl text-apex-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              APEX helps students find the right opportunities, tailor applications, 
              and track progress—all in one place. Your AI job application assistant.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity shadow-lg shadow-blue-500/25"
            >
              Get Started
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Product Description */}
        <section className="py-24 px-6 bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold text-apex-text text-center mb-16">
              Everything you need to stand out
            </h2>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-apex-text mb-2">Discover</h3>
                <p className="text-apex-muted text-sm">
                  Browse job listings with AI-powered match scores tailored to your profile and goals.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-apex-text mb-2">Tailoring Lab</h3>
                <p className="text-apex-muted text-sm">
                  Create custom CVs and cover letters optimized for each application.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-apex-text mb-2">Tracker</h3>
                <p className="text-apex-muted text-sm">
                  Monitor every application from submission to final decision in one dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-semibold text-apex-text mb-4">
              Ready to level up your applications?
            </h2>
            <p className="text-apex-muted mb-8">
              Join students who are landing roles with APEX. Free to get started.
            </p>
            <Link
              to="/login"
              className="inline-flex px-8 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-6 border-t border-slate-200 text-center text-sm text-apex-muted">
        © {new Date().getFullYear()} APEX. AI-powered job application assistant for students.
      </footer>
    </div>
  )
}

export default Landing
