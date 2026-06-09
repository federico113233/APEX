// /api/interview.js — Voice Interview Studio endpoint
//
// Actions:
//   prep     → Research Agent briefing on the company's interview process (non-streaming)
//   turn     → one Interviewer Agent turn (streaming SSE, low latency)
//   feedback → Feedback Agent structured report on the transcript (non-streaming)

import { createClient, runResearchAgent } from './_lib/agents.js'
import { buildInterviewerSystem, runFeedbackAgent, INTERVIEWER_MODEL } from './_lib/interviewAgent.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { action } = req.body || {}
  const client = createClient(apiKey)

  try {
    // ── prep: company interview research ────────────────────────────────────
    if (action === 'prep') {
      const { company, role } = req.body
      if (!company) return res.status(400).json({ error: 'company required' })

      // Research is nice-to-have: never let it block the interview. Hard cap
      // at 25s — on timeout the interviewer works from the job description.
      const started = Date.now()
      const research = await Promise.race([
        runResearchAgent(client, {
          company,
          focus: `Interview process for "${role || 'entry-level roles'}": typical rounds, interview style, real questions candidates report being asked, what the company values in candidates. Also 2-3 key recent facts about the company.`,
        }).catch((err) => {
          console.error('[Interview API] prep research failed:', err.message)
          return ''
        }),
        new Promise((resolve) => setTimeout(() => resolve(''), 25_000)),
      ])
      console.log(`[Interview API] prep done in ${((Date.now() - started) / 1000).toFixed(1)}s (${research ? 'with' : 'without'} research)`)
      return res.status(200).json({ research })
    }

    // ── turn: one interviewer reply (streaming) ─────────────────────────────
    if (action === 'turn') {
      const { context, messages } = req.body
      if (!context || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'context and messages required' })
      }

      const system = buildInterviewerSystem(context)

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const stream = client.messages.stream({
        model: INTERVIEWER_MODEL,
        max_tokens: 300, // voice turns are short by design
        // Cache the big static prefix (CV + JD + research + rules) across turns
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
        // Low effort → fastest first token; ideal for short conversational turns
        output_config: { effort: 'low' },
      })

      stream.on('text', (delta) => {
        res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: delta } })}\n\n`)
      })

      await stream.finalMessage()
      return res.end()
    }

    // ── feedback: post-session coaching report ──────────────────────────────
    if (action === 'feedback') {
      const { transcript, job, cvText, type, language } = req.body
      if (!Array.isArray(transcript) || transcript.length === 0) {
        return res.status(400).json({ error: 'transcript required' })
      }

      const report = await Promise.race([
        runFeedbackAgent(client, { transcript, job: job || {}, cvText, type, language }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('feedback timed out')), 55_000)),
      ])
      return res.status(200).json({ report })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('[Interview API]', err)
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: { message: err.message } })}\n\n`)
      return res.end()
    }
    return res.status(500).json({ error: err.message || 'Failed to reach Anthropic' })
  }
}
