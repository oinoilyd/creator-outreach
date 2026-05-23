'use client'

/**
 * /admin/menu-preview — design comparison page for 6 hamburger menu
 * consolidation variants. Pure presentational mockups; nothing here
 * wires through to real handlers. Lets Dylan pick between layouts
 * without forcing 6 production-quality builds.
 *
 * Each variant renders the menu's open-dropdown state as a static
 * card so you can compare layouts side-by-side. Selector at the
 * top flips between them.
 */

import { useState } from 'react'
import {
  User, Settings as SettingsIcon, FileText, GraduationCap,
  Download, Sun, Moon, Palette, CreditCard, Map, Mail, Scale, LogOut,
  ChevronRight, ChevronDown, Sparkles, Briefcase, HelpCircle,
} from 'lucide-react'

type VariantId = 'merged' | 'primary' | 'grouped' | 'rail' | 'compact' | 'tabbed'

interface VariantMeta {
  id: VariantId
  number: number
  name: string
  description: string
  pros: string[]
  cons: string[]
  recommended?: boolean
}

const VARIANTS: VariantMeta[] = [
  {
    id: 'merged',
    number: 1,
    name: 'Merged super-items',
    description: 'Functionally related items collapse into 3 grouped openers (Settings / Appearance / Help & Info). Standalone items kept short.',
    pros: [
      'Biggest count reduction: 12 → 7 visible items',
      'No feature loss',
      'Future settings slot into the tabbed modal, not the menu',
    ],
    cons: [
      'Moderate engineering: Settings modal needs tabbed shell',
    ],
    recommended: true,
  },
  {
    id: 'primary',
    number: 2,
    name: 'Primary + More expander',
    description: 'Top 4 most-used items always visible; rest hidden behind a "More…" expander.',
    pros: [
      'Big visual relief (4 visible vs 12)',
      'Low engineering — mirrors existing Import expander',
      'Easy iteration ground for which items live "up top"',
    ],
    cons: [
      'Items in "More…" lose discoverability',
      'Templates is borderline — if it gets buried, AI rewrites suffer',
    ],
  },
  {
    id: 'grouped',
    number: 3,
    name: 'Grouped collapsible sections',
    description: 'All 12 items still listed but split into 4 sections (Account / Tools / Appearance / Help). Each section has a collapse chevron.',
    pros: [
      'Everything visible, organized',
      'Honest — no hiding',
    ],
    cons: [
      '4 chevron toggles add their own friction',
      "Doesn't reduce decision count, just visual organization",
    ],
  },
  {
    id: 'rail',
    number: 4,
    name: 'Footer icon rail',
    description: 'Main items as text rows on top; secondary/visual items collapse into a row of icon-only buttons across the bottom.',
    pros: [
      'Compact vertical footprint',
      'Slack-style footer reads as polished',
    ],
    cons: [
      'Icon-only labels hurt for less-techy users (tooltip required)',
      "Doesn't match your existing app patterns elsewhere",
    ],
  },
  {
    id: 'compact',
    number: 5,
    name: 'Visual density only',
    description: 'Same 12 items, tighter typography and padding. No structural change.',
    pros: [
      'Smallest effort, lowest risk',
    ],
    cons: [
      "Doesn't address the count complaint — just packs denser",
      "Misses the 'hefty list' brief",
    ],
  },
  {
    id: 'tabbed',
    number: 6,
    name: 'Tabbed panel',
    description: 'Linear list replaced with 3 tabs (Account / Appearance / Help) inside the dropdown.',
    pros: [
      'Strong grouping in tight space',
    ],
    cons: [
      'Tabs-inside-a-dropdown is fighty UX',
      'Adds a second nav layer inside a quick-access menu',
      'Breaks scan-top-to-bottom muscle memory',
    ],
  },
]

export default function MenuPreviewPage() {
  const [active, setActive] = useState<VariantId>('merged')
  const meta = VARIANTS.find(v => v.id === active)!

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Hamburger menu — consolidation previews</h1>
          <p className="text-sm text-muted-foreground">
            Six layouts for the same 12 normal-user menu items. Switch between them with the tabs below; pros/cons live underneath each preview.
          </p>
        </header>

        {/* Variant tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
          {VARIANTS.map(v => {
            const isActive = active === v.id
            return (
              <button
                key={v.id}
                onClick={() => setActive(v.id)}
                className={[
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors border',
                  isActive
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-300'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80',
                ].join(' ')}
              >
                <span className="font-mono text-[10.5px] opacity-70">#{v.number}</span>
                {v.name}
                {v.recommended && (
                  <span className="ml-1 inline-block text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-purple-500 text-white">Pick</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Variant body */}
        <div className="grid md:grid-cols-[420px_1fr] gap-8 items-start">
          {/* Left: the menu mockup */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-2">
              Mockup
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden">
              {active === 'merged' && <MergedVariant />}
              {active === 'primary' && <PrimaryVariant />}
              {active === 'grouped' && <GroupedVariant />}
              {active === 'rail' && <RailVariant />}
              {active === 'compact' && <CompactVariant />}
              {active === 'tabbed' && <TabbedVariant />}
            </div>
          </div>

          {/* Right: description + pros/cons */}
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Option #{meta.number}: {meta.name}
                {meta.recommended && (
                  <span className="ml-2 inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-purple-500 text-white">Recommended</span>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{meta.description}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-green-700 dark:text-green-400 mb-2">
                  Pros
                </div>
                <ul className="space-y-1.5">
                  {meta.pros.map(p => (
                    <li key={p} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                      <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 inline-flex items-center justify-center text-[10px] font-bold mt-0.5">+</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-rose-700 dark:text-rose-400 mb-2">
                  Cons
                </div>
                <ul className="space-y-1.5">
                  {meta.cons.map(c => (
                    <li key={c} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                      <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 inline-flex items-center justify-center text-[10px] font-bold mt-0.5">−</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-[11.5px] text-muted-foreground/75 italic pt-2 border-t border-border/60">
              These are presentational mockups — clicks inside the menu are no-ops. Tell me which one to ship for real.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared row primitives ────────────────────────────────────────────

function MenuHeader() {
  return (
    <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center text-purple-700 dark:text-purple-300">
        <User className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">Dylan Meehan</div>
        <div className="text-[11px] text-muted-foreground truncate">dmeehanj@gmail.com</div>
      </div>
    </div>
  )
}

function Row({
  icon, label, sublabel,
}: {
  icon: React.ReactNode
  label: string
  sublabel?: string
}) {
  return (
    <div className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group">
      <span className="text-muted-foreground group-hover:text-foreground/80 mt-0.5 shrink-0 transition-colors">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-foreground font-medium leading-tight">{label}</div>
        {sublabel && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sublabel}</div>}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  )
}

function CompactRow({
  icon, label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="w-full flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-muted transition-colors">
      <span className="text-muted-foreground shrink-0 w-3.5 h-3.5">{icon}</span>
      <span className="text-[12.5px] text-foreground">{label}</span>
    </div>
  )
}

function Divider() {
  return <div className="mx-4 my-1 border-t border-border" />
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
      {label}
    </div>
  )
}

// ── Variant 1: Merged super-items ────────────────────────────────────

function MergedVariant() {
  return (
    <div className="w-[300px]">
      <MenuHeader />
      <Row icon={<GraduationCap className="w-4 h-4" />} label="Take a tour" sublabel="90-second walkthrough" />
      <Divider />
      <Row icon={<SettingsIcon className="w-4 h-4" />} label="Settings" sublabel="Profile, Lead Criteria, Templates" />
      <Row icon={<Download className="w-4 h-4" />} label="Import" sublabel="Outreach or Dismissed from Excel" />
      <Divider />
      <Row icon={<Palette className="w-4 h-4" />} label="Appearance" sublabel="Theme, backdrop themes" />
      <Row icon={<CreditCard className="w-4 h-4" />} label="Subscription" sublabel="Trial · 14d left" />
      <Divider />
      <Row icon={<HelpCircle className="w-4 h-4" />} label="Help & Info" sublabel="Roadmap, Contact, Legal" />
      <Divider />
      <Row icon={<LogOut className="w-4 h-4" />} label="Sign out" />
    </div>
  )
}

// ── Variant 2: Primary + More expander ───────────────────────────────

function PrimaryVariant() {
  const [more, setMore] = useState(false)
  return (
    <div className="w-[300px]">
      <MenuHeader />
      <Row icon={<GraduationCap className="w-4 h-4" />} label="Take a tour" />
      <Row icon={<User className="w-4 h-4" />} label="Profile" />
      <Row icon={<CreditCard className="w-4 h-4" />} label="Subscription" sublabel="Trial · 14d left" />
      <Row icon={<LogOut className="w-4 h-4" />} label="Sign out" />
      <Divider />
      <button
        type="button"
        onClick={() => setMore(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-colors text-muted-foreground"
      >
        {more ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="text-[12.5px] font-medium">More options</span>
        <span className="ml-auto text-[10.5px] text-muted-foreground/60">{more ? 'Hide' : '8 items'}</span>
      </button>
      {more && (
        <div className="border-t border-border/60 bg-muted/20">
          <CompactRow icon={<SettingsIcon className="w-3.5 h-3.5" />} label="Lead Criteria" />
          <CompactRow icon={<FileText className="w-3.5 h-3.5" />} label="Templates" />
          <CompactRow icon={<Download className="w-3.5 h-3.5" />} label="Import" />
          <CompactRow icon={<Sun className="w-3.5 h-3.5" />} label="Light mode" />
          <CompactRow icon={<Palette className="w-3.5 h-3.5" />} label="Themes" />
          <CompactRow icon={<Map className="w-3.5 h-3.5" />} label="Roadmap" />
          <CompactRow icon={<Mail className="w-3.5 h-3.5" />} label="Contact" />
          <CompactRow icon={<Scale className="w-3.5 h-3.5" />} label="Legal" />
        </div>
      )}
    </div>
  )
}

// ── Variant 3: Grouped collapsible sections ──────────────────────────

function GroupedSection({
  label, defaultOpen, children,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/60 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">{label}</span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  )
}

function GroupedVariant() {
  return (
    <div className="w-[300px]">
      <MenuHeader />
      <GroupedSection label="Account" defaultOpen>
        <CompactRow icon={<User className="w-3.5 h-3.5" />} label="Profile" />
        <CompactRow icon={<CreditCard className="w-3.5 h-3.5" />} label="Subscription" />
        <CompactRow icon={<LogOut className="w-3.5 h-3.5" />} label="Sign out" />
      </GroupedSection>
      <GroupedSection label="Tools">
        <CompactRow icon={<SettingsIcon className="w-3.5 h-3.5" />} label="Lead Criteria" />
        <CompactRow icon={<FileText className="w-3.5 h-3.5" />} label="Templates" />
        <CompactRow icon={<Download className="w-3.5 h-3.5" />} label="Import" />
        <CompactRow icon={<GraduationCap className="w-3.5 h-3.5" />} label="Take a tour" />
      </GroupedSection>
      <GroupedSection label="Appearance">
        <CompactRow icon={<Sun className="w-3.5 h-3.5" />} label="Light mode" />
        <CompactRow icon={<Palette className="w-3.5 h-3.5" />} label="Themes" />
      </GroupedSection>
      <GroupedSection label="Help">
        <CompactRow icon={<Map className="w-3.5 h-3.5" />} label="Roadmap" />
        <CompactRow icon={<Mail className="w-3.5 h-3.5" />} label="Contact" />
        <CompactRow icon={<Scale className="w-3.5 h-3.5" />} label="Legal" />
      </GroupedSection>
    </div>
  )
}

// ── Variant 4: Footer icon rail ──────────────────────────────────────

function RailVariant() {
  return (
    <div className="w-[300px]">
      <MenuHeader />
      <Row icon={<GraduationCap className="w-4 h-4" />} label="Take a tour" />
      <Row icon={<User className="w-4 h-4" />} label="Profile" />
      <Row icon={<SettingsIcon className="w-4 h-4" />} label="Lead Criteria" />
      <Row icon={<FileText className="w-4 h-4" />} label="Templates" />
      <Row icon={<Download className="w-4 h-4" />} label="Import" />
      <Row icon={<CreditCard className="w-4 h-4" />} label="Subscription" />
      <Row icon={<LogOut className="w-4 h-4" />} label="Sign out" />
      <div className="border-t border-border/60 px-3 py-2.5 flex items-center justify-around bg-muted/30">
        {[
          { icon: <Sun className="w-3.5 h-3.5" />, label: 'Theme' },
          { icon: <Palette className="w-3.5 h-3.5" />, label: 'Themes' },
          { icon: <Map className="w-3.5 h-3.5" />, label: 'Roadmap' },
          { icon: <Mail className="w-3.5 h-3.5" />, label: 'Contact' },
          { icon: <Scale className="w-3.5 h-3.5" />, label: 'Legal' },
        ].map(b => (
          <button
            key={b.label}
            title={b.label}
            className="w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex items-center justify-center transition-colors"
          >
            {b.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Variant 5: Compact (visual density only) ─────────────────────────

function CompactVariant() {
  return (
    <div className="w-[280px] py-1">
      <MenuHeader />
      <CompactRow icon={<SettingsIcon className="w-3.5 h-3.5" />} label="Lead Criteria" />
      <CompactRow icon={<User className="w-3.5 h-3.5" />} label="Profile" />
      <CompactRow icon={<FileText className="w-3.5 h-3.5" />} label="Templates" />
      <CompactRow icon={<GraduationCap className="w-3.5 h-3.5" />} label="Take a tour" />
      <CompactRow icon={<Download className="w-3.5 h-3.5" />} label="Import" />
      <Divider />
      <CompactRow icon={<Sun className="w-3.5 h-3.5" />} label="Light mode" />
      <CompactRow icon={<Palette className="w-3.5 h-3.5" />} label="Themes" />
      <Divider />
      <CompactRow icon={<CreditCard className="w-3.5 h-3.5" />} label="Subscription" />
      <CompactRow icon={<Map className="w-3.5 h-3.5" />} label="Roadmap" />
      <CompactRow icon={<Mail className="w-3.5 h-3.5" />} label="Contact" />
      <CompactRow icon={<Scale className="w-3.5 h-3.5" />} label="Legal" />
      <Divider />
      <CompactRow icon={<LogOut className="w-3.5 h-3.5" />} label="Sign out" />
    </div>
  )
}

// ── Variant 6: Tabbed panel ──────────────────────────────────────────

function TabbedVariant() {
  const [tab, setTab] = useState<'account' | 'appearance' | 'help'>('account')
  return (
    <div className="w-[300px]">
      <MenuHeader />
      <div className="flex border-b border-border bg-muted/40">
        {[
          { id: 'account' as const, label: 'Account', icon: <User className="w-3.5 h-3.5" /> },
          { id: 'appearance' as const, label: 'Appearance', icon: <Palette className="w-3.5 h-3.5" /> },
          { id: 'help' as const, label: 'Help', icon: <HelpCircle className="w-3.5 h-3.5" /> },
        ].map(t => {
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold transition-colors',
                isActive
                  ? 'text-purple-700 dark:text-purple-300 border-b-2 border-purple-500 bg-card'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="py-1">
        {tab === 'account' && (
          <>
            <CompactRow icon={<User className="w-3.5 h-3.5" />} label="Profile" />
            <CompactRow icon={<SettingsIcon className="w-3.5 h-3.5" />} label="Lead Criteria" />
            <CompactRow icon={<FileText className="w-3.5 h-3.5" />} label="Templates" />
            <CompactRow icon={<Download className="w-3.5 h-3.5" />} label="Import" />
            <CompactRow icon={<GraduationCap className="w-3.5 h-3.5" />} label="Take a tour" />
            <CompactRow icon={<CreditCard className="w-3.5 h-3.5" />} label="Subscription" />
            <CompactRow icon={<LogOut className="w-3.5 h-3.5" />} label="Sign out" />
          </>
        )}
        {tab === 'appearance' && (
          <>
            <CompactRow icon={<Sun className="w-3.5 h-3.5" />} label="Light mode" />
            <CompactRow icon={<Moon className="w-3.5 h-3.5" />} label="Dark mode" />
            <CompactRow icon={<Palette className="w-3.5 h-3.5" />} label="Themes" />
            <CompactRow icon={<Sparkles className="w-3.5 h-3.5" />} label="Spotlight" />
          </>
        )}
        {tab === 'help' && (
          <>
            <CompactRow icon={<Map className="w-3.5 h-3.5" />} label="Roadmap" />
            <CompactRow icon={<Mail className="w-3.5 h-3.5" />} label="Contact us" />
            <CompactRow icon={<Scale className="w-3.5 h-3.5" />} label="Legal" />
          </>
        )}
      </div>
    </div>
  )
}
