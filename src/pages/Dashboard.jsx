import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'

function Dashboard() {
  const { user, applications } = useUser()

  const applied    = applications.length
  const interviews = applications.filter((a) => a.status === 'Interview').length
  const offers     = applications.filter((a) => a.status === 'Offer').length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name ? user.name.split(' ')[0] : null

  const stats = [
    {
      label: 'Applications sent',
      value: String(applied),
      sub: applied === 1 ? '1 application' : `${interviews} in interview`,
      href: '/dashboard/tracker',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Interviews scheduled',
      value: String(interviews),
      sub: offers > 0 ? `${offers} offer${offers > 1 ? 's' : ''}` : 'Keep applying!',
      href: '/dashboard/tracker',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'from-violet-500 to-violet-600',
    },
    {
      label: 'Match score avg',
      value: '87%',
      sub: 'Based on your profile',
      href: '/dashboard/discover',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'from-cyan-500 to-cyan-600',
    },
  ]

  const quickActions = [
    {
      to: '/dashboard/discover',
      label: 'Discover Jobs',
      desc: 'Find your next opportunity',
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
      primary: true,
    },
    {
      to: '/dashboard/tailoring-lab',
      label: 'Tailoring Lab',
      desc: 'Generate CV & cover letter',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      primary: false,
    },
    {
      to: '/dashboard/tracker',
      label: 'View Tracker',
      desc: 'Monitor all applications',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      primary: false,
    },
  ]

  return (
    <div className="p-8 max-w-5xl page-fade-in">
      {/* Greeting */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-slate-900">
          {firstName ? `${greeting}, ${firstName} 👋` : `${greeting} 👋`}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Here's your job application overview.</p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {stats.map(({ label, value, sub, href, icon, color }) => (
          <Link
            key={label}
            to={href}
            className="group block bg-white rounded-xl border border-slate-100 p-6 hover:border-blue-100 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
            <p className="text-sm font-medium text-slate-600 mb-0.5">{label}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Quick actions</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {quickActions.map(({ to, label, desc, icon, primary }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 ${
                primary
                  ? 'text-white border-transparent shadow-md shadow-blue-500/20 hover:opacity-90'
                  : 'bg-white border-slate-100 text-slate-700 hover:border-blue-100 hover:shadow-sm'
              }`}
              style={primary ? { background: 'linear-gradient(135deg, #2563EB, #38BDF8)' } : {}}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                primary ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                <svg className={`w-4 h-4 ${primary ? 'text-white' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-semibold ${primary ? 'text-white' : 'text-slate-800'}`}>{label}</p>
                <p className={`text-xs mt-0.5 ${primary ? 'text-white/75' : 'text-slate-400'}`}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent applications preview */}
      {applications.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Recent applications</h2>
            <Link to="/dashboard/tracker" className="text-sm text-blue-600 hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {applications.slice(0, 4).map((app, i) => (
              <div
                key={app.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${i < Math.min(applications.length, 4) - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{app.title}</p>
                  <p className="text-xs text-slate-400 truncate">{app.company} · {app.appliedDate}</p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                  app.status === 'Applied'   ? 'bg-blue-50 text-blue-700' :
                  app.status === 'Interview' ? 'bg-orange-50 text-orange-700' :
                  app.status === 'Offer'     ? 'bg-green-50 text-green-700' :
                                               'bg-red-50 text-red-600'
                }`}>
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
