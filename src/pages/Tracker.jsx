const mockApplications = [
  { id: 1, title: 'Software Engineering Intern', company: 'TechCorp', status: 'Interview', date: 'Mar 5' },
  { id: 2, title: 'Data Analyst Program', company: 'DataFlow Inc', status: 'Applied', date: 'Mar 3' },
  { id: 3, title: 'Product Design Intern', company: 'Design Studio', status: 'Rejected', date: 'Feb 28' },
  { id: 4, title: 'Marketing Intern', company: 'Growth Labs', status: 'Offer', date: 'Mar 1' },
]

const statusColors = {
  Applied: 'bg-slate-100 text-slate-700',
  Interview: 'bg-apex-cyan/20 text-apex-blue',
  Offer: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-50 text-red-700',
}

function Tracker() {
  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-apex-text">Tracker</h1>
        <p className="text-apex-muted mt-1">Monitor your job applications</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left py-4 px-6 text-sm font-medium text-apex-muted">Position</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-apex-muted">Company</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-apex-muted">Status</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-apex-muted">Date</th>
            </tr>
          </thead>
          <tbody>
            {mockApplications.map((app) => (
              <tr key={app.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-6">
                  <span className="font-medium text-apex-text">{app.title}</span>
                </td>
                <td className="py-4 px-6 text-apex-muted">{app.company}</td>
                <td className="py-4 px-6">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status]}`}>
                    {app.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-apex-muted text-sm">{app.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Tracker
