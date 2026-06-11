'use client'

/**
 * Client-side team-view simulator. All state is in-memory mock data —
 * nothing is persisted, no API calls, no real outreach touched.
 * Mirrors the real role rules from lib/team.ts.
 */

import { useState, useMemo } from 'react'

type Role = 'owner' | 'admin' | 'member'

interface Person {
  id: string
  name: string
  role: Role
  email: string
}

interface Lead {
  id: string
  channel: string
  email: string
  status: 'Not Outreached' | 'Pending Response' | 'Warm' | 'Successful' | 'Rejected'
  medium: string
  dealValue: string
  lastTouch: string
  assignee: string // person id
}

const TEAM: Person[] = [
  { id: 'p_owner', name: 'You',     role: 'owner',  email: 'you@acme.co' },
  { id: 'p_adm1',  name: 'Jordan',  role: 'admin',  email: 'jordan@acme.co' },
  { id: 'p_adm2',  name: 'Casey',   role: 'admin',  email: 'casey@acme.co' },
  { id: 'p_mem1',  name: 'Sarah',   role: 'member', email: 'sarah@acme.co' },
  { id: 'p_mem2',  name: 'Marcus',  role: 'member', email: 'marcus@acme.co' },
  { id: 'p_mem3',  name: 'Jenna',   role: 'member', email: 'jenna@acme.co' },
]

const INITIAL_LEADS: Lead[] = [
  { id: 'l1',  channel: 'FinanceWithFran',   email: 'fran@fwf.com',       status: 'Warm',            medium: 'Email',    dealValue: '$4,500', lastTouch: '2d ago',  assignee: 'p_mem1' },
  { id: 'l2',  channel: 'BudgetBro',          email: 'team@budgetbro.io',  status: 'Pending Response',medium: 'Email',    dealValue: '',       lastTouch: '5d ago',  assignee: 'p_mem1' },
  { id: 'l3',  channel: 'StockSavvy',         email: 'hello@stocksavvy.tv',status: 'Successful',      medium: 'LinkedIn', dealValue: '$8,000', lastTouch: '1d ago',  assignee: 'p_mem2' },
  { id: 'l4',  channel: 'CryptoClarity',      email: 'cc@clarity.xyz',     status: 'Rejected',        medium: 'Email',    dealValue: '',       lastTouch: '12d ago', assignee: 'p_mem2' },
  { id: 'l5',  channel: 'WealthWeekly',       email: 'ww@wealthweekly.com',status: 'Warm',            medium: 'Email',    dealValue: '$3,200', lastTouch: '3d ago',  assignee: 'p_mem3' },
  { id: 'l6',  channel: 'IndexInvestor',      email: 'mark@indexinv.com',  status: 'Pending Response',medium: 'IG DM',    dealValue: '',       lastTouch: '6d ago',  assignee: 'p_mem3' },
  { id: 'l7',  channel: 'RetireEarly',        email: 'fire@retireearly.co',status: 'Not Outreached',  medium: '',         dealValue: '',       lastTouch: '—',       assignee: 'p_mem1' },
  { id: 'l8',  channel: 'TaxTactics',         email: 'team@taxtactics.io', status: 'Successful',      medium: 'Email',    dealValue: '$6,750', lastTouch: '4d ago',  assignee: 'p_adm1' },
  { id: 'l9',  channel: 'DividendDiaries',    email: 'dd@diaries.com',     status: 'Warm',            medium: 'LinkedIn', dealValue: '$2,000', lastTouch: '7d ago',  assignee: 'p_adm1' },
  { id: 'l10', channel: 'MoneyMindset',       email: 'hi@moneymindset.tv', status: 'Pending Response',medium: 'Email',    dealValue: '',       lastTouch: '9d ago',  assignee: 'p_adm2' },
  { id: 'l11', channel: 'FrugalFamily',       email: 'ff@frugalfam.com',   status: 'Not Outreached',  medium: '',         dealValue: '',       lastTouch: '—',       assignee: 'p_adm2' },
  { id: 'l12', channel: 'SideHustleSchool',   email: 'shs@hustle.co',      status: 'Warm',            medium: 'Email',    dealValue: '$5,500', lastTouch: '1d ago',  assignee: 'p_owner' },
  { id: 'l13', channel: 'PassiveIncomePro',   email: 'pip@passive.io',     status: 'Successful',      medium: 'Email',    dealValue: '$9,200', lastTouch: '3d ago',  assignee: 'p_owner' },
  { id: 'l14', channel: 'CreditQueen',        email: 'cq@creditqueen.com', status: 'Rejected',        medium: 'IG DM',    dealValue: '',       lastTouch: '15d ago', assignee: 'p_mem2' },
  { id: 'l15', channel: 'InvestingIntern',    email: 'ii@intern.tv',       status: 'Pending Response',medium: 'Email',    dealValue: '',       lastTouch: '8d ago',  assignee: 'p_mem3' },
  { id: 'l16', channel: 'MarketMornings',     email: 'mm@mornings.co',     status: 'Warm',            medium: 'LinkedIn', dealValue: '$3,800', lastTouch: '2d ago',  assignee: 'p_mem1' },
]

const STATUS_TONE: Record<Lead['status'], string> = {
  'Warm':             'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
  'Pending Response': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40',
  'Successful':       'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  'Rejected':         'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
  'Not Outreached':   'bg-muted text-muted-foreground border-border',
}

function personById(id: string): Person | undefined {
  return TEAM.find(p => p.id === id)
}

export function TeamPreviewClient() {
  const [viewerId, setViewerId] = useState<string>('p_owner')
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS)
  const [memberFilter, setMemberFilter] = useState<string>('all') // 'all' | person id

  const viewer = personById(viewerId)!
  const canAssign = viewer.role === 'owner' || viewer.role === 'admin'
  const seesEveryone = canAssign

  // Visible rows per role:
  //   owner/admin → all (optionally filtered by member chip)
  //   member      → only their own assigned leads
  const visible = useMemo(() => {
    if (!seesEveryone) return leads.filter(l => l.assignee === viewerId)
    if (memberFilter === 'all') return leads
    return leads.filter(l => l.assignee === memberFilter)
  }, [leads, viewerId, seesEveryone, memberFilter])

  function reassign(leadId: string, newAssignee: string) {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, assignee: newAssignee } : l)))
  }

  // Per-member counts for the owner/admin filter chips.
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of leads) m[l.assignee] = (m[l.assignee] ?? 0) + 1
    return m
  }, [leads])

  return (
    <div className="space-y-5">
      {/* View-as switcher */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing as</span>
          <select
            value={viewerId}
            onChange={e => { setViewerId(e.target.value); setMemberFilter('all') }}
            className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:border-purple-500"
          >
            {TEAM.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.role}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-muted-foreground leading-snug sm:border-l sm:border-border sm:pl-4 flex-1">
          {viewer.role === 'owner' && (
            <><strong className="text-foreground">Owner.</strong> Sees the whole team&apos;s pipeline, reassigns any row, manages members + billing.</>
          )}
          {viewer.role === 'admin' && (
            <><strong className="text-foreground">Admin.</strong> Same as Owner for the pipeline — sees everything, reassigns any row, manages members. (Can&apos;t touch billing.)</>
          )}
          {viewer.role === 'member' && (
            <><strong className="text-foreground">Member.</strong> Sees ONLY their own assigned leads. No visibility into teammates&apos; pipelines, no reassigning.</>
          )}
        </div>
      </div>

      {/* Member filter chips — owner/admin only */}
      {seesEveryone && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Filter:</span>
          <button
            onClick={() => setMemberFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              memberFilter === 'all'
                ? 'bg-purple-500/15 border-purple-500/40 text-foreground font-medium'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Everyone ({leads.length})
          </button>
          {TEAM.map(p => (
            <button
              key={p.id}
              onClick={() => setMemberFilter(p.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                memberFilter === p.id
                  ? 'bg-purple-500/15 border-purple-500/40 text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.name} ({counts[p.id] ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* Member's-eye note */}
      {!seesEveryone && (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
          You&apos;re seeing <strong className="text-foreground">{viewer.name}&apos;s</strong> view — just their{' '}
          {visible.length} assigned {visible.length === 1 ? 'lead' : 'leads'}. They can&apos;t see anyone else&apos;s
          pipeline or reassign work.
        </div>
      )}

      {/* The board */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Creator</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Via</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Deal</th>
                <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Last touch</th>
                <th className="text-left font-medium px-4 py-2.5">{seesEveryone ? 'Assigned to' : 'Owner'}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(l => {
                const assignee = personById(l.assignee)
                return (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{l.channel}</div>
                      <div className="text-xs text-muted-foreground">{l.email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${STATUS_TONE[l.status]}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">{l.medium || '—'}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell tabular-nums text-foreground/90">{l.dealValue || '—'}</td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">{l.lastTouch}</td>
                    <td className="px-4 py-2.5">
                      {canAssign ? (
                        // Owner/Admin: live reassign dropdown.
                        <select
                          value={l.assignee}
                          onChange={e => reassign(l.id, e.target.value)}
                          className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-purple-500"
                        >
                          {TEAM.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        // Member: read-only — just who owns it (themselves).
                        <span className="text-xs text-muted-foreground">{assignee?.name ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No leads assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* How to use */}
      <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-4 py-3 leading-relaxed">
        <strong className="text-foreground">Try it:</strong> stay as <em>You (Owner)</em> and reassign{' '}
        <em>FinanceWithFran</em> from Sarah to Marcus using the dropdown in the last column. Then switch{' '}
        <em>Viewing as</em> → <em>Marcus</em> and you&apos;ll see it now appears in his pipeline. Switch to{' '}
        <em>Sarah</em> and it&apos;s gone from hers. That&apos;s the real assignment + isolation model — Owner/Admin
        move work around, Members only ever see their own.
      </div>
    </div>
  )
}
