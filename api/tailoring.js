// /api/tailoring.js — Serverless proxy for Anthropic API (TailoringLab)
// Supports an optional `agentic: true` mode used by Alex inside the lab,
// which enables the multi-agent loop (research + document review sub-agents).
import { createClient, runAlexAgentic } from './_lib/agents.js'
import { setCorsHeaders, requireAuth } from './_lib/auth.js'
import { checkAndIncrement } from './_lib/entitlements.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const limit = await checkAndIncrement(user.id, 'tailoring')
  if (limit) return res.status(402).json(limit)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { messages, systemPrompt, stream = false, maxTokens = 4096, agentic = false } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // ── Agentic mode (Alex in the lab: orchestrator + sub-agents) ──────────────
  if (agentic && stream) {
    try {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const client = createClient(apiKey)
      const write = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
      await runAlexAgentic({
        client,
        messages,
        system: systemPrompt || 'You are Alex, an expert CV and cover letter editor.',
        maxTokens,
        write,
      })
      return res.end()
    } catch (err) {
      console.error('[Tailoring API agentic]', err)
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`)
        return res.end()
      }
      return res.status(500).json({ error: err.message || 'Failed to reach Anthropic' })
    }
  }

  // ── Plain proxy mode (generation / analysis flows) ─────────────────────────
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt || 'You are an expert career coach.',
        messages,
        stream,
      }),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      return res.status(upstream.status).json({ error: err })
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
      return res.end()
    }

    const data = await upstream.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error('[Tailoring API]', err)
    return res.status(500).json({ error: err.message || 'Failed to reach Anthropic' })
  }
}
