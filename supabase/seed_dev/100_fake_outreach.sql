-- Inserts 100 randomized fake outreach entries for the user
-- 'dmeehanj@gmail.com' so the Follow-ups + Analytics tabs have real
-- data to validate against.
--
-- Status distribution:    15% Not Outreached, 30% Open, 25% No Response,
--                         15% Successful, 15% Rejected
-- Medium distribution:    50% Email, 30% LinkedIn, 10% Other, 10% blank
-- Touchpoints:            0-5 (skewed toward 1-3)
-- Date reached out:       random within the last 90 days
-- Follow-up date:         derived from status (overdue / today / week / later / unset)
-- Deal value:             30% have a value between $200-$5000
-- Favorite:               20% starred
--
-- Each row gets `notes = '[seed]'` so you can clean up later with:
--   DELETE FROM public.outreach_entries
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'dmeehanj@gmail.com')
--     AND notes = '[seed]';

WITH
  u AS (SELECT id FROM auth.users WHERE email = 'dmeehanj@gmail.com' LIMIT 1),
  pool AS (
    SELECT ARRAY[
      'FitForge', 'Lens & Light', 'Solo Dev Diaries', 'StrengthLab Pro', 'Quick Recipes Co',
      'PixelPath', 'GardenGoals', 'CodeCraft Studio', 'TheTechBrief', 'WildernessWired',
      'MovementCo', 'BookwormBites', 'FocusFlow', 'CityRunner', 'KitchenPhysics',
      'TrailMix Talks', 'StudioSession', 'BeyondBasics', 'CalmCorner', 'TheCanvas',
      'LawAndOrderly', 'HomeGym Hub', 'SunsetStrolls', 'GameTheoryHQ', 'PaperTrail',
      'Slate Studio', 'OrbitMode', 'ForestFloor', 'CulturedClay', 'ClearSky Coding',
      'GoldenHourTV', 'NorthernNotes', 'PrairieProtein', 'BrickAndMortar', 'TidalTalks',
      'Quartz Quotient', 'SilverScreen Scene', 'PineRidge Productions', 'CalibreCreative', 'IronwoodFitness',
      'VelvetVeg', 'Saltwater Studies', 'TundraTrails', 'MeadowMakers', 'CoffeeAndCode',
      'PaintByNumbers', 'EchoChamberCast', 'MarketMonday', 'PlainTextPublishing', 'TheRoughCut'
    ] AS names
  ),
  rolls AS (
    SELECT
      n,
      (SELECT id FROM u)                                                                       AS uid,
      ('UC' || substring(md5(random()::text || n::text || clock_timestamp()::text) FROM 1 FOR 22)) AS channel_id,
      (SELECT names[1 + ((n - 1) % array_length(names, 1))] FROM pool) || ' ' || n             AS channel_name,
      random() AS r_status,
      random() AS r_medium,
      random() AS r_email,
      random() AS r_dealv,
      random() AS r_fav,
      random() AS r_tps,
      random() AS r_reached,
      random() AS r_fit,
      random() AS r_subs,
      random() AS r_views
    FROM generate_series(1, 100) AS s(n)
  ),
  enriched AS (
    SELECT
      n, uid, channel_id, channel_name,
      CASE
        WHEN r_status < 0.15 THEN 'Not Outreached'
        WHEN r_status < 0.45 THEN 'Open'
        WHEN r_status < 0.70 THEN 'No Response'
        WHEN r_status < 0.85 THEN 'Successful'
        ELSE 'Rejected'
      END AS status,
      CASE
        WHEN r_medium < 0.50 THEN 'Email'
        WHEN r_medium < 0.80 THEN 'LinkedIn'
        WHEN r_medium < 0.90 THEN 'Other'
        ELSE ''
      END AS medium,
      CASE WHEN r_email > 0.30 THEN 'contact+' || n || '@' || lower(replace(channel_name, ' ', '')) || '.com' ELSE '' END AS email,
      LEAST(5, FLOOR(r_tps * 6))::int AS touchpoints_n,
      r_reached, r_dealv, r_fav, r_fit, r_subs, r_views
    FROM rolls
  ),
  finalized AS (
    SELECT
      n, uid, channel_id, channel_name, status, medium, email,
      touchpoints_n,
      -- date reached out: 0-90 days ago for non-"Not Outreached"
      CASE WHEN status = 'Not Outreached' THEN ''
           ELSE to_char(CURRENT_DATE - (FLOOR(r_reached * 90))::int, 'YYYY-MM-DD')
      END AS date_reached_out,
      -- follow-up date based on status urgency
      CASE
        WHEN status IN ('Successful', 'Rejected', 'Not Outreached') THEN ''
        WHEN status = 'Open' AND r_reached < 0.20 THEN to_char(CURRENT_DATE - (1 + FLOOR(r_reached * 10))::int, 'YYYY-MM-DD') -- overdue
        WHEN status = 'Open' AND r_reached < 0.30 THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')                                    -- today
        WHEN status = 'Open' AND r_reached < 0.65 THEN to_char(CURRENT_DATE + (1 + FLOOR(r_reached * 7))::int, 'YYYY-MM-DD') -- this week
        WHEN status = 'Open' THEN to_char(CURRENT_DATE + (8 + FLOOR(r_reached * 30))::int, 'YYYY-MM-DD')                     -- later
        WHEN status = 'No Response' AND r_reached < 0.5 THEN to_char(CURRENT_DATE - (1 + FLOOR(r_reached * 14))::int, 'YYYY-MM-DD')
        WHEN status = 'No Response' THEN to_char(CURRENT_DATE + (1 + FLOOR(r_reached * 14))::int, 'YYYY-MM-DD')
        ELSE ''
      END AS follow_up_date,
      -- response date for Successful/Rejected
      CASE WHEN status IN ('Successful', 'Rejected')
           THEN to_char(CURRENT_DATE - (FLOOR(r_reached * 30))::int, 'YYYY-MM-DD')
           ELSE ''
      END AS response_date,
      -- deal value: 30% of rows have $200-$5000
      CASE WHEN r_dealv > 0.70 THEN '$' || (200 + FLOOR(r_dealv * 4800))::int ELSE '' END AS deal_value,
      (r_fav < 0.20) AS favorite,
      ROUND((50 + r_fit * 50)::numeric, 0) AS fit_score,
      (1000 + FLOOR(r_subs * 999000))::int || (CASE WHEN r_subs > 0.7 THEN 'K' ELSE '' END) AS subscribers,
      (500 + FLOOR(r_views * 99500))::int AS avg_views
    FROM enriched
  )
INSERT INTO public.outreach_entries (
  id, user_id, channel_id, channel_name, channel_url, description, email, product,
  reached_out, medium, medium_other, header_used, status,
  notes, follow_up_date, date_reached_out, touchpoints, response_date,
  subscribers, avg_views, fit_score, linkedin, content_niche, phone, deal_value,
  contract_sent, meeting_scheduled, added_at, favorite
)
SELECT
  channel_id || '-seed-' || n,
  uid,
  channel_id,
  channel_name,
  'https://www.youtube.com/channel/' || channel_id,
  'Random seeded creator description for testing follow-ups + analytics flows.',
  email,
  CASE WHEN n % 4 = 0 THEN 'AI Pro Plan' WHEN n % 4 = 1 THEN 'Growth Suite' WHEN n % 4 = 2 THEN '' ELSE 'Premium Tier' END,
  status NOT IN ('Not Outreached', ''),
  medium,
  '',
  CASE WHEN status = 'Not Outreached' THEN '' ELSE 'Quick question about your channel' END,
  status,
  '[seed]',
  follow_up_date,
  date_reached_out,
  CASE WHEN touchpoints_n = 0 THEN '' ELSE touchpoints_n::text END,
  response_date,
  subscribers,
  avg_views,
  fit_score::int,
  CASE WHEN n % 3 = 0 THEN 'https://linkedin.com/in/creator-' || n ELSE '' END,
  CASE WHEN n % 5 = 0 THEN 'Fitness' WHEN n % 5 = 1 THEN 'Tech' WHEN n % 5 = 2 THEN 'Cooking' WHEN n % 5 = 3 THEN 'Travel' ELSE 'Lifestyle' END,
  '',
  deal_value,
  status = 'Successful' AND deal_value <> '',
  '',
  EXTRACT(EPOCH FROM (NOW() - (random() * INTERVAL '120 days'))) * 1000,
  favorite
FROM finalized;
