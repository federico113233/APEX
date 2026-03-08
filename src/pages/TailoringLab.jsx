import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

// ─── Skill extraction from free-text description ──────────────────────────
const KNOWN_SKILLS = [
  'python', 'javascript', 'typescript', 'react', 'java', 'sql', 'excel',
  'powerpoint', 'figma', 'machine learning', 'data analysis', 'leadership',
  'project management', 'agile', 'aws', 'communication', 'finance', 'marketing',
  'research', 'design', 'analytics', 'c++', 'node.js', 'tableau', 'r', 'matlab',
  'tensorflow', 'pandas', 'consulting', 'strategy', 'operations', 'ux', 'ui',
  'product management', 'git', 'docker', 'kubernetes', 'scala', 'go', 'rust',
]

function extractSkills(description = '', max = 6) {
  const lower = description.toLowerCase()
  const found = KNOWN_SKILLS.filter((s) => lower.includes(s))
  return found.length ? found.slice(0, max) : ['analysis', 'communication', 'excel', 'teamwork', 'research', 'organisation']
}

// ─── Document generators ──────────────────────────────────────────────────
function generateCV(user, job) {
  const name = user.name || 'Your Name'
  const country = user.country || 'your country'
  const sector = user.sector || 'professional'
  const skills = job.keywords?.slice(0, 6) ?? extractSkills(job.description)
  const slug = name.toLowerCase().replace(/\s+/g, '-')

  return `${name.toUpperCase()}
${country}  ·  linkedin.com/in/${slug}  ·  your@email.com

──────────────────────────────────────────────────

PROFESSIONAL SUMMARY
Motivated ${sector} professional with a strong foundation in ${skills.slice(0, 3).join(', ')}, seeking the ${job.title} role at ${job.company}. Proven ability to deliver high-impact work in collaborative environments, with a track record of taking ownership and driving results. Eager to contribute to ${job.company}'s mission and grow within a world-class team.

──────────────────────────────────────────────────

EDUCATION
BSc ${sector === 'Technology' ? 'Computer Science' : sector === 'Finance' ? 'Economics & Finance' : sector}
University of [Name]  ·  Expected 2025  ·  GPA: 3.8 / 4.0
Relevant coursework: ${skills.slice(2, 5).join(', ')}

──────────────────────────────────────────────────

EXPERIENCE

${sector} Analyst Intern — [Previous Company], ${country}
Jun 2024 – Sep 2024
• Delivered [key project] improving team efficiency by 25%, working cross-functionally with 3 departments
• Analysed datasets of 50k+ records using ${skills[0]} and ${skills[1] || 'relevant tools'}, presenting insights to senior management
• Reduced reporting turnaround by 18% through workflow automation and process documentation

Project Lead — [University Name]
Oct 2023 – May 2024
• Led a team of 4 to build a ${skills[0]}-based solution adopted by 200+ students
• Presented findings at faculty showcase and awarded Best Project in ${sector}
• Coordinated stakeholder interviews, sprint planning, and final delivery under tight deadlines

──────────────────────────────────────────────────

SKILLS
Technical:  ${skills.join('  ·  ')}
Languages:  English (fluent)${country === 'Italy' ? '  ·  Italian (native)' : ''}
Tools:      Microsoft Office  ·  Google Workspace  ·  Notion  ·  Slack

──────────────────────────────────────────────────

ACHIEVEMENTS & ACTIVITIES
• ${job.company} Virtual Experience Programme — Top 10% of global participants (2024)
• Hackathon Winner — [Event Name], ${country}, 2024
• ${sector} Society, Committee Member — Organised 3 events, 100+ attendees`
}

function generateCoverLetter(user, job) {
  const name = user.name || 'Your Name'
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const skills = job.keywords?.slice(0, 3) ?? extractSkills(job.description, 3)
  const descriptionSnippet = job.description
    ? job.description.split('.')[0].toLowerCase()
    : `${job.title} excellence`

  return `${name}
${user.country || 'your country'}  ·  your@email.com

${today}

Hiring Team
${job.title}
${job.company}${job.location ? ` — ${job.location}` : ''}

──────────────────────────────────────────────────

Dear Hiring Manager,

I am writing to express my strong interest in the ${job.title} position at ${job.company}. Having closely followed ${job.company}'s work — in particular its focus on ${descriptionSnippet} — I am genuinely excited about the opportunity to contribute my skills in ${skills.join(', ')} to your team.

During my internship at [Previous Company], I gained hands-on experience with ${skills[0]} and ${skills[1] || 'related tools'}, delivering a project that improved team efficiency by 25%. I am someone who takes ownership from day one, works well in cross-functional teams, and is not afraid to ask the right questions. These qualities, combined with my deep interest in ${user.sector || job.title.split(' ')[0]}, make me confident I can add real value at ${job.company} from the very start.

I would welcome the chance to discuss how my background and drive align with what your team is building. I am available for an interview at your convenience and look forward to hearing from you.

Warm regards,
${name}`
}

// ─── Main component ───────────────────────────────────────────────────────
export default function TailoringLab() {
  const { user } = useUser()
  const location = useLocation()
  const navigate = useNavigate()

  // Job pre-selected from Discover via navigate state
  const incomingJob = location.state?.job ?? null

  const [selectedJob, setSelectedJob] = useState(incomingJob)
  const [activeTab, setActiveTab] = useState('cv')
  const [generated, setGenerated] = useState(null)
  const [loading, setLoading] = useState(false)

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
    }, 1400)
  }

  const handleClear = () => {
    setSelectedJob(null)
    setGenerated(null)
    // Clear navigation state so Back doesn't re-inject the job
    navigate('/dashboard/tailoring-lab', { replace: true, state: {} })
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-apex-text">Tailoring Lab</h1>
        <p className="text-apex-muted mt-1">
          Generate a tailored CV and cover letter for any job in seconds
        </p>
      </div>

      {/* Job selection panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        {selectedJob ? (
          /* Pre-selected job info */
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-apex-blue bg-blue-50 px-2 py-0.5 rounded-full">
                    ✦ Selected job
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-apex-text">{selectedJob.title}</h2>
                <p className="text-sm text-apex-muted mt-0.5">
                  {selectedJob.company}
                  {selectedJob.location ? ` · ${selectedJob.location}` : ''}
                  {selectedJob.type ? ` · ${selectedJob.type}` : ''}
                  {selectedJob.salary ? ` · ${selectedJob.salary}` : ''}
                </p>
                {selectedJob.description && (
                  <p className="text-sm text-apex-muted mt-3 leading-relaxed line-clamp-3">
                    {selectedJob.description}
                  </p>
                )}
              </div>
              <button
                onClick={handleClear}
                className="text-xs text-apex-muted hover:text-apex-text border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
              >
                Change job
              </button>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center gap-2"
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
                  '✦ Generate tailored documents'
                )}
              </button>
              {selectedJob.url && (
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-apex-text hover:bg-slate-50 transition-colors"
                >
                  View original listing ↗
                </a>
              )}
            </div>
          </div>
        ) : (
          /* No job selected — prompt to go to Discover */
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-apex-blue to-apex-cyan flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-apex-text mb-1">No job selected</h3>
            <p className="text-sm text-apex-muted mb-5">
              Go to Discover, find a job you like, and click{' '}
              <span className="font-medium text-apex-blue">✦ Tailor Application</span>.
            </p>
            <button
              onClick={() => navigate('/dashboard/discover')}
              className="px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity text-sm"
            >
              Browse jobs →
            </button>
          </div>
        )}
      </div>

      {/* Generated documents */}
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
                onClick={() =>
                  navigator.clipboard?.writeText(activeTab === 'cv' ? generated.cv : generated.cover)
                }
                className="text-xs text-apex-blue hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm text-apex-text leading-relaxed bg-slate-50 rounded-lg p-5 border border-slate-100 overflow-auto max-h-[540px]">
              {activeTab === 'cv' ? generated.cv : generated.cover}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
