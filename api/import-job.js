// /api/import-job.js — Job importer with layered strategies.
//
//   POST { url }   → try, in order:
//                      1. LinkedIn public guest endpoint (LinkedIn URLs only)
//                      2. Direct fetch + schema.org JobPosting (JSON-LD) — no LLM needed
//                      3. Direct fetch, page text → Claude extraction
//                      4. Jina reader text → Claude extraction
//                    If none yields a real job posting, respond 422 { code: 'needs_paste' }
//                    so the UI can ask the user to paste the posting text.
//   POST { text, url? } → Claude extraction from text the user pasted (always works).
//
// Nothing is ever returned as a "success" unless it has a title and a real description.
import { setCorsHeaders, requireAuth } from './_lib/auth.js'
import { checkAndIncrement } from './_lib/entitlements.js'

const MIN_DESCRIPTION_CHARS = 200
const MIN_PASTED_CHARS = 80
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ── Small helpers ────────────────────────────────────────────────────────────

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

// Only public http(s) URLs: this endpoint fetches on the server's behalf.
function isSafePublicUrl(u) {
  let parsed
  try { parsed = new URL(u) } catch { return false }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  const h = parsed.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false
  }
  if (h.startsWith('[')) return false // IPv6 literals
  return true
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

// Strong signals only: normal job pages often contain "Sign in" in their nav.
function looksBlocked(text) {
  if (!text || text.trim().length < 300) return true
  return /just a moment|verify you are human|checking your browser|enable javascript and cookies|captcha|access denied|attention required/i
    .test(text.slice(0, 2500))
}

async function fetchWithTimeout(url, options = {}, ms = 9000) {
  return fetch(url, { redirect: 'follow', ...options, signal: AbortSignal.timeout(ms) })
}

// ── Strategy: schema.org JobPosting ──────────────────────────────────────────

function findJobPosting(node) {
  if (!node) return null
  if (Array.isArray(node)) {
    for (const n of node) { const f = findJobPosting(n); if (f) return f }
    return null
  }
  if (typeof node !== 'object') return null
  const type = node['@type']
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node
  if (node['@graph']) return findJobPosting(node['@graph'])
  return null
}

function extractJobPosting(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    try {
      const posting = findJobPosting(JSON.parse(m[1].trim()))
      if (!posting) continue
      const loc = [].concat(posting.jobLocation || [])[0]?.address || {}
      const location = [loc.addressLocality, loc.addressRegion, loc.addressCountry?.name || loc.addressCountry]
        .filter((x) => typeof x === 'string' && x).join(', ')
      const org = posting.hiringOrganization
      return {
        title: String(posting.title || ''),
        company: String(typeof org === 'object' ? org?.name || '' : org || ''),
        location,
        description: htmlToText(String(posting.description || '')),
      }
    } catch { /* invalid JSON-LD block: try the next one */ }
  }
  return null
}

// ── Strategy: Claude extraction from raw text ────────────────────────────────

async function extractWithClaude(apiKey, text) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Below is text taken from a web page or pasted by a user. Decide whether it is a SINGLE job posting and locate it.

Return ONLY a JSON object with exactly these fields:
- is_job_posting (boolean): false if the text is a login/verification wall, a list of many jobs, a company homepage, or anything that is not one specific job posting
- title (string)
- company (string)
- location (string)
- description_start (string): the first 8-12 words of the job description body, copied EXACTLY from the text
- description_end (string): the last 8-12 words of the WHOLE job posting (after responsibilities, requirements, benefits and salary; before any application form, cookie notice or legal boilerplate), copied EXACTLY from the text. It is NOT the end of the first paragraph or section
Use an empty string for any field you cannot find. Never invent content that is not in the text. Return nothing except the JSON object.

TEXT:
${text.slice(0, 14000)}`,
      }],
    }),
    signal: AbortSignal.timeout(25000),
  })
  if (!upstream.ok) throw new Error(`Anthropic error ${upstream.status}`)

  const data = await upstream.json()
  const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  const parsed = JSON.parse(match[0])
  if (parsed.is_job_posting === false) return null

  // Cut the description out of the original text instead of asking the model to rewrite it
  // (rewriting thousands of characters is slow and can drift from the original wording).
  const body = text.slice(0, 14000)
  const start = String(parsed.description_start || '').trim()
  const end = String(parsed.description_end || '').trim()
  const from = start ? Math.max(body.indexOf(start), 0) : 0
  const endAt = end ? body.lastIndexOf(end) : -1
  // Trust the end marker only if it keeps most of the text: models sometimes pick the end of the
  // first paragraph, which would silently truncate the posting. Trailing boilerplate is harmless.
  const candidateTo = endAt > from ? endAt + end.length : body.length
  const to = (candidateTo - from) >= 0.6 * (body.length - from) ? candidateTo : body.length
  return {
    title: String(parsed.title || ''),
    company: String(parsed.company || ''),
    location: String(parsed.location || ''),
    description: cutBoilerplate(body.slice(from, to)).trim(),
  }
}

// Application forms, cookie notices and legal text that often follow the posting on the page.
const BOILERPLATE_START = /apply for this job|submit application|first name\s*\*|autofill with|resume\/cv|powered by greenhouse|we use cookies|accept all cookies|privacy (policy|notice)/i

// Only looks in the second part of the text, so a phrase inside the real description is never cut.
function cutBoilerplate(text) {
  if (text.length < 2500) return text
  const searchFrom = Math.max(1500, Math.floor(text.length * 0.4))
  const m = text.slice(searchFrom).match(BOILERPLATE_START)
  const cut = m ? searchFrom + m.index : text.length
  return text.slice(0, Math.min(cut, 12000))
}

function isValidJob(job) {
  return !!job && job.title.trim().length > 0 && job.description.trim().length >= MIN_DESCRIPTION_CHARS
}

// ── Fetching strategies ──────────────────────────────────────────────────────

// LinkedIn exposes a public, login-free page for a single posting id.
async function fetchLinkedInGuest(url) {
  const id = url.match(/jobs\/view\/(?:[^/?]*-)?(\d{6,})/)?.[1] ||
             url.match(/[?&]currentJobId=(\d{6,})/)?.[1]
  if (!id) return null
  const res = await fetchWithTimeout(
    `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
    { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en,it;q=0.8' } },
    8000,
  )
  if (!res.ok) return null
  return htmlToText(await res.text())
}

async function fetchDirectHtml(url) {
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en,it;q=0.8' } },
    9000,
  )
  if (!res.ok) return null
  const type = res.headers.get('content-type') || ''
  if (!type.includes('html')) return null
  return res.text()
}

async function fetchViaJina(url) {
  const headers = { Accept: 'text/plain' }
  if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
  const res = await fetchWithTimeout('https://r.jina.ai/' + url, { headers }, 15000)
  if (!res.ok) return null
  return res.text()
}

// Runs a strategy, treating any failure as "this strategy did not work".
async function attempt(label, fn) {
  try { return await fn() } catch (err) {
    console.warn(`[import-job] ${label} failed:`, err.message)
    return null
  }
}

async function importFromUrl(apiKey, url) {
  // 1. LinkedIn guest page
  if (inferSource(url) === 'linkedin') {
    const text = await attempt('linkedin-guest', () => fetchLinkedInGuest(url))
    if (text && !looksBlocked(text)) {
      const job = await attempt('linkedin-guest/claude', () => extractWithClaude(apiKey, text))
      if (isValidJob(job)) return { job, via: 'linkedin-guest' }
    }
  }

  // 2 + 3. Direct fetch: structured data first, then page text
  const html = await attempt('direct-fetch', () => fetchDirectHtml(url))
  if (html) {
    const structured = extractJobPosting(html)
    if (isValidJob(structured)) return { job: structured, via: 'json-ld' }

    const text = htmlToText(html)
    if (!looksBlocked(text)) {
      const job = await attempt('direct/claude', () => extractWithClaude(apiKey, text))
      if (isValidJob(job)) return { job, via: 'direct-text' }
    }
  }

  // 4. Jina reader (renders JavaScript pages)
  const jinaText = await attempt('jina', () => fetchViaJina(url))
  if (jinaText && !looksBlocked(jinaText)) {
    const job = await attempt('jina/claude', () => extractWithClaude(apiKey, jinaText))
    if (isValidJob(job)) return { job, via: 'jina' }
  }

  return null
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { url, text } = req.body || {}
  const pasted = typeof text === 'string' ? text.trim() : ''
  const cleanUrl = typeof url === 'string' ? url.trim() : ''

  if (!pasted && !cleanUrl) return res.status(400).json({ error: 'url or text required' })
  if (pasted && pasted.length < MIN_PASTED_CHARS) {
    return res.status(400).json({ error: 'Pasted text is too short to be a job posting', code: 'text_too_short' })
  }
  if (!pasted && !isSafePublicUrl(cleanUrl)) {
    return res.status(400).json({ error: 'Invalid URL', code: 'invalid_url' })
  }

  const limit = await checkAndIncrement(user.id, 'import-job')
  if (limit) return res.status(402).json(limit)

  const source = cleanUrl ? inferSource(cleanUrl) : 'other'

  try {
    let result
    if (pasted) {
      const job = await extractWithClaude(apiKey, pasted)
      result = isValidJob(job) ? { job, via: 'pasted' } : null
    } else {
      result = await importFromUrl(apiKey, cleanUrl)
    }

    if (!result) {
      return res.status(422).json({
        error: pasted
          ? "That text doesn't look like a single job posting."
          : "This site doesn't let us read the page automatically.",
        code: 'needs_paste',
        source,
      })
    }

    console.log(`[import-job] ok via=${result.via} source=${source}`)
    return res.status(200).json({ ...result.job, source, via: result.via })
  } catch (err) {
    console.error('[import-job]', err.message)
    return res.status(422).json({ error: 'Could not extract job details', code: 'needs_paste', source })
  }
}
