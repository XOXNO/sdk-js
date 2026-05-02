/**
 * Stellar aggregator router direct-call transaction builder.
 *
 * Builds an unsigned XDR for `router.batch_execute(BatchSwap)` so a
 * user can swap A → B without involving the lending controller. The
 * `BatchSwap.sender` is filled with the caller's G-strkey (the user's
 * own SAC balances fund the swap and receive the output).
 *
 * For lending strategies (multiply / swap_debt / swap_collateral /
 * repay_debt_with_collateral) the controller wraps the same payload
 * itself and sets `sender = current_contract_address` — those flows
 * use the strategy builders in `./lending.ts`, NOT this builder.
 */

import type {
  AggregatorSwapDto,
  StellarAggregatorQuoteResponseDto,
  SwapHopDto,
  SwapPathDto,
} from '@xoxno/types'
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  ScInt,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'

import {
  getStellarAggregatorRouter,
  STELLAR_NETWORK_PASSPHRASE,
} from './contracts'
import type { BuiltStellarTx, StellarBuilderOptions } from './lending'

const addr = (a: string): xdr.ScVal => new Address(a).toScVal()
const i128 = (s: string): xdr.ScVal => new ScInt(s).toI128()
const u32 = (n: number): xdr.ScVal => xdr.ScVal.scvU32(n)
const sym = (s: string): xdr.ScVal => xdr.ScVal.scvSymbol(s)

const scStruct = (fields: Record<string, xdr.ScVal>): xdr.ScVal =>
  xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map(
        (k) =>
          new xdr.ScMapEntry({
            key: sym(k),
            val: fields[k] as xdr.ScVal,
          })
      )
  )

const encodeHop = (hop: SwapHopDto): xdr.ScVal =>
  scStruct({
    fee_bps: u32(hop.feeBps),
    pool: addr(hop.pool),
    token_in: addr(hop.tokenIn),
    token_out: addr(hop.tokenOut),
    venue: xdr.ScVal.scvVec([sym(hop.venue)]),
  })

const encodePath = (path: SwapPathDto): xdr.ScVal =>
  scStruct({
    amount_in: i128(path.amountIn),
    hops: xdr.ScVal.scvVec(path.hops.map(encodeHop)),
    min_amount_out: i128(path.minAmountOut),
  })

/** Encode the router-facing `BatchSwap` struct. */
const encodeBatchSwap = (
  swap: AggregatorSwapDto,
  sender: string
): xdr.ScVal =>
  scStruct({
    paths: xdr.ScVal.scvVec(swap.paths.map(encodePath)),
    sender: addr(sender),
    total_min_out: i128(swap.totalMinOut),
  })

export interface StellarBatchSwapBuilderOptions extends StellarBuilderOptions {
  /**
   * Override the resolved aggregator router contract address. Normally
   * resolved from `STELLAR_AGGREGATOR_ROUTER[network]`.
   */
  routerAddress?: string
}

/**
 * Build an unsigned XDR for a direct user → aggregator router swap.
 *
 * The `swap` payload (paths + per-path min-outs + total-min-out) comes
 * straight from the quote server; map a
 * `StellarAggregatorQuoteResponseDto` to `AggregatorSwapDto` via
 * `mapQuoteResponseToAggregatorSwap` before calling this.
 */
export function buildStellarBatchSwapTx(
  opts: StellarBatchSwapBuilderOptions,
  swap: AggregatorSwapDto
): BuiltStellarTx {
  const routerId =
    opts.routerAddress ?? getStellarAggregatorRouter(opts.network)
  const contract = new Contract(routerId)

  const source = new Account(opts.caller, opts.sourceSequence)

  const tx = new TransactionBuilder(source, {
    fee: opts.fee ?? BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE[opts.network],
  })
    .addOperation(contract.call('batch_execute', encodeBatchSwap(swap, opts.caller)))
    .setTimeout(opts.timeoutSeconds ?? 300)
    .build()

  return { xdr: tx.toXDR() }
}

/**
 * Translate a quote-server response into the controller-facing
 * `AggregatorSwapDto`. The mapping is purely a key rename plus the
 * fallback for single-path quotes that omit `paths` (we wrap the flat
 * `hops` list as a single path).
 *
 * Throws if `amountOutMin` is missing — the controller refuses
 * unbounded swaps so the SDK rejects them at the boundary.
 */
export function mapQuoteResponseToAggregatorSwap(
  quote: StellarAggregatorQuoteResponseDto
): AggregatorSwapDto {
  if (typeof quote.amountOutMin !== 'string') {
    throw new Error(
      'mapQuoteResponseToAggregatorSwap: quote response is missing `amountOutMin`. Pass `slippage` when fetching the quote.'
    )
  }
  const totalMinOut = quote.amountOutMin

  const paths = quote.paths
    ? quote.paths.map((path) => ({
        amountIn: path.amountIn,
        hops: path.swaps.map(mapHop),
        // Apply the global slippage proportionally to each path's
        // expected output. The server already encodes the same factor
        // in `amountOutMin` at the response root.
        minAmountOut: scaleByOutputRatio(
          path.amountOut,
          quote.amountOut,
          totalMinOut
        ),
      }))
    : [
        {
          amountIn: quote.amountIn,
          hops: quote.hops.map(mapHop),
          minAmountOut: totalMinOut,
        },
      ]

  return { paths, totalMinOut }
}

const mapHop = (hop: {
  feeBps: number
  poolAddress: string
  from: string
  to: string
  dex: string
}): SwapHopDto => ({
  feeBps: hop.feeBps,
  pool: hop.poolAddress,
  tokenIn: hop.from,
  tokenOut: hop.to,
  venue: hop.dex as SwapHopDto['venue'],
})

/**
 * Compute `pathOut * (totalMinOut / totalOut)` using BigInt to keep
 * full i128 precision (the values are decimal strings well above
 * 2^53). Result is floored — the contract treats `min_amount_out` as
 * a strict lower bound, so floor is the safe rounding direction.
 */
const scaleByOutputRatio = (
  pathOut: string,
  totalOut: string,
  totalMinOut: string
): string => {
  const total = BigInt(totalOut)
  if (total === 0n) return totalMinOut
  return ((BigInt(pathOut) * BigInt(totalMinOut)) / total).toString()
}
