// /api/alexchat.js — Alex multi-agent endpoint for the AlexChat widget
import { createAlexHandler } from './_lib/alexHandler.js'

// Sub-agent chains (web search + review) can take a while
export const config = { maxDuration: 60 }

export default createAlexHandler({ defaultMaxTokens: 1024, tag: 'AlexChat' })
