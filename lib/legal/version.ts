/**
 * Shared version string for Terms of Service + Privacy Policy.
 *
 * Bump this when either lib/legal/content/terms.ts or
 * lib/legal/content/privacy.ts is materially updated. The signup
 * checkbox records THIS version on user_profile.terms_privacy_version
 * — when it diverges from the user's stored version, we know they
 * agreed to an older revision and can re-prompt at next sign-in.
 *
 * Format: ISO date matching the `lastUpdated` field in both content
 * files (e.g. "2026-05-11"). Stay in sync — if you bump one, bump the
 * lastUpdated date in the corresponding content file too.
 */
export const TERMS_PRIVACY_VERSION = '2026-05-11'
