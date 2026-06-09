// /api/alex.js — Alex multi-agent endpoint (orchestrator + research/review sub-agents)
import { createAlexHandler } from './_lib/alexHandler.js'

// Sub-agent chains (web search + review) can take a while
export const config = { maxDuration: 60 }

export default createAlexHandler({ defaultMaxTokens: 2048, tag: 'Alex' })
