/**
 * Stellar Soroban lending transaction builders (Wave 1B).
 *
 * Each builder takes a Wave 0 `*Args` DTO from @xoxno/types plus a shared
 * `StellarBuilderOptions` ({ network, caller, sourceSequence, ... }) and
 * returns an unsigned transaction XDR string ready for wallet signing
 * (Freighter / LOBSTR / xBull / WalletConnect via StellarWalletsKit).
 *
 * Mirrors the Stellar controller entry points in
 * rs-lending/stellar/controller/src/lib.rs:
 *
 *   supply(caller, account_id: u64, e_mode_category: u32, assets: Vec<(Address, i128)>) -> u64
 *   borrow(caller, account_id: u64, borrows: Vec<(Address, i128)>)
 *   withdraw(caller, account_id: u64, withdrawals: Vec<(Address, i128)>)
 *   repay(caller, account_id: u64, payments: Vec<(Address, i128)>)
 *   liquidate(liquidator, account_id: u64, debt_payments: Vec<(Address, i128)>)
 *   flash_loan(caller, asset, amount: i128, receiver, data: Bytes)
 *   multiply(caller, account_id, e_mode_category, collateral_token,
 *            debt_to_flash_loan: i128, debt_token, mode: u32, steps: SwapSteps) -> u64
 *   swap_debt(caller, account_id, existing_debt_token, new_debt_amount: i128,
 *             new_debt_token, steps: SwapSteps)
 *   swap_collateral(caller, account_id, current_collateral, from_amount: i128,
 *                   new_collateral, steps: SwapSteps)
 *   repay_debt_with_collateral(caller, account_id, collateral_token,
 *                              collateral_amount: i128, debt_token,
 *                              steps: SwapSteps, close_position: bool)
 *
 * i128 values cross the boundary as decimal strings and are encoded via
 * `new ScInt(str).toI128()`. addresses (Stellar `G...` accounts and Soroban
 * `C...` contracts) are encoded via `new Address(str).toScVal()`.
 *
 * These builders are RPC-free on purpose: they accept a caller-supplied
 * `sourceSequence` so the returned XDR is deterministic and snapshot-testable.
 * The UI hook layer (Wave 1C) is responsible for fetching the current sequence
 * via `rpc.Server.getAccount(caller)` and calling `rpc.Server.prepareTransaction`
 * (which handles simulation + Soroban footprint/auth/resource fee) before
 * handing the XDR to the wallet to sign.
 */

import type {
  AggregatorSwapDto,
  BorrowArgs,
  FlashLoanArgs,
  LiquidateArgs,
  LiquidateDebtPayment,
  MultiplyArgs,
  RepayArgs,
  RepayDebtWithCollateralArgs,
  SupplyArgs,
  SwapCollateralArgs,
  SwapDebtArgs,
  SwapHopDto,
  SwapPathDto,
  SwapVenue,
  WithdrawArgs,
} from '@xoxno/types'

/**
 * Inlined copy of `SWAP_VENUES` from `@xoxno/types` so the SDK can
 * validate a runtime-supplied venue without forcing the (NestJS-coupled)
 * @xoxno/types module to load at runtime. Kept in lockstep with the
 * upstream constant; any new on-chain venue must be added in both
 * places + the contract's `SwapVenue` enum.
 */
const STELLAR_SWAP_VENUES = [
  'Soroswap',
  'Aquarius',
  'Phoenix',
  'NativeAmm',
  'StaticBridge',
] as const satisfies readonly SwapVenue[]
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
  getStellarLendingController,
  STELLAR_NETWORK_PASSPHRASE,
  type StellarNetwork,
} from './contracts'

// -----------------------------------------------------------------------------
// Shared types
// -----------------------------------------------------------------------------

/**
 * Stellar `G...` public key of the caller (tx source account).
 */
export type StellarAccountAddress = string

export interface StellarBuilderOptions {
  network: StellarNetwork
  caller: StellarAccountAddress
  /**
   * Current sequence number of the caller account, as a decimal string.
   * Callers fetch this from Soroban RPC (`server.getAccount(caller)`) before
   * building. Keeping it as an input (rather than fetching inside the builder)
   * makes builders sync-friendly, RPC-free, and deterministic for snapshot tests.
   */
  sourceSequence: string
  /**
   * Override the controller contract address. Normally resolved from env via
   * `getStellarLendingController(network)` — override is for tests and
   * preview/staging deployments.
   */
  controllerAddress?: string
  /** Base fee in stroops (default BASE_FEE = "100"). */
  fee?: string
  /** Tx timeout in seconds (default 300). */
  timeoutSeconds?: number
}

export interface BuiltStellarTx {
  /** Unsigned transaction XDR (base64) ready for wallet signing. */
  xdr: string
}

/**
 * Input shape for the Stellar-specific `swap` payload carried on
 * `MultiplyArgs.steps`, `SwapDebtArgs.steps`, `SwapCollateralArgs.steps`,
 * `RepayDebtWithCollateralArgs.steps`.
 *
 * @xoxno/types declares `steps: unknown` on the Wave 0 DTOs so every chain
 * owns its own encoding. On Stellar, callers MUST pass an
 * `AggregatorSwapDto` which is serialised into the Soroban
 * `AggregatorSwap` struct from `rs-lending-xlm common/src/types.rs`:
 *
 *   pub struct SwapHop {
 *       pub fee_bps: u32,
 *       pub pool: Address,
 *       pub token_in: Address,
 *       pub token_out: Address,
 *       pub venue: SwapVenue,   // tag-only enum
 *   }
 *   pub struct SwapPath {
 *       pub amount_in: i128,
 *       pub hops: Vec<SwapHop>,
 *       pub min_amount_out: i128,
 *   }
 *   pub struct AggregatorSwap {  // controller payload
 *       pub paths: Vec<SwapPath>,
 *       pub total_min_out: i128,
 *   }
 *
 * The controller wraps `AggregatorSwap` in `BatchSwap` (filling
 * `sender = current_contract_address`) before forwarding to the router.
 *
 * Re-exported from this module so consumers can `import { StellarSwapStepsInput }`
 * and get the canonical typed shape without reaching into `@xoxno/types`.
 */
export type StellarSwapStepsInput = AggregatorSwapDto
export type StellarSwapHopInput = SwapHopDto
export type StellarSwapPathInput = SwapPathDto
export type StellarSwapVenue = SwapVenue

// -----------------------------------------------------------------------------
// Encoding helpers — all deterministic, no RPC
// -----------------------------------------------------------------------------

const addr = (a: string): xdr.ScVal => new Address(a).toScVal()
const i128 = (s: string): xdr.ScVal => new ScInt(s).toI128()
const u32 = (n: number): xdr.ScVal => xdr.ScVal.scvU32(n)
const u64 = (n: number | string): xdr.ScVal =>
  new ScInt(typeof n === 'string' ? n : n.toString()).toU64()
const bool = (b: boolean): xdr.ScVal => xdr.ScVal.scvBool(b)
const bytes = (hex: string): xdr.ScVal => {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const buf = Buffer.from(cleanHex, 'hex')
  return xdr.ScVal.scvBytes(buf)
}
const sym = (s: string): xdr.ScVal => xdr.ScVal.scvSymbol(s)

/**
 * Encode `Vec<(Address, i128)>` — a Soroban tuple-vec of (asset, amount).
 * Each tuple is a 2-element `scvVec`.
 */
const tupleAddrAmountVec = (
  entries: Array<{ token: string; amount: string }>
): xdr.ScVal =>
  xdr.ScVal.scvVec(
    entries.map((e) => xdr.ScVal.scvVec([addr(e.token), i128(e.amount)]))
  )

/**
 * Encode a Soroban `struct` — at the XDR level, structs are maps with
 * `Symbol` keys in **lexicographic order** of field names.
 */
const scStruct = (fields: Record<string, xdr.ScVal>): xdr.ScVal => {
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
 * Encode a Soroban `enum SwapVenue` (tag-only / unit variant). At the
 * XDR level a unit variant is `scvVec([symbol_name])`.
 */
const encodeSwapVenue = (venue: SwapVenue): xdr.ScVal =>
  xdr.ScVal.scvVec([sym(venue)])

/**
 * Encode the controller-facing `AggregatorSwap` struct
 * (`{ paths: Vec<SwapPath>, total_min_out: i128 }`).
 *
 * Field names emitted on the wire are the contract's snake_case names —
 * `scStruct()` lex-sorts keys, so the resulting bytes match the Soroban
 * `#[contracttype]`-derived layout exactly.
 *
 * `SwapPath` is the new PPM-split shape: each path declares
 * `split_ppm` (parts-per-million share of the batch's total input) and
 * a `hops` chain. There are no per-path or per-hop amount fields — the
 * router computes per-path input as `total_in * split_ppm / 1_000_000`
 * (last path absorbs PPM rounding).
 */
const encodeAggregatorSwap = (swap: StellarSwapStepsInput): xdr.ScVal => {
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
 * Validate the untyped `steps` field from a Wave 0 DTO and narrow it
 * to `AggregatorSwapDto`. Throws a clear error if the caller passed
 * the wrong shape so the failure surfaces at the SDK boundary, not
 * deep inside the Soroban host on-chain.
 */
const asStellarSwapSteps = (steps: unknown): StellarSwapStepsInput => {
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
const asStellarBytes = (data: unknown): xdr.ScVal => {
  if (typeof data === 'string') return bytes(data)
  if (data instanceof Uint8Array) return xdr.ScVal.scvBytes(Buffer.from(data))
  throw new Error(
    'Stellar builder: `data` must be a hex string or Uint8Array (Soroban Bytes payload)'
  )
}

// -----------------------------------------------------------------------------
// Transaction assembly
// -----------------------------------------------------------------------------

/**
 * Assemble an unsigned XDR that invokes a single Soroban contract method.
 *
 * Uses a synthetic `Account(caller, sourceSequence)` — no RPC call. The
 * returned XDR still needs preparation (simulation to populate Soroban
 * footprint + auth entries + resource fees) before signing. The UI layer
 * does this via `rpc.Server.prepareTransaction`.
 */
function buildTx(
  opts: StellarBuilderOptions,
  method: string,
  params: xdr.ScVal[]
): BuiltStellarTx {
  const controllerId =
    opts.controllerAddress ?? getStellarLendingController(opts.network)
  const contract = new Contract(controllerId)

  const source = new Account(opts.caller, opts.sourceSequence)

  const tx = new TransactionBuilder(source, {
    fee: opts.fee ?? BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE[opts.network],
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(opts.timeoutSeconds ?? 300)
    .build()

  return { xdr: tx.toXDR() }
}

// -----------------------------------------------------------------------------
// Builders — 10 entry points, 1 : 1 with the Stellar controller
// -----------------------------------------------------------------------------

/**
 * supply(caller, account_id: u64, e_mode_category: u32, assets: Vec<(Address, i128)>)
 * @xoxno/types `SupplyArgs` is a single-asset shape; the Stellar contract
 * expects a batch — we wrap the single asset in a 1-element Vec.
 */
export function buildStellarSupplyTx(
  opts: StellarBuilderOptions,
  args: SupplyArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0
  const eModeCategory = args.eModeCategory ?? 0
  const assets = tupleAddrAmountVec([{ token: args.token, amount: args.amount }])

  return buildTx(opts, 'supply', [
    addr(opts.caller),
    u64(accountId),
    u32(eModeCategory),
    assets,
  ])
}

/**
 * borrow(caller, account_id: u64, borrows: Vec<(Address, i128)>)
 */
export function buildStellarBorrowTx(
  opts: StellarBuilderOptions,
  args: BorrowArgs
): BuiltStellarTx {
  const borrows = tupleAddrAmountVec([{ token: args.token, amount: args.amount }])

  return buildTx(opts, 'borrow', [
    addr(opts.caller),
    u64(args.accountNonce),
    borrows,
  ])
}

/**
 * withdraw(caller, account_id: u64, withdrawals: Vec<(Address, i128)>)
 */
export function buildStellarWithdrawTx(
  opts: StellarBuilderOptions,
  args: WithdrawArgs
): BuiltStellarTx {
  const withdrawals = tupleAddrAmountVec([
    { token: args.token, amount: args.amount },
  ])

  return buildTx(opts, 'withdraw', [
    addr(opts.caller),
    u64(args.accountNonce),
    withdrawals,
  ])
}

/**
 * repay(caller, account_id: u64, payments: Vec<(Address, i128)>)
 */
export function buildStellarRepayTx(
  opts: StellarBuilderOptions,
  args: RepayArgs
): BuiltStellarTx {
  const payments = tupleAddrAmountVec([{ token: args.token, amount: args.amount }])

  return buildTx(opts, 'repay', [
    addr(opts.caller),
    u64(args.accountNonce),
    payments,
  ])
}

/**
 * liquidate(liquidator, account_id: u64, debt_payments: Vec<(Address, i128)>)
 */
export function buildStellarLiquidateTx(
  opts: StellarBuilderOptions,
  args: LiquidateArgs
): BuiltStellarTx {
  const debtPayments = tupleAddrAmountVec(
    (args.debtPayments as LiquidateDebtPayment[]).map((p) => ({
      token: p.token,
      amount: p.amount,
    }))
  )

  return buildTx(opts, 'liquidate', [
    addr(opts.caller),
    u64(args.accountNonce),
    debtPayments,
  ])
}

/**
 * flash_loan(caller, asset, amount: i128, receiver, data: Bytes)
 */
export function buildStellarFlashLoanTx(
  opts: StellarBuilderOptions,
  args: FlashLoanArgs
): BuiltStellarTx {
  return buildTx(opts, 'flash_loan', [
    addr(opts.caller),
    addr(args.asset),
    i128(args.amount),
    addr(args.receiver),
    asStellarBytes(args.data),
  ])
}

/**
 * multiply(caller, account_id, e_mode_category, collateral_token,
 *          debt_to_flash_loan: i128, debt_token, mode: u32, steps: SwapSteps) -> u64
 */
export function buildStellarMultiplyTx(
  opts: StellarBuilderOptions,
  args: MultiplyArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0

  return buildTx(opts, 'multiply', [
    addr(opts.caller),
    u64(accountId),
    u32(args.eModeCategory),
    addr(args.collateralToken),
    i128(args.debtToFlashLoan),
    addr(args.debtToken),
    u32(args.mode),
    encodeAggregatorSwap(asStellarSwapSteps(args.steps)),
  ])
}

/**
 * swap_debt(caller, account_id, existing_debt_token, new_debt_amount: i128,
 *           new_debt_token, steps: SwapSteps)
 */
export function buildStellarSwapDebtTx(
  opts: StellarBuilderOptions,
  args: SwapDebtArgs
): BuiltStellarTx {
  return buildTx(opts, 'swap_debt', [
    addr(opts.caller),
    u64(args.accountNonce),
    addr(args.existingDebtToken),
    i128(args.newDebtAmount),
    addr(args.newDebtToken),
    encodeAggregatorSwap(asStellarSwapSteps(args.steps)),
  ])
}

/**
 * swap_collateral(caller, account_id, current_collateral, from_amount: i128,
 *                 new_collateral, steps: SwapSteps)
 */
export function buildStellarSwapCollateralTx(
  opts: StellarBuilderOptions,
  args: SwapCollateralArgs
): BuiltStellarTx {
  return buildTx(opts, 'swap_collateral', [
    addr(opts.caller),
    u64(args.accountNonce),
    addr(args.currentCollateral),
    i128(args.fromAmount),
    addr(args.newCollateral),
    encodeAggregatorSwap(asStellarSwapSteps(args.steps)),
  ])
}

/**
 * repay_debt_with_collateral(caller, account_id, collateral_token,
 *                            collateral_amount: i128, debt_token,
 *                            steps: SwapSteps, close_position: bool)
 */
export function buildStellarRepayDebtWithCollateralTx(
  opts: StellarBuilderOptions,
  args: RepayDebtWithCollateralArgs
): BuiltStellarTx {
  return buildTx(opts, 'repay_debt_with_collateral', [
    addr(opts.caller),
    u64(args.accountNonce),
    addr(args.collateralToken),
    i128(args.collateralAmount),
    addr(args.debtToken),
    encodeAggregatorSwap(asStellarSwapSteps(args.steps)),
    bool(args.closePosition),
  ])
}
