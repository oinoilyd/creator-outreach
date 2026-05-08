'use client'

import { PASSWORD_REQUIREMENTS } from '@/lib/password'

/**
 * Live password-requirement checklist. Renders directly under the
 * password input on signup + reset-password.
 *
 * Each requirement either shows ✓ (met) or ○ (unmet). Met ones
 * fade to muted; unmet ones stay foreground so the user's eye is
 * pulled to what's still needed.
 *
 * `dimUntilTyped`: when true and pw is empty, render the whole
 * list muted (so an empty form doesn't look like a wall of red
 * "you're failing!" indicators before the user has typed anything).
 */
export function PasswordChecklist({
  password,
  dimUntilTyped = true,
  className = '',
}: {
  password: string
  dimUntilTyped?: boolean
  className?: string
}) {
  const empty = password.length === 0
  const dimmed = dimUntilTyped && empty

  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] ${className}`}>
      {PASSWORD_REQUIREMENTS.map(req => {
        const met = !empty && req.test(password)
        return (
          <li
            key={req.id}
            className={
              'flex items-center gap-1.5 transition-colors ' +
              (dimmed
                ? 'text-muted-foreground/55'
                : met
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-muted-foreground')
            }
          >
            <span
              aria-hidden
              className={
                'inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold shrink-0 transition-colors ' +
                (met
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground/70 dark:bg-white/[0.08]')
              }
            >
              {met ? '✓' : '○'}
            </span>
            <span>{req.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
