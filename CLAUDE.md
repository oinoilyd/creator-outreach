@AGENTS.md

# Creator Outreach — Working Rules

## 🧠 Read `.brain/` first

This repo has a private "second brain" at `.brain/` (gitignored, lives only on Dylan's laptop). It's a richer persistent-memory than this file. Open `.brain/index.md` at the start of every session — it routes you to:

- `.brain/people/dylan.md` — how Dylan works, what he hates, what he likes
- `.brain/project/current-state.md` — what's live RIGHT NOW
- `.brain/project/design-decisions.md` — locked-in choices, don't re-litigate
- `.brain/project/gotchas.md` — codebase quirks
- `.brain/features/*.md` — per-feature deep notes
- `.brain/iterations/YYYY-MM-DD.md` — daily journal

**When you ship something material**, write back to the relevant `features/<thing>.md` and append a 5-line entry to today's `iterations/YYYY-MM-DD.md`. That's how the next Claude session catches up.

If `.brain/` doesn't exist yet (fresh clone, different machine), this CLAUDE.md is the fallback — the most important things from the brain are duplicated here.

## Before any non-trivial change, run the plan/verify cycle

Three skill bundles are installed at `~/.claude/skills/`:

- **superpowers** (`obra/superpowers`) — methodology: `writing-plans`, `executing-plans`, `verification-before-completion`, `systematic-debugging`, `brainstorming`, `subagent-driven-development`.
- **ui-ux-pro-max** (`nextlevelbuilder/ui-ux-pro-max-skill`) — design intelligence: 67 UI styles, 161 palettes, 57 font pairings, 99 UX guidelines, 8 landing-page archetypes, pre-delivery validation checklist (375px → 1440px breakpoints, contrast, focus, hover).
- **everything-claude-code** (`affaan-m/everything-claude-code`) — 68 slash commands, 48 agents, TypeScript/JS rules under `~/.claude/rules/ecc/`, MCP configs (Vercel, Supabase, GitHub) at `/tmp/everything-claude-code/mcp-configs/mcp-servers.json` (not yet wired with API keys).
- **taste-skill** (`Leonxlnx/taste-skill`) — anti-slop frontend skills (12 skills): `taste-skill`, `redesign-skill`, `minimalist-skill`, `soft-skill`, `brutalist-skill`, `brandkit`, `stitch-skill`, `image-to-code-skill`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `gpt-tasteskill`, `output-skill`. Use when refining typography, layout, motion quality on premium frontends; use `redesign-skill` for full-page redesigns.
- **emil-design-eng** (`emilkowalski/skill`) — Emil Kowalski's design engineering skill. Use for high-craft motion details, hover states, animation timing curves, micro-interactions on the level of vercel.com / emilkowal.ski.

**Mandatory order on any landing/UI change:**

1. `writing-plans` — produce a written plan first. Tasks must be 2–5 minute increments. Don't start coding until Dylan has seen the plan.
2. `executing-plans` — work the plan one task at a time. Mark progress as you go.
3. `verification-before-completion` — before claiming "done," confirm the change behaves as described. For visuals, that means **looking at the rendered output** (read the image after a crop, screenshot the page after a deploy) — not assuming.
4. **`npm test` BEFORE every push.** Mandatory. See "Test-before-push" below.

This rule exists because we burned a half-night cycle of "shipped → broken → reverted." Read [SESSION-NOTES](./SESSION-NOTES.md) if you want the long version. The cycle ends here.

## 🛡️ Data-safety protocol (MANDATORY — non-negotiable)

This section exists because we lost a user's outreach list on 2026-05-20. The cause was a "diff and reconcile" pattern in `lib/storage.ts:saveOutreach()` combined with a PostgREST schema-cache lag after running migration `0028_active_clients.sql`. Full post-mortem in `.brain/project/gotchas.md` under "Data-loss incident 2026-05-20."

**Never let this happen again.** Before ANY task that touches the database — migrations, storage helpers, new write paths, schema changes — execute the protocol below. No exceptions, even for "small" changes.

### Step 1 — Audit data-write paths BEFORE writing the migration / feature

When the task touches table `T`:

1. Grep the codebase for every place writing to `T`:
   ```bash
   grep -rn "from('T')" lib/ app/api/ | grep -iE "delete|update|upsert|insert"
   ```
2. Open each match. Read the function. Look for:
   - **"Diff and delete" patterns** — fetch existing, compare to new, delete the difference. CATASTROPHIC if the "new" list ever arrives empty. Replace with single-row writes.
   - **No guards** on bulk operations. If a function deletes more than 1 row, it needs a sanity check (e.g., refuse if it would wipe >50% of existing rows, or if the local state appears empty but DB has data).
   - **Stale closures** that can capture an empty array and re-save it.
   - **Error handling that swallows + returns []**. Silent failures + automatic saves = invisible data loss.
3. Surface any concerns in chat BEFORE writing migration SQL or new code. Even if Dylan didn't ask.

### Step 2 — Migration safety checklist

Before recommending Dylan run any migration:

- [ ] Migration is idempotent (`IF NOT EXISTS` on creates, `IF EXISTS` on drops)
- [ ] No `DROP TABLE` / `DROP COLUMN` on tables with user data (NEVER. Use `ALTER ... ADD COLUMN IF NOT EXISTS` to add, leave old columns until proven unused)
- [ ] No `DELETE` / `TRUNCATE` of user-data tables in the migration body
- [ ] If adding columns to a hot table (`outreach_entries`, `user_profile`, `creator_enrichment`), warn Dylan about the **PostgREST schema-cache lag (30-60s)** that follows. During this window, app queries on that table can fail. Recommend running during low-traffic hours.
- [ ] If the migration could destabilize an existing data-write path (per Step 1 audit), block on shipping a code-side guard FIRST.

### Step 3 — Production-readiness preflight

For every push that touches the data layer, surface these questions if they haven't been answered recently:

- "Are Supabase backups configured? Free tier doesn't have them."
- "Is this change live during active user hours? Consider deploying when traffic is low."
- "If this fails partway through, what's the recovery path?"
- "Does this touch any table whose RLS or triggers could mis-fire under load?"

Don't wait to be asked. If the answer to any of these is "I don't know" or "no," flag it.

### Step 4 — After every migration on production tables

- [ ] Verify the deletion audit log (`outreach_entries_deletion_log`) for unexpected entries
- [ ] Spot-check one user's row count before / after
- [ ] Confirm `NOTIFY pgrst, 'reload schema';` ran (the PostgREST cache refresh — every migration that adds/changes columns needs this)
- [ ] If anything looks off, FREEZE and investigate before proceeding

### Step 4b — Code that writes new columns MUST gate on the migration being applied first (2026-06-08 update)

We had a 16-day silent data-loss window because migration 0033 added 4 columns AND the code that wrote those columns shipped in the same commit. The migration sat unapplied; every outreach save returned `PGRST204` → buried in `console.error` → user kept losing data.

**Rule:** whenever you add a new column to `outreachToRow()` / any payload going into `.upsert()` / `.insert()`:

1. **Apply the migration to prod BEFORE the code that uses it deploys.** Two separate steps. Apply migration, verify columns exist via `information_schema.columns`, THEN merge the code.
2. **Wrap any new save-path error with `reportSaveFailure()`** from `lib/error-log.ts`. That writes to the central `client_error_log` table (admin sees on `/admin` → Error Inbox) AND shows a blocking alert to admin so silent failures can't recur. Never `console.error` and continue.
3. **Verify the Error Inbox is empty** on `/admin` after deploy. If anything shows up, the migration didn't take.
4. **Update the migration audit query in CLAUDE.md** (the one in chat history under "Run this audit query in Supabase SQL Editor") to include the new columns. Any future re-audit catches drift.

### Step 5 — Code patterns to refuse

These patterns are banned in any new code:

- **Bulk "save the whole list" functions** that delete rows missing from the list. Use single-row helpers: `addX(item)`, `updateXField(id, field, value)`, `removeX(id)`. The existing `saveOutreach()` is grandfathered with safety guards; do not add new functions in this shape.
- **Empty-array assumptions** as a default fallback. `data ?? []` for a list that's then passed to a save function is a data-loss vector. Either propagate the error or hold the previous good state.
- **`SELECT *`** without a fallback for missing columns. Use explicit column lists with migration-tolerance fallbacks (`try full → fall back to base`).

### Why this is mandatory

Dylan is paying for Claude Max. Token usage is not a constraint. There is no excuse for "I didn't grep the codebase to check." Read the related files. Do the audit. Surface the risks. Take 2–5 extra minutes per task to avoid losing someone's data again.

---

## Test-before-push (MANDATORY)

Playwright tests live in `tests/`. Before every `git push`:

1. **Run** `npm test` (chromium, headless, auto-starts `next dev`).
2. **Capture the summary** — passed / failed / skipped counts + any failure messages.
3. **Show Dylan the summary** in chat. Format:
   ```
   Playwright: ✓ X passed · ✗ Y failed · ⊘ Z skipped (N.NNs)
   [if any failed] Failures:
     - test name → reason (1 line)
   ```
4. **Wait for explicit approval** before pushing if there are any failures or warnings. If all pass, may push immediately and include the summary in the response.
5. **If a test fails**: do NOT push. Diagnose, fix, re-run, re-summarize, get approval. The "fix the test" path is also valid if the test itself was wrong — but call that out explicitly.

Skipping the test step is treated as the same severity as skipping `npm run build`.

### Test scripts

```
npm test              # headless run, default browser (chromium)
npm run test:ui       # interactive UI mode (Dylan's debugging)
npm run test:headed   # visible browser (Claude debugging)
npm run test:debug    # step-debugger
npm run test:prod     # tests target https://creatoroutreach.net (post-deploy verify)
```

### Coverage scope (v1)

- **Landing page render** — headline visible (catches the bg-clip-text bug class), bento count ≥ 5, sections present, no console errors
- **Auth forms render** — sign in / sign up / forgot password fields exist
- **Theme toggle** — clicking flips `html.dark`, headline stays visible in both modes

Auth-required tests (search, outreach, multi-sort behavior) are deferred until a Supabase test user is provisioned. Tag them `@auth` when added.

## Landing redesign — locked decisions

These were paid for in iteration. Don't re-litigate without an explicit ask:

- **Light mode only on landing + auth.** `app/landing/layout.tsx` and `app/auth/layout.tsx` strip `.dark` from `<html>` on mount. Marketing pages do not need a theme toggle. App interior stays themeable.
- **Dark product screenshots on the light landing.** Linear / Vercel / Resend pattern. Real PNGs in `public/screenshots/` (4 source captures + 5 pre-cropped regions for the bento). Crop coords live in `scripts/crop-screenshots.py` — re-run it after editing the coords.
- **No fake testimonials.** Removed in `b1c2b7c`. Re-add only when real quotes exist.
- **No StatsStrip.** Numbers like "5 platforms · 13 niches" undersell, removed in `53ac51e`.
- **Glass bento cards** (`bg-white/70 backdrop-blur-md ring-1 ring-purple-200/40`) — replaced the previous chunky white card + gray border.

## Design tokens — ui-ux-pro-max workflow

Whenever a design decision is on the table (color, font, layout archetype), invoke ui-ux-pro-max **before** writing any CSS. Pick:

1. **Archetype** — one of the 8 landing patterns (Hero-Centric / Conversion-Optimized / Storytelling-Driven / etc.) — locked up front.
2. **Palette** — one of the 161 product-type-aligned palettes for SaaS-CRM. Replace the current OKLCH lavender if Dylan picks something else.
3. **Font pairing** — heading + body from the 57-pair list. Current default is Geist; we're not married to it.
4. **Pre-delivery checklist** — run before push: 375 / 768 / 1440 breakpoints, contrast 7:1 normal / 4.5:1 large, visible focus rings, no overflow, real hover states.

The flow: Dylan picks archetype + palette + fonts → I implement → I run the checklist → I push → Dylan looks. Stops the "we shipped 8 versions and none feel right" loop.

## Deploy quota awareness

Vercel free tier has a **100 deploys / 24 hours** API limit. The CLI hits it; the GitHub auto-deploy hits it; the dashboard "Redeploy" button does NOT (different code path).

**Default workflow:**
- Make multiple changes, commit each, push to main
- Do NOT run `vercel --prod` unless Dylan explicitly asks
- Dylan triggers deploy from the dashboard once per session of changes

If we need API-driven deploys, wire up the Vercel MCP from ECC's `mcp-configs/mcp-servers.json` (token required).

## TypeScript rules

ECC ships TypeScript-specific rules at `~/.claude/rules/ecc/typescript/`:
- `coding-style.md`
- `hooks.md`
- `patterns.md`
- `security.md`
- `testing.md`

Defer to those for any TS / React / Next.js patterns I'm uncertain about, instead of guessing.

## What's NOT in scope unless asked

- Dark mode toggle on the landing (locked light-only)
- A new design system from scratch (only if Dylan greenlights via ui-ux-pro-max archetype pick)
- New testimonials / social-proof copy (only with real quotes)
- Anything in `n8n-io/n8n` — evaluated, declared out of scope

## Instagram Graph API — background enrichment

Status: **scaffolded, awaiting credentials + Meta App Review.**

The flow once enabled:
1. `/api/enrich` resolves IG handle (existing YouTube/about → website → biolink chain).
2. Fires a QStash job to `/api/instagram-fetch` (fire-and-forget, doesn't block response).
3. Worker hits Meta Business Discovery → writes to Redis (7d hot cache) + Postgres `creator_ig_metrics` (permanent historical log, append-only).
4. Frontend polls `/api/instagram-status?handle=X` every 3-5s after a search to fill in real follower counts / engagement.

Until env vars are set, every layer is a graceful no-op — the existing
scrape-based IG enrichment continues to work unchanged.

**Env vars required to flip on:**
```
META_APP_ID, META_APP_SECRET, META_LONG_LIVED_TOKEN, META_IG_BUSINESS_ID
QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY
```

Setup walkthrough lives in `META_APP_REVIEW.md`. Postgres migration is `supabase/migrations/0010_creator_ig_metrics.sql`.

**Legal posture:**
- Internal-use cache (current state): legal, low-risk.
- Selling/exposing the historical log externally: requires lawyer + GDPR/CCPA compliance + state data-broker registrations + would violate Meta API ToS — explicitly out of scope without that lift.

## Supabase auth email deliverability — CUSTOM SMTP (one-time setup)

Default Supabase auth emails come from `noreply@mail.supabase.io`. This sender's domain reputation is poor — Gmail / Outlook routinely land it in spam or flag as "dangerous" (especially for password-reset emails, which phishing campaigns regularly mimic).

**Permanent fix:** route Supabase auth emails through Resend SMTP, using the `creatoroutreach.net` domain we already have verified for the contact form.

Steps (Supabase Dashboard, ~30 seconds):
1. Open https://supabase.com/dashboard/project/qsvsiypwecngqrzgvnxv/settings/auth
2. Scroll to **SMTP Settings** → toggle **Enable Custom SMTP**
3. Paste these values:
   - **Sender email**: `noreply@creatoroutreach.net`
   - **Sender name**: `Creator Outreach`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Minimum interval between emails**: `60`
   - **Username**: `resend`
   - **Password**: paste the value of `RESEND_API_KEY` (from Vercel env, starts with `re_`)
4. Save

After that, all auth emails (signup confirmation, password reset, magic link) flow through Resend with proper SPF/DKIM/DMARC. Spam flags disappear.

The reset-link copy + check-spam UI in `/auth/check-email` and `/auth/forgot-password` is a stopgap until SMTP is configured.

## Quick links

- Live: https://creatoroutreach.net
- Vercel project: https://vercel.com/oinoilyds-projects/creator-outreach
- Supabase: see `lib/supabase/`
- Crop script: `scripts/crop-screenshots.py`
- Screenshot slots: `public/screenshots/` (+ README.md inside)
- Meta App Review docs: `META_APP_REVIEW.md`
