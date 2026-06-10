-- 0040_grant_export_credit_rpc.sql
--
-- Atomic, idempotent export-credit grant. Replaces the read-then-write
-- pattern in the Stripe webhook + the /exports/fulfill redirect path,
-- which had two flaws (2026-06-10 audit):
--   1. If the user_profile row was missing, the UPDATE matched zero
--      rows silently — the user paid $50, the paid_exports idempotency
--      marker was written (so no retry), and the credit vanished.
--   2. Read-modify-write is not atomic; two concurrent deliveries of
--      the same event could each read N and write N+1.
--
-- This function does the idempotency-marker insert AND the credit
-- increment in a single transaction (the function body is atomic).
-- It returns TRUE when a credit was newly granted, FALSE when the
-- session was already fulfilled (idempotent no-op).
--
-- SECURITY DEFINER + service-role-only: the webhook/fulfill routes
-- call it with the service-role client. No end-user can invoke it
-- (no GRANT to authenticated).
--
-- Additive only — creates one function. No table/column/data changes.

CREATE OR REPLACE FUNCTION public.grant_export_credit(
  p_user_id    UUID,
  p_session_id TEXT,
  p_amount_cents INTEGER,
  p_fulfilled_via TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Idempotency marker. ON CONFLICT DO NOTHING so a duplicate session
  -- (webhook + redirect, or a Stripe retry) is a clean no-op.
  INSERT INTO public.paid_exports (stripe_session_id, user_id, amount_cents, fulfilled_via)
  VALUES (p_session_id, p_user_id, p_amount_cents, p_fulfilled_via)
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    -- Already fulfilled by another path/delivery. Do not double-grant.
    RETURN FALSE;
  END IF;

  -- Atomic increment. If the profile row is missing this still affects
  -- zero rows, so we guard: when no row was updated, raise so the
  -- caller can roll back the marker (the whole function is one
  -- transaction — a raised exception undoes the INSERT above too,
  -- letting Stripe's retry re-attempt cleanly).
  UPDATE public.user_profile
  SET paid_export_credits = COALESCE(paid_export_credits, 0) + 1
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RAISE EXCEPTION 'grant_export_credit: no user_profile row for %', p_user_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Service-role only. Do NOT grant to authenticated — end users must
-- never call this directly.
REVOKE ALL ON FUNCTION public.grant_export_credit(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
