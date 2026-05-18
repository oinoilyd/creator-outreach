# Next Steps — Creator Outreach

Consolidated action list as of 2026-05-13. Pulls in playbook items, the
post-paywall polish work, and everything from backlog. Each item is one
action with an estimate so you can pick by available time slot.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## This Week (high leverage, small lift)

- [ ] **Create `VIPOUTREACH` Stripe coupon — 1 free month.**
  *30 min · Stripe Dashboard*
  Stripe → Products → Coupons → New.
  - Name: `VIPOUTREACH`
  - ID: `VIPOUTREACH`
  - Type: Percentage discount
  - Percent off: 100%
  - Duration: Once *(applies to the first invoice after trial ends → user
    gets the 14-day trial + 1 free month = ~6 weeks before any charge)*
  - Max redemptions: 50 *(adjust based on how many VIPs you intend to gift)*
  - Redeem by: 2026-08-31 *(keeps it from leaking forever)*

  Then surface the code on `/pricing` as an optional "Have a code?" link
  next to the Subscribe button. Stripe Checkout already accepts `discounts:
  [{ coupon: 'VIPOUTREACH' }]` if you pass it from the checkout API.

- [ ] **Polish `/pricing` FAQ — 5 objections inline below the cards.**
  *30 min · `app/pricing/page.tsx`*
  Top objections to answer:
  1. What happens at the end of the 14-day trial?
  2. Can I cancel anytime?
  3. Do I keep my data if I cancel?
  4. Will my card be charged today? *(no — only after trial ends)*
  5. What counts as a "creator search" / are there limits?

- [ ] **Polish pricing model + cards.**
  *30 min · `app/pricing/page.tsx` + `app/landing/page.tsx`*
  Audit the value props on each plan card. Right now Monthly and Annual
  share most features — surface what's actually different (priority
  support, custom scoring presets, etc.) so Annual feels worth the lift.
  Re-check copy clarity: someone landing cold should understand the
  product in 5 seconds from the cards alone.

- [ ] **Walk through onboarding incognito as a new user.**
  *30 min · browser*
  Open incognito → creatoroutreach.net → sign up with a brand-new email →
  hit the paywall → start trial in Stripe Checkout → land back in app →
  first search → first outreach. Note every awkward moment in a bullet
  list. Batch-fix in one session.

---

## Engineering Backlog

- [ ] **Fix empty `VERCEL_GIT_COMMIT_SHA` on production.**
  *15 min · Vercel project settings*
  The build-stamp footer (commit `6193113`) renders empty on prod because
  the env var isn't being exposed at runtime. Likely fix: enable "Automatically
  expose System Environment Variables" in Vercel → Project → Settings →
  Environment Variables, then redeploy.
  Why: this is the diagnostic tool for catching stale-deploy reports.
  Without it, we have to debug each one cold.

- [ ] **Enable Stripe trial-end reminder emails in Dashboard.**
  *5 min · Stripe Dashboard*
  Stripe Dashboard → Settings → Billing → Subscriptions and emails →
  toggle ON "Email customers when their trial is about to end." Default
  is 3 days before — leave as is. The /pricing FAQ now claims this email
  is sent, so the toggle has to actually be on. Without this toggle,
  customers get surprise-charged when their trial ends, the #1 reason
  for chargebacks on SaaS trials.

- [ ] **Upgrade Supabase to Pro ($25/mo).**
  *5 min · Supabase Dashboard*
  Required before first paying customer — free tier has a 50K row /
  500MB / 2GB egress limit. Pro lifts to 8GB / 250GB egress + adds daily
  backups + 7-day point-in-time recovery. Do this BEFORE the first warm
  intro converts so the upgrade isn't blocking a transaction.

- [ ] **Cancel Unipile trial.**
  *5 min · Unipile dashboard*
  Trial ends ~2026-05-17. Cancel before then. Per earlier decision, status
  field still powers follow-ups + analytics, so the UX doesn't degrade —
  but Path B (programmatic send) goes dark. Re-subscribe at $200 MRR.

- [ ] **Implement "Have a code?" coupon input on `/pricing`.**
  *45 min · `app/pricing/page.tsx` + `app/api/stripe/checkout/route.ts`*
  After VIPOUTREACH exists in Stripe, expose a small input below the
  Subscribe CTA: user types a code → POST to /api/stripe/checkout with
  `body.couponCode` → checkout endpoint validates via Stripe coupons.retrieve
  and adds it to `session.discounts`. Bonus: server-side reject invalid /
  expired codes so the user gets immediate feedback.

---

## Marketing / GTM (launch playbook items not yet done)

- [ ] **Build the product demo video (3-5 min).** Dylan.
  *2-4 hours*
  Walks through AI fit score, 5-platform search, outreach send, CRM,
  custom analytics. Practical, not narrative. Linked in every warm intro.

- [ ] **Write Ryan's warm-intro email template.** Dylan.
  *15 min*
  First impression for all 100 leads. Casual + credible + clear ask.
  Save in `docs/templates/warm-intro.md` so Ryan can copy + customize per
  lead.

- [ ] **Write follow-up email sequence (first reply + 2-3 follow-ups).** Dylan.
  *30 min*
  Conversion determinant. Most leads need 2-3 touches before they bite.
  Save in `docs/templates/follow-ups.md`.

- [ ] **Produce founder story video (2-4 min).** Ryan.
  *1-2 days editing*
  Ryan tells his story — industry experience, why this product, what it
  means to him — ending with the product as the resolution. Linked in
  warm intro next to the demo video.

- [ ] **Plan testimonial collection.** Dylan.
  *15 min*
  Pick the moment to ask each customer for a quote (after first send?
  after first reply? after the first close?). First 5 testimonials =
  next 100 customers.

---

## Legal / Org

- [ ] **Reply with Gaynor Media LLC info.** Ryan.
  *1 min*
  State, county, full registered address, EIN. Unblocks Stripe legal-name
  fields + the `[LLC ADDRESS]` placeholder in `/privacy`.

- [ ] **Review employment contract for non-compete / non-solicit.** Ryan.
  *20 min*
  Flag any clauses restricting side-venture work. Identify accounts in
  the 100-lead pipeline that are off-limits.

- [ ] **Curate the 100 leads.** Ryan.
  *30-60 min*
  Segment into 'safe to intro' vs 'skip' based on contract review. Build
  the actual list with email + context per lead.

- [ ] **Send the warm intros.** Ryan.
  *1-2 hrs across launch week*
  Use the intro template once Dylan ships it (see above). Batch by batch
  so Dylan can keep up with inbound.

- [ ] **Form Creator Outreach LLC at $300 revenue milestone.** Dylan.
  *~$150 setup + $75/yr Illinois*
  Once cumulative net revenue hits $300, file the Articles of Organization
  for Creator Outreach LLC. Moves the product off Gaynor Media LLC as a
  DBA and into its own entity, reducing legal entanglement with Ryan's
  employer-conflict surface.

- [x] **Supabase DPA.** Dylan. *Done 2026-05-18.*
  Self-signed via Supabase Dashboard → Organization → Legal Documents →
  PandaDoc (no support ticket needed). PDF filed at
  `public/legal/DPA-Supabase-signed.pdf`; row added to /admin/legal.
  All five sub-processors now have counter-signed DPAs.

---

## Joint / Async

- [ ] **Dylan follows up + closes.**
  Ongoing during launch — reply to interested leads, book calls if needed,
  send checkout link, handle questions.

- [ ] **Daily 5-min sync during launch week.**
  What's converting, what's not, what to tweak. Async OK. Most learnings
  happen in the first 10 leads.

---

## Tonight (suggested ordering if you keep working)

1. Create VIPOUTREACH coupon (30 min Dashboard work, no code).
2. Polish /pricing FAQ (30 min — pure copy, no logic).
3. Pricing model audit (30 min — same area, batch with #2).
4. Stop. Sleep. Tomorrow handles demo video / Ryan's intros.

Total tonight: ~90 min of solid progress without touching anything risky.
