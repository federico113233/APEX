// api/_lib/agents.js — Multi-agent intelligence for Alex
//
// Alex is an orchestrator (the career advisor) that delegates to two specialist
// sub-agents via tool use:
//   - research_company  → Company Research Agent (web search, up-to-date sources)
//   - review_document   → Document Quality Agent (CV / cover letter specialist)
//
// The agentic loop runs server-side. Text deltas and custom `apex_agent` status
// events are forwarded to the client over SSE.

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'       // orchestrator (Alex)
const FAST_MODEL = 'claude-haiku-4-5'   // sub-agents — much lower latency
const MAX_ORCHESTRATOR_TURNS = 6
const MAX_PAUSE_CONTINUATIONS = 4

export function createClient(apiKey) {
  return new Anthropic({ apiKey })
}

// ── Sub-agent: Company Research ───────────────────────────────────────────────

const RESEARCH_SYSTEM = `You are the Company Research Agent inside APEX, a job application platform for students. You work for Alex, the lead career advisor, who delegates company research to you.

Your job: find up-to-date, reliable information about a specific company using web search.

RULES:
- Prioritize trustworthy sources: the company's official site and newsroom, reputable business press, recent reviews from credible platforms. Prefer information from the last 12 months.
- Cover what is relevant to the research focus: what the company does, recent news (funding, layoffs, product launches, leadership changes), culture and values signals, hiring activity, and interview process if asked.
- Be fast: one or two well-targeted searches are enough. Do not search exhaustively.
- Return a tight briefing (max ~180 words) as short bullet points.
- Attribute key facts inline, e.g. "(source: reuters.com, Mar 2026)".
- If you cannot verify something, say so explicitly. NEVER invent facts — Alex will pass your briefing to a real job seeker.`

export async function runResearchAgent(client, { company, focus }) {
  const baseParams = {
    model: FAST_MODEL,
    max_tokens: 800,
    system: RESEARCH_SYSTEM,
    // Haiku uses the non-dynamic-filtering web search version
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
  }

  let messages = [{
    role: 'user',
    content: `Company: ${company}\nResearch focus: ${focus || 'General overview — recent news, what they do, culture, and hiring signals.'}`,
  }]

  let response = await client.messages.create({ ...baseParams, messages })

  // Server-side web search can pause the turn — resume until done
  let continuations = 0
  while (response.stop_reason === 'pause_turn' && continuations < MAX_PAUSE_CONTINUATIONS) {
    messages = [...messages, { role: 'assistant', content: response.content }]
    response = await client.messages.create({ ...baseParams, messages })
    continuations++
  }

  return extractText(response)
}

// ── Sub-agent: Document Quality (CV / cover letter) ───────────────────────────

const REVIEW_SYSTEM = `You are the Document Quality Agent inside APEX, a job application platform for students. You work for Alex, the lead career advisor, who delegates CV and cover letter reviews to you.

You are a senior recruiter and ATS expert. Evaluate the document on:
1. Structure & readability — sections, ordering, scannability
2. Impact — quantified achievements vs. duty-listing, strong action verbs
3. Relevance & keyword match — alignment with the job description (ATS perspective), if provided
4. Tone & professionalism — appropriate for the role and seniority
5. Red flags — gaps, vagueness, clichés, typos, length problems

Return, in this order:
- **Score**: an honest overall score out of 100
- **Strengths**: the 2-3 strongest points
- **Issues**: problems ordered by severity, each with a concrete, line-level fix
- **Verdict**: one sentence on whether it is ready to send for this role

Keep it under ~250 words. Be honest and specific — vague praise helps no one.`

export async function runReviewAgent(client, { docType, document, jobDescription }) {
  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 1000,
    system: REVIEW_SYSTEM,
    messages: [{
      role: 'user',
      content: `Document type: ${docType === 'cover_letter' ? 'Cover Letter' : 'CV'}\n\nDocument:\n${document}\n\nJob description:\n${jobDescription || 'Not provided — evaluate on general quality.'}`,
    }],
  })
  return extractText(response)
}

// ── Orchestrator tool definitions ─────────────────────────────────────────────

export const ALEX_TOOLS = [
  {
    name: 'research_company',
    description:
      'Delegate to your Company Research Agent, which searches the web for up-to-date, reliable information about a company. Call this when current company facts would genuinely change your advice — e.g. interview prep for a specific company, questions about its culture, news, products, or hiring. Do NOT call it for passing mentions of a company (application status updates, general career questions) — research takes time, so use it only when it adds real value.',
    input_schema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Company name to research' },
        focus: { type: 'string', description: 'What the research should focus on, e.g. "interview process for graduate engineers" or "recent news and culture"' },
      },
      required: ['company'],
    },
  },
  {
    name: 'review_document',
    description:
      'Delegate to your Document Quality Agent, a senior recruiter specialized in CV and cover letter quality. Call this when the user asks for feedback on their CV or cover letter, or before giving advice that depends on how strong their documents are. Pass the full document text (use the CV from the user profile if that is what is being reviewed).',
    input_schema: {
      type: 'object',
      properties: {
        doc_type: { type: 'string', enum: ['cv', 'cover_letter'], description: 'Type of document being reviewed' },
        document: { type: 'string', description: 'Full text of the document to review' },
        job_description: { type: 'string', description: 'Job description to evaluate the document against (optional but strongly recommended)' },
      },
      required: ['doc_type', 'document'],
    },
  },
]

const AGENT_LABELS = {
  research_company: 'research',
  review_document: 'review',
}

// ── Orchestrator agentic loop (streaming) ─────────────────────────────────────

/**
 * Runs Alex as an orchestrator with sub-agent tools, streaming text deltas and
 * custom `apex_agent` status events through `write(obj)`.
 */
export async function runAlexAgentic({ client, messages, system, maxTokens, write }) {
  const convo = [...messages]

  for (let turn = 0; turn < MAX_ORCHESTRATOR_TURNS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: convo,
      tools: ALEX_TOOLS,
      // Sonnet 4.6 defaults to effort "high"; medium is noticeably faster
      // with consolidated tool calls and less preamble — right for chat advice
      output_config: { effort: 'medium' },
    })

    stream.on('text', (delta) => {
      write({ type: 'content_block_delta', delta: { type: 'text_delta', text: delta } })
    })

    const message = await stream.finalMessage()

    if (message.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content: message.content })
      continue
    }

    if (message.stop_reason !== 'tool_use') return message

    convo.push({ role: 'assistant', content: message.content })

    const toolUses = message.content.filter((b) => b.type === 'tool_use')

    // Run sub-agents in parallel — if Alex asks for research AND a review,
    // they don't need to wait on each other
    const results = await Promise.all(toolUses.map(async (tu) => {
      const agent = AGENT_LABELS[tu.name] || tu.name
      write({
        type: 'apex_agent',
        agent,
        status: 'start',
        company: tu.input?.company,
        docType: tu.input?.doc_type,
      })

      let resultText
      try {
        if (tu.name === 'research_company') {
          resultText = await runResearchAgent(client, tu.input)
        } else if (tu.name === 'review_document') {
          resultText = await runReviewAgent(client, {
            docType: tu.input.doc_type,
            document: tu.input.document,
            jobDescription: tu.input.job_description,
          })
        } else {
          resultText = `Unknown tool: ${tu.name}`
        }
      } catch (err) {
        console.error(`[Alex agents] ${tu.name} failed:`, err)
        resultText = `The ${agent} agent failed (${err.message}). Continue without this information and let the user know if it matters.`
      }

      write({ type: 'apex_agent', agent, status: 'done' })
      return { type: 'tool_result', tool_use_id: tu.id, content: resultText }
    }))

    convo.push({ role: 'user', content: results })
  }

  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(response) {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}
