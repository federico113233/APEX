// src/lib/apiFetch.js — Authenticated fetch wrapper for /api/* calls
import { supabase } from './supabase'

export class PlanLimitError extends Error {
  constructor(action) {
    super('limit_reached')
    this.name = 'PlanLimitError'
    this.action = action
  }
}

// Drop-in replacement for fetch('/api/...') that:
//   1. Attaches the Supabase session token as Authorization: Bearer <token>
//   2. Throws PlanLimitError on HTTP 402 (free-plan limit exceeded)
export async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 402) {
    const body = await res.json().catch(() => ({}))
    throw new PlanLimitError(body.action)
  }

  return res
}
