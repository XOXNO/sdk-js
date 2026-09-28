/**
 * Typed client for the Stellar aggregator quote server
 * (`GET /api/v1/quote`, `GET /api/v1/tokens`).
 *
 * The quote server is a standalone Rust service (deployed independently
 * of the main XOXNO API), so this module hits its base URL directly
 * rather than routing through the swagger-driven endpoints map.
 *
 * All response shapes are mirrored 1:1 by `@xoxno/types` DTOs
 * (`StellarAggregatorQuoteResponseDto`, `StellarQuotePathDto`, etc.) —
 * the wire shape is camelCase, the Soroban contract receives snake_case
 * after the SDK encoder rewrites field names.
 */

import type {
  StellarAggregatorQuoteRequestDto,
  StellarAggregatorQuoteResponseDto,
  StellarQuoteTransactionPayloadDto,
} from '@xoxno/types'
import type { StellarNetwork } from './contracts'

/**
 * Token entry returned by `GET /api/v1/tokens`. Mirrors the service's
 * `TokenEntry` schema exactly.
 */
export interface StellarQuoteToken {
  /** Canonical Soroban token contract id (`C…`). `XLM` and `CODE:ISSUER`
   *  forms are rejected by the service. */
  id: string
  /** Decimal places: divide atomic amounts by 10^decimals for display. */
  decimals: number
  /** `true` for a pool share token; quoting from/to it is a liquidity route. */
  lp: boolean
  /** Venues the token appears on, sorted. For an LP token, the issuing venue. */
  dexes: string[]
  /** LP only: the pool contract that issued the shares. */
  pool?: string | null
  /** LP only: constituent token ids in pool order. */
  assets?: string[] | null
  /** @deprecated Not returned by the service; always `undefined`. */
  kind?: never
  /** @deprecated Not returned by the service; always `undefined`. */
  sacPeer?: never
  /** @deprecated Not returned by the service; always `undefined`. */
  code?: never
  /** @deprecated Not returned by the service; always `undefined`. */
  degree?: never
}

/** Liquidity snapshot the route was searched against. */
export interface StellarQuoteSnapshot {
  ledger: number
  ageSeconds: number
  /** Live ledger compared against; present only when `fresh=true`. */
  checkedLiveLedger?: number | null
}

/** Set when the route was reduced to fit the simulation budget. */
export interface StellarQuoteDegraded {
  requestedMaxSplits: number
  effectiveMaxSplits: number
  requestedMaxHops: number
  effectiveMaxHops: number
  fallbackAttempts: number
  reason: string
}

export interface StellarQuoteLpConstituent {
  token: string
  tokenKind: string
  /** Raw u128 amount as a string. */
  amount: string
  amountShort: number
}

/** Liquidity breakdown for add/remove/convert-liquidity quotes. Informational. */
export interface StellarQuoteLp {
  pool: string
  dex: string
  kind: string
  feeBps: number
  shareToken: string
  amounts: StellarQuoteLpConstituent[]
  refunded?: StellarQuoteLpConstituent[]
  preSwap?: unknown
}

/**
 * Quote response as the service returns it. Extends the `@xoxno/types` DTO with
 * fields the DTO does not yet declare. `alternatives` is still on the DTO but
 * the service no longer returns it.
 */
export type StellarQuoteResponse = StellarAggregatorQuoteResponseDto & {
  snapshot?: StellarQuoteSnapshot | null
  degraded?: StellarQuoteDegraded | null
  lp?: StellarQuoteLp | null
  /** Ordered LP-conversion steps; mutually exclusive with `transaction`. */
  transactions?: StellarQuoteTransactionPayloadDto[] | null
}

/** Quote request; adds `simulate`, which the DTO does not yet declare. */
export type StellarQuoteRequest = StellarAggregatorQuoteRequestDto & {
  /** With `sender`: simulate and prepare resource data (service default `true`). */
  simulate?: boolean
}

export interface StellarQuoteFetchOptions {
  /** Quote-server base URL selected by the host application. */
  baseUrl: string
  /** @deprecated The URL is explicit; network is retained for source compatibility. */
  network?: StellarNetwork
  /** Per-call fetch options (signal, headers, etc.). */
  fetchOptions?: RequestInit
}

const buildUrl = (
  base: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): string => {
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * Fetch a route quote from the Stellar aggregator quote server.
 *
 * Forward mode: pass `amountIn` to compute the maximum reachable
 * `amountOut`. Reverse mode: pass `amountOut` to compute the minimum
 * `amountIn` that delivers at least that output.
 *
 * For lending strategies, pass the quote's `routeXdr` to the builder's
 * `steps`. Amounts are token base-unit decimal strings. Requote after changes
 * to amount, direction or slippage; preparation is the execution check.
 *
 * Passing `sender` (G...) together with `slippage` returns a direct-swap
 * envelope under `transaction.envelopeXdr`. The router comes from the service's
 * `/api/v1/config`; the `router` request field is ignored by the service and is
 * no longer sent. Prepare the envelope before wallet signing unless
 * `transaction.simulated` is true.
 * @param request - Exactly one of amountIn or amountOut; optional referralId is forwarded unchanged.
 * @param opts - Quote-server URL and optional fetch options supplied by the host.
 * @returns Quote estimates and opaque route bytes; does not execute a swap.
 * @category Strategy quotes
 */
export async function getStellarAggregatorQuote(
  request: StellarQuoteRequest,
  opts: StellarQuoteFetchOptions
): Promise<StellarQuoteResponse> {
  if (!opts.baseUrl) {
    throw new Error('Stellar quote baseUrl is required')
  }
  if ((request.amountIn == null) === (request.amountOut == null)) {
    throw new Error(
      'getStellarAggregatorQuote: exactly one of `amountIn` or `amountOut` must be provided'
    )
  }

  const url = buildUrl(opts.baseUrl, 'api/v1/quote', {
    from: request.from,
    to: request.to,
    amountIn: request.amountIn,
    amountOut: request.amountOut,
    maxHops: request.maxHops,
    maxSplits: request.maxSplits,
    slippage: request.slippage,
    includePaths: request.includePaths,
    sender: request.sender,
    simulate: request.simulate,
    referralId: request.referralId,
    platform: request.platform,
    fresh: request.fresh,
  })

  const res = await fetch(url, opts.fetchOptions)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Stellar quote server responded ${res.status} ${res.statusText} for ${url} — ${body}`
    )
  }
  return (await res.json()) as StellarQuoteResponse
}

/**
 * List tokens currently indexed by the quote server. Useful to populate
 * pickers or validate that a user-supplied token has on-chain liquidity.
 * @category Strategy quotes
 */
export async function getStellarQuoteTokens(
  opts: StellarQuoteFetchOptions
): Promise<StellarQuoteToken[]> {
  if (!opts.baseUrl) {
    throw new Error('Stellar quote baseUrl is required')
  }
  const url = buildUrl(opts.baseUrl, 'api/v1/tokens')
  const res = await fetch(url, opts.fetchOptions)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Stellar quote server responded ${res.status} ${res.statusText} for ${url} — ${body}`
    )
  }
  return (await res.json()) as StellarQuoteToken[]
}
