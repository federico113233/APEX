export default async function handler(req, res) {
  const { country, ...params } = req.query
  const countryCode = country || 'it'
  const queryString = new URLSearchParams(params).toString()
  const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${queryString}`

  try {
    const response = await fetch(url)
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' })
  }
}
