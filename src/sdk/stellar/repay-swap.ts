import type { StellarStrategyPayloadInput } from './scval-encode'

/**
 * Placeholder aggregator route when `repay_debt_with_collateral` has
 * `collateral_token === debt_token`. The controller short-circuits and never
 * decodes the route, but the Soroban arg must still be valid `Bytes`.
 */
export function buildSameTokenRepaySwapSteps(
  token: string,
  collateralAmount: string
): StellarStrategyPayloadInput {
  return {
    paths: [
      {
        hops: [
          {
            amountOut: '0',
            pool: token,
            tokenIn: token,
            tokenOut: token,
            venue: 'Soroswap',
          },
        ],
        splitPpm: 1_000_000,
      },
    ],
    referralId: 0,
    tokenIn: token,
    tokenOut: token,
    totalMinOut: collateralAmount,
  }
}