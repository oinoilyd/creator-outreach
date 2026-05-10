'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Filter, Search, Zap } from 'lucide-react'

/**
 * Four variants of the search filter top bar:
 *   A. Editorial / magazine — cream + navy, serif accents, hairlines
 *   B. Neo-brutalism — black borders, yellow accent, offset shadows
 *   C. Glass bento — translucent cards, gradient glows, depth layers
 *   D. Current — reference clone of the live layout
 *
 * Each variant renders the SAME selections (the screenshot Dylan
 * sent: keyword='trading', region='Ireland', recency='Last 6 months',
 * showOnly='Email-first sort', avg views 0–200K). That keeps the
 * comparison about presentation, not state.
 */

// ── shared data ─────────────────────────────────────────────────────

const VIEW_PRESETS = ['0–10K', '10K–50K', '50K–200K', '200K–1M', '1M–5M', '5M+', '0–500K', 'Any']
const SUBS_PRESETS = ['<1K', '1K–10K', '10K–100K', '100K–500K', '500K–1M', '1M–5M', '5M–10M', '10M+', 'Any']
const RECENCY = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Last 6 months', 'Any time']
const SHOW_ONLY = ['Has email', 'Email-first sort']
const REGIONS: Array<{ code: string; flag: string; label: string }> = [
  { code: 'EN', flag: '🌐', label: 'English' },
  { code: 'GLOBAL', flag: '🌍', label: 'Global' },
  { code: 'US', flag: '🇺🇸', label: 'United States' },
  { code: 'GB', flag: '🇬🇧', label: 'United Kingdom' },
  { code: 'CA', flag: '🇨🇦', label: 'Canada' },
  { code: 'AU', flag: '🇦🇺', label: 'Australia' },
  { code: 'NZ', flag: '🇳🇿', label: 'New Zealand' },
  { code: 'IE', flag: '🇮🇪', label: 'Ireland' },
  { code: 'IN', flag: '🇮🇳', label: 'India' },
  { code: 'PH', flag: '🇵🇭', label: 'Philippines' },
  { code: 'SG', flag: '🇸🇬', label: 'Singapore' },
  { code: 'NG', flag: '🇳🇬', label: 'Nigeria' },
  { code: 'ZA', flag: '🇿🇦', label: 'South Africa' },
  { code: 'AE', flag: '🇦🇪', label: 'UAE' },
  { code: 'DE', flag: '🇩🇪', label: 'Germany' },
  { code: 'FR', flag: '🇫🇷', label: 'France' },
  { code: 'ES', flag: '🇪🇸', label: 'Spain' },
  { code: 'BR', flag: '🇧🇷', label: 'Brazil' },
  { code: 'MX', flag: '🇲🇽', label: 'Mexico' },
  { code: 'JP', flag: '🇯🇵', label: 'Japan' },
  { code: 'KR', flag: '🇰🇷', label: 'South Korea' },
  { code: 'ID', flag: '🇮🇩', label: 'Indonesia' },
]

const SHARED = {
  keyword: 'trading',
  avgViewsMin: 0,
  avgViewsMax: 200000,
  subsActive: 'Any',
  recency: 'Last 6 months',
  showOnlyActive: 'Email-first sort',
  region: 'IE',
  found: 100,
}

// ── tab shell ──────────────────────────────────────────────────────

const TABS = [
  { id: 'A' as const, label: 'A · Editorial', sub: 'magazine, serif, hairline rules' },
  { id: 'B' as const, label: 'B · Neo-brutalist', sub: 'hard borders, offset shadows' },
  { id: 'C' as const, label: 'C · Glass bento', sub: 'translucent cards, gradient glow' },
  { id: 'D' as const, label: 'D · Current', sub: 'reference clone' },
]

export function FilterPreview() {
  const [tab, setTab] = useState<'A' | 'B' | 'C' | 'D'>('A')
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/40">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Filter bar — design preview</h1>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Same selections in every tab. Pick a direction and I&apos;ll wire it up for real.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-4 py-2 transition-colors"
          >
            ← Admin
          </Link>
        </div>
        {/* Tabs */}
        <div className="max-w-[1400px] mx-auto px-6 flex items-stretch gap-1">
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 pt-3 pb-3.5 text-sm transition-colors ${
                  active
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div>{t.label}</div>
                <div className="text-[10px] text-muted-foreground/70 font-normal mt-0.5">
                  {t.sub}
                </div>
                {active && (
                  <div className="absolute left-0 right-0 -bottom-px h-0.5 bg-purple-600" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        {tab === 'A' && <VariantEditorial />}
        {tab === 'B' && <VariantBrutalist />}
        {tab === 'C' && <VariantGlassBento />}
        {tab === 'D' && <VariantCurrent />}

        {/* Notes block — same across all tabs */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground/80">
          <div>
            <div className="font-semibold text-foreground/90 mb-1">A · Editorial</div>
            Cream + navy, deep typographic hierarchy, hairline section rules. Reads like a
            magazine layout — restrained, content-forward, slow rhythm. Best fit if you want the
            tool to feel premium and considered rather than dashboard-y.
          </div>
          <div>
            <div className="font-semibold text-foreground/90 mb-1">B · Neo-brutalist</div>
            Hard 2–3px borders, offset shadows, yellow accent on a near-white base. Loud,
            confident, opinionated — feels like a tool not a SaaS template. Works if you want
            the brand to be memorable and slightly counterculture.
          </div>
          <div>
            <div className="font-semibold text-foreground/90 mb-1">C · Glass bento</div>
            Each section is a translucent layered card on a dark backdrop with gradient active
            states. Modern, depth-rich, tech-forward. Works well when paired with motion. Closest
            to current direction but with real depth.
          </div>
        </div>
      </div>
    </main>
  )
}

// ── Variant A — Editorial / Magazine ───────────────────────────────

function VariantEditorial() {
  return (
    <div
      style={{ background: '#FCFAF6', color: '#0F1733' }}
      className="rounded-2xl p-10 border border-[#E8E2D5]"
    >
      {/* Heading + search */}
      <div className="flex items-start justify-between gap-8 mb-10 pb-8 border-b border-[#0F1733]/15">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.32em] text-[#0F1733]/50 mb-3 font-medium">
            № 01 — Sourcing
          </div>
          <div className="flex items-baseline gap-4">
            <span
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              className="text-[#0F1733]/40 text-5xl italic leading-none"
            >
              Find
            </span>
            <input
              defaultValue={SHARED.keyword}
              className="flex-1 bg-transparent text-4xl font-semibold tracking-tight border-0 border-b-2 border-[#0F1733] pb-2 outline-none placeholder:text-[#0F1733]/30 text-[#0F1733]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-7">
          <button className="w-11 h-11 inline-flex items-center justify-center border border-[#0F1733]/25 hover:bg-[#0F1733]/5 transition-colors">
            <Zap className="w-4 h-4" />
          </button>
          <button className="w-11 h-11 inline-flex items-center justify-center border border-[#0F1733]/25 hover:bg-[#0F1733]/5 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button
            style={{ background: '#0F1733', color: '#FCFAF6' }}
            className="px-7 h-11 text-sm uppercase tracking-[0.18em] font-semibold hover:opacity-90 transition-opacity"
          >
            Search
          </button>
        </div>
      </div>

      {/* Filter rows */}
      <div className="space-y-7">
        <EditorialRow label="Avg views">
          <EditorialInput defaultValue={SHARED.avgViewsMin} />
          <span className="text-[#0F1733]/40 text-xs italic">to</span>
          <EditorialInput defaultValue={SHARED.avgViewsMax} />
          <span className="text-[#0F1733]/30 mx-2">/</span>
          {VIEW_PRESETS.map(v => (
            <EditorialChip key={v}>{v}</EditorialChip>
          ))}
        </EditorialRow>

        <EditorialRow label="Subscribers">
          <EditorialInput placeholder="Min" />
          <span className="text-[#0F1733]/40 text-xs italic">to</span>
          <EditorialInput placeholder="Max" />
          <span className="text-[#0F1733]/30 mx-2">/</span>
          {SUBS_PRESETS.map(s => (
            <EditorialChip key={s} active={s === SHARED.subsActive}>
              {s}
            </EditorialChip>
          ))}
        </EditorialRow>

        <EditorialRow label="Last posted">
          {RECENCY.map(r => (
            <EditorialChip key={r} active={r === SHARED.recency}>
              {r}
            </EditorialChip>
          ))}
        </EditorialRow>

        <EditorialRow label="Show only">
          {SHOW_ONLY.map(s => (
            <EditorialChip key={s} active={s === SHARED.showOnlyActive}>
              {s}
            </EditorialChip>
          ))}
        </EditorialRow>

        <EditorialRow label="Region">
          {REGIONS.map(r => (
            <button
              key={r.code}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs transition-colors ${
                r.code === SHARED.region
                  ? 'bg-[#0F1733] text-[#FCFAF6]'
                  : 'border border-[#0F1733]/20 hover:border-[#0F1733]/60 text-[#0F1733]/85'
              }`}
            >
              <span className="text-[13px]">{r.flag}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </EditorialRow>
      </div>

      {/* Status */}
      <div className="mt-10 pt-6 border-t border-[#0F1733]/15 flex items-baseline gap-3 text-[11px] uppercase tracking-[0.18em] text-[#0F1733]/60">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: '#10B981' }}
        />
        <span>Done</span>
        <span className="text-[#0F1733]/30">/</span>
        <span className="text-[#0F1733]">{SHARED.found} creators found</span>
      </div>
    </div>
  )
}

function EditorialRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-6 items-start">
      <div className="pt-1">
        <div className="text-[10px] uppercase tracking-[0.32em] text-[#0F1733]/55 font-semibold">
          {label}
        </div>
        <div className="h-px bg-[#0F1733]/15 mt-2" />
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function EditorialInput({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string | number
  placeholder?: string
}) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-24 px-3 py-1.5 bg-transparent text-sm text-[#0F1733] border-b border-[#0F1733]/30 focus:border-[#0F1733] outline-none placeholder:text-[#0F1733]/30 tabular-nums"
    />
  )
}

function EditorialChip({
  children,
  active,
}: {
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      className={`px-3 py-1 text-xs transition-colors ${
        active
          ? 'bg-[#0F1733] text-[#FCFAF6]'
          : 'border border-[#0F1733]/20 hover:border-[#0F1733]/60 text-[#0F1733]/85'
      }`}
    >
      {children}
    </button>
  )
}

// ── Variant B — Neo-brutalism ──────────────────────────────────────

function VariantBrutalist() {
  return (
    <div
      style={{ background: '#FAF8F2' }}
      className="rounded-none p-10 border-[3px] border-black"
    >
      {/* Heading + search */}
      <div className="flex items-stretch gap-3 mb-10">
        <div
          className="flex-1 flex items-center bg-white border-[3px] border-black px-5 py-4"
          style={{ boxShadow: '6px 6px 0 0 #000' }}
        >
          <Search className="w-5 h-5 text-black mr-3" strokeWidth={2.5} />
          <input
            defaultValue={SHARED.keyword}
            className="flex-1 bg-transparent border-0 outline-none text-2xl font-bold text-black placeholder:text-black/40"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          />
        </div>
        <BrutalIconBtn>
          <Zap className="w-5 h-5" strokeWidth={2.5} />
        </BrutalIconBtn>
        <BrutalIconBtn accent>
          <Filter className="w-5 h-5" strokeWidth={2.5} />
        </BrutalIconBtn>
        <button
          className="px-8 bg-black text-[#FFD500] font-black text-base uppercase tracking-wider border-[3px] border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          style={{ boxShadow: '6px 6px 0 0 #000', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
        >
          SEARCH
        </button>
      </div>

      {/* Filter sections — each is its own bordered card */}
      <div className="space-y-5">
        <BrutalSection label="AVG VIEWS">
          <BrutalNumberInput defaultValue={SHARED.avgViewsMin} />
          <span className="font-black text-lg text-black">→</span>
          <BrutalNumberInput defaultValue={SHARED.avgViewsMax} />
          <span className="text-black/30 mx-1 font-bold text-xl">|</span>
          {VIEW_PRESETS.map(v => (
            <BrutalChip key={v}>{v}</BrutalChip>
          ))}
        </BrutalSection>

        <BrutalSection label="SUBSCRIBERS">
          <BrutalNumberInput placeholder="MIN" />
          <span className="font-black text-lg text-black">→</span>
          <BrutalNumberInput placeholder="MAX" />
          <span className="text-black/30 mx-1 font-bold text-xl">|</span>
          {SUBS_PRESETS.map(s => (
            <BrutalChip key={s} active={s === SHARED.subsActive}>
              {s}
            </BrutalChip>
          ))}
        </BrutalSection>

        <BrutalSection label="LAST POSTED">
          {RECENCY.map(r => (
            <BrutalChip key={r} active={r === SHARED.recency}>
              {r}
            </BrutalChip>
          ))}
        </BrutalSection>

        <BrutalSection label="SHOW ONLY">
          {SHOW_ONLY.map(s => (
            <BrutalChip key={s} active={s === SHARED.showOnlyActive}>
              {s}
            </BrutalChip>
          ))}
        </BrutalSection>

        <BrutalSection label="REGION">
          {REGIONS.map(r => {
            const active = r.code === SHARED.region
            return (
              <button
                key={r.code}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold border-[2px] border-black transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${
                  active ? 'bg-[#FFD500] text-black' : 'bg-white text-black'
                }`}
                style={{ boxShadow: '2px 2px 0 0 #000', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
              >
                <span>{r.flag}</span>
                <span>{r.label.toUpperCase()}</span>
              </button>
            )
          })}
        </BrutalSection>
      </div>

      {/* Status */}
      <div
        className="mt-10 inline-flex items-center gap-2 bg-[#FFD500] text-black font-black text-xs uppercase px-4 py-2 border-[3px] border-black"
        style={{ boxShadow: '4px 4px 0 0 #000', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
      >
        <span className="inline-block w-2 h-2 bg-black" />
        DONE — {SHARED.found} CREATORS FOUND
      </div>
    </div>
  )
}

function BrutalIconBtn({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      className={`w-14 inline-flex items-center justify-center border-[3px] border-black transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
        accent ? 'bg-[#FFD500] text-black' : 'bg-white text-black'
      }`}
      style={{ boxShadow: '6px 6px 0 0 #000' }}
    >
      {children}
    </button>
  )
}

function BrutalSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
      <div
        className="bg-black text-[#FFD500] px-3 py-1.5 text-[11px] font-black tracking-wider"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
      >
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function BrutalNumberInput({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string | number
  placeholder?: string
}) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-24 px-2 py-1.5 bg-white border-[2px] border-black text-sm font-bold text-black placeholder:text-black/40 outline-none focus:bg-[#FFD500]/30 tabular-nums"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    />
  )
}

function BrutalChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-2.5 py-1 text-xs font-bold border-[2px] border-black transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${
        active ? 'bg-[#FFD500] text-black' : 'bg-white text-black'
      }`}
      style={{ boxShadow: '2px 2px 0 0 #000', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    >
      {children}
    </button>
  )
}

// ── Variant C — Glass bento ────────────────────────────────────────

function VariantGlassBento() {
  return (
    <div
      className="relative rounded-3xl p-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top left, #1a1530 0%, #0a0a1a 50%), radial-gradient(ellipse at bottom right, #2a1a4a 0%, #0a0a1a 50%)',
      }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
      />

      <div className="relative">
        {/* Search row — floating glass pill */}
        <div className="flex items-center gap-3 mb-7">
          <div
            className="flex-1 flex items-center backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/15"
            style={{ background: 'rgba(255,255,255,0.06)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
          >
            <Search className="w-5 h-5 text-white/60 mr-3" />
            <input
              defaultValue={SHARED.keyword}
              className="flex-1 bg-transparent border-0 outline-none text-xl font-medium text-white placeholder:text-white/40"
            />
          </div>
          <GlassIconBtn>
            <Zap className="w-4 h-4" />
          </GlassIconBtn>
          <GlassIconBtn active>
            <Filter className="w-4 h-4" />
          </GlassIconBtn>
          <button
            className="px-7 py-4 rounded-2xl text-white font-semibold text-sm transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
              boxShadow: '0 12px 40px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            Search
          </button>
        </div>

        {/* Bento grid: numeric filters in compact cards, region grid takes the bottom row */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          <GlassCard className="col-span-12 lg:col-span-6">
            <GlassLabel>Avg views</GlassLabel>
            <div className="flex items-center gap-2 mb-3">
              <GlassInput defaultValue={SHARED.avgViewsMin} />
              <span className="text-white/40 text-xs">to</span>
              <GlassInput defaultValue={SHARED.avgViewsMax} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VIEW_PRESETS.map(v => (
                <GlassChip key={v}>{v}</GlassChip>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="col-span-12 lg:col-span-6">
            <GlassLabel>Subscribers</GlassLabel>
            <div className="flex items-center gap-2 mb-3">
              <GlassInput placeholder="Min" />
              <span className="text-white/40 text-xs">to</span>
              <GlassInput placeholder="Max" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUBS_PRESETS.map(s => (
                <GlassChip key={s} active={s === SHARED.subsActive}>
                  {s}
                </GlassChip>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="col-span-12 md:col-span-7">
            <GlassLabel>Last posted</GlassLabel>
            <div className="flex flex-wrap gap-1.5">
              {RECENCY.map(r => (
                <GlassChip key={r} active={r === SHARED.recency}>
                  {r}
                </GlassChip>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="col-span-12 md:col-span-5">
            <GlassLabel>Show only</GlassLabel>
            <div className="flex flex-wrap gap-1.5">
              {SHOW_ONLY.map(s => (
                <GlassChip key={s} active={s === SHARED.showOnlyActive}>
                  {s}
                </GlassChip>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="col-span-12">
            <div className="flex items-baseline justify-between mb-3">
              <GlassLabel className="mb-0">Region</GlassLabel>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">
                Pick countries · go global for all
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
              {REGIONS.map(r => {
                const active = r.code === SHARED.region
                return (
                  <button
                    key={r.code}
                    className="relative group rounded-xl px-3 py-2 text-xs text-left transition-all hover:scale-[1.03] flex items-center gap-2"
                    style={
                      active
                        ? {
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.4) 0%, rgba(37,99,235,0.4) 100%)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 8px 24px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                            color: 'white',
                          }
                        : {
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.85)',
                          }
                    }
                  >
                    <span className="text-base shrink-0">{r.flag}</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                )
              })}
            </div>
          </GlassCard>
        </div>

        {/* Status */}
        <div
          className="inline-flex items-center gap-2.5 backdrop-blur-xl rounded-full px-4 py-2 border border-white/15 text-xs text-white/85"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: '#10B981', boxShadow: '0 0 8px #10B981' }}
          />
          <span className="font-medium">Done</span>
          <span className="text-white/30">·</span>
          <span className="text-white/70">{SHARED.found} creators found</span>
        </div>
      </div>
    </div>
  )
}

function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`backdrop-blur-xl rounded-2xl p-4 border border-white/10 ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </div>
  )
}

function GlassLabel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`text-[10px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-2.5 ${className}`}
    >
      {children}
    </div>
  )
}

function GlassIconBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className="w-12 h-12 inline-flex items-center justify-center backdrop-blur-xl rounded-2xl border transition-colors text-white/85"
      style={
        active
          ? {
              background: 'linear-gradient(135deg, rgba(124,58,237,0.4) 0%, rgba(37,99,235,0.4) 100%)',
              borderColor: 'rgba(255,255,255,0.25)',
              boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
            }
          : {
              background: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.12)',
            }
      }
    >
      {children}
    </button>
  )
}

function GlassInput({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string | number
  placeholder?: string
}) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-24 px-3 py-2 rounded-lg backdrop-blur-xl text-sm text-white outline-none border border-white/10 focus:border-purple-400/50 placeholder:text-white/35 tabular-nums"
      style={{ background: 'rgba(255,255,255,0.05)' }}
    />
  )
}

function GlassChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className="px-3 py-1.5 rounded-full text-[11px] transition-all hover:scale-[1.04]"
      style={
        active
          ? {
              background: 'linear-gradient(135deg, rgba(124,58,237,0.45) 0%, rgba(37,99,235,0.45) 100%)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
            }
          : {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.85)',
            }
      }
    >
      {children}
    </button>
  )
}

// ── Variant D — Current (reference) ─────────────────────────────────

function VariantCurrent() {
  return (
    <div className="bg-[#F4F2FB] rounded-2xl p-6 border border-[#D5D2E6]">
      {/* Search row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 bg-white border border-[#D5D2E6] rounded-2xl px-4 py-3 flex items-center">
          <input
            defaultValue={SHARED.keyword}
            className="flex-1 bg-transparent border-0 outline-none text-base text-[#1F1B2E]"
            placeholder="Search…"
          />
        </div>
        <button
          className="w-12 h-12 inline-flex items-center justify-center rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}
        >
          <Zap className="w-5 h-5" />
        </button>
        <button
          className="w-12 h-12 inline-flex items-center justify-center rounded-2xl text-white"
          style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
        >
          <span className="text-lg">🇮🇪</span>
        </button>
        <button
          className="px-7 h-12 rounded-2xl text-white font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
        >
          Search
        </button>
      </div>

      {/* Filter rows */}
      <div className="bg-white rounded-2xl border border-[#D5D2E6] divide-y divide-[#E8E5F2]">
        <CurrentRow label="Avg views:">
          <CurrentNum defaultValue={SHARED.avgViewsMin} />
          <span className="text-xs text-[#6B6580]">to</span>
          <CurrentNum defaultValue={SHARED.avgViewsMax} />
          <span className="text-[#D5D2E6] mx-1">|</span>
          {VIEW_PRESETS.map(v => (
            <CurrentChip key={v}>{v}</CurrentChip>
          ))}
        </CurrentRow>

        <CurrentRow label="Subscribers:">
          <CurrentNum placeholder="Min" />
          <span className="text-xs text-[#6B6580]">to</span>
          <CurrentNum placeholder="Max" />
          <span className="text-[#D5D2E6] mx-1">|</span>
          {SUBS_PRESETS.map(s => (
            <CurrentChip key={s} active={s === SHARED.subsActive}>
              {s}
            </CurrentChip>
          ))}
        </CurrentRow>

        <CurrentRow label="Last posted:">
          {RECENCY.map(r => (
            <CurrentChip key={r} active={r === SHARED.recency}>
              {r}
            </CurrentChip>
          ))}
        </CurrentRow>

        <CurrentRow label="Show only:">
          {SHOW_ONLY.map(s => (
            <CurrentChip key={s} active={s === SHARED.showOnlyActive}>
              {s}
            </CurrentChip>
          ))}
        </CurrentRow>

        <CurrentRow
          label="Region:"
          sublabel="Pick countries or go Global for all"
        >
          {REGIONS.map(r => {
            const active = r.code === SHARED.region
            return (
              <button
                key={r.code}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={
                  active
                    ? { background: '#3B82F6', color: 'white' }
                    : { background: '#F4F2FB', color: '#3D3856', border: '1px solid #E8E5F2' }
                }
              >
                <span>{r.flag}</span>
                <span>{r.label}</span>
              </button>
            )
          })}
        </CurrentRow>
      </div>

      {/* Status */}
      <div className="mt-3 px-2 text-xs text-[#6B6580]">
        Done — {SHARED.found} creators found.
      </div>
    </div>
  )
}

function CurrentRow({
  label,
  sublabel,
  children,
}: {
  label: string
  sublabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 px-5 py-4 items-start">
      <div className="pt-1.5">
        <div className="text-sm text-[#6B6580]">{label}</div>
        {sublabel && (
          <div className="text-[10px] text-[#9590B0] leading-tight mt-0.5">{sublabel}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function CurrentNum({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string | number
  placeholder?: string
}) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-20 px-2 py-1.5 bg-[#F4F2FB] border border-[#D5D2E6] rounded-lg text-xs text-[#1F1B2E] outline-none placeholder:text-[#9590B0] tabular-nums"
    />
  )
}

function CurrentChip({
  children,
  active,
}: {
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      className="px-3 py-1.5 rounded-lg text-xs"
      style={
        active
          ? { background: '#3B82F6', color: 'white' }
          : { background: '#F4F2FB', color: '#3D3856', border: '1px solid #E8E5F2' }
      }
    >
      {children}
    </button>
  )
}
