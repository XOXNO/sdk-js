/**
 * Stellar lending activity-id derivation — the single owner of the inputs that
 * compose `NftActivityDoc.id` (`${txHash}-${eventIdentifier}-${eventOrder}`).
 *
 * Both indexing consumers (xoxno-api-v2, xoxno-az-functions) MUST derive these
 * inputs here so the activity ids they write to `NFT_ACTIVITY_DATA` are
 * byte-identical — the hard gate for consolidating activity indexing into a
 * single producer. Ported verbatim from api-v2's `stellar-lending-activity.mapper`.
 *
 * The activity-type string values mirror `@xoxno/types` `XoxnoLendingActivity`.
 * They are inlined (not imported) because `@xoxno/types` does not re-export its
 * enums on the top-level type surface and the SDK keeps that NestJS-coupled
 * module out of its runtime bundle.
 */

/** Synthetic NFT collection ticker for Stellar lending accounts. */
export const XOXNO_LENDING_STELLAR_TICKER = 'XLENDXLM-a7c9f3'

/**
 * A child delta's contribution to `eventOrder`: `base * STRIDE + childIndex`.
 * The stride bounds the number of child deltas per base event before two base
 * events could collide.
 */
export const SYNTHETIC_EVENT_ORDER_STRIDE = 10_000

/** `XoxnoLendingActivity` values used by the position activity mapping. */
export type StellarLendingActivityType =
  | 'lendingUpdateAccountPosition'
  | 'lendingLiquidateRepayDebt'
  | 'lendingLiquidateSeizeCollateral'
  | 'lendingUpdateAccountParameters'

/**
 * Synthetic NFT identifier for a Stellar lending account, e.g.
 * `XLENDXLM-a7c9f3-2a` for account 42. The u64 account id is rendered as
 * even-length lowercase hex.
 */
export function buildStellarLendingIdentifier(accountId: string): string {
  const hex = BigInt(accountId).toString(16)
  const padded = hex.length % 2 === 0 ? hex : `0${hex}`
  return `${XOXNO_LENDING_STELLAR_TICKER}-${padded}`
}

/**
 * Extract the base event order from a Soroban RPC event id (`<ledger>-<index>`).
 * Returns 0 when the id is malformed or has no index segment.
 */
export function extractEventOrder(eventId: string): number {
  const parts = eventId.split('-')
  return parts.length >= 2 ? parseInt(parts[1]!, 10) || 0 : 0
}

/**
 * Stable per-child ordering within one base event:
 * `baseEventOrder * 10_000 + childIndex`. Keeps multiple deltas emitted by a
 * single transaction deterministically ordered and collision-free.
 */
export function syntheticEventOrder(baseEventOrder: number, childIndex = 0): number {
  return baseEventOrder * SYNTHETIC_EVENT_ORDER_STRIDE + childIndex
}

/**
 * Map a position-delta `action` symbol to its `XoxnoLendingActivity` value.
 * The tag list is authoritative in `rs-lending-xlm common/src/events.rs`.
 */
export function mapStellarPositionActivityType(
  action?: string
): StellarLendingActivityType {
  switch (action) {
    case 'liq_repay':
      return 'lendingLiquidateRepayDebt'
    case 'liq_seize':
      return 'lendingLiquidateSeizeCollateral'
    case 'param_upd':
      return 'lendingUpdateAccountParameters'
    default:
      return 'lendingUpdateAccountPosition'
  }
}
