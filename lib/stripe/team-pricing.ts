/**
 * Team plan Stripe pricing — find-or-create the two Prices we manage.
 *
 *   • Team Base: $150/mo flat, recurring. quantity = 1 always.
 *   • Team Seat: $35/mo per seat, recurring. quantity = max(0, members - 5).
 *
 * We use Stripe `lookup_key` to make these idempotent — the first time
 * any team checkout fires, we call resolveTeamPriceIds() which either
 * finds the existing Prices by lookup_key or creates them. This avoids
 * any manual Stripe Dashboard setup; the only thing the admin has to
 * do is verify the webhook subscribes to `checkout.session.completed`
 * (already required for individual subs).
 *
 * Why a single Product with two Prices? Both line items live under one
 * shared Product so the Stripe invoice reads "Team plan · base + N
 * extra seats" cleanly, not as two separate products.
 */

import type Stripe from 'stripe'
import { getStripe } from './client'
import {
  TEAM_BASE_PRICE_CENTS,
  TEAM_SEAT_PRICE_CENTS,
  TEAM_BASE_PRICE_LOOKUP_KEY,
  TEAM_SEAT_PRICE_LOOKUP_KEY,
} from '../team'

interface TeamPriceIds {
  basePriceId: string
  seatPriceId: string
}

/** Module-level cache so repeat calls don't hit Stripe each time. */
let cached: TeamPriceIds | null = null

/**
 * Find existing Team Prices by lookup_key, or create them if missing.
 * Returns the Price IDs for use in checkout sessions.
 *
 * Idempotent — safe to call on every team-related endpoint. Subsequent
 * calls hit the module-level cache; only the cold first call talks to
 * Stripe.
 */
export async function resolveTeamPriceIds(): Promise<TeamPriceIds> {
  if (cached) return cached
  const stripe = getStripe()

  // Look up existing Prices by their lookup_key. expand the product
  // so we know whether the parent exists too.
  const existing = await stripe.prices.list({
    lookup_keys: [TEAM_BASE_PRICE_LOOKUP_KEY, TEAM_SEAT_PRICE_LOOKUP_KEY],
    active: true,
    limit: 10,
    expand: ['data.product'],
  })

  let basePrice = existing.data.find(p => p.lookup_key === TEAM_BASE_PRICE_LOOKUP_KEY)
  let seatPrice = existing.data.find(p => p.lookup_key === TEAM_SEAT_PRICE_LOOKUP_KEY)

  // Both exist already → done.
  if (basePrice && seatPrice) {
    cached = { basePriceId: basePrice.id, seatPriceId: seatPrice.id }
    return cached
  }

  // Need to create at least one. First ensure a "Team plan" Product exists.
  let productId: string | null = null
  // Reuse existing Product if either Price already has one.
  if (basePrice && typeof basePrice.product !== 'string') {
    productId = basePrice.product?.id ?? null
  } else if (seatPrice && typeof seatPrice.product !== 'string') {
    productId = seatPrice.product?.id ?? null
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: 'Creator Outreach Team',
      description: 'Team plan — $150/mo for 5 seats, $35/mo per extra seat.',
      metadata: { kind: 'team_plan' },
    })
    productId = product.id
  }

  // Create whichever Prices are missing.
  if (!basePrice) {
    basePrice = await stripe.prices.create({
      product: productId,
      unit_amount: TEAM_BASE_PRICE_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: TEAM_BASE_PRICE_LOOKUP_KEY,
      nickname: 'Team Base ($150/mo, includes 5 seats)',
    })
  }
  if (!seatPrice) {
    seatPrice = await stripe.prices.create({
      product: productId,
      unit_amount: TEAM_SEAT_PRICE_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: TEAM_SEAT_PRICE_LOOKUP_KEY,
      nickname: 'Team Seat ($35/mo per extra seat beyond 5)',
    })
  }

  cached = { basePriceId: basePrice.id, seatPriceId: seatPrice.id }
  return cached
}

/**
 * Update the seat quantity on an org's Team subscription. Called
 * whenever a member is added/removed/accepted-invite. Idempotent —
 * if Stripe is already at the target quantity, no-op.
 *
 * Returns true on change, false if no change was needed.
 */
export async function syncTeamSeatQuantity(
  stripeSubscriptionId: string,
  desiredExtraSeats: number,
): Promise<boolean> {
  const stripe = getStripe()
  const { seatPriceId } = await resolveTeamPriceIds()

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['items.data.price'],
  })

  // Find the existing seat-line item, if any.
  const seatItem = sub.items.data.find(item => {
    const price = item.price as Stripe.Price | undefined
    return price?.id === seatPriceId
      || (typeof item.price === 'string' && item.price === seatPriceId)
  })

  const desired = Math.max(0, Math.floor(desiredExtraSeats))

  if (seatItem) {
    // Update quantity (or remove the item if dropping to 0).
    if (seatItem.quantity === desired) return false
    if (desired === 0) {
      await stripe.subscriptionItems.del(seatItem.id, {
        proration_behavior: 'create_prorations',
      })
      return true
    }
    await stripe.subscriptionItems.update(seatItem.id, {
      quantity: desired,
      proration_behavior: 'create_prorations',
    })
    return true
  }

  // No seat item yet. Only add one if we actually need extras.
  if (desired === 0) return false
  await stripe.subscriptionItems.create({
    subscription: stripeSubscriptionId,
    price: seatPriceId,
    quantity: desired,
    proration_behavior: 'create_prorations',
  })
  return true
}
