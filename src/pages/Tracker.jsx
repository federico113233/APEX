import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

const STATUS_STYLES = {
  Applied:   'bg-blue-50 text-blue-700',
  Interview: 'bg-orange-50 text-orange-700',
  Offer:     'bg-green-50 text-green-700',
  Rejected:  'bg-red-50 text-red-600',
}

const STATUS_DOT = {
  Applied:   'bg-blue-500',
  Interview: 'bg-orange-500',
  Offer:     'bg-green-500',
  Rejected:  'bg-red-500',
}

// ── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ app, onClose, onStatusChange, onNotesChange, onDelete }) {
  const [activeTab, setActiveTab]       = useState(app.tailoredCv ? 'cv' : app.coverLetter ? 'cover' : 'notes')
  const [notes, setNotes]               = useState(app.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingNotes, setSavingNotes]   = useState(false)

  const handleNotesBlur = async () => {
    if (notes === app.notes) return
    setSavingNotes(true)
    await onNotesChange(app.id, notes)
    setSavingNotes(false)
  }

  const tabs = [
    { key: 'cv',    label: 'Tailored CV',   show: true },
    { key: 'cover', label: 'Cover Letter',  show: true },
    { key: 'notes', label: 'Notes',         show: true },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-apex-text text-lg leading-tight">{app.title}</h2>
              <p className="text-sm text-apex-muted mt-0.5">
                {[app.company, app.location].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-apex-muted mt-1">Applied {app.appliedDate}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-apex-text hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status selector */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-apex-muted">Status</span>
            <select
              value={app.status}
              onChange={(e) => onStatusChange(app.id, e.target.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-apex-blue cursor-pointer ${STATUS_STYLES[app.status]}`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 flex-shrink-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'text-apex-blue border-b-2 border-apex-blue'
                  : 'text-apex-muted hover:text-apex-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'cv' && (
            app.tailoredCv ? (
              <textarea
                readOnly
                value={app.tailoredCv}
                className="w-full h-full min-h-[400px] p-5 font-mono text-xs text-apex-text leading-relaxed bg-slate-50 border-0 resize-none focus:outline-none"
              />
            ) : (
              <EmptyTab
                icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                label="No tailored CV saved for this application."
                hint='Use the Tailoring Lab and click "Add to Tracker" to attach a CV.'
              />
            )
          )}

          {activeTab === 'cover' && (
            app.coverLetter ? (
              <textarea
                readOnly
                value={app.coverLetter}
                className="w-full h-full min-h-[400px] p-5 font-mono text-xs text-apex-text leading-relaxed bg-slate-50 border-0 resize-none focus:outline-none"
              />
            ) : (
              <EmptyTab
                icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                label="No cover letter saved for this application."
                hint='Use the Tailoring Lab and click "Add to Tracker" to attach a cover letter.'
              />
            )
          )}

          {activeTab === 'notes' && (
            <div className="p-5 h-full flex flex-col">
              <p className="text-xs text-apex-muted mb-3">
                Personal notes — saved automatically when you click away.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="e.g. Interview on March 15 at 10:00&#10;Contact: mario@company.com&#10;Requested: portfolio + GitHub"
                className="flex-1 w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-apex-text placeholder-slate-400 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
              />
              {savingNotes && (
                <p className="text-xs text-apex-muted mt-2 flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full border border-apex-muted border-t-transparent animate-spin" />
                  Saving…
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer — delete */}
        <div className="p-4 border-t border-slate-200 flex-shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-apex-text flex-1">Remove this application?</p>
              <button
                onClick={() => onDelete(app.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-apex-muted border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete application
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function EmptyTab({ icon, label, hint }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center">
      <svg className="w-10 h-10 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
      <p className="text-sm text-apex-muted">{label}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 max-w-xs">{hint}</p>}
    </div>
  )
}

// ── Main Tracker ──────────────────────────────────────────────────────────────
function Tracker() {
  const { applications, updateStatus, updateApplicationNotes, deleteApplication } = useUser()
  const [selected, setSelected] = useState(null)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length
    return acc
  }, {})

  const handleDelete = async (appId) => {
    await deleteApplication(appId)
    setSelected(null)
  }

  const handleStatusChange = async (appId, status) => {
    await updateStatus(appId, status)
    // Keep panel open with updated status
    setSelected((prev) => prev?.id === appId ? { ...prev, status } : prev)
  }

  const handleNotesChange = async (appId, notes) => {
    await updateApplicationNotes(appId, notes)
    setSelected((prev) => prev?.id === appId ? { ...prev, notes } : prev)
  }

  return (
    <div className="p-8 page-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Tracker</h1>
        <p className="text-slate-500 mt-1 text-sm">Monitor every application from submission to decision</p>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {STATUSES.map((status) => (
          <div key={status} className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-sm transition-all duration-150">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]} mb-3`} />
            <p className="text-3xl font-bold text-slate-900">{counts[status]}</p>
            <p className="text-sm text-slate-500 mt-0.5 font-medium">{status}</p>
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
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Position</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Company</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Location</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-left py-3.5 px-6 text-xs font-semibold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-3.5 px-6" />
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setSelected(app)}
                  className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors duration-100 ${
                    selected?.id === app.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="py-4 px-6">
                    <span className="font-semibold text-slate-800 text-sm">{app.title}</span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500">{app.company}</td>
                  <td className="py-4 px-6 text-sm text-slate-400">{app.location}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[app.status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[app.status]}`} />
                      {app.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-400">{app.appliedDate}</td>
                  <td className="py-4 px-6 text-slate-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          app={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

export default Tracker
