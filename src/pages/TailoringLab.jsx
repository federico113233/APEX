import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { JOBS } from './Discover'

function generateCV(user, job) {
  const name = user.name || 'Your Name'
  const country = user.country || 'your country'
  return `${name.toUpperCase()}
${country} · linkedin.com/in/${name.toLowerCase().replace(/\s/g, '-')} · your@email.com

─────────────────────────────────────────────

PROFESSIONAL SUMMARY
Results-driven ${user.sector || 'professional'} with hands-on experience in ${job.keywords.slice(0, 3).join(', ')} seeking the ${job.title} role at ${job.company}. Passionate about delivering high-impact work and growing within a world-class team. Proven ability to adapt quickly, collaborate cross-functionally, and ship work that matters.

─────────────────────────────────────────────

EDUCATION
BSc ${user.sector || 'Computer Science'} — University Name
Expected Graduation: 2025 | GPA: 3.8 / 4.0
Relevant coursework: ${job.keywords.slice(3, 6).join(', ')}

─────────────────────────────────────────────

EXPERIENCE

${job.sectors[0]} Analyst Intern — Previous Company, ${country}
Jun 2024 – Sep 2024
• Delivered [key project] that improved team efficiency by 25%, collaborating with 3 cross-functional stakeholders
• Analysed datasets of 50k+ records using ${job.keywords[0]} and ${job.keywords[1] || 'relevant tools'}, presenting findings to senior management
• Reduced process turnaround time by 18% through automation of reporting workflows

University Project Lead — [University Name]
Oct 2023 – May 2024
• Led a team of 4 to build a ${job.keywords[0]}-based tool used by 200+ students
• Presented results at faculty showcase; awarded Best Project in ${user.sector || 'department'}

─────────────────────────────────────────────

SKILLS
Technical: ${job.keywords.slice(0, 5).join(', ')}
Languages: English (fluent), ${country === 'Italy' ? 'Italian (native)' : 'native language (native)'}
Tools: Microsoft Office, Google Workspace, Notion

─────────────────────────────────────────────

ACHIEVEMENTS & ACTIVITIES
• ${job.company} Virtual Experience Program — Top 10% of participants
• Hackathon Winner — [Event Name], ${country}, 2024
• Student ${user.sector || 'Society'} Committee — Organised 3 events for 100+ attendees`
}

function generateCoverLetter(user, job) {
  const name = user.name || 'Your Name'
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${name}
${user.country || 'your country'} · your@email.com

${today}

Hiring Team
${job.title} — ${job.company}
${job.location}

─────────────────────────────────────────────

Dear Hiring Manager,

I am writing to apply for the ${job.title} position at ${job.company}. Having closely followed ${job.company}'s work — particularly its impact on ${job.description.split('.')[0].toLowerCase()} — I am eager to contribute my skills in ${job.keywords.slice(0, 3).join(', ')} to your team.

During my time as an intern at [Previous Company], I gained direct experience with ${job.keywords[0]} and ${job.keywords[1] || 'relevant technologies'}, delivering projects that improved team efficiency by 25%. I thrive in environments where precision, creativity, and collaboration intersect — which is exactly what ${job.company}'s culture embodies. I am particularly drawn to this role because it sits at the intersection of ${job.sectors.join(' and ')}, an area I have been developing expertise in throughout my academic and professional journey.

I would be excited to bring my drive, attention to detail, and genuine passion for ${user.sector || job.sectors[0]} to the ${job.company} team. I am available for an interview at your convenience and look forward to the opportunity to discuss how I can contribute.

Warm regards,
${name}`
}

export default function TailoringLab() {
  const { user } = useUser()
  const [selectedJobId, setSelectedJobId] = useState('')
  const [activeTab, setActiveTab] = useState('cv')
  const [generated, setGenerated] = useState(null)
  const [loading, setLoading] = useState(false)

  const selectedJob = JOBS.find((j) => j.id === Number(selectedJobId))

  const handleGenerate = () => {
    if (!selectedJob) return
    setLoading(true)
    setGenerated(null)
    setTimeout(() => {
      setGenerated({
        cv: generateCV(user, selectedJob),
        cover: generateCoverLetter(user, selectedJob),
      })
      setLoading(false)
    }, 1200)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-apex-text">Tailoring Lab</h1>
        <p className="text-apex-muted mt-1">
          Select a job and let APEX generate a tailored CV and cover letter
        </p>
      </div>

      {/* Job selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <label className="block text-sm font-medium text-apex-text mb-2">
          Select a job to tailor for
        </label>
        <div className="flex gap-3">
          <select
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value)
              setGenerated(null)
            }}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-apex-text bg-white focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent"
          >
            <option value="">Choose a job listing…</option>
            {JOBS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} — {j.company}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!selectedJobId || loading}
            className="px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </>
            ) : (
              '✦ Generate'
            )}
          </button>
        </div>

        {selectedJob && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-sm font-medium text-apex-text">
              {selectedJob.title} · {selectedJob.company}
            </p>
            <p className="text-xs text-apex-muted mt-0.5">{selectedJob.location} · {selectedJob.type}</p>
            <p className="text-sm text-apex-muted mt-2 leading-relaxed">{selectedJob.description}</p>
          </div>
        )}
      </div>

      {/* Generated output */}
      {generated && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            {[
              { key: 'cv', label: 'Tailored CV' },
              { key: 'cover', label: 'Cover Letter' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'text-apex-blue border-b-2 border-apex-blue'
                    : 'text-apex-muted hover:text-apex-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-apex-muted flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                Tailored for {selectedJob.title} at {selectedJob.company}
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(activeTab === 'cv' ? generated.cv : generated.cover)}
                className="text-xs text-apex-blue hover:underline"
              >
                Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm text-apex-text leading-relaxed bg-slate-50 rounded-lg p-5 border border-slate-100 overflow-auto max-h-[520px]">
              {activeTab === 'cv' ? generated.cv : generated.cover}
            </pre>
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="text-center py-16 text-apex-muted">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Select a job above and click Generate to see your tailored documents</p>
        </div>
      )}
    </div>
  )
}
