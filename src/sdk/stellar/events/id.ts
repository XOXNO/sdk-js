/**
 * Stellar lending activity-id derivation: the inputs that compose
 * `NftActivityDoc.id` (`${txHash}-${eventIdentifier}-${eventOrder}`).
 *
 * The activity-type string values mirror `@xoxno/types` `XoxnoLendingActivity`,
 * inlined rather than imported since `@xoxno/types` does not re-export its enums
 * on its top-level type surface.
 */


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
 * NFT identifier for a Stellar lending account: the position-NFT contract
 * address with the decimal account id (== token id) appended, e.g.
 * `CDVN5…LPSY-42`. The account IS an on-chain NFT since the NFT-ownership
 * protocol; the collection is the contract itself and there is no synthetic
 * ticker or hex encoding anymore.
 */
export function buildStellarLendingIdentifier(
  positionNftContract: string,
  accountId: string,
): string {
  return `${positionNftContract}-${BigInt(accountId).toString(10)}`
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
 * The tag list is authoritative in `rs-lending-xlm
 * contracts/controller/src/events/mod.rs` (`PositionAction`).
 *
 * `liq_credit` is deliberately NOT `lendingLiquidateSeizeCollateral`. That
 * activity renders as "Liquidated by / Liquidation", and a share-credit leg
 * lands on the *liquidator's* receiving account, which was not liquidated —
 * so it maps to the plain position update instead. It also keeps a
 * protocol-wide sum over `lendingLiquidateSeizeCollateral` from
 * double-counting the same seizure twice (gross on the liquidated account,
 * net on the receiver). The raw `liq_credit` / `liq_seize` strings stay on
 * the delta itself, so the two legs remain distinguishable downstream.
 */
export function mapStellarPositionActivityType(
  action?: string
): StellarLendingActivityType {
  switch (action) {
    case 'liq_repay':
      return 'lendingLiquidateRepayDebt'
    case 'liq_seize':
      return 'lendingLiquidateSeizeCollateral'
    case 'liq_credit':
      return 'lendingUpdateAccountPosition'
    case 'param_upd':
      return 'lendingUpdateAccountParameters'
    default:
      return 'lendingUpdateAccountPosition'
  }
}
