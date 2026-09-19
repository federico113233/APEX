// /api/import-job.js — Job importer using Jina AI reader + Claude extraction
import { setCorsHeaders, requireAuth } from './_lib/auth.js'
import { checkAndIncrement } from './_lib/entitlements.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const limit = await checkAndIncrement(user.id, 'import-job')
  if (limit) return res.status(402).json(limit)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { url } = req.body
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' })

  // Infer source from URL domain
  function inferSource(u) {
    try {
      const h = new URL(u).hostname.toLowerCase()
      if (h.includes('linkedin')) return 'linkedin'
      if (h.includes('indeed')) return 'indeed'
      if (h.includes('glassdoor')) return 'glassdoor'
      if (h.includes('infojobs')) return 'infojobs'
      return 'other'
    } catch { return 'other' }
  }

  const source = inferSource(url)

  try {
    // Use Jina AI reader — returns clean text from any webpage including LinkedIn/Indeed
    const jinaUrl = 'https://r.jina.ai/' + url
    const pageRes = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'Mozilla/5.0 (compatible; ApexJobImporter/1.0)',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!pageRes.ok) throw new Error(`Jina fetch error ${pageRes.status}`)

    const text = await pageRes.text()
    const trimmed = text.trim().slice(0, 14000)

    // Call Claude to extract structured job data
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Extract the job details from this webpage text. Return ONLY a JSON object with exactly these fields: title (string), company (string), location (string), description (string — the full job description text, preserving all details about responsibilities and requirements). If you cannot find a field, use an empty string. Return nothing except the JSON object.\n\n${trimmed}`,
        }],
      }),
    })

    if (!upstream.ok) throw new Error(`Anthropic error ${upstream.status}`)

    const data = await upstream.json()
    const content = data.content?.[0]?.text || ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    return res.status(200).json({
      title:       String(parsed.title       || ''),
      company:     String(parsed.company     || ''),
      location:    String(parsed.location    || ''),
      description: String(parsed.description || ''),
      source,
    })
  } catch (err) {
    console.error('[import-job]', err.message)
    return res.status(422).json({ error: 'Could not extract job details' })
  }
}
