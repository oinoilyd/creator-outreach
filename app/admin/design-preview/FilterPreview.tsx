'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Filter, Search, Zap, ChevronRight } from 'lucide-react'

/**
 * Four variants of the search filter top bar:
 *   A. Print classified — mono, brackets, hairlines, no color
 *   B. Linear-style dev tool — compact slate, keyboard-key chips
 *   C. OS-native refined — generous spacing, restrained, real type
 *   D. Current — reference clone of the live layout
 *
 * Each variant uses the SAME selections so the only thing varying
 * tab-to-tab is presentation. The "non-AI" goal: avoid gradients,
 * glassmorphism, soft glow shadows, and the default rounded-2xl
 * SaaS-template look. Every variant should read as a deliberate
 * design choice, not a template default.
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
  { id: 'A' as const, label: 'A · Print classified', sub: 'mono, brackets, hairlines, no color' },
  { id: 'B' as const, label: 'B · Linear strip', sub: 'compact slate, keyboard-key chips' },
  { id: 'C' as const, label: 'C · OS-native refined', sub: 'generous spacing, restrained type' },
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
        <div className="max-w-[1400px] mx-auto px-6 flex items-stretch gap-1 overflow-x-auto">
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 pt-3 pb-3.5 text-sm transition-colors text-left whitespace-nowrap ${
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
        {tab === 'A' && <VariantPrint />}
        {tab === 'B' && <VariantLinear />}
        {tab === 'C' && <VariantNative />}
        {tab === 'D' && <VariantCurrent />}

        {/* Notes block — same across all tabs */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground/80">
          <div>
            <div className="font-semibold text-foreground/90 mb-1">A · Print classified</div>
            Black ink on warm white. Mono everywhere, brackets around chips, hairline rules
            between sections. Looks like a Wallpaper-magazine page or a vintage Yellow Pages
            spread, not a SaaS dashboard. Strong opinion, no color.
          </div>
          <div>
            <div className="font-semibold text-foreground/90 mb-1">B · Linear strip</div>
            Tight, dense, info-rich — single horizontal control strip with keyboard-key chip
            aesthetic. Slate neutrals with one disciplined blue accent for active state. Reads
            as a tool a serious operator built, not a marketing page.
          </div>
          <div>
            <div className="font-semibold text-foreground/90 mb-1">C · OS-native refined</div>
            macOS Settings / Vercel dashboard energy. Generous whitespace, real typographic
            hierarchy, no decorative borders, subtle dividers. The accent is a confident dark
            green (not the generic SaaS purple-blue). Restrained but considered.
          </div>
        </div>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Variant A — Print classified
//   Inspiration: Wallpaper magazine layout, Yellow Pages, library
//   catalog cards. Mono everywhere, brackets around chips, hairline
//   rules between sections, asymmetric numbered headers. No color.
// ─────────────────────────────────────────────────────────────────────

function VariantPrint() {
  return (
    <div
      style={{ background: '#FAF8F2', color: '#1A1A1A' }}
      className="rounded-none p-12 border border-[#1A1A1A]"
    >
      {/* Header rule + masthead */}
      <div className="flex items-end justify-between border-b-2 border-[#1A1A1A] pb-3 mb-10">
        <div
          className="text-[10px] uppercase tracking-[0.4em] font-bold"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
        >
          Section I — Sourcing / Filter index
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.4em] text-[#1A1A1A]/60"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
        >
          Edition 01 / Page 01
        </div>
      </div>

      {/* Search block — asymmetric */}
      <div className="grid grid-cols-12 gap-6 items-end mb-12 pb-10 border-b border-[#1A1A1A]/30">
        <div className="col-span-12 lg:col-span-9">
          <div
            className="text-[10px] uppercase tracking-[0.32em] mb-3 text-[#1A1A1A]/55"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          >
            Query —
          </div>
          <input
            defaultValue={SHARED.keyword}
            className="w-full bg-transparent border-0 border-b-[2px] border-[#1A1A1A] pb-2 outline-none text-5xl font-light tracking-tight text-[#1A1A1A] placeholder:text-[#1A1A1A]/30"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          />
        </div>
        <div className="col-span-12 lg:col-span-3 flex items-center gap-2 justify-end">
          <PrintIconBtn>
            <Zap className="w-3.5 h-3.5" />
          </PrintIconBtn>
          <PrintIconBtn>
            <Filter className="w-3.5 h-3.5" />
          </PrintIconBtn>
          <button
            className="px-6 py-2 bg-[#1A1A1A] text-[#FAF8F2] text-[11px] uppercase tracking-[0.32em] font-bold hover:opacity-85 transition-opacity"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          >
            Search →
          </button>
        </div>
      </div>

      {/* Numbered filter sections */}
      <div className="space-y-9">
        <PrintSection num="01" label="AVG VIEWS">
          <PrintNumInput defaultValue={SHARED.avgViewsMin} />
          <span className="text-[#1A1A1A]/40 text-xs">→</span>
          <PrintNumInput defaultValue={SHARED.avgViewsMax} />
          <span className="text-[#1A1A1A]/30 mx-1.5">·</span>
          {VIEW_PRESETS.map(v => (
            <PrintChip key={v}>{v}</PrintChip>
          ))}
        </PrintSection>

        <PrintSection num="02" label="SUBSCRIBERS">
          <PrintNumInput placeholder="min" />
          <span className="text-[#1A1A1A]/40 text-xs">→</span>
          <PrintNumInput placeholder="max" />
          <span className="text-[#1A1A1A]/30 mx-1.5">·</span>
          {SUBS_PRESETS.map(s => (
            <PrintChip key={s} active={s === SHARED.subsActive}>
              {s}
            </PrintChip>
          ))}
        </PrintSection>

        <PrintSection num="03" label="LAST POSTED">
          {RECENCY.map(r => (
            <PrintChip key={r} active={r === SHARED.recency}>
              {r}
            </PrintChip>
          ))}
        </PrintSection>

        <PrintSection num="04" label="SHOW ONLY">
          {SHOW_ONLY.map(s => (
            <PrintChip key={s} active={s === SHARED.showOnlyActive}>
              {s}
            </PrintChip>
          ))}
        </PrintSection>

        <PrintSection num="05" label="REGION">
          {REGIONS.map(r => {
            const active = r.code === SHARED.region
            return (
              <button
                key={r.code}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] transition-colors ${
                  active
                    ? 'bg-[#1A1A1A] text-[#FAF8F2]'
                    : 'text-[#1A1A1A]/85 hover:text-[#1A1A1A]'
                }`}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
              >
                <span className="text-xs">{r.flag}</span>
                <span>
                  {active ? r.label : `[ ${r.label} ]`}
                </span>
              </button>
            )
          })}
        </PrintSection>
      </div>

      {/* Footer rule */}
      <div className="mt-12 pt-4 border-t-2 border-[#1A1A1A] flex items-center justify-between">
        <div
          className="text-[10px] uppercase tracking-[0.32em] font-bold"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
        >
          Status — Done · {SHARED.found} entries returned
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.32em] text-[#1A1A1A]/50"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
        >
          End of section I
        </div>
      </div>
    </div>
  )
}

function PrintSection({
  num,
  label,
  children,
}: {
  num: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-8 items-baseline">
      <div className="flex items-baseline gap-2 pt-0.5">
        <span
          className="text-2xl font-light text-[#1A1A1A]/30"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {num}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.32em] font-bold"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">{children}</div>
    </div>
  )
}

function PrintIconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="w-9 h-9 inline-flex items-center justify-center border border-[#1A1A1A]/40 hover:border-[#1A1A1A] hover:bg-[#1A1A1A]/5 transition-colors">
      {children}
    </button>
  )
}

function PrintNumInput({
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
      className="w-24 px-2 py-1 bg-transparent border-b border-[#1A1A1A]/40 focus:border-[#1A1A1A] outline-none text-sm text-[#1A1A1A] placeholder:text-[#1A1A1A]/30 tabular-nums"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    />
  )
}

function PrintChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? 'bg-[#1A1A1A] text-[#FAF8F2]'
          : 'text-[#1A1A1A]/85 hover:text-[#1A1A1A]'
      }`}
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    >
      {active ? children : <>[ {children} ]</>}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Variant B — Linear-style strip
//   Inspiration: Linear app's filter bar, GitHub Issues filters,
//   Vercel dashboard headers. Tight, dense, info-rich, single
//   horizontal strip. Slate neutrals, mono numerics, keyboard-key
//   chips. One blue accent (Linear's #5E6AD2-ish) for active.
// ─────────────────────────────────────────────────────────────────────

const LINEAR_BG = '#FBFBFC'
const LINEAR_PANEL = '#FFFFFF'
const LINEAR_BORDER = '#E5E5EA'
const LINEAR_BORDER_HOVER = '#D0D0D7'
const LINEAR_TEXT = '#1F1F23'
const LINEAR_MUTED = '#6F6F7A'
const LINEAR_ACCENT = '#5E6AD2'

function VariantLinear() {
  return (
    <div
      style={{ background: LINEAR_BG, color: LINEAR_TEXT }}
      className="rounded-xl border p-7"
    >
      {/* Top: search + actions in a single row */}
      <div
        className="flex items-stretch rounded-lg overflow-hidden border mb-6"
        style={{ background: LINEAR_PANEL, borderColor: LINEAR_BORDER }}
      >
        <div className="flex items-center px-4 flex-1 gap-3">
          <Search className="w-3.5 h-3.5" style={{ color: LINEAR_MUTED }} strokeWidth={2.25} />
          <input
            defaultValue={SHARED.keyword}
            placeholder="Search creators…"
            className="flex-1 bg-transparent border-0 outline-none text-[15px] py-3"
            style={{ color: LINEAR_TEXT, fontVariantNumeric: 'tabular-nums' }}
          />
          <kbd
            className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border tabular-nums"
            style={{
              background: LINEAR_BG,
              borderColor: LINEAR_BORDER,
              color: LINEAR_MUTED,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            ⌘K
          </kbd>
        </div>
        <div
          className="flex items-stretch border-l"
          style={{ borderColor: LINEAR_BORDER }}
        >
          <LinearActionBtn label="Quick">
            <Zap className="w-3.5 h-3.5" strokeWidth={2.25} />
          </LinearActionBtn>
          <LinearActionBtn label="Filters" hint="3" active>
            <Filter className="w-3.5 h-3.5" strokeWidth={2.25} />
          </LinearActionBtn>
          <button
            className="px-5 text-[13px] font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-1.5"
            style={{ background: LINEAR_ACCENT }}
          >
            Search
            <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Filter strip — labels on left, chips inline */}
      <div
        className="rounded-lg border divide-y"
        style={{ background: LINEAR_PANEL, borderColor: LINEAR_BORDER, borderTop: 'none' }}
      >
        <LinearRow label="Avg views">
          <LinearNum defaultValue={SHARED.avgViewsMin} />
          <span className="text-[11px]" style={{ color: LINEAR_MUTED }}>—</span>
          <LinearNum defaultValue={SHARED.avgViewsMax} />
          <LinearDivider />
          {VIEW_PRESETS.map(v => (
            <LinearChip key={v}>{v}</LinearChip>
          ))}
        </LinearRow>

        <LinearRow label="Subscribers">
          <LinearNum placeholder="min" />
          <span className="text-[11px]" style={{ color: LINEAR_MUTED }}>—</span>
          <LinearNum placeholder="max" />
          <LinearDivider />
          {SUBS_PRESETS.map(s => (
            <LinearChip key={s} active={s === SHARED.subsActive}>
              {s}
            </LinearChip>
          ))}
        </LinearRow>

        <LinearRow label="Last posted">
          {RECENCY.map(r => (
            <LinearChip key={r} active={r === SHARED.recency}>
              {r}
            </LinearChip>
          ))}
        </LinearRow>

        <LinearRow label="Show only">
          {SHOW_ONLY.map(s => (
            <LinearChip key={s} active={s === SHARED.showOnlyActive}>
              {s}
            </LinearChip>
          ))}
        </LinearRow>

        <LinearRow label="Region" hint="20 countries">
          {REGIONS.map(r => {
            const active = r.code === SHARED.region
            return (
              <button
                key={r.code}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] transition-colors"
                style={
                  active
                    ? {
                        background: LINEAR_ACCENT,
                        color: '#fff',
                        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.08)',
                      }
                    : {
                        background: LINEAR_BG,
                        color: LINEAR_TEXT,
                        border: `1px solid ${LINEAR_BORDER}`,
                      }
                }
              >
                <span className="text-[12px]">{r.flag}</span>
                <span>{r.label}</span>
              </button>
            )
          })}
        </LinearRow>
      </div>

      {/* Footer status */}
      <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: LINEAR_MUTED }}>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: '#10B981' }}
        />
        <span>Done</span>
        <span style={{ color: '#C4C4CC' }}>·</span>
        <span style={{ color: LINEAR_TEXT }} className="font-medium tabular-nums">
          {SHARED.found}
        </span>
        <span>creators found</span>
      </div>
    </div>
  )
}

function LinearActionBtn({
  children,
  label,
  hint,
  active,
}: {
  children: React.ReactNode
  label: string
  hint?: string
  active?: boolean
}) {
  return (
    <button
      className="px-3 inline-flex items-center gap-1.5 text-[12px] font-medium border-r transition-colors hover:bg-[#F4F4F7]"
      style={{
        borderColor: LINEAR_BORDER,
        color: active ? LINEAR_ACCENT : LINEAR_TEXT,
      }}
    >
      {children}
      <span>{label}</span>
      {hint && (
        <kbd
          className="px-1 py-0.5 text-[10px] rounded tabular-nums font-medium"
          style={{ background: LINEAR_BG, color: LINEAR_MUTED }}
        >
          {hint}
        </kbd>
      )}
    </button>
  )
}

function LinearRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3 items-center">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[12px] font-medium" style={{ color: LINEAR_TEXT }}>
          {label}
        </span>
        {hint && (
          <span className="text-[10px]" style={{ color: LINEAR_MUTED }}>
            {hint}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function LinearDivider() {
  return (
    <span
      className="inline-block w-px h-3 mx-1"
      style={{ background: LINEAR_BORDER }}
    />
  )
}

function LinearNum({
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
      className="w-20 px-2 py-1 rounded-md text-[12px] outline-none transition-colors focus:border-[#5E6AD2] tabular-nums"
      style={{
        background: LINEAR_BG,
        color: LINEAR_TEXT,
        border: `1px solid ${LINEAR_BORDER}`,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      }}
    />
  )
}

function LinearChip({
  children,
  active,
}: {
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      className="px-2 py-1 rounded-md text-[12px] transition-colors hover:border-[#D0D0D7]"
      style={
        active
          ? {
              background: LINEAR_ACCENT,
              color: '#fff',
              border: `1px solid ${LINEAR_ACCENT}`,
              boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.08)',
            }
          : {
              background: LINEAR_BG,
              color: LINEAR_TEXT,
              border: `1px solid ${LINEAR_BORDER}`,
            }
      }
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Variant C — OS-native refined
//   Inspiration: macOS System Settings, Vercel dashboard, Stripe
//   docs. Generous whitespace, real typographic hierarchy, no
//   decorative borders, subtle dividers. Single accent: a confident
//   dark green (#1B4D3E ish), not the SaaS purple-blue.
// ─────────────────────────────────────────────────────────────────────

const NATIVE_BG = '#FBFBF9'
const NATIVE_PANEL = '#FFFFFF'
const NATIVE_TEXT = '#1F1F1F'
const NATIVE_MUTED = '#6E6E70'
const NATIVE_FAINT = '#A0A0A4'
const NATIVE_DIVIDER = '#ECECEC'
const NATIVE_FILL = '#F4F4F2'
const NATIVE_ACCENT = '#1B4D3E'
const NATIVE_ACCENT_BG = '#E6F0EC'

function VariantNative() {
  return (
    <div
      style={{ background: NATIVE_BG, color: NATIVE_TEXT }}
      className="rounded-2xl p-10 border"
    >
      {/* Header — single line, no decoration */}
      <div className="mb-8">
        <h2
          className="text-[28px] font-semibold tracking-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          Find creators
        </h2>
        <p className="text-[14px] mt-1" style={{ color: NATIVE_MUTED }}>
          Search across YouTube, then narrow by views, audience size, and where they post from.
        </p>
      </div>

      {/* Search input — tall, restrained, single row */}
      <div
        className="flex items-stretch mb-7 rounded-xl overflow-hidden border"
        style={{ background: NATIVE_PANEL, borderColor: NATIVE_DIVIDER }}
      >
        <div className="flex items-center px-5 flex-1 gap-3">
          <Search className="w-4 h-4" style={{ color: NATIVE_FAINT }} strokeWidth={2} />
          <input
            defaultValue={SHARED.keyword}
            className="flex-1 bg-transparent border-0 outline-none text-[16px] py-4"
            style={{ color: NATIVE_TEXT }}
          />
        </div>
        <button
          className="px-3.5 inline-flex items-center justify-center border-l hover:bg-[#F4F4F2] transition-colors"
          style={{ borderColor: NATIVE_DIVIDER, color: NATIVE_MUTED }}
          title="Quick search"
        >
          <Zap className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          className="px-3.5 inline-flex items-center justify-center border-l hover:bg-[#F4F4F2] transition-colors"
          style={{ borderColor: NATIVE_DIVIDER, color: NATIVE_MUTED }}
          title="Filters"
        >
          <Filter className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          className="px-7 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: NATIVE_ACCENT }}
        >
          Search
        </button>
      </div>

      {/* Filter sections — generous spacing, dividers not borders */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: NATIVE_PANEL, borderColor: NATIVE_DIVIDER }}
      >
        <NativeRow label="Avg views" hint="Range or preset">
          <NativeNum defaultValue={SHARED.avgViewsMin} />
          <span className="text-[13px]" style={{ color: NATIVE_FAINT }}>to</span>
          <NativeNum defaultValue={SHARED.avgViewsMax} />
          <NativeDivider />
          {VIEW_PRESETS.map(v => (
            <NativeChip key={v}>{v}</NativeChip>
          ))}
        </NativeRow>

        <NativeRow label="Subscribers" hint="Min and max">
          <NativeNum placeholder="Min" />
          <span className="text-[13px]" style={{ color: NATIVE_FAINT }}>to</span>
          <NativeNum placeholder="Max" />
          <NativeDivider />
          {SUBS_PRESETS.map(s => (
            <NativeChip key={s} active={s === SHARED.subsActive}>
              {s}
            </NativeChip>
          ))}
        </NativeRow>

        <NativeRow label="Last posted">
          {RECENCY.map(r => (
            <NativeChip key={r} active={r === SHARED.recency}>
              {r}
            </NativeChip>
          ))}
        </NativeRow>

        <NativeRow label="Show only">
          {SHOW_ONLY.map(s => (
            <NativeChip key={s} active={s === SHARED.showOnlyActive}>
              {s}
            </NativeChip>
          ))}
        </NativeRow>

        <NativeRow label="Region" hint="Pick countries or go global">
          {REGIONS.map(r => {
            const active = r.code === SHARED.region
            return (
              <button
                key={r.code}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors"
                style={
                  active
                    ? {
                        background: NATIVE_ACCENT_BG,
                        color: NATIVE_ACCENT,
                        border: `1px solid ${NATIVE_ACCENT}`,
                      }
                    : {
                        background: 'transparent',
                        color: NATIVE_TEXT,
                        border: `1px solid ${NATIVE_DIVIDER}`,
                      }
                }
              >
                <span>{r.flag}</span>
                <span>{r.label}</span>
              </button>
            )
          })}
        </NativeRow>
      </div>

      {/* Footer status */}
      <div className="mt-5 flex items-center gap-2.5 text-[13px]" style={{ color: NATIVE_MUTED }}>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: NATIVE_ACCENT }}
        />
        <span>Done</span>
        <span style={{ color: NATIVE_FAINT }}>·</span>
        <span style={{ color: NATIVE_TEXT }} className="font-medium tabular-nums">
          {SHARED.found}
        </span>
        <span>creators found</span>
      </div>
    </div>
  )
}

function NativeRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="grid grid-cols-[180px_1fr] gap-6 px-6 py-5 items-start border-b last:border-b-0"
      style={{ borderColor: NATIVE_DIVIDER }}
    >
      <div>
        <div className="text-[14px] font-medium leading-tight" style={{ color: NATIVE_TEXT }}>
          {label}
        </div>
        {hint && (
          <div className="text-[12px] mt-1 leading-tight" style={{ color: NATIVE_MUTED }}>
            {hint}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">{children}</div>
    </div>
  )
}

function NativeDivider() {
  return (
    <span
      className="inline-block w-px h-4 mx-1.5"
      style={{ background: NATIVE_DIVIDER }}
    />
  )
}

function NativeNum({
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
      className="w-24 px-3 py-1.5 rounded-lg text-[13px] outline-none transition-colors tabular-nums"
      style={{
        background: NATIVE_FILL,
        color: NATIVE_TEXT,
        border: `1px solid ${NATIVE_DIVIDER}`,
      }}
    />
  )
}

function NativeChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className="px-3 py-1.5 rounded-lg text-[13px] transition-colors"
      style={
        active
          ? {
              background: NATIVE_ACCENT_BG,
              color: NATIVE_ACCENT,
              border: `1px solid ${NATIVE_ACCENT}`,
            }
          : {
              background: 'transparent',
              color: NATIVE_TEXT,
              border: `1px solid ${NATIVE_DIVIDER}`,
            }
      }
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Variant D — Current (reference clone)
// ─────────────────────────────────────────────────────────────────────

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
