/**
 * Shared Soroban `ScVal` encoding primitives for the Stellar lending SDK.
 *
 * Extracted verbatim from `lending.ts` so both the user-operation builders
 * (`lending.ts`) and the admin/config builders (`admin.ts`) encode against one
 * implementation. Behavior-preserving: the existing builder XDR snapshots must
 * not change.
 *
 * i128/u128 values cross the boundary as decimal strings (`new ScInt(str)`).
 * Addresses (Stellar `G...` accounts and Soroban `C...` contracts) encode via
 * `new Address(str).toScVal()`. Soroban `#[contracttype]` structs are ScMaps
 * with `Symbol` keys in ascending order — `scStruct` lex-sorts the field names,
 * which matches Soroban's small-symbol collation for the all-lowercase
 * snake_case field sets used here.
 */

import type { AggregatorSwapDto, SwapVenue } from '@xoxno/types'
import { Address, ScInt, xdr } from '@stellar/stellar-sdk'

/**
 * Inlined copy of `SWAP_VENUES` from `@xoxno/types` so the SDK can validate a
 * runtime-supplied venue without forcing the (NestJS-coupled) `@xoxno/types`
 * module to load at runtime. Kept in lockstep with the upstream constant; any
 * new on-chain venue must be added in both places + the contract's `SwapVenue`
 * enum.
 */
export const STELLAR_SWAP_VENUES = [
  'Soroswap',
  'Aquarius',
  'Phoenix',
  'NativeAmm',
  'StaticBridge',
] as const satisfies readonly SwapVenue[]

export type StellarSwapStepsInput = AggregatorSwapDto

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
export const encodeSwapVenue = (venue: SwapVenue): xdr.ScVal =>
  xdr.ScVal.scvVec([sym(venue)])

/**
 * Encode the controller-facing `AggregatorSwap` struct
 * (`{ paths: Vec<SwapPath>, total_min_out: i128 }`).
 *
 * `SwapPath` is the PPM-split shape: each path declares `split_ppm`
 * (parts-per-million share of the batch's total input) and a `hops` chain.
 */
export const encodeAggregatorSwap = (
  swap: StellarSwapStepsInput
): xdr.ScVal => {
  const paths = swap.paths.map((path) => {
    const hops = path.hops.map((hop) =>
      scStruct({
        fee_bps: u32(hop.feeBps),
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
    total_min_out: i128(swap.totalMinOut),
  })
}

/**
 * Validate the untyped `steps` field from a Wave 0 DTO and narrow it to
 * `AggregatorSwapDto`. Throws a clear error if the caller passed the wrong
 * shape so the failure surfaces at the SDK boundary, not deep inside the
 * Soroban host on-chain.
 */
export const asStellarSwapSteps = (steps: unknown): StellarSwapStepsInput => {
  if (!steps || typeof steps !== 'object') {
    throw new Error(
      'Stellar builder: `steps` must be an AggregatorSwapDto ({ paths, totalMinOut })'
    )
  }
  const candidate = steps as Partial<StellarSwapStepsInput>
  if (!Array.isArray(candidate.paths) || candidate.paths.length === 0) {
    throw new Error(
      'Stellar builder: `steps.paths` must be a non-empty array of SwapPathDto'
    )
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
        typeof hop.feeBps !== 'number' ||
        typeof hop.pool !== 'string' ||
        typeof hop.tokenIn !== 'string' ||
        typeof hop.tokenOut !== 'string' ||
        !STELLAR_SWAP_VENUES.includes(hop.venue as SwapVenue)
      ) {
        throw new Error(
          `Stellar builder: \`steps.paths[${idx}].hops[${hopIdx}]\` must have feeBps, pool, tokenIn, tokenOut, and a valid venue`
        )
      }
    }
  }
  if (sumPpm !== 1_000_000) {
    throw new Error(
      `Stellar builder: \`steps.paths[].splitPpm\` must sum to 1_000_000, got ${sumPpm}`
    )
  }
  return candidate as StellarSwapStepsInput
}

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
