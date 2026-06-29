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
  hubAsset,
  i128,
  option,
  tupleAddrAmountVec,
  tupleHubAssetAmount,
  tupleHubAssetAmountVec,
  u32,
  u64,
  vec,
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
// Multi-hub asset shapes — the controller is keyed by `HubAssetKey { hub_id,
// asset }`, so every batch entry carries an explicit `hubId` alongside the
// token address. The same `asset` on two hubs is two isolated positions.
// -----------------------------------------------------------------------------

/** A `(hub_id, asset)` coordinate — the `HubAssetKey` struct, builder-side. */
export interface StellarHubAsset {
  hubId: number
  asset: string
}

/** A `HubAssetKey` paired with an i128 decimal-string amount. */
export interface StellarHubAssetAmount extends StellarHubAsset {
  amount: string
}

export interface StellarSupplyArgs extends StellarHubAssetAmount {
  /** Existing account id; omit / `0` opens a new account. */
  accountNonce?: number
  /** Risk spoke the (new) account binds to; defaults to the canonical spoke 0. */
  spokeId?: number
}

export interface StellarSupplyBatchArgs {
  accountNonce?: number
  spokeId?: number
  assets: ReadonlyArray<StellarHubAssetAmount>
}

export interface StellarBorrowArgs extends StellarHubAssetAmount {
  accountNonce: number
  /** Optional recipient override (`C...`/`G...`); debt is recorded on the account. */
  to?: string
}

export interface StellarBorrowBatchArgs {
  accountNonce: number
  borrows: ReadonlyArray<StellarHubAssetAmount>
  to?: string
}

export interface StellarWithdrawArgs extends StellarHubAssetAmount {
  accountNonce: number
  /**
   * Optional recipient override (`C...` or `G...`). The pool pays the
   * withdrawn tokens to this address instead of the caller. Omit for the
   * standard flow — the contract arg is still sent, encoded as
   * `Option::None` (ScVal void), which the controller resolves to the caller.
   */
  to?: string
}

export interface StellarWithdrawBatchArgs {
  accountNonce: number
  withdrawals: ReadonlyArray<StellarHubAssetAmount>
  to?: string
}

export interface StellarRepayArgs extends StellarHubAssetAmount {
  accountNonce: number
}

export interface StellarRepayBatchArgs {
  accountNonce: number
  payments: ReadonlyArray<StellarHubAssetAmount>
}

export interface StellarLiquidateArgs {
  accountNonce: number
  debtPayments: ReadonlyArray<StellarHubAssetAmount>
}

export interface StellarFlashLoanArgs extends StellarHubAsset {
  amount: string
  receiver: string
  data: string | Uint8Array
}

export interface StellarMultiplyArgs {
  accountNonce?: number
  spokeId?: number
  collateral: StellarHubAsset
  debtToFlashLoan: string
  debt: StellarHubAsset
  /** `PositionMode` repr(u32). */
  mode: number
  steps: StellarSwapStepsInput
  initialPayment?: StellarHubAssetAmount
  convertSwap?: StellarSwapStepsInput
}

export interface StellarSwapDebtArgs {
  accountNonce: number
  existingDebt: StellarHubAsset
  newDebtAmount: string
  newDebt: StellarHubAsset
  steps: StellarSwapStepsInput
}

export interface StellarSwapCollateralArgs {
  accountNonce: number
  current: StellarHubAsset
  fromAmount: string
  newCollateral: StellarHubAsset
  steps: StellarSwapStepsInput
}

export interface StellarRepayDebtWithCollateralArgs {
  accountNonce: number
  collateral: StellarHubAsset
  collateralAmount: string
  debt: StellarHubAsset
  steps: StellarSwapStepsInput
  closePosition: boolean
}

/**
 * `migrate_from_blend` references the *Blend* pool's bare-`Address` assets, so
 * collateral / supply / debt stay token-keyed; only the account's risk spoke
 * (`spoke_id`) crosses on the XOXNO side.
 */
export interface StellarMigrateFromBlendArgs {
  accountId: number | string
  spokeId: number
  blendPool: string
  collateralTokens: ReadonlyArray<string>
  supplyTokens: ReadonlyArray<string>
  debtCaps: ReadonlyArray<{ token: string; cap: string }>
}

// -----------------------------------------------------------------------------
// Builders — 11 entry points, 1 : 1 with the multi-hub Stellar controller
// -----------------------------------------------------------------------------

/**
 * supply(caller, account_id: u64, spoke_id: u32, assets: Vec<(HubAssetKey, i128)>)
 */
export function buildStellarSupplyBatchTx(
  opts: StellarBuilderOptions,
  args: StellarSupplyBatchArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0
  const spokeId = args.spokeId ?? 0

  return buildTx(opts, 'supply', [
    addr(opts.caller),
    u64(accountId),
    u32(spokeId),
    tupleHubAssetAmountVec([...args.assets]),
  ])
}

/** Single-asset `supply` — wraps the asset in a 1-element batch. */
export function buildStellarSupplyTx(
  opts: StellarBuilderOptions,
  args: StellarSupplyArgs
): BuiltStellarTx {
  return buildStellarSupplyBatchTx(opts, {
    accountNonce: args.accountNonce,
    spokeId: args.spokeId,
    assets: [{ hubId: args.hubId, asset: args.asset, amount: args.amount }],
  })
}

/**
 * borrow(caller, account_id: u64, borrows: Vec<(HubAssetKey, i128)>,
 * to: Option<Address>) — `to` is always sent; absent means the caller
 * receives the funds.
 */
export function buildStellarBorrowBatchTx(
  opts: StellarBuilderOptions,
  args: StellarBorrowBatchArgs
): BuiltStellarTx {
  return buildTx(opts, 'borrow', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.borrows]),
    option(args.to, addr),
  ])
}

/** Single-asset `borrow`. */
export function buildStellarBorrowTx(
  opts: StellarBuilderOptions,
  args: StellarBorrowArgs
): BuiltStellarTx {
  return buildStellarBorrowBatchTx(opts, {
    accountNonce: args.accountNonce,
    borrows: [{ hubId: args.hubId, asset: args.asset, amount: args.amount }],
    to: args.to,
  })
}

/**
 * withdraw(caller, account_id: u64, withdrawals: Vec<(HubAssetKey, i128)>,
 * to: Option<Address>) — `to` is always sent; absent means the caller
 * receives the funds.
 */
export function buildStellarWithdrawBatchTx(
  opts: StellarBuilderOptions,
  args: StellarWithdrawBatchArgs
): BuiltStellarTx {
  return buildTx(opts, 'withdraw', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.withdrawals]),
    option(args.to, addr),
  ])
}

/** Single-asset `withdraw`. */
export function buildStellarWithdrawTx(
  opts: StellarBuilderOptions,
  args: StellarWithdrawArgs
): BuiltStellarTx {
  return buildStellarWithdrawBatchTx(opts, {
    accountNonce: args.accountNonce,
    withdrawals: [{ hubId: args.hubId, asset: args.asset, amount: args.amount }],
    to: args.to,
  })
}

/**
 * repay(caller, account_id: u64, payments: Vec<(HubAssetKey, i128)>)
 */
export function buildStellarRepayBatchTx(
  opts: StellarBuilderOptions,
  args: StellarRepayBatchArgs
): BuiltStellarTx {
  return buildTx(opts, 'repay', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.payments]),
  ])
}

/** Single-asset `repay`. */
export function buildStellarRepayTx(
  opts: StellarBuilderOptions,
  args: StellarRepayArgs
): BuiltStellarTx {
  return buildStellarRepayBatchTx(opts, {
    accountNonce: args.accountNonce,
    payments: [{ hubId: args.hubId, asset: args.asset, amount: args.amount }],
  })
}

/**
 * liquidate(liquidator, account_id: u64, debt_payments: Vec<(HubAssetKey, i128)>)
 */
export function buildStellarLiquidateTx(
  opts: StellarBuilderOptions,
  args: StellarLiquidateArgs
): BuiltStellarTx {
  return buildTx(opts, 'liquidate', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.debtPayments]),
  ])
}

/**
 * flash_loan(caller, asset: HubAssetKey, amount: i128, receiver, data: Bytes)
 */
export function buildStellarFlashLoanTx(
  opts: StellarBuilderOptions,
  args: StellarFlashLoanArgs
): BuiltStellarTx {
  return buildTx(opts, 'flash_loan', [
    addr(opts.caller),
    hubAsset(args.hubId, args.asset),
    i128(args.amount),
    addr(args.receiver),
    asStellarBytes(args.data),
  ])
}

/**
 * Build a `migrate_from_blend` controller invocation: atomically moves a Blend
 * V2 position (collateral + supply + debt) into XOXNO at zero flash-loan fee.
 *
 * ABI: `migrate_from_blend(caller, account_id, spoke_id, blend_pool,
 * collateral_assets, supply_assets, debt_caps: Vec<(Address, i128)>)`. Pass
 * `accountId = "0"` to open a new account. Each debt cap should slightly exceed
 * the live Blend debt — Blend refunds the excess, reconciled on-chain.
 *
 * Like every builder this emits an unsigned invoke; the nested `submit(from =
 * user)` authorization is materialized by `prepareTransaction` (simulation) and
 * signed by the wallet over the whole envelope.
 */
export function buildStellarMigrateFromBlendTx(
  opts: StellarBuilderOptions,
  args: StellarMigrateFromBlendArgs
): BuiltStellarTx {
  return buildTx(opts, 'migrate_from_blend', [
    addr(opts.caller),
    u64(args.accountId),
    u32(args.spokeId),
    addr(args.blendPool),
    vec(args.collateralTokens.map(addr)),
    vec(args.supplyTokens.map(addr)),
    tupleAddrAmountVec(
      args.debtCaps.map((d) => ({ token: d.token, amount: d.cap }))
    ),
  ])
}

/**
 * multiply(caller, account_id, spoke_id, collateral: HubAssetKey,
 *          debt_to_flash_loan: i128, debt: HubAssetKey, mode: PositionMode,
 *          swap: Bytes, initial_payment: Option<(HubAssetKey, i128)>,
 *          convert_swap: Option<Bytes>) -> u64
 *
 * `mode` is a repr(u32) `PositionMode` → encoded as `scvU32`. The two trailing
 * `Option`s seed an optional initial collateral payment and a secondary swap
 * converting it into the collateral token; both omit to Soroban `Void`.
 */
export function buildStellarMultiplyTx(
  opts: StellarBuilderOptions,
  args: StellarMultiplyArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0
  const spokeId = args.spokeId ?? 0

  return buildTx(opts, 'multiply', [
    addr(opts.caller),
    u64(accountId),
    u32(spokeId),
    hubAsset(args.collateral.hubId, args.collateral.asset),
    i128(args.debtToFlashLoan),
    hubAsset(args.debt.hubId, args.debt.asset),
    u32(args.mode),
    asStellarStrategySwapBytes(args.steps),
    option(args.initialPayment, (p) =>
      tupleHubAssetAmount(p.hubId, p.asset, p.amount)
    ),
    option(args.convertSwap, asStellarStrategySwapBytes),
  ])
}

/**
 * swap_debt(caller, account_id, existing_debt: HubAssetKey, amount: i128,
 *           new_debt: HubAssetKey, swap: Bytes)
 */
export function buildStellarSwapDebtTx(
  opts: StellarBuilderOptions,
  args: StellarSwapDebtArgs
): BuiltStellarTx {
  return buildTx(opts, 'swap_debt', [
    addr(opts.caller),
    u64(args.accountNonce),
    hubAsset(args.existingDebt.hubId, args.existingDebt.asset),
    i128(args.newDebtAmount),
    hubAsset(args.newDebt.hubId, args.newDebt.asset),
    asStellarStrategySwapBytes(args.steps),
  ])
}

/**
 * swap_collateral(caller, account_id, current: HubAssetKey, amount: i128,
 *                 new: HubAssetKey, swap: Bytes)
 */
export function buildStellarSwapCollateralTx(
  opts: StellarBuilderOptions,
  args: StellarSwapCollateralArgs
): BuiltStellarTx {
  return buildTx(opts, 'swap_collateral', [
    addr(opts.caller),
    u64(args.accountNonce),
    hubAsset(args.current.hubId, args.current.asset),
    i128(args.fromAmount),
    hubAsset(args.newCollateral.hubId, args.newCollateral.asset),
    asStellarStrategySwapBytes(args.steps),
  ])
}

/**
 * repay_debt_with_collateral(caller, account_id, collateral: HubAssetKey,
 *                            collateral_amount: i128, debt: HubAssetKey,
 *                            swap: Bytes, close_position: bool)
 */
export function buildStellarRepayDebtWithCollateralTx(
  opts: StellarBuilderOptions,
  args: StellarRepayDebtWithCollateralArgs
): BuiltStellarTx {
  return buildTx(opts, 'repay_debt_with_collateral', [
    addr(opts.caller),
    u64(args.accountNonce),
    hubAsset(args.collateral.hubId, args.collateral.asset),
    i128(args.collateralAmount),
    hubAsset(args.debt.hubId, args.debt.asset),
    asStellarStrategySwapBytes(args.steps),
    bool(args.closePosition),
  ])
}
