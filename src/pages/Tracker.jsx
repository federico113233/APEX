import { useUser } from '../context/UserContext'
import { Link } from 'react-router-dom'

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

const STATUS_STYLES = {
  Applied: 'bg-slate-100 text-slate-700',
  Interview: 'bg-blue-50 text-apex-blue',
  Offer: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-50 text-red-600',
}

const PIPELINE = [
  { status: 'Applied', color: 'bg-slate-400' },
  { status: 'Interview', color: 'bg-apex-blue' },
  { status: 'Offer', color: 'bg-green-500' },
  { status: 'Rejected', color: 'bg-red-400' },
]

function Tracker() {
  const { applications, updateStatus } = useUser()

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-apex-text">Tracker</h1>
        <p className="text-apex-muted mt-1">Monitor every application from submission to decision</p>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {PIPELINE.map(({ status, color }) => (
          <div key={status} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className={`w-2.5 h-2.5 rounded-full ${color} mb-3`} />
            <p className="text-2xl font-semibold text-apex-text">{counts[status]}</p>
            <p className="text-sm text-apex-muted mt-0.5">{status}</p>
          </div>
        ))}
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-apex-muted text-sm mb-4">No applications yet.</p>
          <Link
            to="/dashboard/discover"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity text-sm"
          >
            Browse jobs in Discover →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="text-left py-4 px-6 text-xs font-semibold text-apex-muted uppercase tracking-wide">
                  Position
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-apex-muted uppercase tracking-wide">
                  Company
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-apex-muted uppercase tracking-wide">
                  Location
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-apex-muted uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-apex-muted uppercase tracking-wide">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="py-4 px-6">
                    <span className="font-medium text-apex-text">{app.title}</span>
                    <span className="ml-2 text-xs text-apex-muted">{app.type}</span>
                  </td>
                  <td className="py-4 px-6 text-sm text-apex-muted">{app.company}</td>
                  <td className="py-4 px-6 text-sm text-apex-muted">{app.location}</td>
                  <td className="py-4 px-6">
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-apex-blue cursor-pointer ${STATUS_STYLES[app.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4 px-6 text-sm text-apex-muted">{app.appliedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Tracker
