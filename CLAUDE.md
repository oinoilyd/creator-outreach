@AGENTS.md

# Creator Outreach — Working Rules

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

## Quick links

- Live: https://creatoroutreach.net
- Vercel project: https://vercel.com/oinoilyds-projects/creator-outreach
- Supabase: see `lib/supabase/`
- Crop script: `scripts/crop-screenshots.py`
- Screenshot slots: `public/screenshots/` (+ README.md inside)
