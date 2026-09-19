// api/_lib/entitlements.js — Free-plan usage limits and enforcement
import { createClient } from '@supabase/supabase-js'

// Monthly action limits for free-plan users.
// 'pro' and 'admin' have no limits.
export const FREE_LIMITS = {
  tailoring:    10,
  interview:     3,
  alex:         20,
  'score-job':  50,
  'import-job': 20,
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

// Checks whether the user has capacity for one more `action` this month.
// If yes, increments the counter and returns null.
// If no, returns { error: 'limit_reached', action }.
export async function checkAndIncrement(userId, action) {
  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  const plan = profile?.plan || 'free'
  if (plan === 'pro' || plan === 'admin') return null

  const limit = FREE_LIMITS[action]
  if (limit === undefined) return null

  const month = new Date().toISOString().slice(0, 7) // "2026-09"

  const { data: usage } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('month', month)
    .maybeSingle()

  const current = usage?.count || 0
  if (current >= limit) return { error: 'limit_reached', action }

  await supabase
    .from('usage')
    .upsert(
      { user_id: userId, action, month, count: current + 1 },
      { onConflict: 'user_id,action,month' }
    )

  return null
}
