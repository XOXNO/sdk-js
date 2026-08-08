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
 * Mirrors the Soroban-only aggregator router's opcode table.
 */
export const STELLAR_SWAP_VENUES = [
  'Soroswap',
  'Aquarius',
  'Phoenix',
  'Sushi',
  'CometDex',
] as const

export type StellarSwapVenue = (typeof STELLAR_SWAP_VENUES)[number]

/**
 * Instruction opcode per venue. Part of the on-chain ABI — see
 * `contracts/swap-aggregator/src/program.rs`.
 */
export const STELLAR_SWAP_VENUE_OPCODE: Record<StellarSwapVenue, number> = {
  Soroswap: 0,
  Aquarius: 1,
  Phoenix: 2,
  Sushi: 3,
  CometDex: 4,
}

/** Wire version of the packed program. Must match the contract's `VERSION`. */
export const STELLAR_PROGRAM_VERSION = 1

/** Split weights are parts per million. */
export const PPM_DENOMINATOR = 1_000_000

const OP_BURN = 5
const OP_MINT = 6

const MODE_ALL = 0
const MODE_PREV = 1
const MODE_FIXED_BASE = 2
const MODE_PPM_BASE = 128

const MAX_OPS = 48
const MAX_WEIGHTS = 32
const MAX_ASSETS = 256
const MAX_AMOUNTS = MODE_PPM_BASE - MODE_FIXED_BASE

export interface StellarStrategySwapHopInput {
  /** Quote-side estimate; not carried on the wire. */
  amountOut?: string
  pool: string
  tokenIn: string
  tokenOut: string
  venue: StellarSwapVenue
}

export interface StellarStrategySwapPathInput {
  hops: StellarStrategySwapHopInput[]
  /** Absolute share of this path's starting-token balance, in ppm. */
  splitPpm: number
}

export interface StellarStrategyPayloadInput {
  /** Aquarius pool whose LP shares (`tokenIn`) are burned before routing. */
  burnPool?: string
  /** Per-constituent floors for the burn, in the pool's own token order. */
  burnMinAmounts?: string[]
  /** Aquarius pool that mints `tokenOut` from the routed constituents. */
  mintPool?: string
  /** Minimum LP shares the mint must deliver. */
  mintMinShares?: string
  /** Constituents of `mintPool`, in pool order. Required with `preSwapAmount`. */
  mintPoolTokens?: string[]
  paths: StellarStrategySwapPathInput[]
  /** Caller-solved amount that balances a lopsided mint before the deposit. */
  preSwapAmount?: string
  /** Pre-swap direction: pool token A into B when true, B into A when false. */
  preSwapFromA?: boolean
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
 * Lowers a strategy plan into the router's two registries plus the packed
 * instruction stream.
 *
 * Mirrors `contracts/swap-aggregator/src/program.rs` and the Rust builder in
 * `arb-algo`. Instructions reference addresses and amounts by `u8` index, so an
 * address several hops share costs 40 bytes once rather than once per hop.
 */
class ProgramLowering {
  private readonly assets: string[] = []
  private readonly amounts: string[] = []
  private readonly ops: number[][] = []
  private readonly weights: number[] = []

  constructor(totalMinOut: string) {
    // Slot 0 is the strategy-wide minimum output.
    this.amounts.push(totalMinOut)
  }

  /** Index of `address` in the registry, appending it if new. */
  asset(address: string): number {
    const found = this.assets.indexOf(address)
    if (found !== -1) return found
    if (this.assets.length >= MAX_ASSETS) {
      throw new Error(
        'Stellar builder: strategy references more than 256 distinct addresses'
      )
    }
    this.assets.push(address)
    return this.assets.length - 1
  }

  /** Index of a newly appended amount. */
  amount(value: string): number {
    if (this.amounts.length >= MAX_AMOUNTS) {
      throw new Error(
        'Stellar builder: strategy references too many distinct amounts'
      )
    }
    this.amounts.push(value)
    return this.amounts.length - 1
  }

  /** Index of a newly appended split weight. */
  weight(ppm: number): number {
    if (this.weights.length >= MAX_WEIGHTS) {
      throw new Error('Stellar builder: strategy uses more than 32 split weights')
    }
    if (!Number.isInteger(ppm) || ppm <= 0 || ppm > PPM_DENOMINATOR) {
      throw new Error(
        `Stellar builder: split weight ${ppm} outside 1..=${PPM_DENOMINATOR}`
      )
    }
    this.weights.push(ppm)
    return this.weights.length - 1
  }

  emit(opcode: number, mode: number, a: number, b: number, c: number): void {
    this.ops.push([opcode, mode, a, b, c])
  }

  /** Emit one path: the head instruction sizes the input, the rest chain. */
  emitPath(path: StellarStrategySwapPathInput, headMode: number): void {
    path.hops.forEach((hop, n) => {
      if (hop.tokenIn === hop.tokenOut) {
        throw new Error('Stellar builder: hop swaps a token for itself')
      }
      const previous = path.hops[n - 1]
      if (previous && hop.tokenIn !== previous.tokenOut) {
        throw new Error(
          "Stellar builder: hop does not chain onto its predecessor's output"
        )
      }
      this.emit(
        STELLAR_SWAP_VENUE_OPCODE[hop.venue],
        n === 0 ? headMode : MODE_PREV,
        this.asset(hop.pool),
        this.asset(hop.tokenIn),
        this.asset(hop.tokenOut)
      )
    })
  }

  /**
   * Lower paths one starting-token group at a time.
   *
   * The contract measures a ppm instruction against the vault balance *at that
   * moment*, so absolute weights are rewritten as successive shares of the
   * shrinking remainder. A group that routes its whole balance ends on `All`,
   * which absorbs ppm rounding exactly.
   */
  lowerPaths(paths: StellarStrategySwapPathInput[]): void {
    const live = paths.filter((p) => p.hops.length > 0)
    const done: boolean[] = Array.from({ length: live.length }, () => false)

    for (let i = 0; i < live.length; i += 1) {
      if (done[i]) continue
      const groupToken = (live[i] as StellarStrategySwapPathInput).hops[0]?.tokenIn
      const members: number[] = []
      for (let j = i; j < live.length; j += 1) {
        if ((live[j] as StellarStrategySwapPathInput).hops[0]?.tokenIn === groupToken) {
          members.push(j)
        }
      }
      const total = members.reduce(
        (sum, j) => sum + (live[j] as StellarStrategySwapPathInput).splitPpm,
        0
      )
      if (total > PPM_DENOMINATOR) {
        throw new Error(
          `Stellar builder: split weights for one token sum to ${total}, above ${PPM_DENOMINATOR}`
        )
      }
      const sweeps = total === PPM_DENOMINATOR

      let remaining = PPM_DENOMINATOR
      members.forEach((j, n) => {
        done[j] = true
        const path = live[j] as StellarStrategySwapPathInput
        let mode: number
        if (n + 1 === members.length && sweeps) {
          mode = MODE_ALL
        } else {
          if (remaining === 0) {
            throw new Error(
              'Stellar builder: split weights exhaust the group before its last path'
            )
          }
          const relative = Math.floor((path.splitPpm * PPM_DENOMINATOR) / remaining)
          remaining -= Math.min(path.splitPpm, remaining)
          mode = MODE_PPM_BASE + this.weight(relative)
        }
        this.emitPath(path, mode)
      })
    }
  }

  /** Serialize header, instructions, and weights. */
  toBytes(tokenIn: number, tokenOut: number, referralId: number): Buffer {
    if (this.ops.length === 0) {
      throw new Error('Stellar builder: strategy lowered to zero instructions')
    }
    if (this.ops.length > MAX_OPS) {
      throw new Error(
        `Stellar builder: strategy has ${this.ops.length} instructions, the router accepts ${MAX_OPS}`
      )
    }
    const out: number[] = [
      STELLAR_PROGRAM_VERSION,
      tokenIn,
      tokenOut,
      0, // amounts[0] is totalMinOut
      (referralId >>> 24) & 0xff,
      (referralId >>> 16) & 0xff,
      (referralId >>> 8) & 0xff,
      referralId & 0xff,
      this.ops.length,
      this.weights.length,
    ]
    for (const op of this.ops) out.push(...op)
    for (const ppm of this.weights) {
      out.push((ppm >>> 16) & 0xff, (ppm >>> 8) & 0xff, ppm & 0xff)
    }
    return Buffer.from(out)
  }

  get assetList(): string[] {
    return this.assets
  }

  get amountList(): string[] {
    return this.amounts
  }
}

/**
 * Encode the aggregator router's `StrategyPayload`. The caller usually receives
 * this already encoded as quote `routeXdr`; this helper is for tests and for
 * callers that construct routes locally.
 */
export const encodeStrategyPayload = (
  payload: StellarStrategyPayloadInput
): xdr.ScVal => {
  const low = new ProgramLowering(payload.totalMinOut)

  const tokenIn = low.asset(payload.tokenIn)
  const tokenOut = low.asset(payload.tokenOut)
  if (tokenIn === tokenOut) {
    throw new Error('Stellar builder: `tokenIn` and `tokenOut` are the same asset')
  }

  if (payload.burnPool) {
    const pool = low.asset(payload.burnPool)
    const start = low.amountList.length
    for (const min of payload.burnMinAmounts ?? []) low.amount(min)
    // A burn consumes the whole LP balance, which is `tokenIn`.
    low.emit(OP_BURN, MODE_ALL, pool, tokenIn, start)
  }

  low.lowerPaths(payload.paths)

  if (payload.mintPool) {
    const preSwap = payload.preSwapAmount
    if (preSwap && BigInt(preSwap) > 0n) {
      const tokens = payload.mintPoolTokens
      if (!tokens || tokens.length !== 2) {
        throw new Error(
          'Stellar builder: `preSwapAmount` needs `mintPoolTokens` to name the pool’s two constituents'
        )
      }
      const [tokenA, tokenB] = tokens as [string, string]
      const [from, to] = payload.preSwapFromA ? [tokenA, tokenB] : [tokenB, tokenA]
      low.emit(
        STELLAR_SWAP_VENUE_OPCODE.Aquarius,
        MODE_FIXED_BASE + low.amount(preSwap),
        low.asset(payload.mintPool),
        low.asset(from),
        low.asset(to)
      )
    }
    // The mint credits `tokenOut`, the pool's share token.
    low.emit(
      OP_MINT,
      MODE_ALL,
      low.asset(payload.mintPool),
      tokenOut,
      low.amount(payload.mintMinShares ?? '1')
    )
  }

  const referralId = Number(payload.referralId ?? 0)
  if (!Number.isInteger(referralId) || referralId < 0 || referralId > 0xffffffff) {
    throw new Error(
      `Stellar builder: referral id ${payload.referralId} does not fit the wire’s u32`
    )
  }

  return scStruct({
    amounts: xdr.ScVal.scvVec(low.amountList.map((a) => i128(a))),
    assets: xdr.ScVal.scvVec(low.assetList.map((a) => addr(a))),
    ops: xdr.ScVal.scvBytes(low.toBytes(tokenIn, tokenOut, referralId)),
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
  // Weights are grouped by the token a path starts from: parallel legs out of
  // the same token share one budget, and a burn releases several tokens that
  // each get their own.
  const groupPpm = new Map<string, number>()
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
    for (const [hopIdx, hop] of path.hops.entries()) {
      if (
        !hop ||
        typeof hop.pool !== 'string' ||
        typeof hop.tokenIn !== 'string' ||
        typeof hop.tokenOut !== 'string' ||
        !STELLAR_SWAP_VENUES.includes(hop.venue as StellarSwapVenue)
      ) {
        throw new Error(
          `Stellar builder: \`steps.paths[${idx}].hops[${hopIdx}]\` must have pool, tokenIn, tokenOut, and a valid Soroban venue`
        )
      }
    }
    const head = path.hops[0] as StellarStrategySwapHopInput
    groupPpm.set(head.tokenIn, (groupPpm.get(head.tokenIn) ?? 0) + path.splitPpm)
  }
  for (const [token, sum] of groupPpm) {
    if (sum > PPM_DENOMINATOR) {
      throw new Error(
        `Stellar builder: \`steps.paths[].splitPpm\` for ${token} sums to ${sum}, above ${PPM_DENOMINATOR}`
      )
    }
    // Without a mint leg every routed token must be fully consumed, or the
    // router's residual guard rejects the strategy on-chain.
    if (!candidate.mintPool && sum !== PPM_DENOMINATOR) {
      throw new Error(
        `Stellar builder: \`steps.paths[].splitPpm\` for ${token} must sum to ${PPM_DENOMINATOR}, got ${sum}`
      )
    }
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

/**
 * Genuinely empty strategy swap bytes. Required by `repay_debt_with_collateral`
 * and `swap_debt` when the collateral/borrowed asset is identical to the debt
 * asset — the controller asserts `swap.is_empty()` in that case and reverts
 * `InvalidPayments` if any route is supplied, even an unused placeholder.
 */
export const emptyStrategySwapBytes = (): xdr.ScVal =>
  xdr.ScVal.scvBytes(Buffer.alloc(0))

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
    return steps.length === 0 ? emptyStrategySwapBytes() : strategyBytes(steps)
  }
  if (steps && typeof steps === 'object') {
    if (hasRouteXdr(steps)) {
      return strategyBytes(decodeStrategyBytesString(steps.routeXdr))
    }
    if (hasSwapXdr(steps)) {
      return strategyBytes(decodeStrategyBytesString(steps.swapXdr))
    }
    if (hasBytes(steps)) {
      if (typeof steps.bytes === 'string') {
        return strategyBytes(decodeStrategyBytesString(steps.bytes))
      }
      return steps.bytes.length === 0
        ? emptyStrategySwapBytes()
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
