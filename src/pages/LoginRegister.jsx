import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

function LoginRegister() {
  const [isLogin, setIsLogin] = useState(true)
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/onboarding')
  }

  return (
    <div className="min-h-screen bg-apex-bg flex flex-col">
      <header className="p-6">
        <Link to="/" className="inline-block">
          <Logo size="lg" />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <h1 className="text-2xl font-semibold text-apex-text mb-1">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-apex-muted text-sm mb-8">
              {isLogin 
                ? 'Sign in to continue to APEX' 
                : 'Get started with APEX in seconds'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-apex-text mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@university.edu"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-apex-text mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
                />
              </div>
              {!isLogin && (
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-apex-text mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full py-3 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
              >
                {isLogin ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-apex-muted">
              {isLogin ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="font-medium text-apex-blue hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="font-medium text-apex-blue hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default LoginRegister
