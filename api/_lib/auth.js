// api/_lib/auth.js — Shared CORS + Supabase JWT verification helpers
import { createClient } from '@supabase/supabase-js'

export function setCorsHeaders(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN
  const origin = req.headers['origin'] || ''

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin === allowed ? origin : allowed)
  } else {
    // Dev fallback: allow any localhost origin
    res.setHeader('Access-Control-Allow-Origin', /^https?:\/\/localhost/.test(origin) ? origin : '*')
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
}

let _adminClient = null
function getAdminClient() {
  if (_adminClient) return _adminClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured')
  _adminClient = createClient(url, key, { auth: { persistSession: false } })
  return _adminClient
}

// Verifies the Bearer token from the Authorization header.
// Returns the Supabase user object on success, or sends 401 and returns null.
export async function requireAuth(req, res) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  try {
    const { data: { user }, error } = await getAdminClient().auth.getUser(token)
    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized' })
      return null
    }
    return user
  } catch (err) {
    console.error('[auth]', err.message)
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
}
