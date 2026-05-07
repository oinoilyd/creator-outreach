# Meta App Review — Creator Outreach

Reference doc for submitting our Facebook App for the
`instagram_basic` + `pages_show_list` permissions and the Business
Discovery feature. Fill in placeholders before submitting.

## App Details

- **App Name:** Creator Outreach
- **App ID:** _(set after Step 1 below — Facebook Developer dashboard)_
- **Category:** Business / Productivity
- **Privacy Policy URL:** https://creatoroutreach.net/privacy _(must exist before submission)_
- **Terms of Service URL:** https://creatoroutreach.net/terms
- **App Domains:** creatoroutreach.net
- **Site URL:** https://creatoroutreach.net
- **Business Use:** "Help small businesses and brands find creators on
  Instagram who align with their niche, track outreach to those
  creators, and measure the ROI of those campaigns."

## Permissions Requested

| Permission | Why we need it |
|------------|----------------|
| `instagram_basic` | Read profile data of our own IG Business account (required to call Business Discovery from it). |
| `pages_show_list` | Required by Meta to associate our IG Business account with our Facebook Page (Meta's auth chain). |
| `business_management` | Manage the long-lived access token via Business Manager. |

## Features Requested

- **Instagram Business Discovery** — call `business_discovery.username()`
  on our IG Business account's node to fetch public follower /
  bio / media counts for arbitrary IG Business accounts that the
  user is investigating for partnership.

## How We Use the Data

The data is shown only to the authenticated user who initiated the
search. We do not aggregate the data across users for resale. We do not
expose the data via any public API. Data is cached in our Redis layer
(7d TTL) and Postgres (permanent historical log) **solely to avoid
re-querying Meta on repeat searches** — i.e. operational cache.

## Screencast Submission Script (~3 min)

Meta requires a screencast walking through the user-facing flow that
uses the requested permissions. Recipe:

1. **(0:00)** Show the landing page at https://creatoroutreach.net.
   "Creator Outreach is a tool that helps small businesses find and
   reach out to social media creators."
2. **(0:15)** Sign in with magic link — show the magic-link email +
   redirect into the app.
3. **(0:30)** Type a niche query into the search bar (e.g. "personal
   finance creators"). Click Search.
4. **(0:45)** Show the results table populating. Highlight the
   Instagram column — explain that for each creator with a Business or
   Creator Instagram account, we fetch the follower count, recent
   engagement rate, and bio via Meta's Business Discovery endpoint.
5. **(1:30)** Click a single creator's lead — show the LeadDetailModal
   exposing the metrics + recent posts.
6. **(2:00)** Demonstrate that the data is **only visible to the
   authenticated user**. Sign out, sign back in as a different test
   user, run the same search — the IG metrics still load (cached) but
   the outreach status / personal notes are scoped per-user.
7. **(2:45)** End on the privacy-policy page showing our data-usage
   disclosure.

## Test Users

Add the following Facebook accounts as test users in the App
dashboard so they can use the integration before App Review approves:

- Dylan: _(Dylan's personal Facebook user ID)_
- Internal test: _(claude/test FB user if separate)_

## Rate-Limit & Caching Justification

- **200 calls/hour** on Business Discovery (per Meta Graph API docs).
- **Cache layer:** Upstash Redis with 7-day TTL on every fetch result.
- **Tombstone cache:** failed fetches (personal accounts, deleted
  accounts) cached for 24h to prevent retry storms.
- **Postgres historical log:** every successful fetch appended as an
  immutable snapshot for trend analysis. Read by authenticated users
  only (RLS).

## Submission Checklist

- [ ] Privacy Policy live at /privacy
- [ ] Terms live at /terms
- [ ] App configured with our prod domain
- [ ] Long-lived token minted + stored as `META_LONG_LIVED_TOKEN`
- [ ] IG Business account ID set as `META_IG_BUSINESS_ID`
- [ ] Test users added in dashboard
- [ ] Screencast recorded per script above
- [ ] Submit App Review form

## Setup Order (humans + claude)

### Step 1 — Dylan (~10 min, one-time)

Sign in to Facebook, then:

1. Go to https://business.facebook.com → "Create Account"
2. Business name: "Creator Outreach", email: dmeehanj@gmail.com,
   country: US
3. Inside Business Manager → "Pages" → "Add" → "Create a New Page"
   - Page name: "Creator Outreach"
   - Category: "Software"
4. On the IG app on your phone, switch (or create) an account to
   "Business" via Settings → Account → Switch to Professional Account
   - Connect that IG account to the FB Page from step 3 (you'll be
     prompted during the switch)
5. Go to https://developers.facebook.com → "My Apps" → "Create App"
   - Use case: "Other"
   - App type: "Business"
   - App name: "Creator Outreach"
6. In the App dashboard:
   - Add Product → "Instagram Graph API"
   - Settings → Basic → copy **App ID** and **App Secret** somewhere
     safe — Claude will need them
   - Settings → Basic → fill in Privacy Policy URL + Terms URL
     (creatoroutreach.net/privacy, creatoroutreach.net/terms)

### Step 2 — Dylan (~5 min)

Go to https://console.upstash.com → QStash tab → copy:

- **QSTASH_TOKEN** (publish credential)
- **QSTASH_CURRENT_SIGNING_KEY**
- **QSTASH_NEXT_SIGNING_KEY**

Paste these + the Meta credentials (App ID, App Secret) into Vercel
env vars (Production scope) for `creator-outreach`. Variables to set:

```
META_APP_ID=
META_APP_SECRET=
META_LONG_LIVED_TOKEN=
META_IG_BUSINESS_ID=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

### Step 3 — Claude (~30 min, after Step 1+2 done)

- Mint long-lived token via Graph API explorer (App Secret +
  short-lived token → 60-day token)
- Look up `META_IG_BUSINESS_ID` via the Page's connected accounts
- Run the migration: `creator_ig_metrics` (already in `supabase/migrations/0010`)
- Submit App Review with screencast (Claude can produce the script;
  Dylan records the screen)
- Verify in production: search → watch /api/instagram-fetch logs →
  watch Redis + Postgres fill in
