import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'illinois-breach-notification',
  title: 'Illinois Breach Notification Procedure',
  lastUpdated: 'May 11, 2026',
  summary: 'Internal procedure for notifying Illinois residents and the Attorney General under PIPA (815 ILCS 530).',
  isPublic: false,
  docType: 'Procedure',
  docNumber: 'PRO-003',
  version: '1.0',
  effectiveDate: 'May 11, 2026',
  owner: 'Founder / CEO',
  status: 'Active',
  intro:
    'This procedure defines how Creator Outreach responds to data breaches affecting Illinois residents under the **Illinois Personal Information Protection Act (PIPA, 815 ILCS 530)**. Illinois is our primary launch market and a substantial portion of our user base. This procedure ensures we satisfy PIPA timing, content, and method-of-notification requirements while preserving evidence for any post-incident review.',
  blocks: [
    { type: 'h2', text: '1. Purpose' },
    {
      type: 'p',
      md: 'To document the steps Creator Outreach will take following a confirmed or reasonably suspected breach of unencrypted **Personal Information** belonging to Illinois residents, so that affected individuals and (where required) the Illinois Attorney General are notified within the time and manner required by PIPA.',
    },

    { type: 'h2', text: '2. Scope' },
    {
      type: 'p',
      md: 'This procedure applies whenever Creator Outreach has reason to believe that **unencrypted Personal Information of one or more Illinois residents** has been (or may have been) acquired by an unauthorized person.',
    },
    {
      type: 'p',
      md: '"Personal Information" under PIPA means a resident\'s first name (or initial) and last name in combination with any of the following data elements, when not encrypted or redacted:',
    },
    {
      type: 'ul',
      items: [
        'Social Security number',
        'Driver\'s license number or state ID number',
        'Financial account number, credit card number, or debit card number — alone or with any required security code, access code, or password',
        'Medical information',
        'Health insurance information',
        'Unique biometric data (fingerprint, retina, iris, voiceprint, or other unique physical representation)',
        'A username or email address in combination with a password or security question and answer that would permit access to an online account',
      ],
    },
    {
      type: 'p',
      md: 'For Creator Outreach, the most likely in-scope combinations are: **email + auth credentials** (Supabase managed) and any user-supplied financial account info (none stored — all card processing is via Stripe). Accordingly, the most likely breach vectors are credential leakage from our Supabase database or session hijacking via stolen authentication tokens.',
    },

    { type: 'h2', text: '3. Roles & Responsibilities' },
    {
      type: 'ul',
      items: [
        '**Incident Commander** — the Founder / CEO is the default Incident Commander and has final decision authority on classification, notification, and external communications.',
        '**Technical Lead** — the engineer with deepest access to the affected system; coordinates containment and evidence preservation.',
        '**Legal Counsel** — engaged within 24 hours of a confirmed breach affecting Illinois residents.',
        '**Notification Coordinator** — drafts the consumer notice, the Illinois AG notice (if applicable), and any service-provider-facing communications.',
      ],
    },

    { type: 'h2', text: '4. Detection & Classification' },
    {
      type: 'p',
      md: 'Detection sources include: Supabase audit logs, Stripe Radar fraud alerts, Vercel monitoring, Anthropic API anomaly notifications, user reports submitted to support@creatoroutreach.net or security@creatoroutreach.net, and any external researcher disclosure.',
    },
    {
      type: 'p',
      md: 'Within **24 hours** of a credible report, the Incident Commander classifies the event:',
    },
    {
      type: 'ul',
      items: [
        '**Confirmed breach** — unencrypted Personal Information was, or likely was, acquired by an unauthorized person. Proceed to Section 5.',
        '**Suspected breach** — facts are incomplete but a breach is plausible. Continue investigation with a 72-hour deadline to confirm or rule out.',
        '**False positive / non-incident** — document findings and close.',
      ],
    },

    { type: 'h2', text: '5. Containment & Investigation' },
    {
      type: 'p',
      md: 'Immediately upon confirmation:',
    },
    {
      type: 'ul',
      items: [
        'Rotate all credentials and API keys associated with the affected system (Supabase, Stripe, Anthropic, Unipile, Vercel).',
        'Force-logout all affected user sessions via Supabase Auth.',
        'Preserve evidence: snapshot relevant database state, copy server logs, screenshot dashboards, save all communication threads.',
        'Engage Legal Counsel.',
        'Open a dated incident log; every subsequent action is timestamped in that log.',
        'If the breach was caused by, or involves, a subprocessor (Supabase, Stripe, Anthropic, Unipile, Vercel), notify that vendor in writing within 24 hours and request their incident report.',
      ],
    },

    { type: 'h2', text: '6. Consumer Notification (Affected Illinois Residents)' },
    {
      type: 'p',
      md: 'PIPA requires notification to affected Illinois residents **in the most expedient time possible and without unreasonable delay**, consistent with measures necessary to determine breach scope and restore reasonable system integrity.',
    },
    {
      type: 'p',
      md: 'The consumer notice **must include**, at minimum:',
    },
    {
      type: 'ul',
      items: [
        'Toll-free numbers and addresses for consumer reporting agencies (Equifax, Experian, TransUnion).',
        'The toll-free number, address, and website for the Federal Trade Commission.',
        'A statement that the individual can obtain information from these sources about fraud alerts and security freezes.',
      ],
    },
    {
      type: 'p',
      md: 'Permissible notification methods (PIPA §10(c)):',
    },
    {
      type: 'ul',
      items: [
        '**Written notice** sent to the postal address in our records.',
        '**Electronic notice** if the resident has previously consented to electronic communication (which they have, via our Terms of Service at signup).',
        '**Substitute notice** if the cost of standard notice would exceed $250,000, the affected class exceeds 500,000 residents, or we lack sufficient contact information. Substitute notice consists of: (a) email notice if we have addresses; (b) conspicuous posting on creatoroutreach.net; and (c) notification to major statewide media.',
      ],
    },

    { type: 'h2', text: '7. Attorney General Notification (500+ Affected Illinois Residents)' },
    {
      type: 'p',
      md: 'If a single breach affects **more than 500 Illinois residents**, PIPA §12 requires notification to the Illinois Attorney General **within 45 days** of the discovery of the breach, or in the time specified by the AG\'s office, whichever is sooner. The notice must include:',
    },
    {
      type: 'ul',
      items: [
        'A description of the nature of the breach or potential breach.',
        'The number of Illinois residents affected by the breach.',
        'Any steps the data collector has taken or plans to take relating to the incident.',
        'The date or estimated date of the breach.',
        'A copy of the notice sent to consumers (or, if substitute notice was used, a description of the substitute notice).',
      ],
    },
    {
      type: 'p',
      md: 'Submit via the AG\'s consumer protection division. Current submission portal: **[https://www.illinoisattorneygeneral.gov/Page-Attachments/Submit-Data-Breach-Notification](https://www.illinoisattorneygeneral.gov/Page-Attachments/Submit-Data-Breach-Notification)** — verify URL at time of submission as the AG\'s site is periodically reorganized.',
    },

    { type: 'h2', text: '8. Coordination with Law Enforcement' },
    {
      type: 'p',
      md: 'If law enforcement notifies us in writing that consumer or AG notification would impede a criminal investigation, we **may delay notification** for as long as law enforcement determines is necessary. Document the law enforcement contact, the basis for the delay, and the agency reference number.',
    },

    { type: 'h2', text: '9. Post-Incident Review' },
    {
      type: 'p',
      md: 'Within **30 days** after consumer notification is complete, the Incident Commander hosts a post-incident review that produces:',
    },
    {
      type: 'ul',
      items: [
        'A timeline of detection → containment → notification.',
        'Root-cause analysis of how Personal Information was exposed.',
        'A remediation plan with owners and due dates.',
        'A determination of whether this procedure itself needs updating.',
      ],
    },
    {
      type: 'p',
      md: 'Retain all incident artifacts (logs, communications, post-mortem) for a minimum of **5 years**, per Illinois statute of limitations on related civil actions.',
    },

    { type: 'h2', text: '10. Annual Review' },
    {
      type: 'p',
      md: 'This procedure is reviewed annually (next: May 2027) and after any breach. Updates are version-controlled in `lib/legal/content/illinois-breach-notification.ts` and re-issued via `/admin/legal`. Material changes are communicated to all team members in writing.',
    },

    { type: 'h2', text: '11. References' },
    {
      type: 'ul',
      items: [
        '**815 ILCS 530** — Illinois Personal Information Protection Act (PIPA). Full text: [https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2702](https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2702)',
        '**Illinois Attorney General — Identity Theft Hotline:** 1-866-999-5630',
        '**Illinois Attorney General — Privacy Resources:** [https://www.illinoisattorneygeneral.gov/Consumer-Protection/Privacy](https://www.illinoisattorneygeneral.gov/Consumer-Protection/Privacy)',
        'Related internal procedures: PCI Compliance Procedure (PRO-001), Webhook Security Procedure (PRO-002).',
      ],
    },
  ],
}

export default doc
export { doc }
