/**
 * Tour step types — re-exported from the canonical catalog at
 * lib/tutorial-catalog.ts. All step definitions live there now;
 * this file just provides the legacy TourStep / TourPlacement /
 * TourPreviewSketch / TourHelpers exports the rest of the tour
 * components import from.
 *
 * Three-tier system per Dylan 2026-05-24:
 *   - 'short'    — ~10 steps, the spine
 *   - 'pro'      — ~18 steps, customization moments
 *   - 'granular' — ~30+ steps, every advanced surface
 *
 * See lib/tutorial-catalog.ts for the maintenance guide on adding
 * new feature steps.
 */

export type {
  TourHelpers,
  TourPlacement,
  TourPreviewSketch,
  TutorialTier,
} from '@/lib/tutorial-catalog'

import type { CatalogStep, TutorialTier } from '@/lib/tutorial-catalog'
import { CATALOG_STEPS, stepsForTier } from '@/lib/tutorial-catalog'

/** Backwards-compat alias — the rest of the tour code imports TourStep
 *  from this file. CatalogStep has the same shape plus tier tags;
 *  consumers can ignore the tiers field. */
export type TourStep = CatalogStep

/**
 * Default tour step list — kept for backwards compatibility with the
 * single-tier code path. Defaults to the 'short' tier so existing
 * callers (auto-open on first visit, hamburger "Take a tour") fall
 * back to the smallest tour if no explicit tier is passed.
 *
 * NEW callers should use `stepsForTier()` directly with the tier the
 * user picked.
 */
export const TOUR_STEPS: ReadonlyArray<TourStep> = stepsForTier('short')

/** Re-export so consumers don't need a second import. */
export { CATALOG_STEPS, stepsForTier }
