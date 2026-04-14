// /api/score-job.js — Score a job against a candidate profile using Claude Haiku
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { jobTitle, company, jobDescription, userProfile } = req.body
  if (!jobDescription || !userProfile) {
    return res.status(400).json({ error: 'jobDescription and userProfile required' })
  }

  const userMessage = `Analyze the fit between this candidate and job.

JOB: ${jobTitle || 'Unknown'} at ${company || 'Unknown'}
DESCRIPTION: ${jobDescription.slice(0, 6000)}

CANDIDATE PROFILE:
${userProfile}

IMPORTANT: Before scoring, verify each gap you identify is genuinely missing from the candidate's CV. If a skill appears anywhere in the CV (even briefly), do not list it as a gap.

Respond with this exact JSON structure:
{
  "score": <number from 0.0 to 5.0, one decimal>,
  "verdict": "<one sentence, max 12 words, direct verdict>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>"],
  "salary_range": "<estimated range for this role in this market, or null>"
}

Rules:
- score 4.0-5.0: strong match
- score 2.5-3.9: partial match, worth considering
- score 0-2.4: weak match
- strengths: max 2 items, specific to this candidate's actual experience
- gaps: max 2 items, only real gaps not minor ones
- be direct, no generic statements
- respond in the same language as the job description`

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'You are an expert career advisor and recruiter with 15 years of experience. Analyze the fit between a candidate and a job. You have the candidate\'s FULL CV. Read it carefully before scoring — do not assume gaps if the information is present in the CV. Respond ONLY with a valid JSON object. No markdown, no text outside the JSON.',
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!upstream.ok) throw new Error(`Anthropic error ${upstream.status}`)

    const data = await upstream.json()
    const content = data.content?.[0]?.text || ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    const score = typeof parsed.score === 'number'
      ? Math.min(5, Math.max(0, Math.round(parsed.score * 10) / 10))
      : null

    if (score === null) throw new Error('Invalid score')

    return res.status(200).json({
      score,
      report: {
        verdict:      String(parsed.verdict      || ''),
        strengths:    Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 2).map(String) : [],
        gaps:         Array.isArray(parsed.gaps)      ? parsed.gaps.slice(0, 2).map(String)      : [],
        salary_range: parsed.salary_range ? String(parsed.salary_range) : null,
      },
    })
  } catch (err) {
    console.error('[score-job]', err.message)
    return res.status(200).json({ score: null, report: null })
  }
}
