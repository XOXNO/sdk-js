/**
 * Stellar lending user-operation transaction builders.
 *
 * Each builder takes an `*Args` DTO from `@xoxno/types` plus a shared
 * `StellarBuilderOptions` ({ network, caller, sourceSequence, ... }) and returns
 * an unsigned transaction XDR string ready for wallet signing.
 *
 * i128 values cross the boundary as decimal strings, encoded via
 * `new ScInt(str).toI128()`. Addresses (Stellar `G...` accounts and Soroban
 * `C...` contracts) are encoded via `new Address(str).toScVal()`.
 *
 * Builders are RPC-free: they accept a caller-supplied `sourceSequence` so the
 * returned XDR is deterministic and snapshot-testable. The caller fetches the
 * current sequence via `rpc.Server.getAccount(caller)` and runs
 * `rpc.Server.prepareTransaction` (simulation + Soroban footprint/auth/resource
 * fee) before handing the XDR to the wallet to sign.
 */

import type {
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
  asStellarStrategySwapBytes,
  bool,
  i128,
  option,
  tupleAddrAmount,
  tupleAddrAmountVec,
  u32,
  u64,
  type StellarStrategySwapHopInput,
  type StellarStrategySwapInput,
  type StellarStrategySwapPathInput,
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
  /**
   * Override the governance (timelock) contract address. Normally resolved from
   * env via `getStellarGovernance(network)` — override is for tests and
   * preview/staging deployments. Required (env or override) for the governance
   * `propose_*` / `execute` / `execute_*` builders.
   */
  governanceAddress?: string
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
 * `MultiplyArgs.steps`, `SwapDebtArgs.steps`, `SwapCollateralArgs.steps`, and
 * `RepayDebtWithCollateralArgs.steps`.
 *
 * `@xoxno/types` declares `steps: unknown` on these DTOs so every chain owns
 * its own encoding. On Stellar, callers pass opaque aggregator strategy bytes,
 * normally the quote response `routeXdr` (base64 ScVal XDR) or `{ routeXdr }`.
 * The lending controller forwards those bytes to the aggregator and does not
 * decode the aggregator route.
 */
export type StellarSwapStepsInput = StellarStrategySwapInput
export type StellarSwapHopInput = StellarStrategySwapHopInput
export type StellarSwapPathInput = StellarStrategySwapPathInput
export type { StellarSwapVenue } from './scval-encode'

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
// Shared batch asset shape (Vec<(Address, i128)> on the controller)
// -----------------------------------------------------------------------------

export interface StellarTokenAmount {
  token: string
  amount: string
}

export interface StellarSupplyBatchArgs {
  accountNonce?: number
  eModeCategory?: number
  assets: ReadonlyArray<StellarTokenAmount>
}

export interface StellarBorrowBatchArgs {
  accountNonce: number
  borrows: ReadonlyArray<StellarTokenAmount>
}

export interface StellarWithdrawBatchArgs {
  accountNonce: number
  withdrawals: ReadonlyArray<StellarTokenAmount>
  /**
   * Optional recipient override (`C...` or `G...`). The pool pays the
   * withdrawn tokens to this address instead of the caller. Omit for the
   * standard flow — the contract arg is still sent, encoded as
   * `Option::None` (ScVal void), which the controller resolves to the
   * caller.
   */
  to?: string
}

export interface StellarRepayBatchArgs {
  accountNonce: number
  payments: ReadonlyArray<StellarTokenAmount>
}

// -----------------------------------------------------------------------------
// Builders — 10 entry points, 1 : 1 with the Stellar controller
// -----------------------------------------------------------------------------

/**
 * supply(caller, account_id: u64, e_mode_category: u32, assets: Vec<(Address, i128)>)
 */
export function buildStellarSupplyBatchTx(
  opts: StellarBuilderOptions,
  args: StellarSupplyBatchArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0
  const eModeCategory = args.eModeCategory ?? 0
  const assets = tupleAddrAmountVec([...args.assets])

  return buildTx(opts, 'supply', [
    addr(opts.caller),
    u64(accountId),
    u32(eModeCategory),
    assets,
  ])
}

/**
 * @xoxno/types `SupplyArgs` is a single-asset shape; the Stellar contract
 * expects a batch — we wrap the single asset in a 1-element Vec.
 */
export function buildStellarSupplyTx(
  opts: StellarBuilderOptions,
  args: SupplyArgs
): BuiltStellarTx {
  return buildStellarSupplyBatchTx(opts, {
    accountNonce: args.accountNonce,
    eModeCategory: args.eModeCategory,
    assets: [{ token: args.token, amount: args.amount }],
  })
}

export function buildStellarBorrowBatchTx(
  opts: StellarBuilderOptions,
  args: StellarBorrowBatchArgs
): BuiltStellarTx {
  const borrows = tupleAddrAmountVec([...args.borrows])

  return buildTx(opts, 'borrow', [
    addr(opts.caller),
    u64(args.accountNonce),
    borrows,
  ])
}

/**
 * borrow(caller, account_id: u64, borrows: Vec<(Address, i128)>)
 */
export function buildStellarBorrowTx(
  opts: StellarBuilderOptions,
  args: BorrowArgs
): BuiltStellarTx {
  return buildStellarBorrowBatchTx(opts, {
    accountNonce: args.accountNonce,
    borrows: [{ token: args.token, amount: args.amount }],
  })
}

export function buildStellarWithdrawBatchTx(
  opts: StellarBuilderOptions,
  args: StellarWithdrawBatchArgs
): BuiltStellarTx {
  const withdrawals = tupleAddrAmountVec([...args.withdrawals])

  return buildTx(opts, 'withdraw', [
    addr(opts.caller),
    u64(args.accountNonce),
    withdrawals,
    option(args.to, addr),
  ])
}

/**
 * withdraw(caller, account_id: u64, withdrawals: Vec<(Address, i128)>,
 * to: Option<Address>) — `to` is always sent; absent means the caller
 * receives the funds.
 */
export function buildStellarWithdrawTx(
  opts: StellarBuilderOptions,
  args: WithdrawArgs
): BuiltStellarTx {
  return buildStellarWithdrawBatchTx(opts, {
    accountNonce: args.accountNonce,
    withdrawals: [{ token: args.token, amount: args.amount }],
  })
}

export function buildStellarRepayBatchTx(
  opts: StellarBuilderOptions,
  args: StellarRepayBatchArgs
): BuiltStellarTx {
  const payments = tupleAddrAmountVec([...args.payments])

  return buildTx(opts, 'repay', [
    addr(opts.caller),
    u64(args.accountNonce),
    payments,
  ])
}

/**
 * repay(caller, account_id: u64, payments: Vec<(Address, i128)>)
 */
export function buildStellarRepayTx(
  opts: StellarBuilderOptions,
  args: RepayArgs
): BuiltStellarTx {
  return buildStellarRepayBatchTx(opts, {
    accountNonce: args.accountNonce,
    payments: [{ token: args.token, amount: args.amount }],
  })
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
 *          swap: Bytes, initial_payment: Option<(Address, i128)>,
 *          convert_swap: Option<Bytes>) -> u64
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
    asStellarStrategySwapBytes(args.steps),
    option(args.initialPayment, (p) => tupleAddrAmount(p.token, p.amount)),
    option(args.convertSwap, asStellarStrategySwapBytes),
  ])
}

/**
 * swap_debt(caller, account_id, existing_debt_token, new_debt_amount: i128,
 *           new_debt_token, steps: Bytes)
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
    asStellarStrategySwapBytes(args.steps),
  ])
}

/**
 * swap_collateral(caller, account_id, current_collateral, from_amount: i128,
 *                 new_collateral, steps: Bytes)
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
    asStellarStrategySwapBytes(args.steps),
  ])
}

/**
 * repay_debt_with_collateral(caller, account_id, collateral_token,
 *                            collateral_amount: i128, debt_token,
 *                            steps: Bytes, close_position: bool)
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
    asStellarStrategySwapBytes(args.steps),
    bool(args.closePosition),
  ])
}
