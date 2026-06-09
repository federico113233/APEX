// api/_lib/alexHandler.js — Shared serverless handler for Alex endpoints.
// Runs the multi-agent orchestrator loop (see ./agents.js) and streams
// Anthropic-style SSE events plus custom `apex_agent` status events.

import { createClient, runAlexAgentic } from './agents.js'

export function createAlexHandler({ defaultMaxTokens, tag }) {
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

    const { messages, systemPrompt, stream = false, maxTokens = defaultMaxTokens } = req.body
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' })
    }

    const client = createClient(apiKey)
    const system = systemPrompt || 'You are Alex, an AI career advisor.'

    try {
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const write = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
        await runAlexAgentic({ client, messages, system, maxTokens, write })
        return res.end()
      }

      // Non-streaming: run the same loop, buffering text into a single response
      let text = ''
      const write = (obj) => {
        if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
          text += obj.delta.text
        }
      }
      await runAlexAgentic({ client, messages, system, maxTokens, write })
      return res.status(200).json({ content: [{ type: 'text', text }] })
    } catch (err) {
      console.error(`[${tag} API]`, err)
      if (stream && res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`)
        return res.end()
      }
      return res.status(500).json({ error: err.message || 'Failed to reach Anthropic' })
    }
  }
}
