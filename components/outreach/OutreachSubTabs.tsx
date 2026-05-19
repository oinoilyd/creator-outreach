'use client'

import React from 'react'
import { Star, Clock, BarChart3, Briefcase } from 'lucide-react'
import { AnimatedTabs } from '@/components/AnimatedTabs'

/**
 * Sub-tab strip rendered inside the Outreach view.
 * All / Favorites / Follow-ups / Analytics / Active Clients, with
 * badge counts on the action-needed tabs.
 *
 * Extracted from app/page.tsx as part of the architectural debt
 * cleanup — pure presentational component, takes 4 props, no state,
 * no context. Safe to lift out independently of the larger
 * OutreachTab refactor.
 */

export type OutreachSubTabId = 'all' | 'favorites' | 'analytics' | 'followups' | 'active'

export function OutreachSubTabs({
  active,
  onChange,
  favCount,
  dueCount,
  activeClientsCount,
}: {
  active: OutreachSubTabId
  onChange: (v: OutreachSubTabId) => void
  favCount: number
  dueCount: number
  /** Count of status='Successful' rows — surfaces as a small badge on
   *  the "Active Clients" tab so users notice when new clients land. */
  activeClientsCount?: number
}) {
  const tabs: { id: OutreachSubTabId; label: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    {
      id: 'favorites',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5" />
          Favorites
          {favCount > 0 && (
            <span className="ml-0.5 text-amber-700 dark:text-yellow-400/70">({favCount})</span>
          )}
        </span>
      ),
    },
    {
      id: 'followups',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Follow-ups
          {dueCount > 0 && (
            <span className="ml-0.5 text-red-700 dark:text-red-400/80">({dueCount})</span>
          )}
        </span>
      ),
    },
    {
      id: 'active',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5" />
          Active Clients
          {(activeClientsCount ?? 0) > 0 && (
            <span className="ml-0.5 text-green-700 dark:text-green-400/80">({activeClientsCount})</span>
          )}
        </span>
      ),
    },
    {
      id: 'analytics',
      label: (
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" />
          Analytics
        </span>
      ),
    },
  ]
  return (
    <div className="mb-4 border-b border-border pb-2">
      <AnimatedTabs<OutreachSubTabId>
        layoutGroup="outreach-subtabs"
        variant="pill"
        ariaLabel="Outreach view"
        tabs={tabs}
        active={active}
        onChange={onChange}
      />
    </div>
  )
}
