import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn / Magic UI / Aceternity components all use a `cn(...)` helper
 * that merges Tailwind classes intelligently (later classes override
 * earlier ones for the same property). Standard pattern across these
 * design systems — drop in once and every copy-pasted component works.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
