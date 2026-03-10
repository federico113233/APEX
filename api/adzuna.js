export default async function handler(req, res) {
  // req.url: /api/adzuna/v1/api/jobs/{country}/search/1?params
  const path = req.url.replace(/^\/api\/adzuna/, '')
  const url = `https://api.adzuna.com${path}`

  try {
    const response = await fetch(url)
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' })
  }
}
