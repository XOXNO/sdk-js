/**
 * Soroban `ScVal` encoding primitives for the Stellar lending builders.
 *
 * i128/u128 values cross the boundary as decimal strings (`new ScInt(str)`).
 * Addresses (Stellar `G...` accounts and Soroban `C...` contracts) encode via
 * `new Address(str).toScVal()`.
 */

import { Address, ScInt, xdr } from '@stellar/stellar-sdk'

/**
 * On-chain swap venues, validated at runtime for a caller-supplied venue.
 * Mirrors the Soroban-only aggregator router's `SwapVenue` enum.
 */
export const STELLAR_SWAP_VENUES = [
  'Soroswap',
  'Aquarius',
  'Phoenix',
  'Sushi',
  'CometDex',
] as const

export type StellarSwapVenue = (typeof STELLAR_SWAP_VENUES)[number]

export interface StellarStrategySwapHopInput {
  amountOut: string
  pool: string
  tokenIn: string
  tokenOut: string
  venue: StellarSwapVenue
}

export interface StellarStrategySwapPathInput {
  hops: StellarStrategySwapHopInput[]
  splitPpm: number
}

export interface StellarStrategyPayloadInput {
  paths: StellarStrategySwapPathInput[]
  referralId?: number | string
  tokenIn: string
  tokenOut: string
  totalMinOut: string
}

export type StellarStrategySwapInput =
  | string
  | Uint8Array
  | { routeXdr: string }
  | { swapXdr: string }
  | { bytes: string | Uint8Array }
  | StellarStrategyPayloadInput

export type StellarSwapStepsInput = StellarStrategySwapInput

export const addr = (a: string): xdr.ScVal => new Address(a).toScVal()
export const i128 = (s: string): xdr.ScVal => new ScInt(s).toI128()
export const u32 = (n: number): xdr.ScVal => xdr.ScVal.scvU32(n)
export const u64 = (n: number | string): xdr.ScVal =>
  new ScInt(typeof n === 'string' ? n : n.toString()).toU64()
export const bool = (b: boolean): xdr.ScVal => xdr.ScVal.scvBool(b)
export const str = (s: string): xdr.ScVal => xdr.ScVal.scvString(s)
export const sym = (s: string): xdr.ScVal => xdr.ScVal.scvSymbol(s)
export const voidVal = (): xdr.ScVal => xdr.ScVal.scvVoid()
export const vec = (items: xdr.ScVal[]): xdr.ScVal => xdr.ScVal.scvVec(items)
export const bytes = (hex: string): xdr.ScVal => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const buf = Buffer.from(cleanHex, 'hex')
  return xdr.ScVal.scvBytes(buf)
}

/**
 * Encode a Soroban `BytesN<N>` (default 32) — a fixed-length byte array such as
 * a WASM hash. Validates the decoded length so a malformed hash fails at the
 * SDK boundary, not deep inside the host.
 */
export const bytesN = (hex: string, length = 32): xdr.ScVal => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const buf = Buffer.from(cleanHex, 'hex')
  if (buf.length !== length) {
    throw new Error(
      `Stellar builder: expected a ${length}-byte BytesN (got ${buf.length} bytes from "${hex}")`
    )
  }
  return xdr.ScVal.scvBytes(buf)
}

/**
 * Encode a Soroban `Option<T>`: `None` is `scvVoid`, `Some(x)` is the bare
 * encoded `x` (Soroban does not wrap `Some`). NOT for the contract's custom
 * `OracleSourceConfigInputOption` enum, which is a tagged union — see
 * `encodeOracleSourceConfigInputOption` in `admin.ts`.
 */
export const option = <T>(
  value: T | undefined | null,
  encode: (v: T) => xdr.ScVal
): xdr.ScVal =>
  value === undefined || value === null ? voidVal() : encode(value)

/**
 * Encode a single Soroban tuple `(Address, i128)` as a 2-element `scvVec`.
 */
export const tupleAddrAmount = (token: string, amount: string): xdr.ScVal =>
  xdr.ScVal.scvVec([addr(token), i128(amount)])

/**
 * Encode `Vec<(Address, i128)>` — a Soroban tuple-vec of (asset, amount).
 * Each tuple is a 2-element `scvVec`.
 */
export const tupleAddrAmountVec = (
  entries: Array<{ token: string; amount: string }>
): xdr.ScVal =>
  xdr.ScVal.scvVec(entries.map((e) => tupleAddrAmount(e.token, e.amount)))

/**
 * Encode a `HubAssetKey` `#[contracttype]` struct — the `(hub_id, asset)`
 * coordinate that keys liquidity and positions on the multi-hub controller.
 * Emitted as an ScVal map with symbol keys in lexicographic order
 * (`asset`, then `hub_id`).
 */
export const hubAsset = (hubId: number, asset: string): xdr.ScVal =>
  scStruct({ asset: addr(asset), hub_id: u32(hubId) })

/**
 * Encode a single Soroban tuple `(HubAssetKey, i128)` as a 2-element `scvVec`.
 */
export const tupleHubAssetAmount = (
  hubId: number,
  asset: string,
  amount: string
): xdr.ScVal => xdr.ScVal.scvVec([hubAsset(hubId, asset), i128(amount)])

/**
 * Encode `Vec<(HubAssetKey, i128)>` — the multi-hub batch payload carried by
 * `supply` / `borrow` / `withdraw` / `repay` / `liquidate`.
 */
export const tupleHubAssetAmountVec = (
  entries: Array<{ hubId: number; asset: string; amount: string }>
): xdr.ScVal =>
  xdr.ScVal.scvVec(
    entries.map((e) => tupleHubAssetAmount(e.hubId, e.asset, e.amount))
  )

/**
 * Encode a Soroban `struct` — at the XDR level, structs are maps with
 * `Symbol` keys in **lexicographic order** of field names.
 */
export const scStruct = (fields: Record<string, xdr.ScVal>): xdr.ScVal => {
  const entries = Object.keys(fields)
    .sort()
    .map(
      (k) =>
        new xdr.ScMapEntry({
          key: sym(k),
          val: fields[k] as xdr.ScVal,
        })
    )
  return xdr.ScVal.scvMap(entries)
}

/**
 * Encode a Soroban `enum SwapVenue` (tag-only / unit variant). At the XDR level
 * a unit variant is `scvVec([symbol_name])`.
 */
export const encodeSwapVenue = (venue: StellarSwapVenue): xdr.ScVal =>
  xdr.ScVal.scvVec([sym(venue)])

/**
 * Encode the aggregator router's decoded `StrategyPayload` struct. The caller
 * usually receives this as quote `routeXdr`; this helper is for tests and for
 * callers that construct routes locally.
 */
export const encodeStrategyPayload = (
  payload: StellarStrategyPayloadInput
): xdr.ScVal => {
  const paths = payload.paths.map((path) => {
    const hops = path.hops.map((hop) =>
      scStruct({
        amount_out: i128(hop.amountOut),
        pool: addr(hop.pool),
        token_in: addr(hop.tokenIn),
        token_out: addr(hop.tokenOut),
        venue: encodeSwapVenue(hop.venue),
      })
    )
    return scStruct({
      hops: xdr.ScVal.scvVec(hops),
      split_ppm: u32(path.splitPpm),
    })
  })
  return scStruct({
    paths: xdr.ScVal.scvVec(paths),
    referral_id: u64(payload.referralId ?? 0),
    token_in: addr(payload.tokenIn),
    token_out: addr(payload.tokenOut),
    total_min_out: i128(payload.totalMinOut),
  })
}

/** @deprecated Use `encodeStrategyPayload`. */
export const encodeAggregatorSwap = encodeStrategyPayload

export const encodeStrategyPayloadToBytes = (
  payload: StellarStrategyPayloadInput
): xdr.ScVal =>
  xdr.ScVal.scvBytes(
    Buffer.from(encodeStrategyPayload(payload).toXDR('base64'), 'base64')
  )

/**
 * Validate the untyped `steps` field and narrow it to `StrategyPayload`.
 * Throws if the caller passed the wrong shape so the failure surfaces at the
 * SDK boundary, not inside the Soroban host on-chain.
 */
export const asStellarStrategyPayload = (
  steps: unknown
): StellarStrategyPayloadInput => {
  if (!steps || typeof steps !== 'object') {
    throw new Error(
      'Stellar builder: decoded strategy `steps` must be a StrategyPayload ({ paths, tokenIn, tokenOut, totalMinOut })'
    )
  }
  const candidate = steps as Partial<StellarStrategyPayloadInput>
  if (!Array.isArray(candidate.paths) || candidate.paths.length === 0) {
    throw new Error(
      'Stellar builder: `steps.paths` must be a non-empty array of strategy paths'
    )
  }
  if (typeof candidate.tokenIn !== 'string') {
    throw new Error('Stellar builder: `steps.tokenIn` must be a contract address')
  }
  if (typeof candidate.tokenOut !== 'string') {
    throw new Error('Stellar builder: `steps.tokenOut` must be a contract address')
  }
  if (typeof candidate.totalMinOut !== 'string') {
    throw new Error(
      'Stellar builder: `steps.totalMinOut` must be an i128 decimal string'
    )
  }
  let sumPpm = 0
  for (const [idx, path] of candidate.paths.entries()) {
    if (
      !path ||
      typeof path.splitPpm !== 'number' ||
      path.splitPpm <= 0 ||
      !Array.isArray(path.hops) ||
      path.hops.length === 0
    ) {
      throw new Error(
        `Stellar builder: \`steps.paths[${idx}]\` must have splitPpm > 0 and a non-empty hops array`
      )
    }
    sumPpm += path.splitPpm
    for (const [hopIdx, hop] of path.hops.entries()) {
      if (
        !hop ||
        typeof hop.amountOut !== 'string' ||
        typeof hop.pool !== 'string' ||
        typeof hop.tokenIn !== 'string' ||
        typeof hop.tokenOut !== 'string' ||
        !STELLAR_SWAP_VENUES.includes(hop.venue as StellarSwapVenue)
      ) {
        throw new Error(
          `Stellar builder: \`steps.paths[${idx}].hops[${hopIdx}]\` must have amountOut, pool, tokenIn, tokenOut, and a valid Soroban venue`
        )
      }
    }
  }
  if (sumPpm !== 1_000_000) {
    throw new Error(
      `Stellar builder: \`steps.paths[].splitPpm\` must sum to 1_000_000, got ${sumPpm}`
    )
  }
  return candidate as StellarStrategyPayloadInput
}

const isHexString = (s: string): boolean =>
  s.length > 0 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)

const strategyBytes = (data: Uint8Array): xdr.ScVal => {
  const buf = Buffer.from(data)
  if (buf.length === 0) {
    throw new Error(
      'Stellar builder: strategy swap bytes must be non-empty base64 routeXdr, 0x hex string, or Uint8Array'
    )
  }
  return xdr.ScVal.scvBytes(buf)
}

const decodeStrategyBytesString = (encoded: string): Buffer => {
  const trimmed = encoded.trim()
  if (trimmed.startsWith('0x')) {
    const hex = trimmed.slice(2)
    if (!isHexString(hex)) {
      throw new Error(
        'Stellar builder: strategy swap bytes hex string must be 0x-prefixed and even-length'
      )
    }
    return Buffer.from(hex, 'hex')
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new Error(
      'Stellar builder: strategy swap bytes must be base64 routeXdr or 0x-prefixed hex'
    )
  }
  const decoded = Buffer.from(trimmed, 'base64')
  if (decoded.length === 0) {
    throw new Error(
      'Stellar builder: strategy swap bytes must be non-empty base64 routeXdr, 0x hex string, or Uint8Array'
    )
  }
  return decoded
}

const hasRouteXdr = (input: object): input is { routeXdr: string } =>
  'routeXdr' in input && typeof (input as { routeXdr?: unknown }).routeXdr === 'string'

const hasSwapXdr = (input: object): input is { swapXdr: string } =>
  'swapXdr' in input && typeof (input as { swapXdr?: unknown }).swapXdr === 'string'

const hasBytes = (
  input: object
): input is { bytes: string | Uint8Array } =>
  'bytes' in input &&
  (typeof (input as { bytes?: unknown }).bytes === 'string' ||
    (input as { bytes?: unknown }).bytes instanceof Uint8Array)

/**
 * Encode opaque strategy bytes for the lending controller. Accepted inputs:
 *   - quote `routeXdr` base64 string
 *   - `{ routeXdr }` / `{ swapXdr }`
 *   - raw `Uint8Array` / `{ bytes }`
 *   - decoded `StrategyPayload` object
 */
export const asStellarStrategySwapBytes = (steps: unknown): xdr.ScVal => {
  if (typeof steps === 'string') {
    return strategyBytes(decodeStrategyBytesString(steps))
  }
  if (steps instanceof Uint8Array) {
    return strategyBytes(steps)
  }
  if (steps && typeof steps === 'object') {
    if (hasRouteXdr(steps)) {
      return strategyBytes(decodeStrategyBytesString(steps.routeXdr))
    }
    if (hasSwapXdr(steps)) {
      return strategyBytes(decodeStrategyBytesString(steps.swapXdr))
    }
    if (hasBytes(steps)) {
      return typeof steps.bytes === 'string'
        ? strategyBytes(decodeStrategyBytesString(steps.bytes))
        : strategyBytes(steps.bytes)
    }
    return encodeStrategyPayloadToBytes(asStellarStrategyPayload(steps))
  }
  throw new Error(
    'Stellar builder: `steps` must be opaque strategy bytes (`routeXdr`, base64/hex string, or Uint8Array)'
  )
}

/** @deprecated Use `asStellarStrategyPayload` or `asStellarStrategySwapBytes`. */
export const asStellarSwapSteps = asStellarStrategyPayload

/**
 * Validate the untyped `data` field on FlashLoanArgs and narrow it to
 * Buffer / hex string for Soroban `Bytes` encoding.
 */
export const asStellarBytes = (data: unknown): xdr.ScVal => {
  if (typeof data === 'string') return bytes(data)
  if (data instanceof Uint8Array) return xdr.ScVal.scvBytes(Buffer.from(data))
  throw new Error(
    'Stellar builder: `data` must be a hex string or Uint8Array (Soroban Bytes payload)'
  )
}
