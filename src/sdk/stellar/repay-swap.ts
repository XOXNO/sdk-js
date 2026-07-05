/**
 * Empty strategy swap bytes for `repay_debt_with_collateral` when
 * `collateral_token === debt_token`. The controller requires the swap payload
 * to be genuinely empty in this case (`swap.is_empty()`) and reverts
 * `InvalidPayments` if any route is supplied, even an unused placeholder.
 */
export function buildSameTokenRepaySwapSteps(): Uint8Array {
  return new Uint8Array(0)
}