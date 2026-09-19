// /api/build-cv.js — Turns a short guided questionnaire into a plain-text CV
// for users who don't have one yet (onboarding "Build it with Alex" path).
import { setCorsHeaders, requireAuth } from './_lib/auth.js'
import { checkAndIncrement } from './_lib/entitlements.js'

export const config = { maxDuration: 60 }

const FIELDS = ['education', 'experience', 'projects', 'skills', 'extras']
const MAX_FIELD_CHARS = 3000

const asText = (v, max = MAX_FIELD_CHARS) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { profile = {}, answers = {} } = req.body || {}
  const clean = Object.fromEntries(FIELDS.map((f) => [f, asText(answers[f])]))

  // Need at least some substance to write a CV from
  const filled = FIELDS.filter((f) => clean[f].length > 0)
  const totalChars = filled.reduce((n, f) => n + clean[f].length, 0)
  if (filled.length < 2 || totalChars < 60) {
    return res.status(400).json({
      error: 'Tell us a bit more: fill in at least two sections.',
      code: 'not_enough_info',
    })
  }

  const limit = await checkAndIncrement(user.id, 'build-cv')
  if (limit) return res.status(402).json(limit)

  const languages = Array.isArray(profile.languages)
    ? profile.languages.filter((l) => l?.lang).map((l) => `${asText(l.lang, 40)} (${asText(l.level, 20)})`).join(', ')
    : ''
  const sectors = Array.isArray(profile.sectors) ? profile.sectors.map((s) => asText(s, 40)).join(', ') : ''

  const userMessage = `Write a CV for this person, using ONLY the information below.

CANDIDATE
Name: ${asText(profile.name, 80) || '(not provided)'}
Location: ${[asText(profile.city, 60), asText(profile.country, 60)].filter(Boolean).join(', ') || '(not provided)'}
Target sectors: ${sectors || '(not provided)'}
Languages spoken: ${languages || '(not provided)'}

WHAT THEY TOLD US
Education:
${clean.education || '(nothing)'}

Work experience / internships / volunteering:
${clean.experience || '(nothing)'}

Projects:
${clean.projects || '(nothing)'}

Skills and tools:
${clean.skills || '(nothing)'}

Anything else (certifications, awards, activities):
${clean.extras || '(nothing)'}`

  const system = `You write clear, honest, professional CVs for students and early-career candidates.

Truthfulness rules (the most important part: a CV with invented facts can hurt the candidate):
- Use ONLY facts the candidate provided. Never invent or infer employers, places, dates, grades, numbers, results, tasks, responsibilities or skills.
- Do NOT add a location to a job, school or project unless the candidate gave one. The candidate's home city is NOT the location of their jobs.
- Every bullet must restate something the candidate actually said. You may make it more concise and use a stronger verb, but you must not add tasks, tools, outcomes or adjectives ("strategic", "cross-functional", "dynamic") that were not stated. If the candidate gave one fact about a job, write one bullet.
- If a date or detail is missing, leave it out. Never write placeholders like "[insert]".
- Do not describe the candidate's personality or claim soft skills they did not state.

Format rules:
- Write in the same language the candidate used in their answers, including the section headings (Italian answers: PROFILO, ISTRUZIONE, ESPERIENZE, PROGETTI, COMPETENZE, LINGUE, ALTRE INFORMAZIONI; English answers: PROFILE, EDUCATION, EXPERIENCE, PROJECTS, SKILLS, LANGUAGES, ADDITIONAL INFORMATION).
- Output PLAIN TEXT only. No markdown symbols (no #, **, tables). Section headings in UPPERCASE on their own line. Bullet points start with "- ".
- Start with the candidate's name and their city/country if provided, then the sections in the order above, only those that have content. The profile section is at most ONE factual sentence (degree or field and target sector), or omitted.
- Target one page. Output the CV only, with no introduction or comments.`

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: AbortSignal.timeout(50000),
    })
    if (!upstream.ok) throw new Error(`Anthropic error ${upstream.status}`)

    const data = await upstream.json()
    const cv = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    if (cv.length < 80) throw new Error('Empty CV returned')

    return res.status(200).json({ cv })
  } catch (err) {
    console.error('[build-cv]', err.message)
    return res.status(502).json({ error: 'Could not generate the CV. Please try again.', code: 'generation_failed' })
  }
}
