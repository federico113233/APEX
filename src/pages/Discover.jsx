const mockJobs = [
  { id: 1, title: 'Software Engineering Intern', company: 'TechCorp', location: 'Remote', match: 94 },
  { id: 2, title: 'Data Analyst Summer Program', company: 'DataFlow Inc', location: 'New York, NY', match: 89 },
  { id: 3, title: 'Product Design Internship', company: 'Design Studio', location: 'San Francisco, CA', match: 76 },
  { id: 4, title: 'Marketing Intern', company: 'Growth Labs', location: 'London, UK', match: 72 },
  { id: 5, title: 'Research Assistant', company: 'Uni Labs', location: 'Cambridge', match: 91 },
]

function MatchBadge({ score }) {
  const color = score >= 85 ? 'bg-green-100 text-green-800' : score >= 70 ? 'bg-apex-cyan/20 text-apex-blue' : 'bg-slate-100 text-apex-muted'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {score}% match
    </span>
  )
}

function Discover() {
  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-apex-text">Discover</h1>
        <p className="text-apex-muted mt-1">Find jobs matched to your profile</p>
      </div>

      <div className="space-y-4">
        {mockJobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-6 bg-white rounded-xl border border-slate-200 hover:border-apex-blue/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-apex-text">{job.title}</h3>
                <MatchBadge score={job.match} />
              </div>
              <p className="text-sm text-apex-muted">{job.company} · {job.location}</p>
            </div>
            <button className="ml-4 px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity flex-shrink-0">
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Discover
