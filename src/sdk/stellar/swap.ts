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
    hops: xdr.ScVal.scvVec(path.hops.map(encodeHop)),
    split_ppm: u32(path.splitPpm),
  })

const u64 = (n: number | string): xdr.ScVal =>
  new ScInt(typeof n === 'string' ? n : n.toString()).toU64()

/** Encode the router-facing `BatchSwap` struct. */
const encodeBatchSwap = (
  swap: AggregatorSwapDto,
  sender: string,
  totalIn: string,
  referralId: number | string
): xdr.ScVal =>
  scStruct({
    paths: xdr.ScVal.scvVec(swap.paths.map(encodePath)),
    referral_id: u64(referralId),
    sender: addr(sender),
    total_in: i128(totalIn),
    total_min_out: i128(swap.totalMinOut),
  })

export interface StellarBatchSwapBuilderOptions extends StellarBuilderOptions {
  /**
   * Override the resolved aggregator router contract address. Normally
   * resolved from `STELLAR_AGGREGATOR_ROUTER[network]`.
   */
  routerAddress?: string
  /**
   * Total input amount the router will pull from `caller` once at the
   * start of `batch_execute` (i128 decimal string). Per-path
   * allocations are derived inside the router from each path's
   * `splitPpm`. For a quote-derived swap, pass `quote.amountIn`.
   */
  totalIn: string
  /**
   * Referral identifier embedded into the BatchSwap. Defaults to `0`
   * (no referral / no fee — matches rs-aggregator MVX semantics).
   * Non-zero IDs MUST be registered on-chain via `add_referral` or the
   * router reverts at execution.
   */
  referralId?: number | string
}

/**
 * Build an unsigned XDR for a direct user → aggregator router swap.
 *
 * The `swap` payload (paths + total-min-out) comes straight from the
 * quote server; map a `StellarAggregatorQuoteResponseDto` to
 * `AggregatorSwapDto` via `mapQuoteResponseToAggregatorSwap` before
 * calling this. `opts.totalIn` is the authoritative input amount.
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
    .addOperation(
      contract.call(
        'batch_execute',
        encodeBatchSwap(swap, opts.caller, opts.totalIn, opts.referralId ?? 0)
      )
    )
    .setTimeout(opts.timeoutSeconds ?? 300)
    .build()

  return { xdr: tx.toXDR() }
}

/**
 * Translate a quote-server response into the controller-facing
 * `AggregatorSwapDto`. Each path's `splitPpm` comes straight from the
 * server; the single-path fallback (when `paths` is omitted) gets the
 * full 1_000_000 weight.
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

  const paths: SwapPathDto[] = quote.paths
    ? quote.paths.map((path) => ({
        hops: path.swaps.map(mapHop),
        splitPpm: path.splitPpm,
      }))
    : [
        {
          hops: quote.hops.map(mapHop),
          splitPpm: 1_000_000,
        },
      ]

  return { paths, totalMinOut }
}

const mapHop = (hop: {
  feeBps: number
  address: string
  from: string
  to: string
  dex: string
}): SwapHopDto => ({
  feeBps: hop.feeBps,
  pool: hop.address,
  tokenIn: hop.from,
  tokenOut: hop.to,
  venue: hop.dex as SwapHopDto['venue'],
})
