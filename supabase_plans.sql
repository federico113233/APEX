-- supabase_plans.sql
-- Run this manually in the Supabase SQL Editor (project "apex").
-- Additive only: adds profiles.plan, a trigger that locks it, and the usage table.
-- Do NOT expose SUPABASE_SERVICE_ROLE_KEY to the client — it bypasses RLS.

-- ── 1. Add plan column to profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'admin'));

-- ── 2. Lock the plan column against client writes ─────────────────────────────
-- The existing policy "own profile" (FOR ALL, auth.uid() = id) lets a signed-in
-- user write any column of their own row, including plan, on both INSERT and
-- UPDATE. A policy cannot restrict single columns, so a trigger does it:
--   * requests made with the anon / authenticated key: plan is forced to
--     'free' on INSERT and left unchanged on UPDATE
--   * the service role (server) and the SQL Editor are not affected
CREATE OR REPLACE FUNCTION public.lock_profile_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'free';
    ELSE
      NEW.plan := OLD.plan;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_profile_plan ON public.profiles;
CREATE TRIGGER lock_profile_plan
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profile_plan();

-- ── 3. Create usage table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action     text    NOT NULL,
  month      text    NOT NULL,   -- format: "2026-09"
  count      integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, action, month)
);

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (so the frontend can show remaining credits).
DROP POLICY IF EXISTS "users can read own usage" ON public.usage;
CREATE POLICY "users can read own usage"
  ON public.usage FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policy: only the server (service role) writes.

-- ── 4. Make yourself admin (run after the rest) ───────────────────────────────
-- UPDATE public.profiles
--   SET plan = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'federico.balucani@gmail.com');
