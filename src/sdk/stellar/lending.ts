/**
 * Stellar lending user-operation transaction builders.
 *
 * Each builder takes a typed Stellar argument object plus shared
 * `StellarLendingBuilderOptions` ({ network, caller, sourceSequence,
 * controllerAddress, ... }) and returns
 * unsigned transaction XDR that must be prepared before wallet signing.
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

import {
  Account,
  BASE_FEE,
  Contract,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'

import { STELLAR_NETWORK_PASSPHRASE, type StellarNetwork } from './contracts'
import {
  addr,
  asStellarBytes,
  asStellarStrategySwapBytes,
  bool,
  hubAsset,
  i128,
  option,
  seizeMode,
  tupleAddrAmountVec,
  tupleHubAssetAmount,
  tupleHubAssetAmountVec,
  u32,
  u64,
  vec,
  type StellarSeizeModeInput,
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
  /** Must match the API deployment, RPC and signing wallet. */
  network: StellarNetwork
  /** Transaction source and authorizing wallet public key (G...). */
  caller: StellarAccountAddress
  /**
   * Current sequence number of the caller account, as a decimal string.
   * Callers fetch this from Soroban RPC (`server.getAccount(caller)`) before
   * building. Keeping it as an input (rather than fetching inside the builder)
   * makes builders sync-friendly, RPC-free, and deterministic for snapshot tests.
   */
  sourceSequence: string
  /** Base fee in stroops (default BASE_FEE = "100"). */
  fee?: string
  /** Tx timeout in seconds (default 300). */
  timeoutSeconds?: number
}

/** Shared options plus the lending controller contract selected by the host. */
export interface StellarLendingBuilderOptions extends StellarBuilderOptions {
  /** Soroban lending controller contract (C...). Supplied by the host app. */
  controllerAddress: string
}

/** Shared options plus the governance timelock contract selected by the host. */
export interface StellarGovernanceBuilderOptions extends StellarBuilderOptions {
  /** Soroban governance/timelock contract (C...). Supplied by the host app. */
  governanceAddress: string
}

export interface BuiltStellarTx {
  /** Unsigned base64 XDR. Pass to prepareStellarBuiltTx before wallet signing. */
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
export type { StellarSeizeModeInput, StellarSwapVenue } from './scval-encode'

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
  opts: StellarLendingBuilderOptions,
  method: string,
  params: xdr.ScVal[]
): BuiltStellarTx {
  if (!opts.controllerAddress) {
    throw new Error('Stellar lending controllerAddress is required')
  }
  const contract = new Contract(opts.controllerAddress)

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
  /** Liquidity hub from the selected reserve; independent of its risk spoke. */
  hubId: number
  /** Token contract address (C...), including SAC addresses for classic assets. */
  asset: string
}

/** A hub/token coordinate with a token base-unit amount. */
export interface StellarHubAssetAmount extends StellarHubAsset {
  /** i128 decimal string in token base units; e.g. 1 token at 7 decimals is "10000000". */
  amount: string
}

export interface StellarSupplyArgs extends StellarHubAssetAmount {
  /** Lending account ID, distinct from the Stellar sequence. Prefer decimal strings; omit / 0 opens an account. */
  accountNonce?: number | string
  /** Positive risk-spoke ID. Must match the existing account when topping up. */
  spokeId: number
}

export interface StellarSupplyBatchArgs {
  accountNonce?: number | string
  /** Positive risk-spoke ID; never inferred from the asset or hub. */
  spokeId: number
  assets: ReadonlyArray<StellarHubAssetAmount>
}

export interface StellarBorrowArgs extends StellarHubAssetAmount {
  accountNonce: number | string
  /** Optional recipient override (`C...`/`G...`); debt is recorded on the account. */
  to?: string
}

export interface StellarBorrowBatchArgs {
  accountNonce: number | string
  borrows: ReadonlyArray<StellarHubAssetAmount>
  to?: string
}

export interface StellarWithdrawArgs extends StellarHubAssetAmount {
  accountNonce: number | string
  /**
   * Optional recipient override (`C...` or `G...`). The pool pays the
   * withdrawn tokens to this address instead of the caller. Omit for the
   * standard flow — the contract arg is still sent, encoded as
   * `Option::None` (ScVal void), which the controller resolves to the caller.
   */
  to?: string
}

export interface StellarWithdrawBatchArgs {
  accountNonce: number | string
  withdrawals: ReadonlyArray<StellarHubAssetAmount>
  to?: string
}

export interface StellarRepayArgs extends StellarHubAssetAmount {
  accountNonce: number | string
}

export interface StellarRepayBatchArgs {
  accountNonce: number | string
  payments: ReadonlyArray<StellarHubAssetAmount>
}

export interface StellarLiquidateArgs {
  accountNonce: number | string
  debtPayments: ReadonlyArray<StellarHubAssetAmount>
  /**
   * How the liquidator takes delivery of the seized collateral. Defaults to
   * `'Transfer'` — the pool pays out underlying tokens, which is the only
   * behaviour the pre-`SeizeMode` ABI had. `{ Credit: 0 }` opens a fresh
   * receiving account; `{ Credit: id }` credits an existing one.
   */
  seizeMode?: StellarSeizeModeInput
}

export interface StellarFlashLoanArgs extends StellarHubAsset {
  amount: string
  receiver: string
  data: string | Uint8Array
}

export interface StellarMultiplyArgs {
  accountNonce?: number | string
  /** Positive risk-spoke ID. Must match the existing account when reusing it. */
  spokeId: number
  collateral: StellarHubAsset
  debtToFlashLoan: string
  debt: StellarHubAsset
  /** Stellar PositionMode: 0 normal, 1 multiply, 2 long, 3 short. */
  mode: number
  steps: StellarSwapStepsInput
  initialPayment?: StellarHubAssetAmount
  convertSwap?: StellarSwapStepsInput
}

export interface StellarSwapDebtArgs {
  accountNonce: number | string
  existingDebt: StellarHubAsset
  newDebtAmount: string
  newDebt: StellarHubAsset
  steps: StellarSwapStepsInput
}

export interface StellarSwapCollateralArgs {
  accountNonce: number | string
  current: StellarHubAsset
  fromAmount: string
  newCollateral: StellarHubAsset
  steps: StellarSwapStepsInput
}

export interface StellarRepayDebtWithCollateralArgs {
  accountNonce: number | string
  collateral: StellarHubAsset
  collateralAmount: string
  debt: StellarHubAsset
  steps: StellarSwapStepsInput
  closePosition: boolean
}

/**
 * `migrate_from_blend` references the *Blend* pool's bare-`Address` assets, so
 * collateral / supply / debt stay token-keyed; only the account's risk spoke
 * and destination liquidity hub cross on the XOXNO side.
 */
export interface StellarMigrateFromBlendArgs {
  accountId: number | string
  spokeId: number
  hubId: number
  blendPool: string
  collateralTokens: ReadonlyArray<string>
  supplyTokens: ReadonlyArray<string>
  debtCaps: ReadonlyArray<{ token: string; cap: string }>
}

// -----------------------------------------------------------------------------
// Builders — 11 entry points, 1 : 1 with the multi-hub Stellar controller
// -----------------------------------------------------------------------------

function encodeSpokeId(value: number): xdr.ScVal {
  if (!Number.isInteger(value) || value < 1 || value > 0xffffffff) {
    throw new Error('Stellar builder: spokeId must be an integer from 1 to 4294967295')
  }
  return u32(value)
}

/**
 * supply(caller, account_id: u64, spoke_id: u32, assets: Vec<(HubAssetKey, i128)>)
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarSupplyBatchTx(
  opts: StellarLendingBuilderOptions,
  args: StellarSupplyBatchArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0

  return buildTx(opts, 'supply', [
    addr(opts.caller),
    u64(accountId),
    encodeSpokeId(args.spokeId),
    tupleHubAssetAmountVec([...args.assets]),
  ])
}

/** Single-asset `supply` — wraps the asset in a 1-element batch.
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarSupplyTx(
  opts: StellarLendingBuilderOptions,
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarBorrowBatchTx(
  opts: StellarLendingBuilderOptions,
  args: StellarBorrowBatchArgs
): BuiltStellarTx {
  return buildTx(opts, 'borrow', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.borrows]),
    option(args.to, addr),
  ])
}

/** Single-asset `borrow`.
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarBorrowTx(
  opts: StellarLendingBuilderOptions,
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarWithdrawBatchTx(
  opts: StellarLendingBuilderOptions,
  args: StellarWithdrawBatchArgs
): BuiltStellarTx {
  return buildTx(opts, 'withdraw', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.withdrawals]),
    option(args.to, addr),
  ])
}

/** Single-asset `withdraw`. Amount "0" withdraws the full supplied position.
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarWithdrawTx(
  opts: StellarLendingBuilderOptions,
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarRepayBatchTx(
  opts: StellarLendingBuilderOptions,
  args: StellarRepayBatchArgs
): BuiltStellarTx {
  return buildTx(opts, 'repay', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.payments]),
  ])
}

/** Single-asset `repay`.
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarRepayTx(
  opts: StellarLendingBuilderOptions,
  args: StellarRepayArgs
): BuiltStellarTx {
  return buildStellarRepayBatchTx(opts, {
    accountNonce: args.accountNonce,
    payments: [{ hubId: args.hubId, asset: args.asset, amount: args.amount }],
  })
}

/**
 * liquidate(liquidator, account_id: u64, debt_payments: Vec<(HubAssetKey, i128)>,
 *           seize_mode: SeizeMode) -> u64
 *
 * The `u64` return is the account credited with the seized supply shares under
 * `SeizeMode::Credit` (freshly opened when `Credit(0)` was passed), and `0`
 * under `SeizeMode::Transfer`. Read it from the simulation / tx result with
 * `decodeStellarLiquidateReturn`.
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarLiquidateTx(
  opts: StellarLendingBuilderOptions,
  args: StellarLiquidateArgs
): BuiltStellarTx {
  return buildTx(opts, 'liquidate', [
    addr(opts.caller),
    u64(args.accountNonce),
    tupleHubAssetAmountVec([...args.debtPayments]),
    seizeMode(args.seizeMode ?? 'Transfer'),
  ])
}

/**
 * Decode `liquidate`'s `u64` return value from its base64 XDR — the receiving
 * account id, as a decimal string. `'0'` means `SeizeMode::Transfer` (the
 * liquidator was paid in underlying tokens, no account was touched).
 *
 * Takes base64 XDR (as Soroban RPC delivers `returnValue` / `result.retval`)
 * so no live `xdr.ScVal` crosses the consumer boundary — same contract as
 * `decodeStellarLendingEvent`. Hold a parsed ScVal? Pass `toBase64Xdr(scv)`.
 */
export function decodeStellarLiquidateReturn(returnValueB64: string): string {
  const native = scValToNative(xdr.ScVal.fromXDR(returnValueB64, 'base64'))
  if (typeof native === 'bigint' || typeof native === 'number') {
    return native.toString()
  }
  throw new Error(
    `Stellar builder: liquidate return value must be a u64, got ${typeof native}`
  )
}

/**
 * flash_loan(caller, asset: HubAssetKey, amount: i128, receiver, data: Bytes)
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarFlashLoanTx(
  opts: StellarLendingBuilderOptions,
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
 * ABI: `migrate_from_blend(caller, account_id, spoke_id, hub_id, blend_pool,
 * collateral_assets, supply_assets, debt_caps: Vec<(Address, i128)>)`. Pass
 * `accountId = "0"` to open a new account. Each debt cap should slightly exceed
 * the live Blend debt — Blend refunds the excess, reconciled on-chain.
 *
 * Like every builder this emits an unsigned invoke; the nested `submit(from =
 * user)` authorization is materialized by `prepareTransaction` (simulation) and
 * signed by the wallet over the whole envelope. The Blend pool must be approved
 * by the controller. Use an explicit destination hub and spoke; this operation
 * does not consume aggregator route bytes.
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarMigrateFromBlendTx(
  opts: StellarLendingBuilderOptions,
  args: StellarMigrateFromBlendArgs
): BuiltStellarTx {
  return buildTx(opts, 'migrate_from_blend', [
    addr(opts.caller),
    u64(args.accountId),
    encodeSpokeId(args.spokeId),
    u32(args.hubId),
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarMultiplyTx(
  opts: StellarLendingBuilderOptions,
  args: StellarMultiplyArgs
): BuiltStellarTx {
  const accountId = args.accountNonce ?? 0

  return buildTx(opts, 'multiply', [
    addr(opts.caller),
    u64(accountId),
    encodeSpokeId(args.spokeId),
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarSwapDebtTx(
  opts: StellarLendingBuilderOptions,
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarSwapCollateralTx(
  opts: StellarLendingBuilderOptions,
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
 * @param opts - Network, caller, current source sequence and deployment addresses.
 * @param args - Operation arguments; token amounts are decimal base-unit strings.
 * @returns Unsigned XDR; prepare with prepareStellarBuiltTx before wallet signing.
 * @category Lending transactions
 */
export function buildStellarRepayDebtWithCollateralTx(
  opts: StellarLendingBuilderOptions,
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
