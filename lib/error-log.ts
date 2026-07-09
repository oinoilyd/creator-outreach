/**
 * Central client-side error logger + admin gate.
 *
 * Why this exists (Dylan 2026-06-08): migration 0033 wasn't applied
 * to prod for 16 days, causing every outreach save to fail silently
 * with PGRST204. The only signal was a `console.error` invisible to
 * the user. This module routes all save-fn failures into a Supabase
 * table that admin can review centrally on the /admin tab.
 *
 * Design choices:
 *   • Admin (dmeehanj@gmail.com) sees a blocking alert for any save
 *     failure they personally hit — fast feedback during dev / admin
 *     usage. Other users see nothing, but their failure is logged.
 *   • Inserts use the browser Supabase client (the same auth context
 *     as the failing save), so RLS treats the writer as an
 *     authenticated user and the row carries their auth.uid().
 *   • If the error-log INSERT itself fails (e.g., the
 *     client_error_log table doesn't exist on this env), we fall
 *     back to console.error — never break the calling save fn.
 */

import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export interface ClientErrorContext {
  /** Which save function failed — e.g. 'saveOutreach', 'saveDismissed'. */
  functionName: string
  /** Supabase / Postgres error object as returned from the failed call. */
  error: {
    code?: string
    message: string
    details?: string
    hint?: string
  }
  /** Keys of the payload being saved at the time. Helps spot which
   *  column the schema-cache error refers to. Optional. */
  payloadKeys?: string[]
  /** Which rows the failed write was carrying (channel names or ids).
   *  Added 2026-07-09 with the delta-write refactor: a scoped write
   *  failure concerns specific rows, and knowing WHICH row failed is
   *  what makes the error inbox actionable. Folded into error_details
   *  so no schema change is needed. Optional. */
  rowIds?: string[]
}

/**
 * Log a failed save to the central error log. Best-effort: never
 * throws, never blocks the caller. The calling save fn should still
 * log to console for dev-time visibility.
 */
export async function logClientError(ctx: ClientErrorContext): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('client_error_log').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      function_name: ctx.functionName,
      error_code: ctx.error.code ?? null,
      error_message: ctx.error.message,
      error_details: [
        ctx.error.details,
        ctx.rowIds?.length ? `rows: ${ctx.rowIds.join(', ')}` : null,
      ].filter(Boolean).join(' | ') || null,
      error_hint: ctx.error.hint ?? null,
      payload_keys: ctx.payloadKeys ?? null,
    })
  } catch (logErr) {
    // Fallback: can't even write the log. Print to console so dev sees
    // something. Don't propagate — calling save fn shouldn't crash
    // because logging crashed.
    console.error(
      '[error-log] failed to write client_error_log row:',
      (logErr as Error)?.message,
      '(original error was:', ctx.error.message, ')',
    )
  }
}

/**
 * True when the currently-signed-in user is the admin. Used to decide
 * whether to show a blocking alert for save failures. Cached at module
 * level so repeated checks within a session don't re-query Supabase.
 */
let cachedIsAdmin: boolean | null = null
export async function isAdminUser(): Promise<boolean> {
  if (cachedIsAdmin !== null) return cachedIsAdmin
  if (typeof window === 'undefined') return false
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    cachedIsAdmin = user?.email === ADMIN_EMAIL
    return cachedIsAdmin
  } catch {
    cachedIsAdmin = false
    return false
  }
}

/**
 * Combined helper: log the error, AND show a blocking alert if the
 * current user is admin. Designed to drop straight into save-fn
 * error branches.
 *
 * Use:
 *   if (upErr) {
 *     console.error('[saveOutreach] upsert failed:', upErr.message)
 *     void reportSaveFailure({
 *       functionName: 'saveOutreach',
 *       error: upErr,
 *       payloadKeys: Object.keys(rows[0] ?? {}),
 *     })
 *   }
 */
export async function reportSaveFailure(ctx: ClientErrorContext): Promise<void> {
  await logClientError(ctx)
  if (await isAdminUser() && typeof window !== 'undefined') {
    const code = ctx.error.code ?? 'unknown'
    const details = ctx.error.details ?? ''
    const hint = ctx.error.hint ?? ''
    const keys = (ctx.payloadKeys ?? []).join(', ') || '(none captured)'
    const rows = (ctx.rowIds ?? []).join(', ')
    window.alert(
      `❌ SAVE FAILED (admin alert)\n\n` +
      `Function: ${ctx.functionName}\n` +
      `Error: ${ctx.error.message}\n` +
      `Code: ${code}\n` +
      `Details: ${details}\n` +
      `Hint: ${hint}\n\n` +
      (rows ? `Rows: ${rows}\n` : '') +
      `Payload keys: ${keys}\n\n` +
      `Logged to client_error_log. Check /admin → Error Inbox.`,
    )
  }
}
