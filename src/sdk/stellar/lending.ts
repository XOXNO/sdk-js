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
import { Account, BASE_FEE, Contract, TransactionBuilder, xdr } from '@stellar/stellar-sdk'

import {
  getStellarLendingController,
  STELLAR_NETWORK_PASSPHRASE,
  type StellarNetwork,
} from './contracts'
import {
  addr,
  asStellarBytes,
  asStellarSwapSteps,
  bool,
  encodeAggregatorSwap,
  i128,
  option,
  tupleAddrAmount,
  tupleAddrAmountVec,
  u32,
  u64,
} from './scval-encode'

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
export function buildTx(
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
 *          debt_to_flash_loan: i128, debt_token, mode: PositionMode,
 *          swap: AggregatorSwap, initial_payment: Option<(Address, i128)>,
 *          convert_swap: Option<AggregatorSwap>) -> u64
 *
 * `mode` is a repr(u32) `PositionMode` → encoded as `scvU32`. The two trailing
 * `Option`s seed an optional initial collateral payment and a secondary swap
 * converting it into the collateral token; both omit to Soroban `Void`.
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
    option(args.initialPayment, (p) => tupleAddrAmount(p.token, p.amount)),
    option(args.convertSwap, (s) => encodeAggregatorSwap(asStellarSwapSteps(s))),
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
