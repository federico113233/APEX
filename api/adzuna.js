export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  // req.url is the original request URL (Vercel preserves it through rewrites)
  // e.g. /api/adzuna/v1/api/jobs/gb/search/1?app_id=...&app_key=...
  const path = req.url.replace(/^\/api\/adzuna/, '')

  if (!path) {
    return res.status(400).json({ error: 'Missing Adzuna path' })
  }

  const url = `https://api.adzuna.com${path}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      const text = await response.text()
      console.error('[adzuna] upstream error', response.status, text.slice(0, 300))
      return res.status(response.status).json({
        error: `Adzuna returned ${response.status}`,
        detail: text.slice(0, 300),
      })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('[adzuna] handler error', error)
    return res.status(500).json({ error: 'Failed to fetch jobs', detail: error.message })
  }
}
