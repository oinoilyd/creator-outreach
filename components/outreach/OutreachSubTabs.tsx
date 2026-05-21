'use client'

import React from 'react'
import { Clock, BarChart3, Briefcase } from 'lucide-react'
import { AnimatedTabs } from '@/components/AnimatedTabs'

/**
 * Sub-tab strip rendered inside the Outreach view.
 * All / Follow-ups / Active Clients / Analytics, with badge counts
 * on the action-needed tabs.
 *
 * Note: the "Favorites" tab was removed in v3 (2026-05-21). The
 * ★ column header in OutreachTab is now a regular sort target —
 * click it to surface favorites at the top, click again to send
 * them to the bottom, click a third time to clear. No always-on
 * pinning; favorites surface only when the user asks. Legacy
 * ?sub=favorites URLs are coerced to ?sub=all in app/page.tsx.
 */

export type OutreachSubTabId = 'all' | 'analytics' | 'followups' | 'active'

export function OutreachSubTabs({
  active,
  onChange,
  dueCount,
  activeClientsCount,
}: {
  active: OutreachSubTabId
  onChange: (v: OutreachSubTabId) => void
  dueCount: number
  /** Count of status='Successful' rows — surfaces as a small badge on
   *  the "Active Clients" tab so users notice when new clients land. */
  activeClientsCount?: number
}) {
  const tabs: { id: OutreachSubTabId; label: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
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
