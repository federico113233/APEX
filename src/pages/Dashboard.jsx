import { Link } from 'react-router-dom'

const stats = [
  { label: 'Applications sent', value: '12', change: '+3 this week', href: '/dashboard/tracker' },
  { label: 'Match score avg', value: '87%', change: 'Great fit', href: '/dashboard/discover' },
  { label: 'Tailored CVs', value: '8', change: 'Ready to use', href: '/dashboard/tailoring-lab' },
]

function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-apex-text">Dashboard</h1>
        <p className="text-apex-muted mt-1">Your job application overview</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {stats.map(({ label, value, change, href }) => (
          <Link
            key={label}
            to={href}
            className="block p-6 bg-white rounded-xl border border-slate-200 hover:border-apex-blue/30 hover:shadow-sm transition-all"
          >
            <p className="text-sm font-medium text-apex-muted">{label}</p>
            <p className="text-2xl font-semibold text-apex-text mt-1">{value}</p>
            <p className="text-sm text-apex-cyan mt-1">{change}</p>
          </Link>
        ))}
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-apex-text">Quick actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/dashboard/discover"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Discover jobs
          </Link>
          <Link
            to="/dashboard/tailoring-lab"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 bg-white font-medium text-apex-text hover:bg-slate-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Create tailored CV
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
