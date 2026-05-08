/**
 * Password validation — shared between signup and reset-password.
 *
 * Mirrors the requirements Supabase Auth is currently configured to
 * enforce server-side (lowercase + uppercase + digit + special +
 * min length). Doing the same checks client-side gives us a clean,
 * specific message instead of Supabase's default character-class-
 * dump string ("Password should contain at least one character of
 * each: abc... ABC... 012... !@#..."), which is unreadable.
 *
 * If the Supabase password policy ever changes, update REQUIREMENTS
 * to match. Otherwise the client check will diverge from the server
 * check and users will see the ugly fallback message again.
 */

export interface PasswordRequirement {
  /** Stable id for keying / programmatic checks. */
  id: 'length' | 'lower' | 'upper' | 'digit' | 'special'
  /** User-facing label rendered in the checklist. */
  label: string
  /** Predicate that returns true when this requirement is satisfied. */
  test: (pw: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length',  label: 'At least 8 characters',  test: (pw) => pw.length >= 8 },
  { id: 'lower',   label: 'A lowercase letter',     test: (pw) => /[a-z]/.test(pw) },
  { id: 'upper',   label: 'An uppercase letter',    test: (pw) => /[A-Z]/.test(pw) },
  { id: 'digit',   label: 'A number',               test: (pw) => /\d/.test(pw) },
  { id: 'special', label: 'A special character',    test: (pw) => /[^a-zA-Z0-9\s]/.test(pw) },
]

export interface PasswordValidationResult {
  valid: boolean
  /** Requirements not yet satisfied. Empty when valid. */
  missing: PasswordRequirement[]
}

/**
 * Run every requirement against the candidate password. Returns
 * the full breakdown so callers can render either a live checklist
 * (each requirement) OR a single inline error ("Add a number").
 */
export function validatePassword(pw: string): PasswordValidationResult {
  const missing = PASSWORD_REQUIREMENTS.filter(req => !req.test(pw))
  return { valid: missing.length === 0, missing }
}

/**
 * Translate Supabase's noisy default password-policy error into
 * something a user can actually act on.
 *
 * Supabase fires a message like:
 *   "Password should contain at least one character of each:
 *    abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ,
 *    0123456789, !@#$%..."
 *
 * Detect that pattern and replace with: "Password needs an
 * uppercase letter, a number, and a special character." (or
 * whatever specific items are missing).
 *
 * Any other error message passes through untouched — we only
 * sanitize the one we know is ugly.
 */
export function friendlyPasswordError(rawMessage: string, candidate: string): string {
  if (!rawMessage) return ''
  const isPolicyDump = /password should contain at least one character of each/i.test(rawMessage)
  if (!isPolicyDump) return rawMessage

  const { missing } = validatePassword(candidate)
  if (missing.length === 0) {
    // Server thinks something's missing but our client check passed —
    // surface a generic ask-for-the-things message rather than the dump.
    return 'Your password needs an uppercase letter, a lowercase letter, a number, and a special character.'
  }
  if (missing.length === 1) {
    return `Your password is missing ${missing[0].label.toLowerCase()}.`
  }
  const labels = missing.map(m => m.label.toLowerCase())
  const tail = labels.pop()
  return `Your password is missing ${labels.join(', ')} and ${tail}.`
}
