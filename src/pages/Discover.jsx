import { useState } from 'react'
import { useUser } from '../context/UserContext'

export const JOBS = [
  {
    id: 1,
    title: 'Software Engineering Intern',
    company: 'Google',
    location: 'London, UK',
    type: 'Internship',
    sectors: ['Technology', 'Engineering'],
    keywords: ['python', 'java', 'software', 'code', 'programming', 'developer', 'engineering', 'algorithms', 'computer science', 'typescript', 'react'],
    description:
      "Join Google's engineering team to build products used by billions. Work on scalable systems and ship real product features alongside senior engineers.",
  },
  {
    id: 2,
    title: 'Investment Banking Summer Analyst',
    company: 'Goldman Sachs',
    location: 'New York, NY',
    type: 'Summer Program',
    sectors: ['Finance'],
    keywords: ['finance', 'excel', 'financial modeling', 'banking', 'economics', 'accounting', 'valuation', 'analysis', 'investment', 'm&a'],
    description:
      'Work alongside senior bankers on live M&A and capital markets transactions. 10-week structured program with mentorship and full-time conversion potential.',
  },
  {
    id: 3,
    title: 'Product Designer',
    company: 'Figma',
    location: 'Remote',
    type: 'Internship',
    sectors: ['Design'],
    keywords: ['figma', 'design', 'ux', 'ui', 'user experience', 'prototype', 'wireframe', 'sketch', 'adobe', 'product design', 'visual'],
    description:
      'Help shape the future of collaborative design. Work with product and engineering to ship UI improvements used by millions of designers worldwide.',
  },
  {
    id: 4,
    title: 'Strategy & Operations Analyst',
    company: 'McKinsey & Company',
    location: 'Milan, Italy',
    type: 'Full-time',
    sectors: ['Consulting', 'Finance'],
    keywords: ['strategy', 'consulting', 'analysis', 'powerpoint', 'excel', 'problem solving', 'management', 'operations', 'case', 'business'],
    description:
      'Solve complex business problems for global clients across industries. Fast-track career growth, world-class training, and exposure to C-suite leadership.',
  },
  {
    id: 5,
    title: 'Data Science Intern',
    company: 'Spotify',
    location: 'Stockholm, Sweden',
    type: 'Internship',
    sectors: ['Technology', 'Research'],
    keywords: ['python', 'machine learning', 'data', 'sql', 'statistics', 'pandas', 'sklearn', 'r', 'analytics', 'data science', 'ml', 'ai'],
    description:
      'Use data to improve music recommendations for 600M+ users. Work with large-scale datasets, ML pipelines, and a team that cares deeply about craft.',
  },
  {
    id: 6,
    title: 'Brand Marketing Intern',
    company: 'Nike',
    location: 'Amsterdam, Netherlands',
    type: 'Internship',
    sectors: ['Marketing'],
    keywords: ['marketing', 'brand', 'social media', 'content', 'campaign', 'advertising', 'communication', 'creative', 'digital', 'copywriting'],
    description:
      "Support brand campaigns across Europe for one of the world's most iconic sports brands. Own real projects and present to senior stakeholders.",
  },
]

function computeMatch(job, user) {
  let score = 60
  if (job.sectors.includes(user.sector)) score += 22
  const cv = (user.cvText || '').toLowerCase()
  const hits = job.keywords.filter((kw) => cv.includes(kw)).length
  score += Math.min(14, hits * 2)
  // deterministic nudge per job
  const nudge = [3, -1, 2, 0, 4, -2]
  score += nudge[(job.id - 1) % nudge.length]
  return Math.min(99, Math.max(55, score))
}

function MatchBadge({ score }) {
  const color =
    score >= 85
      ? 'bg-green-100 text-green-800'
      : score >= 70
      ? 'bg-blue-50 text-apex-blue'
      : 'bg-slate-100 text-apex-muted'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}% match
    </span>
  )
}

const TYPE_COLORS = {
  Internship: 'bg-violet-50 text-violet-700',
  'Summer Program': 'bg-amber-50 text-amber-700',
  'Full-time': 'bg-emerald-50 text-emerald-700',
}

function Discover() {
  const { user, applications, addApplication } = useUser()
  const [appliedIds, setAppliedIds] = useState(
    () => new Set(applications.map((a) => a.id))
  )

  const sortedJobs = [...JOBS]
    .map((j) => ({ ...j, score: computeMatch(j, user) }))
    .sort((a, b) => b.score - a.score)

  const handleApply = (job) => {
    addApplication(job)
    setAppliedIds((prev) => new Set([...prev, job.id]))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-apex-text">Discover</h1>
        <p className="text-apex-muted mt-1">
          {user.sector
            ? `Jobs matched to your ${user.sector} profile — sorted by fit`
            : 'Find jobs matched to your profile'}
        </p>
      </div>

      <div className="space-y-4">
        {sortedJobs.map((job) => {
          const applied = appliedIds.has(job.id)
          return (
            <div
              key={job.id}
              className="p-6 bg-white rounded-xl border border-slate-200 hover:border-apex-blue/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-apex-text">{job.title}</h3>
                    <MatchBadge score={job.score} />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[job.type] || 'bg-slate-100 text-slate-700'}`}>
                      {job.type}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-apex-muted mb-2">
                    {job.company} · {job.location}
                  </p>
                  <p className="text-sm text-apex-muted leading-relaxed">{job.description}</p>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApply(job)}
                    disabled={applied}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      applied
                        ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                        : 'text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95'
                    }`}
                  >
                    {applied ? '✓ Applied' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Discover
