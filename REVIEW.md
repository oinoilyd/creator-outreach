# Design Review — Three Interfaces, Three+ Skills

Reviewed against the four design skills installed at `~/.claude/skills/`:

- **TS** — `taste-skill` (Leonxlnx) — anti-slop frontend rules
- **EM** — `emil-design-eng` (emilkowalski) — animation craft + invisible details
- **UX** — `ui-ux-pro-max` (nextlevelbuilder) — design tokens, archetypes, accessibility
- **MWD** — `modern-web-design` (freshtechbro) — performance, glassmorphism, tokens

★ = **multiple skills agree**, listed as the highest-priority fixes.

The "Reviewed" column shows what's currently shipped. The "Issue" column quotes the specific skill rule violated.

---

## 1. Pre-sign-in (`/landing`)

### High-priority issues (★ multi-skill agreement)

| # | Reviewed | Issue (skill) | Recommended fix |
|---|---|---|---|
| 1 ★ | Headline + CTA glow + Aurora orbs are heavily violet/purple | **TS — "THE LILA BAN":** *"The 'AI Purple/Blue' aesthetic is strictly BANNED. No purple button glows, no neon gradients."* / **MWD** advises desaturated accents | Cut the Lila count: drop the `shadow-[0_0_80px_-10px_rgba(124,58,237,0.75)]` glow on the primary CTA, desaturate Aurora orbs (drop saturation 30-40%), keep ONE accent (violet) and let it carry the brand alone. Cyan can stay as a secondary but should not be a co-equal "rainbow." |
| 2 ★ | Centered hero (`text-center max-w-6xl mx-auto`) | **TS — "ANTI-CENTER BIAS":** *"Centered Hero/H1 sections are strictly BANNED when LAYOUT_VARIANCE > 4."* / **MWD** Pattern 1 lists asymmetric heros / **UX** archetype catalog includes Split-Screen | Asymmetric hero: text left-aligned (or right) + product visual on the opposite side. Frees the AppPreview from "below the fold" — it joins the hero as the right pane. |
| 3 ★ | Headline `text-5xl md:text-7xl lg:text-8xl` — oversized | **TS — "NO Oversized H1s":** *"The first heading should not scream. Control hierarchy with weight and color, not just massive scale."* / **EM** "Beauty is leverage" (proportion is taste) | Drop to `text-4xl md:text-5xl lg:text-6xl`, increase weight (`font-semibold` → `font-bold` only on the accent word), tighten leading further. |
| 4 ★ | `Sparkles ✨`, `🔥`, `⏰`, `👋` emojis present (verified by grep) | **TS — "ANTI-EMOJI POLICY [CRITICAL]":** *"NEVER use emojis in code, markup, text content, or alt text. Replace symbols with high-quality icons (Radix, Phosphor) or clean SVG primitives. Emojis are BANNED."* | Replace every emoji with an SVG icon. Specifically: `✨` → `Sparkles` icon (already imported), `🔥` → `Flame` icon, `⏰` → `Clock`, `👋` → just remove or use `HandWaving` from Phosphor. |
| 5 ★ | Bento has 5+ cards, several in **3-equal-card** rows | **TS — "NO 3-Column Card Layouts":** *"The generic '3 equal cards horizontally' feature row is BANNED. Use a 2-column Zig-Zag, asymmetric grid, or horizontal scrolling approach."* / **TS Section 9** advocates Bento 2.0 (asymmetric tile sizing) | Currently we DO use asymmetric `md:col-span-2` on some cards. Check if any row collapses to 3 equal. The custom-metrics card was added at col-1 paired with analytics col-2 — that's good. But "Built-in CRM (col-2) + Cadence (col-1)" + "Analytics (col-2) + Custom (col-1)" — fine. Audit on prod after deploy. |
| 6 ★ | `text-fill-gradient` headline (bg-clip-text + text-transparent) | **TS — "NO Excessive Gradient Text":** *"Do not use text-fill gradients for large headers."* / **MWD** says use color + weight for hierarchy | Keep gradient ONLY on the accent word ("spreadsheets") in `--brand` → `--brand-2`. The other words should be solid `text-foreground`, no gradient. We're already partially there per the latest TextGenerateEffect. Verify on prod. |
| 7 ★ | Meteors falling diagonally (12) + Spotlight cursor + Aurora orbs + BorderBeam = 4 simultaneous bg motion sources | **EM — "1. Should this animate at all?":** *"If the purpose is just 'it looks cool' and the user will see it often, don't animate."* / **TS** caps at MOTION_INTENSITY 6/10; we exceed this on first paint | Audit each motion: does each have a clear "why?" Trim Meteors (already toned 18→12, slow but still busy). Aurora orbs are atmosphere = keep but desaturate. Spotlight = keep (interactive). BorderBeam = keep (eye to CTA). Meteors might be the cut — try without them and see if hero still has movement enough. |

### Single-skill notes

| # | Reviewed | Issue (skill) | Recommended fix |
|---|---|---|---|
| 8 | Geist Sans default font | TS prefers `Cabinet Grotesk`, `Outfit`, or `Satoshi` for "premium/creative" vibes (Geist is acceptable but not their pick) | **Keep Geist** — Vercel-tier, free, already loaded. Don't introduce new font for marginal differentiation. |
| 9 | Spring physics on TextGenerateEffect uses `ease: 'easeOut'` (CSS default) | **EM:** *"Critical: use custom easing curves. The built-in CSS easings are too weak."* — provides `cubic-bezier(0.23, 1, 0.32, 1)` | Apply `ease: [0.23, 1, 0.32, 1]` (Framer Motion array form) to TextGenerateEffect, AppPreview transitions, BentoCard reveals. |
| 10 | No skeleton loading state on AppPreview tab swap | **EM:** *"5. Empty/loading states with proper transitions"* / **MWD:** Skeletons > spinners | Low priority — AppPreview switches static images with framer fade. Acceptable. |
| 11 | Spotlight effect color is rgba(124,58,237,0.28) = violet | TS — "NO purple button glows" — Spotlight is a soft cursor light, not a button glow. Probably acceptable. | Keep but consider reducing opacity to 0.18-0.22. |
| 12 | Meteor `animation: meteor 8s linear infinite` | **EM:** *"Constant motion (marquee, progress bar) → linear"* — meteors qualify | OK as-is. |

---

## 2. Sign-in page (`/auth/signin`)

| # | Reviewed | Issue (skill) | Recommended fix |
|---|---|---|---|
| 13 ★ | Form card centered in viewport with Aurora behind | **TS — "ANTI-CENTER BIAS"** at high variance / **UX** says auth pages benefit from focused center but allow split-screen variant | Acceptable for auth — auth is a focused single-task page. **Anti-center bias doesn't apply here**. Center is correct. |
| 14 | Submit button is `bg-primary` violet | TS — Lila ban applies | Reduce primary's saturation slightly OR lean into violet as the SOLE accent (no cyan elsewhere on this page). |
| 15 | Inputs: `bg-muted` light, `bg-white/[0.04]` dark | **MWD** depth scale: cards/inputs need proper elevation | Add a subtle inset shadow on inputs in light mode for depth: `shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]` |
| 16 | Sign in / Sign up / Forgot links all `text-brand` | **TS — Color Calibration Constraint Max 1 Accent** | Already follow this — fine. |
| 17 | Card width `max-w-sm` (24rem ≈ 384px) | **MWD** Pattern: forms feel right at 360-420px wide | OK as-is. |
| 18 | Form submit on press: no `:active` scale feedback | **TS — Tactile Feedback** + **EM — Animation Decision Framework** "1. Should this animate?" → buttons clicked many times = yes for tactile feel | Add `active:scale-[0.98]` on the submit button + on links. ~5-10ms ease, no transition explicitly so :active is instant. |
| 19 | No keyboard focus styles on the brand link "Sign up" / "Forgot password" | **MWD** Accessibility — all interactive must have visible focus | Add `focus-visible:outline-2 focus-visible:outline-brand` to the brand-colored links. |
| 20 | Error toast text uses `text-red-300` (good in dark mode) | Light mode: red-300 is washed out on near-white bg | Use `text-red-600 dark:text-red-300` instead. |

---

## 3. Internal app (`/` after sign-in)

### High-priority (★ multi-skill agreement)

| # | Reviewed | Issue (skill) | Recommended fix |
|---|---|---|---|
| 21 ★ | Emojis in tab labels: `⏰ Follow-ups`, `🔥 High priority`, `📊 Analytics`, `★ Favorites`, `✨ Your criteria` | **TS — "ANTI-EMOJI POLICY [CRITICAL]"** | Replace every emoji with lucide-react SVG icon (already imported in this file). The `⏰` → `<Clock>`, `🔥` → `<Flame>`, `📊` → `<BarChart3>`, `★` → `<Star>`. Uniform stroke 1.5 for consistency. |
| 22 ★ | Pure black backgrounds in screenshots and bg `bg-gray-950` references | **TS — "NO Pure Black":** *"Never use #000000. Use Off-Black, Zinc-950, or Charcoal."* | Token `--background` in dark is `oklch(0.08 0.005 280)` — that's already off-black with violet tint. Good. Audit for any `bg-black` literals. |
| 23 ★ | Outreach table is a dense data grid with `bg-card` rows + `border-border` separators between every row | **TS Rule 4 "Anti-Card Overuse":** *"For VISUAL_DENSITY > 7, generic card containers are strictly BANNED. Use logic-grouping via `border-t`, `divide-y`, or purely negative space."* / **TS Section 6 cockpit mode:** *"No card boxes; just 1px lines to separate data."* | Outreach table should be `divide-y divide-border` with a single outer card frame, NOT each row as its own card. Verify. |
| 24 ★ | Status pills use bright color blocks (`bg-emerald-500/10` etc.) | **TS Color Calibration:** *"Saturation < 80%"* — emerald-500 is ~75% sat, OK. | Acceptable. |

### Single-skill (still worth fixing)

| # | Reviewed | Issue (skill) | Recommended fix |
|---|---|---|---|
| 25 | Sort indicator `↑↓↕` are Unicode arrows, not SVG icons | **TS — Anti-emoji** (Unicode arrows are gray-area, but TS prefers icons) | Optional: replace with lucide `<ArrowUp>` / `<ArrowDown>` / `<ArrowUpDown>`. |
| 26 | "DM" link in Instagram cell is text-only | **EM — Tactile Feedback** + **TS — Tactile Feedback** | Already has `cursor-pointer` via the `<a>` element. Add `active:scale-[0.96]` for a press feedback. |
| 27 | Clipboard-copy toast appears **after** click | **EM — Perceived Performance** *"180ms feels more responsive than 400ms"* | The toast itself is sonner-default (probably ~200ms enter). Acceptable. |
| 28 | Search input has no skeleton/loading state during async search | **TS Rule 5 — Mandatory Loading States** + **MWD** Skeletons > spinners | We have an inline progress (`enrichProgress`) but no skeleton rows in the table during initial load. |
| 29 | Multi-sort priority badges (`1`, `2`, `3`) are tiny `text-[9px]` purple chips | **EM — Unseen details compound** (badges should feel right) | Increase to `text-[10px]`, give them a slight shadow when primary, animate the badge in/out with Framer's spring. |
| 30 | Animations across the app default to `transition-colors` (CSS default ease) | **EM — "Critical: use custom easing curves"** — *cubic-bezier(0.23, 1, 0.32, 1)* | Add a `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` token, replace generic transitions on hover states. |

---

## Summary table — fixes ranked by ★ count

| Rank | Fix | Skills agreeing | Effort |
|---|---|---|---|
| 1 | Strip emojis everywhere → SVG icons | TS, MWD | 30 min — find/replace, ~10 sites |
| 2 | Lila reduction: kill primary CTA glow + desaturate Aurora orbs | TS, MWD | 15 min |
| 3 | Hero: centered → asymmetric (text-left + visual-right) | TS, MWD, UX | 45 min |
| 4 | Headline scale down + remove text-fill gradient (keep accent word only) | TS, MWD | 10 min |
| 5 | Outreach table: rows as `divide-y` not stacked cards | TS | 15 min — verify + adjust |
| 6 | Custom easing curve token + apply to motion | EM | 20 min |
| 7 | `:active` scale feedback on all buttons | TS, EM | 15 min |
| 8 | Audit motion for "why does this animate?" — trim meteors | EM, TS | 5 min decision |
| 9 | Skeleton loading state for search results | TS, MWD | 30 min |
| 10 | Sign-in: add focus-visible styles, light-mode red, inset input shadows | MWD, EM | 15 min |

**Total estimated effort: ~3.5 hours focused work.**

---

## What I propose for the preview

Implement fixes 1-7 (highest-impact, multi-skill consensus, fastest path to "feel different") on a branch:

```
git checkout -b design-review-iter-1
```

Push the branch → Vercel auto-creates a preview URL like `https://creator-outreach-design-review-iter-1-oinoilyds-projects.vercel.app`. You review the preview, approve to merge OR request changes. We iterate without touching prod.

Fixes 8-10 are smaller polish — can land in iter-2 once you've signed off on iter-1.

---

## Open questions before I start

1. **Asymmetric hero** — comfortable making this the change? It's the biggest visual shift. The product screenshot moves from "below" to "right side of hero," which means tighter screenshot dimensions.
2. **How aggressive on Lila reduction?** Keep violet primary but kill all glows (my pick), or fully repalette to a different accent (zinc + emerald, per TS rule)?
3. **Anything you DON'T want changed** that I might have flagged?

Reply with answers to those + "go" and I open the branch.
