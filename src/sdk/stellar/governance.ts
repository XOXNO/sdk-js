/**
 * Stellar lending governance (timelock) transaction builders. Each builder
 * returns an unsigned `BuiltStellarTx` XDR targeting the governance contract
 * (`opts.governanceAddress`, or env via `getStellarGovernance(network)`).
 *
 * Flow:
 *   - An admin holding the PROPOSER role calls a `propose_*` method. The
 *     leading arg is `proposer = opts.caller` (an `Address`); the remaining
 *     args mirror the matching controller setter exactly; the trailing arg is
 *     a `salt: BytesN<32>`. Validation runs at propose time; the call returns
 *     the operation id (`BytesN<32>`).
 *   - After the timelock delay, ANYONE executes. Controller-targeted ops go
 *     through the generic `execute(executor, target, function, args,
 *     predecessor, salt)`; governance-self ops go through typed `execute_*`.
 *     Open execution passes `executor = None` (Soroban `Option::None`, encoded
 *     as `scvVoid` — mirrors the lending `withdraw` builder's optional `to`).
 *   - `predecessor` is ALWAYS the 32-zero-byte `BytesN<32>` in this system.
 *
 * Builders are RPC-free and deterministic (synthetic `Account(caller,
 * sourceSequence)`), exactly like the lending / admin builders. The returned
 * XDR still needs `rpc.Server.prepareTransaction` before signing.
 */

import type { PositionLimitsDto } from '@xoxno/types'
import {
  Account,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'

import {
  encodeAssetConfigRaw,
  encodeInterestRateModel,
  encodeMarketOracleConfigInput,
  encodeMarketParamsRaw,
  encodePositionLimits,
  type ConfigureMarketOracleArgs,
  type CreateLiquidityPoolArgs,
  type EditAssetConfigArgs,
  type EditOracleToleranceArgs,
  type EModeAssetArgs,
  type RemoveEModeAssetArgs,
  type RoleGrantArgs,
  type TransferOwnershipArgs,
  type UpdatePoolCapsArgs,
  type UpgradeLiquidityPoolParamsArgs,
} from './admin'
import {
  getStellarGovernance,
  STELLAR_NETWORK_PASSPHRASE,
} from './contracts'
import type { BuiltStellarTx, StellarBuilderOptions } from './lending'
import { addr, bool, bytesN, i128, sym, u32, vec, voidVal } from './scval-encode'

// -----------------------------------------------------------------------------
// Salt / predecessor helpers
// -----------------------------------------------------------------------------

/**
 * A `salt: BytesN<32>` for a governance proposal/execution. Accepts a 32-byte
 * hex string (optionally `0x`-prefixed) or a 32-byte `Buffer`/`Uint8Array`.
 */
export type StellarGovernanceSalt = string | Buffer | Uint8Array

/** The 32-zero-byte `BytesN<32>` predecessor used for every op in this system. */
export const STELLAR_GOVERNANCE_ZERO_PREDECESSOR = '00'.repeat(32)

/**
 * Coerce a 32-byte hex string / Buffer / Uint8Array salt into a Soroban
 * `BytesN<32>` ScVal. Validates the length at the SDK boundary.
 */
const saltScVal = (salt: StellarGovernanceSalt): xdr.ScVal => {
  if (typeof salt === 'string') return bytesN(salt)
  const buf = Buffer.from(salt)
  if (buf.length !== 32) {
    throw new Error(
      `Stellar governance builder: expected a 32-byte salt (got ${buf.length} bytes)`
    )
  }
  return xdr.ScVal.scvBytes(buf)
}

// -----------------------------------------------------------------------------
// Governance transaction assembly
// -----------------------------------------------------------------------------

/**
 * Assemble an unsigned XDR invoking a single method on the GOVERNANCE contract.
 * Mirrors `buildTx` (lending.ts) but resolves `opts.governanceAddress` instead
 * of the controller address. RPC-free + deterministic.
 */
function buildGovernanceTx(
  opts: StellarBuilderOptions,
  method: string,
  params: xdr.ScVal[]
): BuiltStellarTx {
  const governanceId =
    opts.governanceAddress ?? getStellarGovernance(opts.network)
  const contract = new Contract(governanceId)

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

/**
 * Build a `propose_*` tx: `proposer = opts.caller`, then the controller-setter
 * args, then `salt`. The caller must hold the PROPOSER role and sign the tx.
 */
const buildPropose = (
  opts: StellarBuilderOptions,
  method: string,
  args: xdr.ScVal[],
  salt: StellarGovernanceSalt
): BuiltStellarTx =>
  buildGovernanceTx(opts, method, [addr(opts.caller), ...args, saltScVal(salt)])

/**
 * Build an `execute_*` (governance-self) tx: `executor = None`, then the typed
 * args, then `salt`. Open execution — any account may sign.
 */
const buildExecuteSelf = (
  opts: StellarBuilderOptions,
  method: string,
  args: xdr.ScVal[],
  salt: StellarGovernanceSalt
): BuiltStellarTx =>
  buildGovernanceTx(opts, method, [voidVal(), ...args, saltScVal(salt)])

// -----------------------------------------------------------------------------
// Builder argument shapes (SDK-local)
// -----------------------------------------------------------------------------

export interface RemoveEModeCategoryArgs {
  id: number
}
export interface UpgradeArgs {
  wasmHash: string
}
export interface MigrateArgs {
  newVersion: number
}
export interface UpdateDelayArgs {
  newDelay: number
}

// -----------------------------------------------------------------------------
// CONTROLLER-targeted proposers (forward.rs) — proposer + controller args + salt
// -----------------------------------------------------------------------------

/** propose_set_aggregator(proposer, addr: Address, salt) */
export function buildStellarProposeSetAggregatorTx(
  opts: StellarBuilderOptions,
  args: { aggregator: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, 'propose_set_aggregator', [addr(args.aggregator)], salt)
}

/** propose_set_accumulator(proposer, addr: Address, salt) */
export function buildStellarProposeSetAccumulatorTx(
  opts: StellarBuilderOptions,
  args: { accumulator: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_set_accumulator',
    [addr(args.accumulator)],
    salt
  )
}

/** propose_set_pool_template(proposer, hash: BytesN<32>, salt) */
export function buildStellarProposeSetPoolTemplateTx(
  opts: StellarBuilderOptions,
  args: { wasmHash: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_set_pool_template',
    [bytesN(args.wasmHash)],
    salt
  )
}

/** propose_edit_asset_config(proposer, asset: Address, cfg: AssetConfigRaw, salt) */
export function buildStellarProposeEditAssetConfigTx(
  opts: StellarBuilderOptions,
  args: EditAssetConfigArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_edit_asset_config',
    [addr(args.asset), encodeAssetConfigRaw(args.config)],
    salt
  )
}

/** propose_set_position_limits(proposer, limits: PositionLimits, salt) */
export function buildStellarProposeSetPositionLimitsTx(
  opts: StellarBuilderOptions,
  args: PositionLimitsDto,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_set_position_limits',
    [encodePositionLimits(args)],
    salt
  )
}

/** propose_set_min_borrow_collat(proposer, floor_wad: i128, salt) */
export function buildStellarProposeSetMinBorrowCollatTx(
  opts: StellarBuilderOptions,
  args: { floorWad: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_set_min_borrow_collat',
    [i128(args.floorWad)],
    salt
  )
}

/** propose_add_e_mode_category(proposer, salt) — risk params are per-asset */
export function buildStellarProposeAddEModeCategoryTx(
  opts: StellarBuilderOptions,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, 'propose_add_e_mode_category', [], salt)
}

/** propose_remove_e_mode_category(proposer, id: u32, salt) */
export function buildStellarProposeRemoveEModeCategoryTx(
  opts: StellarBuilderOptions,
  args: RemoveEModeCategoryArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_remove_e_mode_category',
    [u32(args.id)],
    salt
  )
}

/** propose_add_asset_to_e_mode(proposer, asset, category_id, can_collateral, can_borrow, ltv, threshold, bonus, supply_cap, borrow_cap, salt) */
export function buildStellarProposeAddAssetToEModeTx(
  opts: StellarBuilderOptions,
  args: EModeAssetArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_add_asset_to_e_mode',
    [
      addr(args.asset),
      u32(args.categoryId),
      bool(args.canCollateral),
      bool(args.canBorrow),
      u32(args.ltv),
      u32(args.threshold),
      u32(args.bonus),
      i128(args.supplyCap),
      i128(args.borrowCap),
    ],
    salt
  )
}

/** propose_edit_asset_in_e_mode(proposer, asset, category_id, can_collateral, can_borrow, ltv, threshold, bonus, supply_cap, borrow_cap, salt) */
export function buildStellarProposeEditAssetInEModeTx(
  opts: StellarBuilderOptions,
  args: EModeAssetArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_edit_asset_in_e_mode',
    [
      addr(args.asset),
      u32(args.categoryId),
      bool(args.canCollateral),
      bool(args.canBorrow),
      u32(args.ltv),
      u32(args.threshold),
      u32(args.bonus),
      i128(args.supplyCap),
      i128(args.borrowCap),
    ],
    salt
  )
}

/** propose_update_pool_caps(proposer, asset, supply_cap, borrow_cap, salt) */
export function buildStellarProposeUpdatePoolCapsTx(
  opts: StellarBuilderOptions,
  args: UpdatePoolCapsArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_update_pool_caps',
    [addr(args.asset), i128(args.supplyCap), i128(args.borrowCap)],
    salt
  )
}

/** propose_remove_asset_from_e_mode(proposer, asset: Address, category_id: u32, salt) */
export function buildStellarProposeRemoveAssetFromEModeTx(
  opts: StellarBuilderOptions,
  args: RemoveEModeAssetArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_remove_asset_from_e_mode',
    [addr(args.asset), u32(args.categoryId)],
    salt
  )
}

/** propose_approve_token(proposer, token: Address, salt) */
export function buildStellarProposeApproveTokenTx(
  opts: StellarBuilderOptions,
  args: { token: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, 'propose_approve_token', [addr(args.token)], salt)
}

/** propose_revoke_token(proposer, token: Address, salt) */
export function buildStellarProposeRevokeTokenTx(
  opts: StellarBuilderOptions,
  args: { token: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, 'propose_revoke_token', [addr(args.token)], salt)
}

/** propose_create_liquidity_pool(proposer, asset, params: MarketParamsRaw, config: AssetConfigRaw, salt) */
export function buildStellarProposeCreateLiquidityPoolTx(
  opts: StellarBuilderOptions,
  args: CreateLiquidityPoolArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_create_liquidity_pool',
    [
      addr(args.asset),
      encodeMarketParamsRaw(args.params),
      encodeAssetConfigRaw(args.config),
    ],
    salt
  )
}

/** propose_upgrade_pool_params(proposer, asset, params: InterestRateModel, salt) */
export function buildStellarProposeUpgradePoolParamsTx(
  opts: StellarBuilderOptions,
  args: UpgradeLiquidityPoolParamsArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_upgrade_pool_params',
    [addr(args.asset), encodeInterestRateModel(args.params)],
    salt
  )
}

/** propose_deploy_pool(proposer, salt) */
export function buildStellarProposeDeployPoolTx(
  opts: StellarBuilderOptions,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, 'propose_deploy_pool', [], salt)
}

/** propose_upgrade_pool(proposer, new_wasm_hash: BytesN<32>, salt) */
export function buildStellarProposeUpgradePoolTx(
  opts: StellarBuilderOptions,
  args: { wasmHash: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_upgrade_pool',
    [bytesN(args.wasmHash)],
    salt
  )
}

/** propose_grant_controller_role(proposer, account: Address, role: Symbol, salt) */
export function buildStellarProposeGrantControllerRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_grant_controller_role',
    [addr(args.account), sym(args.role)],
    salt
  )
}

/** propose_revoke_controller_role(proposer, account: Address, role: Symbol, salt) */
export function buildStellarProposeRevokeControllerRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_revoke_controller_role',
    [addr(args.account), sym(args.role)],
    salt
  )
}

/** propose_upgrade_controller(proposer, new_wasm_hash: BytesN<32>, salt) */
export function buildStellarProposeUpgradeControllerTx(
  opts: StellarBuilderOptions,
  args: UpgradeArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_upgrade_controller',
    [bytesN(args.wasmHash)],
    salt
  )
}

/** propose_migrate_controller(proposer, new_version: u32, salt) */
export function buildStellarProposeMigrateControllerTx(
  opts: StellarBuilderOptions,
  args: MigrateArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_migrate_controller',
    [u32(args.newVersion)],
    salt
  )
}

/** propose_transfer_ctrl_ownership(proposer, new_owner: Address, live_until_ledger: u32, salt) */
export function buildStellarProposeTransferCtrlOwnershipTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_transfer_ctrl_ownership',
    [addr(args.newOwner), u32(args.liveUntilLedger)],
    salt
  )
}

/**
 * propose_configure_market_oracle(proposer, asset, cfg: MarketOracleConfigInput, salt)
 *
 * The SDK passes the oracle INPUT args verbatim; the contract resolves the
 * input to a resolved config at propose time (do NOT resolve in the SDK).
 */
export function buildStellarProposeConfigureMarketOracleTx(
  opts: StellarBuilderOptions,
  args: ConfigureMarketOracleArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_configure_market_oracle',
    [addr(args.asset), encodeMarketOracleConfigInput(args.config)],
    salt
  )
}

/** propose_edit_oracle_tolerance(proposer, asset, first_tolerance_bps: u32, last_tolerance_bps: u32, salt) */
export function buildStellarProposeEditOracleToleranceTx(
  opts: StellarBuilderOptions,
  args: EditOracleToleranceArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_edit_oracle_tolerance',
    [addr(args.asset), u32(args.firstTolerance), u32(args.lastTolerance)],
    salt
  )
}

// -----------------------------------------------------------------------------
// GOVERNANCE-self proposers (self_timelock.rs) — proposer + typed args + salt
// -----------------------------------------------------------------------------

/** propose_governance_upgrade(proposer, new_wasm_hash: BytesN<32>, salt) */
export function buildStellarProposeGovernanceUpgradeTx(
  opts: StellarBuilderOptions,
  args: UpgradeArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_governance_upgrade',
    [bytesN(args.wasmHash)],
    salt
  )
}

/** propose_update_delay(proposer, new_delay: u32, salt) */
export function buildStellarProposeUpdateDelayTx(
  opts: StellarBuilderOptions,
  args: UpdateDelayArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_update_delay',
    [u32(args.newDelay)],
    salt
  )
}

/** propose_grant_governance_role(proposer, account: Address, role: Symbol, salt) */
export function buildStellarProposeGrantGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_grant_governance_role',
    [addr(args.account), sym(args.role)],
    salt
  )
}

/** propose_revoke_governance_role(proposer, account: Address, role: Symbol, salt) */
export function buildStellarProposeRevokeGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_revoke_governance_role',
    [addr(args.account), sym(args.role)],
    salt
  )
}

/** propose_transfer_gov_own(proposer, new_owner: Address, live_until_ledger: u32, salt) */
export function buildStellarProposeTransferGovOwnTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    'propose_transfer_gov_own',
    [addr(args.newOwner), u32(args.liveUntilLedger)],
    salt
  )
}

// -----------------------------------------------------------------------------
// Execution — open (executor = None)
// -----------------------------------------------------------------------------

export interface StellarGovernanceExecuteArgs {
  /** Controller (or other) contract the scheduled op targets. */
  target: string
  /** Controller method name → Soroban `Symbol`. */
  functionName: string
  /**
   * The controller-call args, each a base64 ScVal XDR string. These must be the
   * SAME ScVals the matching `propose_*` scheduled (the timelock hashes them
   * into the op id), in the controller method's arg order. Reconstructed via
   * `xdr.ScVal.fromXDR(s, 'base64')`.
   */
  argsXdr: string[]
  /** `salt: BytesN<32>` — the same salt used at propose time. */
  salt: StellarGovernanceSalt
  /**
   * `predecessor: BytesN<32>` — defaults to the 32-zero-byte value used for
   * every op in this system. Override only if a non-zero predecessor is used.
   */
  predecessor?: StellarGovernanceSalt
}

/**
 * Generic `execute(executor, target, function, args, predecessor, salt)` for a
 * controller-targeted op. `executor = None` (open execution), `target` is the
 * controller `Address`, `function` is a `Symbol`, `args` is the `Vec<Val>`
 * reconstructed from `argsXdr`, `predecessor` defaults to 32 zero bytes.
 */
export function buildStellarGovernanceExecuteTx(
  opts: StellarBuilderOptions,
  args: StellarGovernanceExecuteArgs
): BuiltStellarTx {
  const callArgs = vec(
    args.argsXdr.map((s) => xdr.ScVal.fromXDR(s, 'base64'))
  )
  const predecessor = saltScVal(
    args.predecessor ?? STELLAR_GOVERNANCE_ZERO_PREDECESSOR
  )
  return buildGovernanceTx(opts, 'execute', [
    voidVal(),
    addr(args.target),
    sym(args.functionName),
    callArgs,
    predecessor,
    saltScVal(args.salt),
  ])
}

/** execute_governance_upgrade(executor=None, new_wasm_hash: BytesN<32>, salt) */
export function buildStellarGovernanceExecuteGovernanceUpgradeTx(
  opts: StellarBuilderOptions,
  args: UpgradeArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    'execute_governance_upgrade',
    [bytesN(args.wasmHash)],
    salt
  )
}

/** execute_update_delay(executor=None, new_delay: u32, salt) */
export function buildStellarGovernanceExecuteUpdateDelayTx(
  opts: StellarBuilderOptions,
  args: UpdateDelayArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    'execute_update_delay',
    [u32(args.newDelay)],
    salt
  )
}

/** execute_grant_governance_role(executor=None, account: Address, role: Symbol, salt) */
export function buildStellarGovernanceExecuteGrantGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    'execute_grant_governance_role',
    [addr(args.account), sym(args.role)],
    salt
  )
}

/** execute_revoke_governance_role(executor=None, account: Address, role: Symbol, salt) */
export function buildStellarGovernanceExecuteRevokeGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    'execute_revoke_governance_role',
    [addr(args.account), sym(args.role)],
    salt
  )
}

/** execute_transfer_gov_own(executor=None, new_owner: Address, live_until_ledger: u32, salt) */
export function buildStellarGovernanceExecuteTransferGovOwnTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    'execute_transfer_gov_own',
    [addr(args.newOwner), u32(args.liveUntilLedger)],
    salt
  )
}
