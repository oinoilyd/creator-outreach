-- =====================================================================
-- Creator Outreach Tool — initial schema
-- =====================================================================
-- 4 tables, all RLS-protected, all scoped to the current authenticated user.
-- Auto-creates user_profile + user_preferences rows when a user signs up.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. user_profile  — one row per user; identity + outreach signature
-- ---------------------------------------------------------------------
CREATE TABLE public.user_profile (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  full_name    TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  pitch_line   TEXT NOT NULL DEFAULT '',
  onboarded    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profile_self" ON public.user_profile
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 2. outreach_entries  — many rows per user; CRM tracker
-- ---------------------------------------------------------------------
CREATE TABLE public.outreach_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  channel_id        TEXT NOT NULL,
  channel_name      TEXT NOT NULL,
  channel_url       TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL DEFAULT '',
  product           TEXT NOT NULL DEFAULT '',

  reached_out       BOOLEAN NOT NULL DEFAULT FALSE,
  medium            TEXT NOT NULL DEFAULT '',
  medium_other      TEXT NOT NULL DEFAULT '',
  header_used       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT '',

  notes             TEXT NOT NULL DEFAULT '',
  follow_up_date    TEXT NOT NULL DEFAULT '',
  date_reached_out  TEXT NOT NULL DEFAULT '',
  touchpoints       TEXT NOT NULL DEFAULT '',
  response_date     TEXT NOT NULL DEFAULT '',

  subscribers       TEXT NOT NULL DEFAULT '',
  avg_views         INTEGER NOT NULL DEFAULT 0,
  fit_score         INTEGER NOT NULL DEFAULT 0,
  linkedin          TEXT NOT NULL DEFAULT '',
  content_niche     TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  deal_value        TEXT NOT NULL DEFAULT '',
  contract_sent     BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_scheduled TEXT NOT NULL DEFAULT '',

  added_at          BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, channel_id)
);

CREATE INDEX outreach_entries_user_idx ON public.outreach_entries(user_id);

ALTER TABLE public.outreach_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_entries_self" ON public.outreach_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 3. dismissed_creators  — many rows per user; skip list
-- ---------------------------------------------------------------------
CREATE TABLE public.dismissed_creators (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id   TEXT NOT NULL,
  data         JSONB NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX dismissed_creators_user_idx ON public.dismissed_creators(user_id);

ALTER TABLE public.dismissed_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dismissed_creators_self" ON public.dismissed_creators
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 4. user_preferences  — one row per user; column configs + per-platform state
-- ---------------------------------------------------------------------
CREATE TABLE public.user_preferences (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  col_config           JSONB,
  outreach_col_config  JSONB,
  platform_state       JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_self" ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 5. Auto-create profile + preferences rows on user signup
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pre-fill name from OAuth metadata if available (e.g. Google sign-in)
  INSERT INTO public.user_profile (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------
-- 6. updated_at touch trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profile_touch BEFORE UPDATE ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER outreach_entries_touch BEFORE UPDATE ON public.outreach_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER user_preferences_touch BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
