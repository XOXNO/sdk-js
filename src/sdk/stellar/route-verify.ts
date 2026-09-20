/**
 * Decoder and pre-signing verifier for the aggregator router's packed route
 * (`routeXdr` / `swap_xdr`).
 *
 * The quote server is unauthenticated and returns the route as an opaque blob
 * next to separate JSON display fields. The router enforces only the minimum
 * that is ENCODED in the blob, so a caller must decode it and compare it with
 * its own request before a wallet signs. The decoder mirrors
 * `contracts/swap-aggregator/src/program.rs` (`Program::decode` + `validate`)
 * and `execute::run` check for check; the encoder is `./scval-encode.ts`.
 */

import { Address, Asset, scValToBigInt, StrKey, xdr } from '@stellar/stellar-sdk'
import { Buffer } from 'buffer'

import { STELLAR_NETWORK_PASSPHRASE, type StellarNetwork } from './contracts'
import {
  asStellarStrategySwapBytes,
  MAX_AMOUNTS,
  MAX_ASSETS,
  MAX_OPS,
  MAX_WEIGHTS,
  MODE_ALL,
  MODE_FIXED_BASE,
  MODE_PPM_BASE,
  MODE_PREV,
  OP_BURN,
  OP_MINT,
  PPM_DENOMINATOR,
  STELLAR_PROGRAM_VERSION,
  STELLAR_SWAP_VENUES,
  type StellarStrategySwapInput,
  type StellarSwapVenue,
} from './scval-encode'

const HEADER_LEN = 10
const OP_LEN = 5
const WEIGHT_LEN = 3
const MAX_PROGRAM_BYTES = HEADER_LEN + OP_LEN * MAX_OPS + WEIGHT_LEN * MAX_WEIGHTS
/**
 * Cap on the serialized payload, checked before XDR parsing so a hostile
 * response cannot force a proportional allocation. The largest legal payload
 * (256 addresses, 126 amounts, 346 program bytes) is below 16 KiB.
 */
export const STELLAR_ROUTE_MAX_BYTES = 16 * 1024

export type StellarRouteErrorCode =
  | 'MALFORMED'
  | 'OVERSIZED'
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN_OPCODE'
  | 'INVALID_STRUCTURE'
  | 'TOKEN_IN_MISMATCH'
  | 'TOKEN_OUT_MISMATCH'
  | 'MIN_OUT_TOO_LOW'
  | 'AMOUNT_IN_EXCEEDED'
  | 'EXPECTATION_MISSING'

/** Thrown when a route cannot be decoded or disagrees with the caller's request. */
export class StellarRouteVerificationError extends Error {
  readonly code: StellarRouteErrorCode

  constructor(code: StellarRouteErrorCode, message: string) {
    super(`Stellar route verification failed [${code}]: ${message}`)
    this.name = 'StellarRouteVerificationError'
    this.code = code
  }
}

const fail = (code: StellarRouteErrorCode, message: string): never => {
  throw new StellarRouteVerificationError(code, message)
}

export type DecodedStellarRouteMode =
  | { kind: 'all' }
  | { kind: 'prev' }
  | { kind: 'fixed'; amount: bigint }
  | { kind: 'ppm'; ppm: number }

export type DecodedStellarRouteOp =
  | {
      kind: 'swap'
      venue: StellarSwapVenue
      mode: DecodedStellarRouteMode
      pool: string
      tokenIn: string
      tokenOut: string
    }
  | {
      kind: 'burn' | 'mint'
      pool: string
      shareToken: string
      /** Burn: first index of the per-constituent floor run. Mint: index of the minimum shares. */
      amountIndex: number
    }

export interface DecodedStellarRoute {
  version: number
  tokenIn: string
  tokenOut: string
  /** The minimum output the router enforces on chain (`amounts[min_out]`). */
  totalMinOut: bigint
  referralId: number
  assets: string[]
  amounts: bigint[]
  ops: DecodedStellarRouteOp[]
  /** Split weights in parts per million. */
  weights: number[]
}

/**
 * Any form the builders accept: base64 `routeXdr`, `0x` hex, raw bytes,
 * `{ routeXdr }` / `{ swapXdr }` / `{ bytes }`, or a decoded payload object
 * (encoded locally first, so the check covers exactly what would be signed).
 */
export type StellarRouteBytesInput = StellarStrategySwapInput

const toBuffer = (route: StellarRouteBytesInput): Buffer => {
  const encoded =
    typeof route === 'string'
      ? route
      : route && typeof route === 'object' && 'routeXdr' in route
        ? route.routeXdr
        : undefined
  // Base64 expands 3 bytes to 4 characters; reject before decoding.
  if (typeof encoded === 'string' && encoded.length > STELLAR_ROUTE_MAX_BYTES * 2) {
    return fail('OVERSIZED', `encoded route has ${encoded.length} characters`)
  }
  try {
    return Buffer.from(asStellarStrategySwapBytes(route).bytes())
  } catch (error) {
    return fail('MALFORMED', error instanceof Error ? error.message : String(error))
  }
}

const readPayloadFields = (
  buf: Buffer
): { amounts: xdr.ScVal[]; assets: xdr.ScVal[]; ops: Buffer } => {
  let value: xdr.ScVal
  try {
    // `fromXDR` rejects truncated input and trailing bytes.
    value = xdr.ScVal.fromXDR(buf)
  } catch (error) {
    return fail(
      'MALFORMED',
      `payload is not one XDR ScVal: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (value.switch().name !== 'scvMap') {
    return fail('MALFORMED', 'payload must be a StrategyPayload map')
  }
  const entries = value.map() ?? []
  // A `#[contracttype]` struct is a map with exactly its fields, keys sorted.
  const keys = entries.map((entry) =>
    entry.key().switch().name === 'scvSymbol' ? entry.key().sym().toString() : ''
  )
  if (keys.join(',') !== 'amounts,assets,ops') {
    return fail('MALFORMED', 'payload fields must be exactly amounts, assets, ops')
  }
  const [amountsVal, assetsVal, opsVal] = entries.map((entry) => entry.val()) as [
    xdr.ScVal,
    xdr.ScVal,
    xdr.ScVal,
  ]
  if (
    amountsVal.switch().name !== 'scvVec' ||
    assetsVal.switch().name !== 'scvVec' ||
    opsVal.switch().name !== 'scvBytes'
  ) {
    return fail('MALFORMED', 'payload field has the wrong type')
  }
  return {
    amounts: amountsVal.vec() ?? [],
    assets: assetsVal.vec() ?? [],
    ops: Buffer.from(opsVal.bytes()),
  }
}

/**
 * Decode and structurally validate route bytes. Applies every check of the
 * on-chain decoder, so a route that `Program::decode` rejects does not decode
 * here. Venue behaviour (pools, liquidity, budget) is not checked.
 * @throws StellarRouteVerificationError
 */
export function decodeStellarRouteBytes(route: StellarRouteBytesInput): DecodedStellarRoute {
  const buf = toBuffer(route)
  if (buf.length === 0) fail('MALFORMED', 'route is empty')
  if (buf.length > STELLAR_ROUTE_MAX_BYTES) {
    fail('OVERSIZED', `route has ${buf.length} bytes, above ${STELLAR_ROUTE_MAX_BYTES}`)
  }

  const fields = readPayloadFields(buf)
  const assetsLen = fields.assets.length
  const amountsLen = fields.amounts.length
  if (assetsLen === 0) fail('MALFORMED', 'asset registry is empty')
  if (assetsLen > MAX_ASSETS || amountsLen > MAX_AMOUNTS) {
    fail('OVERSIZED', `registries hold ${assetsLen} assets and ${amountsLen} amounts`)
  }

  const assets = fields.assets.map((value, i) => {
    if (value.switch().name !== 'scvAddress') {
      return fail('MALFORMED', `assets[${i}] is not an address`)
    }
    return Address.fromScAddress(value.address()).toString()
  })
  const amounts = fields.amounts.map((value, i) => {
    if (value.switch().name !== 'scvI128') {
      return fail('MALFORMED', `amounts[${i}] is not an i128`)
    }
    return scValToBigInt(value)
  })

  const ops = fields.ops
  if (ops.length < HEADER_LEN) fail('MALFORMED', 'program header is truncated')
  if (ops.length > MAX_PROGRAM_BYTES) {
    fail('OVERSIZED', `program has ${ops.length} bytes, above ${MAX_PROGRAM_BYTES}`)
  }
  const byte = (at: number): number => {
    const value = ops[at]
    return value === undefined ? fail('MALFORMED', `program byte ${at} is missing`) : value
  }

  const version = byte(0)
  if (version !== STELLAR_PROGRAM_VERSION) {
    fail('UNSUPPORTED_VERSION', `program version ${version}, expected ${STELLAR_PROGRAM_VERSION}`)
  }
  const opCount = byte(8)
  const weightCount = byte(9)
  if (opCount === 0) fail('INVALID_STRUCTURE', 'program has no instructions')
  if (opCount > MAX_OPS || weightCount > MAX_WEIGHTS) {
    fail('OVERSIZED', `program declares ${opCount} instructions and ${weightCount} weights`)
  }
  const weightsAt = HEADER_LEN + OP_LEN * opCount
  if (ops.length !== weightsAt + WEIGHT_LEN * weightCount) {
    fail('MALFORMED', 'program length does not match its instruction and weight counts')
  }

  const tokenInIdx = byte(1)
  const tokenOutIdx = byte(2)
  const minOutIdx = byte(3)
  if (tokenInIdx >= assetsLen || tokenOutIdx >= assetsLen || minOutIdx >= amountsLen) {
    fail('MALFORMED', 'header index is outside its registry')
  }
  if (tokenInIdx === tokenOutIdx) fail('INVALID_STRUCTURE', 'token_in equals token_out')
  const referralId = ops.readUInt32BE(4)

  const weights: number[] = []
  for (let i = 0; i < weightCount; i += 1) {
    const ppm = ops.readUIntBE(weightsAt + WEIGHT_LEN * i, WEIGHT_LEN)
    if (ppm === 0 || ppm > PPM_DENOMINATOR) {
      fail('INVALID_STRUCTURE', `split weight ${ppm} outside 1..=${PPM_DENOMINATOR}`)
    }
    weights.push(ppm)
  }

  const asset = (idx: number): string =>
    assets[idx] ?? fail('MALFORMED', `asset index ${idx} is outside the registry`)
  const amount = (idx: number): bigint =>
    amounts[idx] ?? fail('MALFORMED', `amount index ${idx} is outside the registry`)

  const decoded: DecodedStellarRouteOp[] = []
  // Registry index of the previous instruction's single output; a burn has none.
  let producedIdx: number | undefined
  for (let i = 0; i < opCount; i += 1) {
    const at = HEADER_LEN + OP_LEN * i
    const opcode = byte(at)
    const modeByte = byte(at + 1)
    const idxA = byte(at + 2)
    const idxB = byte(at + 3)
    const idxC = byte(at + 4)
    if (opcode > OP_MINT) fail('UNKNOWN_OPCODE', `instruction ${i} has opcode ${opcode}`)

    let mode: DecodedStellarRouteMode
    if (modeByte === MODE_ALL) {
      mode = { kind: 'all' }
    } else if (modeByte === MODE_PREV) {
      // `Prev` needs a predecessor with one output, and that output must be
      // this input. The contract compares registry INDICES, so do the same.
      if (producedIdx === undefined || producedIdx !== idxB) {
        fail('INVALID_STRUCTURE', `instruction ${i} does not chain onto its predecessor`)
      }
      mode = { kind: 'prev' }
    } else if (modeByte >= MODE_PPM_BASE) {
      const ppm = weights[modeByte - MODE_PPM_BASE]
      if (ppm === undefined) fail('MALFORMED', `instruction ${i} weight index is out of range`)
      mode = { kind: 'ppm', ppm: ppm as number }
    } else {
      mode = { kind: 'fixed', amount: amount(modeByte - MODE_FIXED_BASE) }
    }

    const pool = asset(idxA)
    if (opcode === OP_BURN || opcode === OP_MINT) {
      if (mode.kind !== 'all') fail('MALFORMED', `liquidity instruction ${i} must use mode All`)
      if (idxC >= amountsLen) fail('MALFORMED', `instruction ${i} amount index is out of range`)
      decoded.push({
        kind: opcode === OP_BURN ? 'burn' : 'mint',
        pool,
        shareToken: asset(idxB),
        amountIndex: idxC,
      })
      producedIdx = opcode === OP_MINT ? idxB : undefined
      continue
    }
    if (idxB === idxC) fail('INVALID_STRUCTURE', `instruction ${i} swaps a token for itself`)
    decoded.push({
      kind: 'swap',
      venue: STELLAR_SWAP_VENUES[opcode] as StellarSwapVenue,
      mode,
      pool,
      tokenIn: asset(idxB),
      tokenOut: asset(idxC),
    })
    producedIdx = idxC
  }

  const totalMinOut = amount(minOutIdx)
  // `execute::run` rejects a non-positive minimum.
  if (totalMinOut <= 0n) fail('MIN_OUT_TOO_LOW', `encoded total_min_out is ${totalMinOut}`)

  return {
    version,
    tokenIn: asset(tokenInIdx),
    tokenOut: asset(tokenOutIdx),
    totalMinOut,
    referralId,
    assets,
    amounts,
    ops: decoded,
    weights,
  }
}

/**
 * Contract id of a quote-server token id: `C…` as is, `XLM` / `native` and
 * `CODE:GISSUER` through the Stellar Asset Contract id of `network`.
 * @throws StellarRouteVerificationError when the id needs a network and none is given.
 */
export function stellarTokenContractId(tokenId: string, network?: StellarNetwork): string {
  if (StrKey.isValidContract(tokenId)) return tokenId
  if (!network) {
    return fail(
      'EXPECTATION_MISSING',
      `token ${tokenId} is not a contract id; pass \`network\` to derive its asset contract`
    )
  }
  try {
    const sep = tokenId.indexOf(':')
    const classic =
      tokenId === 'XLM' || tokenId === 'native'
        ? Asset.native()
        : new Asset(tokenId.slice(0, sep), tokenId.slice(sep + 1))
    return classic.contractId(STELLAR_NETWORK_PASSPHRASE[network])
  } catch {
    return fail('MALFORMED', `token id ${tokenId} is not a contract id or a classic asset`)
  }
}

/** What the CALLER asked for. Take these from request state, not from the response. */
export interface StellarRouteExpectation {
  /** Input token contract id (`C…`). */
  tokenIn: string
  /** Output token contract id (`C…`). */
  tokenOut: string
  /** Lowest acceptable encoded `total_min_out`, base units. This is the value shown to the user. */
  minOut: string | bigint
  /** Input amount, base units. When given, no fixed-size leg may spend more of `tokenIn`. */
  amountIn?: string | bigint
}

const toAmount = (value: string | bigint, label: string): bigint => {
  if (typeof value === 'bigint') return value
  if (!/^\d+$/.test(value)) {
    return fail('EXPECTATION_MISSING', `${label} must be a base-unit integer string`)
  }
  return BigInt(value)
}

/**
 * Decode `route` and require it to match `expected`. Call before signing any
 * transaction that carries route bytes; never sign when this throws.
 * @returns The decoded route, for display or further checks.
 * @throws StellarRouteVerificationError
 */
export function verifyStellarRouteBytes(
  route: StellarRouteBytesInput,
  expected: StellarRouteExpectation
): DecodedStellarRoute {
  const minOut = toAmount(expected.minOut, 'expected.minOut')
  if (minOut <= 0n) fail('EXPECTATION_MISSING', 'expected.minOut must be positive')

  const decoded = decodeStellarRouteBytes(route)
  if (decoded.tokenIn !== expected.tokenIn) {
    fail('TOKEN_IN_MISMATCH', `route spends ${decoded.tokenIn}, expected ${expected.tokenIn}`)
  }
  if (decoded.tokenOut !== expected.tokenOut) {
    fail('TOKEN_OUT_MISMATCH', `route delivers ${decoded.tokenOut}, expected ${expected.tokenOut}`)
  }
  if (decoded.totalMinOut < minOut) {
    fail(
      'MIN_OUT_TOO_LOW',
      `route enforces a minimum of ${decoded.totalMinOut}, below the expected ${minOut}`
    )
  }
  if (expected.amountIn !== undefined) {
    const amountIn = toAmount(expected.amountIn, 'expected.amountIn')
    for (const op of decoded.ops) {
      if (
        op.kind === 'swap' &&
        op.mode.kind === 'fixed' &&
        op.tokenIn === decoded.tokenIn &&
        op.mode.amount > amountIn
      ) {
        fail('AMOUNT_IN_EXCEEDED', `a leg spends ${op.mode.amount}, above the input ${amountIn}`)
      }
    }
  }
  return decoded
}
