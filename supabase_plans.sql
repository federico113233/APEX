-- supabase_plans.sql
-- Run this manually in the Supabase SQL Editor.
-- It adds the plan column to profiles and creates the usage table.
-- Do NOT expose SUPABASE_SERVICE_ROLE_KEY to the client — it bypasses RLS.

-- ── 1. Add plan column to profiles ────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'admin'));

-- Prevent clients from changing their own plan.
-- Drop the existing UPDATE policy (if any) and recreate it with a WITH CHECK
-- clause that locks the plan value to whatever it already is in the DB.
-- This way users can update name, CV, etc. but cannot elevate their own plan.
DO $$
BEGIN
  -- Drop common policy names — adjust if yours differs.
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY "users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan = (SELECT plan FROM profiles WHERE id = auth.uid())
  );

-- ── 2. Create usage table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action     text    NOT NULL,
  month      text    NOT NULL,   -- format: "2026-09"
  count      integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, action, month)
);

ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (so the frontend can show remaining credits).
DROP POLICY IF EXISTS "users can read own usage" ON usage;
CREATE POLICY "users can read own usage"
  ON usage FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE from the client: only the server (service role)
-- writes to this table. With RLS enabled and no write policy, direct client
-- writes are denied by default.

-- ── 3. Set plan='admin' for your account ──────────────────────────────────────
-- After running this file, run the query below (replace with your actual user id):
--
-- UPDATE profiles SET plan = 'admin' WHERE id = '<your-user-id>';
--
-- To find your user id: SELECT id FROM auth.users WHERE email = 'your@email.com';
