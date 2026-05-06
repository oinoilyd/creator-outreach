-- Admin-only RPC to summarize all users + their per-user counts.
-- Runs as SECURITY DEFINER so it can read auth.users, but checks the
-- caller's email against a hardcoded admin allowlist before returning data.
-- To grant another admin, edit the email check below and re-run this file.

create or replace function public.admin_user_summary()
returns table(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  outreach_count bigint,
  dismissed_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Admin gate: only this email may call.
  if (select u.email from auth.users u where u.id = auth.uid()) is distinct from 'dmeehanj@gmail.com' then
    raise exception 'forbidden';
  end if;

  return query
  select
    u.id as user_id,
    u.email::text,
    p.full_name,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    coalesce((select count(*) from public.outreach_entries oe where oe.user_id = u.id), 0)::bigint as outreach_count,
    coalesce((select count(*) from public.dismissed_creators dc where dc.user_id = u.id), 0)::bigint as dismissed_count
  from auth.users u
  left join public.user_profile p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

grant execute on function public.admin_user_summary() to authenticated;
