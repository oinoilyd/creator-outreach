-- Extends admin_user_summary with profile completion fields and the
-- timestamp of each user's first outreach entry. The signature changes,
-- so we drop and recreate.

drop function if exists public.admin_user_summary();

create or replace function public.admin_user_summary()
returns table(
  user_id uuid,
  email text,
  full_name text,
  linkedin_url text,
  pitch_line text,
  onboarded boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  first_outreach_at timestamptz,
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
    coalesce(p.full_name, '') as full_name,
    coalesce(p.linkedin_url, '') as linkedin_url,
    coalesce(p.pitch_line, '') as pitch_line,
    coalesce(p.onboarded, false) as onboarded,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    (select min(oe.created_at) from public.outreach_entries oe where oe.user_id = u.id) as first_outreach_at,
    coalesce((select count(*) from public.outreach_entries oe where oe.user_id = u.id), 0)::bigint as outreach_count,
    coalesce((select count(*) from public.dismissed_creators dc where dc.user_id = u.id), 0)::bigint as dismissed_count
  from auth.users u
  left join public.user_profile p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

grant execute on function public.admin_user_summary() to authenticated;
