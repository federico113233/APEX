import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

export default function LoginRegister() {
  const [email, setEmail]                 = useState('')
  const [magicSent, setMagicSent]         = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingMagic, setLoadingMagic]   = useState(false)
  const [error, setError]                 = useState('')

  const handleGoogle = async () => {
    setError('')
    setLoadingGoogle(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' },
    })
    if (error) { setError(error.message); setLoadingGoogle(false) }
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoadingMagic(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/dashboard' },
    })
    setLoadingMagic(false)
    if (error) setError(error.message)
    else setMagicSent(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-6 py-5">
        <Link to="/">
          <img src="/apex_full_logo.png" alt="APEX" className="h-8 w-auto object-contain" />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          {/* Logo + heading */}
          <div className="text-center mb-8">
            <img
              src="/apex_x_blue.png"
              alt="APEX"
              className="w-12 h-12 object-contain mx-auto mb-5"
            />
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome to APEX</h1>
            <p className="text-sm text-slate-500">Sign in to start your career journey.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
            {/* Error */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={loadingGoogle}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-60 shadow-sm"
            >
              {loadingGoogle
                ? <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
                : <GoogleIcon />
              }
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Magic link */}
            {magicSent ? (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="font-semibold text-slate-900 mb-2">Check your inbox</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  We sent a magic link to{' '}
                  <span className="font-medium text-slate-700">{email}</span>.
                  <br />Click it to sign in — no password needed.
                </p>
                <button
                  onClick={() => { setMagicSent(false); setEmail('') }}
                  className="mt-5 text-sm text-blue-600 hover:underline font-medium"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div>
                  <label htmlFor="magic-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="magic-email"
                    name="magic-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingMagic || !email.trim()}
                  className="w-full py-2.5 rounded-lg font-medium text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #38BDF8)' }}
                >
                  {loadingMagic && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  Send magic link
                </button>
              </form>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            By continuing you agree to our{' '}
            <span className="underline cursor-pointer hover:text-slate-600">Terms of Service</span>
            {' '}and{' '}
            <span className="underline cursor-pointer hover:text-slate-600">Privacy Policy</span>.
          </p>
        </div>
      </main>

      <footer className="flex flex-col items-center gap-2 pb-8">
        <img src="/apex_x_blue.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" style={{ opacity: 0.35 }} />
      </footer>
    </div>
  )
}
