-- Sandboxed email-discovery test runs from the admin email-test page.
-- Each row is one experimental search → enrichment cycle, recording
-- which strategy toggles were active so you can compare hit rates
-- across enrichment configurations and iterate on the email logic.
--
-- Aggregate-only (per-creator details are NOT persisted) to keep the
-- table small even after hundreds of runs.

CREATE TABLE IF NOT EXISTS public.email_test_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  query        text NOT NULL,
  region       text,
  strategy     text NOT NULL,            -- comma-separated active method keys
  total        int  NOT NULL,            -- total creators returned by search
  with_email   int  NOT NULL,            -- of those, how many had an email after enrichment
  hit_rate     numeric(5,2) NOT NULL,    -- percent: 0.00–100.00
  took_ms      int  NOT NULL,            -- total wall-clock ms
  notes        text                       -- optional human label for what changed
);

ALTER TABLE public.email_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin can insert email_test_runs" ON public.email_test_runs;
CREATE POLICY "admin can insert email_test_runs"
  ON public.email_test_runs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

DROP POLICY IF EXISTS "admin can read email_test_runs" ON public.email_test_runs;
CREATE POLICY "admin can read email_test_runs"
  ON public.email_test_runs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

DROP POLICY IF EXISTS "admin can delete email_test_runs" ON public.email_test_runs;
CREATE POLICY "admin can delete email_test_runs"
  ON public.email_test_runs FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'dmeehanj@gmail.com');

CREATE INDEX IF NOT EXISTS idx_email_test_runs_created_at
  ON public.email_test_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_test_runs_strategy
  ON public.email_test_runs (strategy);

-- Same Supabase gotcha as 0006: explicit GRANT alongside RLS.
GRANT INSERT, SELECT, DELETE ON public.email_test_runs TO authenticated;
