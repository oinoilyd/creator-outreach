-- Mail client preference: which web compose URL to use when the user
-- clicks an outreach email link. 'default' = OS mailto handler.
-- Others open the provider's web compose with to/subject/body
-- pre-filled in a new tab.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS mail_client TEXT NOT NULL DEFAULT 'default';
