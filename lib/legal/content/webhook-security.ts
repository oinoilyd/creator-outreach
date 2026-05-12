import type { LegalDoc } from '../types'

const doc: LegalDoc = {
  slug: 'webhook-security',
  title: 'Webhook Security Procedure',
  lastUpdated: 'May 11, 2026',
  summary: 'Signature verification, replay protection, and incident response for inbound webhooks.',
  isPublic: false,
  docType: 'Procedure',
  docNumber: 'PRO-002',
  version: '1.0',
  effectiveDate: 'May 11, 2026',
  owner: 'Founder / CEO',
  status: 'Active',
  intro:
    'This procedure defines how Creator Outreach receives, verifies, and processes inbound webhooks from third-party services. Forged webhook events are a high-impact attack vector — a single unsigned endpoint can let an attacker grant themselves a paid subscription, mark messages as delivered, or bypass billing entirely. Every webhook endpoint MUST follow the controls below.',
  blocks: [
    { type: 'h2', text: '1. Purpose' },
    {
      type: 'p',
      md: 'Prevent forged or replayed webhook events from triggering downstream business logic such as subscription activation, message delivery state, or any other side-effect-bearing handler.',
    },

    { type: 'h2', text: '2. Scope' },
    {
      type: 'p',
      md: 'This procedure applies to every inbound webhook endpoint Creator Outreach exposes. Current third parties:',
    },
    {
      type: 'ul',
      items: [
        '**Stripe** — subscription, invoice, customer, payment_intent events.',
        '**Unipile** — inbound email replies, OAuth status changes, delivery and engagement events.',
        '**QStash (Upstash)** — our own scheduled job dispatcher; events are signed with a QStash signing key.',
        'Any future provider that sends asynchronous server-to-server events to a Creator Outreach URL.',
      ],
    },

    { type: 'h2', text: '3. Policy' },
    {
      type: 'ul',
      items: [
        '**Every** webhook endpoint MUST verify the signature on the request before reading or acting on the payload.',
        'A request that fails signature verification MUST be rejected with **HTTP 401** and MUST NOT trigger any downstream state change.',
        'Signing secrets are stored as Vercel environment variables (e.g., `STRIPE_WEBHOOK_SECRET`, `UNIPILE_WEBHOOK_SECRET`, `QSTASH_CURRENT_SIGNING_KEY`) and are **never** committed to the repository.',
        'Signing-secret rotation is logged and reviewed during the quarterly security check.',
      ],
    },

    { type: 'h2', text: '4. Procedure' },
    { type: 'h3', text: '4.1 Provider SDK Verification' },
    {
      type: 'ul',
      items: [
        'Use the provider’s official verification helper rather than hand-rolling HMAC code.',
        'Stripe: `stripe.webhooks.constructEvent(rawBody, signatureHeader, process.env.STRIPE_WEBHOOK_SECRET)`. The raw body MUST be used — do not parse JSON before verification.',
        'Unipile: verify the `X-Unipile-Signature` header against `UNIPILE_WEBHOOK_SECRET` using the algorithm documented in their integration guide.',
        'QStash: verify using the Upstash QStash receiver against `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` (both keys are checked to allow zero-downtime rotation).',
      ],
    },
    { type: 'h3', text: '4.2 Replay Protection' },
    {
      type: 'ul',
      items: [
        'Reject any event whose signed timestamp is more than **5 minutes** older than the server clock (Stripe supplies this in `t=` of the signature; Unipile and QStash supply equivalent timestamps).',
        'Track the last N processed event IDs per provider in a fast store (Redis / KV) and reject duplicates that arrive within the dedupe window.',
      ],
    },
    { type: 'h3', text: '4.3 Idempotency' },
    {
      type: 'ul',
      items: [
        'Stripe delivers events **at least once**. Every webhook handler MUST be idempotent: re-running the same event ID MUST produce the same observable state.',
        'Persist each processed event ID with a timestamp. Before applying side effects, check this table; if the event ID is already present, acknowledge with HTTP 200 and return without re-applying.',
        'Side effects (database writes, outbound API calls) MUST happen inside a transaction that includes the idempotency insert, so a partial failure cannot leave us "applied but unmarked."',
      ],
    },
    { type: 'h3', text: '4.4 Logging' },
    {
      type: 'ul',
      items: [
        'Log every signature verification failure with: request IP, request path, header values that influenced verification (but never the secret), and the timestamp.',
        'Log successful verification at INFO level with provider, event ID, and event type.',
        'Sensitive payload fields (tokens, OAuth credentials) MUST be redacted in logs.',
      ],
    },

    { type: 'h2', text: '5. Provider-Specific Implementation Notes' },
    { type: 'h3', text: '5.1 Stripe' },
    {
      type: 'ul',
      items: [
        'Use `stripe.webhooks.constructEvent`. Never trust the JSON body before this call returns.',
        'Configure the Next.js route to receive the raw body (no automatic JSON parsing in middleware).',
        'When rotating `STRIPE_WEBHOOK_SECRET`, add the new secret in Stripe, deploy code that accepts both old and new for a short window, then remove the old.',
      ],
    },
    { type: 'h3', text: '5.2 Unipile' },
    {
      type: 'ul',
      items: [
        'Read the `X-Unipile-Signature` header and verify against `UNIPILE_WEBHOOK_SECRET`.',
        'Reject requests missing the header outright (HTTP 401).',
        'Treat any payload that arrives without a matching signature as adversarial regardless of source IP.',
      ],
    },
    { type: 'h3', text: '5.3 QStash' },
    {
      type: 'ul',
      items: [
        'Use the Upstash QStash receiver to verify the JWT in the `Upstash-Signature` header.',
        'Both `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` MUST be configured to allow safe rotation.',
      ],
    },
    { type: 'h3', text: '5.4 Outbound Signed URLs (Unsubscribe)' },
    {
      type: 'p',
      md: 'Same HMAC discipline applies to URLs we mint and send to third parties. The `/unsubscribe` endpoint embedded in every outreach email is the canonical example: an attacker who can forge an unsubscribe URL can silently DoS a sender\'s outreach by opting their entire contact list out. The link is signed and verified the same way an inbound webhook is.',
    },
    {
      type: 'ul',
      items: [
        'Token format is `<base64url(json)>.<base64url(hmac)>` where the HMAC is HMAC-SHA256 of the base64url-encoded payload using `UNSUBSCRIBE_HMAC_SECRET`.',
        'Sign the **encoded** payload string, not the raw JSON — verification then compares bytes directly without re-serialising the JSON.',
        'Verify with `crypto.timingSafeEqual` to defeat timing oracles.',
        'Treat any tampered or unsigned token as invalid and render a friendly fallback page that tells the recipient to reply with "unsubscribe" — never throw a 500 at someone trying to opt out of mail.',
        '`UNSUBSCRIBE_HMAC_SECRET` MUST be ≥64 chars / 256 bits of entropy and is stored as a Vercel env var, never committed.',
      ],
    },

    { type: 'h2', text: '6. Incident Response' },
    {
      type: 'ul',
      items: [
        'If a single anomalous verification failure appears in the logs, capture it for the quarterly review but take no immediate action.',
        'If a **pattern** of failed verifications appears (>5 in a short window from non-trivial origins, repeated probes against the webhook path, or any handler-side anomaly suggesting forgery), rotate the signing secret in the provider dashboard and in Vercel immediately.',
        'After rotation, re-verify that all live deploys reference the new secret and that no legitimate events are being dropped.',
        'Document the incident, evidence, and resolution in the security log and retain for at least 3 years.',
      ],
    },

    { type: 'h2', text: '7. Review Cadence' },
    {
      type: 'p',
      md: 'This procedure is reviewed quarterly. Adding a new third-party webhook source requires updating Section 2 and Section 5 **before** the endpoint goes live.',
    },
  ],
}

export default doc
export { doc }
