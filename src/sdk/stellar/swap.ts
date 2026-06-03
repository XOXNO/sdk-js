/**
 * Stellar aggregator router direct-call transaction builder.
 *
 * Builds an unsigned XDR for
 * `router.execute_strategy(sender, total_in, swap_xdr)` so a user can swap
 * A -> B without involving the lending controller. The strategy route is
 * opaque bytes: normally the quote response `routeXdr`, decoded into Soroban
 * `Bytes` for the contract call.
 *
 * Lending strategies use the builders in `./lending.ts`; they pass the same
 * opaque route bytes to the controller, which forwards them to the aggregator.
 */

import type { StellarAggregatorQuoteResponseDto } from '@xoxno/types'
import {
  Account,
  BASE_FEE,
  Contract,
  TransactionBuilder,
} from '@stellar/stellar-sdk'

import {
  getStellarAggregatorRouter,
  STELLAR_NETWORK_PASSPHRASE,
} from './contracts'
import type { BuiltStellarTx, StellarBuilderOptions } from './lending'
import {
  addr,
  asStellarStrategySwapBytes,
  encodeStrategyPayload,
  i128,
  type StellarStrategyPayloadInput,
  type StellarStrategySwapHopInput,
  type StellarStrategySwapInput,
  type StellarStrategySwapPathInput,
  type StellarSwapVenue,
} from './scval-encode'

type QuoteWithRouteXdr = StellarAggregatorQuoteResponseDto & {
  routeXdr?: string
}

export type StellarStrategyPayload = StellarStrategyPayloadInput
export type StellarStrategySwap = StellarStrategySwapInput
export type StellarStrategySwapHop = StellarStrategySwapHopInput
export type StellarStrategySwapPath = StellarStrategySwapPathInput

export interface StellarExecuteStrategyBuilderOptions
  extends StellarBuilderOptions {
  /**
   * Override the resolved aggregator router contract address. Normally
   * resolved from `STELLAR_AGGREGATOR_ROUTER[network]`.
   */
  routerAddress?: string
  /**
   * Total input amount passed to `execute_strategy` (i128 decimal string).
   * For a quote-derived swap, pass `quote.amountIn`.
   */
  totalIn: string
  /**
   * Referral identifier used only when the `swap` input is a decoded
   * `StrategyPayload` object and does not already include `referralId`.
   * Quote `routeXdr` already contains the referral chosen by the quote server.
   */
  referralId?: number | string
}

/** @deprecated Use `StellarExecuteStrategyBuilderOptions`. */
export interface StellarBatchSwapBuilderOptions
  extends StellarExecuteStrategyBuilderOptions {}

const hasPayloadPaths = (
  swap: StellarStrategySwapInput
): swap is StellarStrategyPayloadInput =>
  Boolean(
    swap &&
      typeof swap === 'object' &&
      !(swap instanceof Uint8Array) &&
      'paths' in swap
  )

const withDefaultReferral = (
  swap: StellarStrategySwapInput,
  referralId: number | string | undefined
): StellarStrategySwapInput => {
  if (!hasPayloadPaths(swap) || swap.referralId !== undefined) return swap
  return { ...swap, referralId: referralId ?? 0 }
}

export const encodeStrategyPayloadToRouteXdr = (
  payload: StellarStrategyPayloadInput
): string => encodeStrategyPayload(payload).toXDR('base64')

/**
 * Build an unsigned XDR for a direct user -> aggregator router swap.
 *
 * Pass the quote response `routeXdr` string or `{ routeXdr }` directly when
 * available. Decoded `StrategyPayload` objects are accepted for local tests and
 * custom route builders.
 */
export function buildStellarExecuteStrategyTx(
  opts: StellarExecuteStrategyBuilderOptions,
  swap: StellarStrategySwapInput
): BuiltStellarTx {
  const routerId =
    opts.routerAddress ?? getStellarAggregatorRouter(opts.network)
  const contract = new Contract(routerId)

  const source = new Account(opts.caller, opts.sourceSequence)
  const swapBytes = asStellarStrategySwapBytes(
    withDefaultReferral(swap, opts.referralId)
  )

  const tx = new TransactionBuilder(source, {
    fee: opts.fee ?? BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE[opts.network],
  })
    .addOperation(
      contract.call('execute_strategy', addr(opts.caller), i128(opts.totalIn), swapBytes)
    )
    .setTimeout(opts.timeoutSeconds ?? 300)
    .build()

  return { xdr: tx.toXDR() }
}

/**
 * @deprecated The router no longer exposes `batch_execute`; this wrapper now
 * builds `execute_strategy(sender, total_in, swap_xdr)`.
 */
export function buildStellarBatchSwapTx(
  opts: StellarBatchSwapBuilderOptions,
  swap: StellarStrategySwapInput
): BuiltStellarTx {
  return buildStellarExecuteStrategyTx(opts, swap)
}

/**
 * Translate a quote-server response into the decoded `StrategyPayload` shape.
 * Prefer `mapQuoteResponseToStrategySwap` when the quote includes `routeXdr`.
 */
export function mapQuoteResponseToStrategyPayload(
  quote: StellarAggregatorQuoteResponseDto,
  opts: { referralId?: number | string } = {}
): StellarStrategyPayloadInput {
  if (typeof quote.amountOutMin !== 'string') {
    throw new Error(
      'mapQuoteResponseToStrategyPayload: quote response is missing `amountOutMin`. Pass `slippage` when fetching the quote.'
    )
  }

  const paths: StellarStrategySwapPathInput[] = quote.paths
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

  return {
    paths,
    referralId: opts.referralId ?? 0,
    tokenIn: quote.from,
    tokenOut: quote.to,
    totalMinOut: quote.amountOutMin,
  }
}

/**
 * Return the executable quote route when the API provided it; otherwise build
 * the decoded fallback payload from hop/path fields.
 */
export function mapQuoteResponseToStrategySwap(
  quote: StellarAggregatorQuoteResponseDto,
  opts: { referralId?: number | string } = {}
): StellarStrategySwapInput {
  const quoteWithRoute = quote as QuoteWithRouteXdr
  if (typeof quoteWithRoute.routeXdr === 'string' && quoteWithRoute.routeXdr.length > 0) {
    return { routeXdr: quoteWithRoute.routeXdr }
  }
  return mapQuoteResponseToStrategyPayload(quote, opts)
}

/** @deprecated Use `mapQuoteResponseToStrategyPayload`. */
export const mapQuoteResponseToAggregatorSwap = mapQuoteResponseToStrategyPayload

const mapHop = (hop: {
  amountOut: string
  address: string
  from: string
  to: string
  dex: string
}): StellarStrategySwapHopInput => ({
  amountOut: hop.amountOut,
  pool: hop.address,
  tokenIn: hop.from,
  tokenOut: hop.to,
  venue: hop.dex as StellarSwapVenue,
})
