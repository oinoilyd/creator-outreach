-- Per-user favorites flag on outreach entries.
-- Enables the "Favorites" sub-tab inside Outreach.

alter table public.outreach_entries
  add column if not exists favorite boolean not null default false;

-- Optional: index for fast filtering of a user's favorites.
create index if not exists outreach_entries_user_favorite_idx
  on public.outreach_entries(user_id)
  where favorite = true;
