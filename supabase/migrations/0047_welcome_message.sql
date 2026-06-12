-- 0047_welcome_message.sql
--
-- Auto-welcome: every NEW signup gets a friendly in-app welcome message
-- in their inbox with a tutorial overview + how to reopen the tour.
--
-- NEW USERS ONLY — by construction. This is an AFTER INSERT trigger on
-- auth.users, so it fires exactly once when an account is created. People
-- who already signed up were inserted long ago and will NEVER receive it.
--
-- SIGNUP-SAFE — the whole body is wrapped in EXCEPTION WHEN OTHERS so a
-- bug here can never roll back / block account creation. Worst case a new
-- user just doesn't get the welcome; signup still succeeds.
--
-- In-app only (no email) — the new user is already in the app, so the
-- inbox bell badge surfaces it. Additive.

CREATE OR REPLACE FUNCTION public.handle_new_user_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  INSERT INTO public.inbox_threads (type, subject, target_user_id, allow_replies)
  VALUES ('direct', 'Welcome to Creator Outreach 👋', NEW.id, true)
  RETURNING id INTO v_thread_id;

  INSERT INTO public.inbox_messages (thread_id, body, author_user_id, author_is_admin)
  VALUES (
    v_thread_id,
    $body$Hey — welcome to Creator Outreach! 👋

Glad to have you. The fastest way to get going is a walkthrough — open the menu (☰, top-right) and pick a Tutorial any time. There are three depths, so choose your speed:

• Short — the 2-minute essentials to get your first search going
• Pro — the features that make you fast
• Granular — a detailed, step-by-step tour of everything

You can replay any of them whenever you like.

Got a question? Just reply right here — it comes straight to our team.

— The Creator Outreach team$body$,
    NULL,
    true
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a signup because of a welcome message.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_welcome ON auth.users;
CREATE TRIGGER on_auth_user_welcome
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_welcome();

NOTIFY pgrst, 'reload schema';
