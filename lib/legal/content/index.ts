import type { LegalDoc } from '../types'
import terms from './terms'
import privacy from './privacy'
import refunds from './refunds'
import cookies from './cookies'
import pciCompliance from './pci-compliance'
import webhookSecurity from './webhook-security'
import customerSupport from './customer-support'

/**
 * Registry of every legal / policy-and-procedure document in the
 * product. Public docs render at /terms, /privacy, etc.; internal
 * PnPs are downloadable from the admin console only.
 *
 * @remarks
 * **CAN-SPAM Procedure — not yet a standalone PnP.** The CAN-SPAM
 * compliance posture today is enforced in two places:
 *   1. Terms of Service, §6 (Acceptable Use) and §11 (Indemnification)
 *      put the responsibility on the user.
 *   2. Code paths: `buildCanSpamFooter` in `lib/format.ts` auto-appends
 *      a physical-address line + unsubscribe link to every outgoing
 *      email body, and the `suppression_list` table (migration 0021)
 *      is the do-not-contact ledger consulted before send.
 *
 * Once we have an /unsubscribe endpoint, a bounce-ingest webhook, and
 * a documented operator runbook, this should be promoted to a
 * standalone `can-spam.ts` PnP alongside `pci-compliance.ts` and
 * `webhook-security.ts`. Until then, do not link to a CAN-SPAM doc
 * that doesn't exist.
 */
export const LEGAL_DOCS: LegalDoc[] = [
  terms,
  privacy,
  refunds,
  cookies,
  pciCompliance,
  webhookSecurity,
  customerSupport,
]

export function getDocBySlug(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug)
}
