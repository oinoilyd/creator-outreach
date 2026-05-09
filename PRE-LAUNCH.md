# Pre-launch checklist

Running list of things to do before opening the app to public marketing /
unbounded signups. The app works today and is shippable to a small
audience (test users you've explicitly added in Google OAuth, anyone who
finds the URL); these items are about the polish + scale layer before
public marketing.

Each item: **What** · **Why it matters** · **When to do it** · **Status**.

Add new items at the bottom of the relevant section. Cross out done items
with `~~strike~~` markdown rather than deleting — leaves a trail of what
shipped.

---

## Auth & Identity

### Supabase Pro plan + custom auth domain
**What**: Upgrade Supabase from Free to Pro ($25/mo). Configure
`auth.creatoroutreach.net` as a custom auth domain via DNS CNAME.
Update Google Cloud Console redirect URI to point at the new
custom domain.

**Why**: Today the OAuth consent screen shows
`qsvsiypwecngqrzgvnxv.supabase.co` — looks like a phishing URL to
anyone paying attention. Custom domain replaces it with
`auth.creatoroutreach.net`. Pro plan also gets daily backups + 8GB
DB which we'll grow into as the contacts cache fills out.

**When**: Before any paid marketing or public launch announcement.
Free plan is fine for the test-user phase.

**Status**: Todo. Wiring is mostly drop-in once Pro is active —
~30 min DNS + redirect URI update + one code line for the auth
URL constant.

### Google OAuth app verification
**What**: Submit the Creator Outreach app to Google for OAuth
verification. Google reviews → marks app as verified → consent
screen no longer shows "Google hasn't verified this app" warning
page.

**Why**: Until verified, anyone signing in via Google sees a yellow
warning page they have to click through (Advanced → Go to
creatoroutreach.net unsafe). Looks bad. Also: in test mode there's
a hard limit on test users (~100 IIRC); verification removes that.

**When**: After custom auth domain is live (verification reviews
the URLs you've configured). Allow 1-3 weeks for review.

**Status**: Todo. Blocked on legal pages below — Google requires
hosted privacy policy + terms before they'll review.

---

## Legal & Compliance

### Privacy policy page
**What**: Real privacy policy hosted at
`creatoroutreach.net/privacy` (or similar). Covers what data is
collected (email, channel research data), how it's used, who it's
shared with (only Supabase + Vercel + the email/social providers
you query), how to request deletion.

**Why**: Required for Google OAuth verification. Required by GDPR
for any EU users. Also a credibility marker on the landing page.

**When**: Before submitting for Google verification. Soon-ish — even
private-beta users will look for it.

**Status**: Todo. Can draft from a template (Termly, GetTerms,
hand-written) and host as a static page in the existing Next.js
app — no engineering complexity.

### Terms of service page
**What**: Terms hosted at `creatoroutreach.net/terms`. Cover
acceptable use, liability disclaimers, account termination rights,
governing law.

**Why**: Required for Google OAuth verification. Protects you from
bad-actor users (e.g. someone using the tool to spam — your terms
should explicitly prohibit that).

**When**: Same time as privacy policy.

**Status**: Todo. Same drafting path as above.

---

## Backlog (lower priority, add to as ideas come up)

- _(add new items here as they come up — keeps this file useful as a
  living checklist instead of a one-shot doc)_
