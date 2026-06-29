/**
 * /settings/email — connect-your-inbox surface for the DIRECT email path.
 *
 * Server component. Gated three ways:
 *   • not signed in        → bounce to home
 *   • flag off             → "not enabled yet" notice
 *   • flag on, no creds     → "no providers configured" notice (admin hint)
 *   • flag on, creds present → connect buttons + connected-mailbox list
 *
 * This is the sandbox pilot surface. The beta caveats (unverified-app
 * warning, weekly reconnect in testing mode) are spelled out so a pilot
 * user knows what to expect before Google verification lands.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isDirectEmailEnabled, enabledProviders } from '@/lib/email/direct/flag'
import type { DirectEmailAccount } from '@/lib/email/direct/types'

export const dynamic = 'force-dynamic'

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Gmail',
  microsoft: 'Outlook',
}

const ERROR_COPY: Record<string, string> = {
  disabled: 'Direct email isn’t switched on yet.',
  bad_provider: 'That email provider isn’t supported.',
  not_configured: 'That provider isn’t set up yet (missing credentials).',
  state_mismatch: 'The connection attempt expired or didn’t match. Please try again.',
  no_email: 'We couldn’t read your mailbox address from the grant.',
  no_refresh_token: 'Google didn’t return a long-term token — disconnect the app in your Google account, then reconnect.',
  exchange_failed: 'Something went wrong finishing the connection. Please try again.',
}

export default async function DirectEmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const enabled = isDirectEmailEnabled()
  const providers = enabledProviders()

  let accounts: DirectEmailAccount[] = []
  if (enabled) {
    const { data } = await supabase
      .from('direct_email_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    accounts = (data ?? []) as DirectEmailAccount[]
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Connect your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Send outreach and catch replies straight from your own Gmail or Outlook — no middleman.
          This is an early beta running alongside the current email setup.
        </p>
      </header>

      {sp.connected && (
        <div className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          ✓ Connected {PROVIDER_LABEL[sp.connected] ?? sp.connected}. Replies will start syncing shortly.
        </div>
      )}
      {sp.error && (
        <div className="mb-6 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {ERROR_COPY[sp.error] ?? 'Something went wrong. Please try again.'}
        </div>
      )}

      {!enabled ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Direct email isn’t switched on yet. It’s in development — you’ll see connect options here
            once it’s enabled.
          </p>
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            The feature is on, but no email provider is configured. Set the provider OAuth credentials
            in the environment to enable Connect.
          </p>
        </div>
      ) : (
        <>
          {accounts.length > 0 && (
            <section aria-label="Connected mailboxes" className="mb-8 space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {PROVIDER_LABEL[a.provider] ?? a.provider}
                      {' · '}
                      {a.status === 'active' ? 'Connected' : a.status === 'needs_reconnect' ? 'Needs reconnect' : 'Revoked'}
                      {a.last_synced_at ? ` · last synced ${new Date(a.last_synced_at).toLocaleString()}` : ''}
                    </div>
                  </div>
                  {a.status !== 'active' && (
                    <a
                      href={`/api/email/direct/connect?provider=${a.provider}`}
                      className="rounded-md bg-gradient-to-br from-brand to-brand-2 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Reconnect
                    </a>
                  )}
                </div>
              ))}
            </section>
          )}

          <section aria-label="Add a mailbox" className="space-y-3">
            {providers.map((p) => (
              <a
                key={p}
                href={`/api/email/direct/connect?provider=${p}`}
                className="flex items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-2 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Connect {PROVIDER_LABEL[p] ?? p}
              </a>
            ))}
          </section>

          <div className="mt-8 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Heads up while we’re in beta</p>
            <p>
              Until Google finishes verifying the app, you may see an “unverified app” warning when
              you connect (it’s safe to continue), and the connection can expire about every 7 days —
              just reconnect here if replies stop syncing.
            </p>
          </div>
        </>
      )}
    </main>
  )
}
