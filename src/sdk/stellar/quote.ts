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
  StellarTokenKind,
} from '@xoxno/types'

import { STELLAR_QUOTE_URL, type StellarNetwork } from './contracts'

/**
 * Resolved token entry returned by the quote server's tokens endpoint.
 * Mirrors the indexer's `TokenEntry` JSON exactly.
 */
export interface StellarQuoteToken {
  /** Canonical token id. `C…` for Soroban contracts; `CODE:GISSUER…`
   *  for Classic; `XLM` for native. */
  id: string
  kind: StellarTokenKind
  decimals: number
  /** Soroban Asset Contract peer for Classic assets (null otherwise). */
  sacPeer: string | null
  /** Classic asset code (for Classic / SAC entries; null for Soroban). */
  code: string | null
  /** Number of pools touching this token in the current snapshot. */
  degree: number
}

export interface StellarQuoteFetchOptions {
  /** Network selects which base URL to hit. */
  network: StellarNetwork
  /** Override the resolved base URL (useful for tests / preview). */
  baseUrl?: string
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

const resolveBase = (opts: StellarQuoteFetchOptions): string =>
  opts.baseUrl ?? STELLAR_QUOTE_URL[opts.network]

/**
 * Fetch a route quote from the Stellar aggregator quote server.
 *
 * Forward mode: pass `amountIn` to compute the maximum reachable
 * `amountOut`. Reverse mode: pass `amountOut` to compute the minimum
 * `amountIn` that delivers at least that output.
 *
 * Pass both `sender` (G-strkey) and `router` (C-strkey) to receive a
 * ready-to-sign envelope under `transaction.envelopeXdr`. The caller
 * must still run `simulateTransaction` to attach Soroban resource fees
 * before signing.
 */
export async function getStellarAggregatorQuote(
  request: StellarAggregatorQuoteRequestDto,
  opts: StellarQuoteFetchOptions
): Promise<StellarAggregatorQuoteResponseDto> {
  if ((request.amountIn == null) === (request.amountOut == null)) {
    throw new Error(
      'getStellarAggregatorQuote: exactly one of `amountIn` or `amountOut` must be provided'
    )
  }

  const url = buildUrl(resolveBase(opts), 'api/v1/quote', {
    from: request.from,
    to: request.to,
    amountIn: request.amountIn,
    amountOut: request.amountOut,
    maxHops: request.maxHops,
    maxSplits: request.maxSplits,
    slippage: request.slippage,
    includePaths: request.includePaths,
    sender: request.sender,
    router: request.router,
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
  return (await res.json()) as StellarAggregatorQuoteResponseDto
}

/**
 * List tokens currently indexed by the quote server. Useful to populate
 * pickers or validate that a user-supplied token has on-chain liquidity.
 */
export async function getStellarQuoteTokens(
  opts: StellarQuoteFetchOptions
): Promise<StellarQuoteToken[]> {
  const url = buildUrl(resolveBase(opts), 'api/v1/tokens')
  const res = await fetch(url, opts.fetchOptions)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Stellar quote server responded ${res.status} ${res.statusText} for ${url} — ${body}`
    )
  }
  return (await res.json()) as StellarQuoteToken[]
}
