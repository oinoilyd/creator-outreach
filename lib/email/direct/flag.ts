/**
 * lib/email/direct/flag.ts — the master kill-switch for the direct-email
 * integration.
 *
 * The entire direct Gmail/Outlook path (OAuth connect, sync, send,
 * sequences) is DARK until DIRECT_EMAIL_ENABLED is explicitly turned on.
 * This lets the whole feature live in the repo — and even ship to prod —
 * without affecting the live Unipile path or any user, until we flip it.
 *
 * Turn-on is a deliberate, env-gated step:
 *   DIRECT_EMAIL_ENABLED=1   (Vercel env var, then redeploy)
 *
 * Per-provider readiness is separate: a provider only counts as usable
 * if its OAuth credentials are present. That way you can enable Google
 * first and add Microsoft later without code changes.
 */

export type DirectEmailProvider = 'google' | 'microsoft'

/** Master switch. Everything in lib/email/direct/* checks this first. */
export function isDirectEmailEnabled(): boolean {
  const v = process.env.DIRECT_EMAIL_ENABLED?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

/** True only if the given provider has its OAuth app credentials wired. */
export function isProviderConfigured(provider: DirectEmailProvider): boolean {
  if (provider === 'google') {
    return Boolean(
      process.env.GOOGLE_EMAIL_CLIENT_ID?.trim() &&
        process.env.GOOGLE_EMAIL_CLIENT_SECRET?.trim(),
    )
  }
  return Boolean(
    process.env.MS_EMAIL_CLIENT_ID?.trim() &&
      process.env.MS_EMAIL_CLIENT_SECRET?.trim(),
  )
}

/** Master switch AND at least one provider ready to connect. */
export function isDirectEmailUsable(): boolean {
  return (
    isDirectEmailEnabled() &&
    (isProviderConfigured('google') || isProviderConfigured('microsoft'))
  )
}

/** Which providers a user is currently allowed to connect, in UI order. */
export function enabledProviders(): DirectEmailProvider[] {
  if (!isDirectEmailEnabled()) return []
  const out: DirectEmailProvider[] = []
  if (isProviderConfigured('google')) out.push('google')
  if (isProviderConfigured('microsoft')) out.push('microsoft')
  return out
}
