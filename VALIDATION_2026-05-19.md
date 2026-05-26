# Validation checklist — 2026-05-19 push

Six commits live on `origin/main` (`168e3e0` → `eaeaba0`). Mark the
checkbox once you've validated, then pick a status from the
**Outcome** column.

> **Outcome key:**
> `✅ Pass` — works as expected, ship-ready
> `⚠️ Needs edits` — works but wants follow-up tweaks
> `🔴 Broken` — doesn't work, needs a fix before re-validating
> `⏳ Not tested yet` — haven't gotten to it

---

## 1️⃣ Templates rework — `c383320`

**What changed:** new default templates for all 5 platforms · email
subject editor in TemplatesModal · YT-boilerplate detector in
`buildOutreachContent` · copy-paste DM coverage extended to X +
TikTok · migration 0026 (template columns + CAN-SPAM footer toggle).

**Validation steps (in scope):**
1. Profile → Templates modal opens, all 5 platform tabs render
2. Email tab now shows a **subject** editor above body
3. Type `{name}` / `{channel}` etc. → variable inserts at cursor
4. Save a custom template; close + reopen → it persisted
5. Send a test email to yourself → no YT boilerplate leaks in body
6. Copy-DM buttons exist for Instagram, LinkedIn, X, TikTok

| Checkbox | Outcome |
|---|---|
| `[ ]` | `⏳ Not tested yet` |

---

## 2️⃣ Promo code redemption — `285f92a` + `8193901`

**What changed:** `/pricing` now has an **Enter a promo code** CTA
(renamed from "Have a code?" per your ask). Opens an input → applies
to checkout via Stripe `discounts: [{ promotion_code }]`. Invalid
codes show inline 400 error.

**Validation steps (in scope):**
1. Visit `/pricing` (signed in)
2. CTA reads **"Enter a promo code"** (not "Have a code?")
3. Click → input expands. Type random `ZZZZZ` → applies (client only
   shape-checks). Click any plan button → checkout returns "Promo
   code 'ZZZZZ' not found or expired."
4. Create a real promotion code in Stripe dashboard
5. Apply → checkout completes with discount applied
6. Pill confirms `Code applied: <CODE>` after applying

| Checkbox | Outcome |
|---|---|
| `[ ]` | `⏳ Not tested yet` |

---

## 3️⃣ Active Clients v1 (legacy, superseded by v2) — `217b769`

**What changed:** original sub-tab MVP — engagement cards with
inline budget/timeline/scope/contract-URL/notes fields. Migration
0028 added 7 nullable columns to `outreach_entries`.

**Validation steps (in scope):**
1. Run `0028_active_clients.sql` in Supabase SQL editor (if you
   haven't already — v2 depends on these columns too)
2. Confirm `outreach_entries` now has `client_budget_amount`,
   `client_budget_currency`, `client_timeline_start`,
   `client_timeline_end`, `client_scope`, `client_contract_url`,
   `client_notes`

| Checkbox | Outcome |
|---|---|
| `[ ]` | `⏳ Not tested yet` |

---

## 4️⃣ Landing build-stamp removed — `b3efdab`

**What changed:** the tiny `Built 2026-05-XX` stamp at the bottom of
the landing page footer is gone.

**Validation steps (in scope):**
1. Visit `/landing` (incognito so you're not logged in)
2. Scroll to footer → no build hash / build date visible

| Checkbox | Outcome |
|---|---|
| `[ ]` | `⏳ Not tested yet` |

---

## 5️⃣ Active Clients v2 — BIG BUILD — `eaeaba0`

**What changed:** complete depth pass on top of v1. Lifecycle
states · detail modal · milestone checklist · activity timeline ·
contract file upload to Supabase Storage · search + sort + filter ·
avg-duration metric. Migration 0029 adds 7 columns + a `contracts`
storage bucket + 4 RLS policies.

**⚠️ REQUIRED FIRST:** paste
`supabase/migrations/0029_active_clients_expansion.sql` into
[Supabase SQL Editor](https://supabase.com/dashboard/project/qsvsiypwecngqrzgvnxv/sql/new)
and run it. Without this, lifecycle/milestone saves return
"Run migrations 0028 + 0029" and contract upload says "bucket not
yet available."

**Validation steps (in scope):**

### Setup
1. Migration 0029 ran successfully in Supabase
2. Confirm `outreach_entries.client_lifecycle` column exists
3. Confirm Storage → `contracts` bucket exists (Storage section of
   Supabase dashboard)
4. Confirm 4 RLS policies on `storage.objects` for `contracts`

### Tab + filter
5. Outreach tab → **Active Clients** sub-tab loads
6. Mark an existing outreach `Successful` → it appears as a card
7. Metric row shows 5 cards (Clients shown, Total booked, Avg deal,
   Avg duration, Contracts)
8. Lifecycle filter pills work (All / Active / Paused / Completed /
   Churned) with live counts

### Card → modal flow
9. Click a card → detail modal opens
10. Modal shows: channel name + lifecycle pill, two-column body,
    lifecycle action bar at bottom
11. Edit budget → "Saved" flash → activity timeline gains
    `Set budget to $X`
12. Change lifecycle → card chip updates, filter counts update
13. Add a milestone via input → progress bar appears
14. Click "Use default checklist" → 4 milestones seed (Kickoff,
    Brief, Deliverable, Invoice)
15. Toggle a milestone checkbox → activity log records
    `Milestones: completed 1`

### Contract upload
16. Drag-and-drop a PDF onto the dropzone → uploads, file card
    appears with name + size + uploaded date
17. Click external-link icon on file card → opens signed URL in
    new tab (PDF viewer should load)
18. Click trash icon → file removed, dropzone returns
19. Paste an external link in the URL field → blur → activity logs
    `Set external contract link`

### Search + sort
20. Type a channel name in search → grid filters
21. Sort dropdown switches between Most recent / Budget / End date /
    Channel A-Z

### Empty + filtered empty states
22. With no Successful outreaches → top-level empty state ("No
    active clients yet")
23. Apply a lifecycle filter that has 0 matches → filtered empty
    state ("No matches")

| Checkbox | Outcome |
|---|---|
| `[ ]` | `⏳ Not tested yet` |

---

## Still pending (not yet pushed)

These were on the punch list before this push. Not in scope for
this validation pass — listed so you know they're open.

| Item | Status |
|---|---|
| Resend DPA signed | Pending vendor counter-signature |
| Upstash DPA signed | Pending vendor counter-signature |
| DPA discoverability in legal nav (currently tucked in `<details>` on `/subprocessors`) | Pending design decision: rename, expand-by-default, or new `/dpas` route |

---

## Deploy state

- Last commit on origin: `eaeaba0`
- Local + remote in sync; working tree clean
- Vercel auto-deploy via GitHub webhook expected on push to `main`.
  If `/landing` doesn't reflect the new commit in ~3 minutes, force:
  ```bash
  vercel --prod --yes --scope oinoilyds-projects
  ```
