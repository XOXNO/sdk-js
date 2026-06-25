/**
 * Stellar lending governance (timelock) transaction builders. Each builder
 * returns an unsigned `BuiltStellarTx` XDR targeting the governance contract
 * (`opts.governanceAddress`, or env via `getStellarGovernance(network)`).
 *
 * Flow:
 *   - An admin holding the PROPOSER role calls the single `propose(proposer,
 *     op: AdminOperation, salt)` entrypoint. `proposer = opts.caller`; `op` is
 *     the serialized `AdminOperation` enum identifying the target setter and its
 *     args; `salt: BytesN<32>` is trailing. Validation runs at propose time and
 *     the call returns the operation id (`BytesN<32>`).
 *   - After the timelock delay, ANYONE executes. Controller-targeted ops go
 *     through the generic `execute(executor, target, function, args,
 *     predecessor, salt)`; governance-self ops go through `execute_self(executor,
 *     op: AdminOperation, salt)`. Open execution passes `executor = None`
 *     (Soroban `Option::None`, encoded as `scvVoid`).
 *   - `predecessor` is ALWAYS the 32-zero-byte `BytesN<32>` in this system.
 *
 * The on-chain scheduled `Operation` (target, function, args) is byte-identical
 * to the pre-enum typed proposers, so the operation id, the generic `execute`
 * path, and event indexing are unchanged. The `AdminOperation` enum only changes
 * the `propose` / `execute_self` call encoding, which these builders own.
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
import {
  addr,
  bool,
  bytesN,
  i128,
  scStruct,
  sym,
  u32,
  vec,
  voidVal,
} from './scval-encode'

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
// AdminOperation enum encoding
// -----------------------------------------------------------------------------

/**
 * Encode an `AdminOperation` enum value. At the XDR level a Soroban enum value
 * is `scvVec([scvSymbol(VariantName), ...payload])`: a unit variant carries only
 * the symbol, a single/tuple variant appends its fields in declaration order,
 * and a struct-carrying variant appends the single `scStruct(..)` payload. The
 * `VariantName` MUST match the Rust `AdminOperation` variant identifier exactly.
 */
const adminOp = (variant: string, ...payload: xdr.ScVal[]): xdr.ScVal =>
  vec([sym(variant), ...payload])

// Argument-struct encoders. The `scStruct` keys MUST be the Rust struct field
// names (snake_case); `scStruct` sorts them lexicographically into the `scvMap`
// layout the contract decodes. Builder arg interfaces stay camelCase.

const encodeEModeAssetArgs = (a: EModeAssetArgs): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    category_id: u32(a.categoryId),
    can_collateral: bool(a.canCollateral),
    can_borrow: bool(a.canBorrow),
    ltv: u32(a.ltv),
    threshold: u32(a.threshold),
    bonus: u32(a.bonus),
    supply_cap: i128(a.supplyCap),
    borrow_cap: i128(a.borrowCap),
  })

const encodePoolCapsArgs = (a: UpdatePoolCapsArgs): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    supply_cap: i128(a.supplyCap),
    borrow_cap: i128(a.borrowCap),
  })

const encodeRemoveAssetFromEModeArgs = (a: RemoveEModeAssetArgs): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    category_id: u32(a.categoryId),
  })

const encodeCreatePoolArgs = (a: CreateLiquidityPoolArgs): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    params: encodeMarketParamsRaw(a.params),
    config: encodeAssetConfigRaw(a.config),
  })

const encodeUpgradePoolParamsArgs = (
  a: UpgradeLiquidityPoolParamsArgs
): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    params: encodeInterestRateModel(a.params),
  })

const encodeTransferOwnershipArgs = (a: TransferOwnershipArgs): xdr.ScVal =>
  scStruct({
    new_owner: addr(a.newOwner),
    live_until_ledger: u32(a.liveUntilLedger),
  })

const encodeConfigureOracleArgs = (a: ConfigureMarketOracleArgs): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    cfg: encodeMarketOracleConfigInput(a.config),
  })

const encodeEditToleranceArgs = (a: EditOracleToleranceArgs): xdr.ScVal =>
  scStruct({
    asset: addr(a.asset),
    first_tolerance: u32(a.firstTolerance),
    last_tolerance: u32(a.lastTolerance),
  })

const encodeRoleArgs = (a: RoleGrantArgs): xdr.ScVal =>
  scStruct({
    account: addr(a.account),
    role: sym(a.role),
  })

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
 * Build a `propose(proposer, op, salt)` tx: `proposer = opts.caller`, then the
 * `AdminOperation`, then `salt`. The caller must hold PROPOSER and sign the tx.
 */
const buildPropose = (
  opts: StellarBuilderOptions,
  op: xdr.ScVal,
  salt: StellarGovernanceSalt
): BuiltStellarTx =>
  buildGovernanceTx(opts, 'propose', [addr(opts.caller), op, saltScVal(salt)])

/**
 * Build an `execute_self(executor, op, salt)` (governance-self) tx: `executor =
 * None`, then the `AdminOperation`, then `salt`. Open execution — any account
 * may sign. Self-target ops cannot use the generic `execute` (the timelock
 * rejects `target == governance` to avoid self-reentry).
 */
const buildExecuteSelf = (
  opts: StellarBuilderOptions,
  op: xdr.ScVal,
  salt: StellarGovernanceSalt
): BuiltStellarTx =>
  buildGovernanceTx(opts, 'execute_self', [voidVal(), op, saltScVal(salt)])

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
// CONTROLLER-targeted proposers — proposer + AdminOperation + salt
// -----------------------------------------------------------------------------

/** propose(SetAggregator(addr)) */
export function buildStellarProposeSetAggregatorTx(
  opts: StellarBuilderOptions,
  args: { aggregator: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('SetAggregator', addr(args.aggregator)), salt)
}

/** propose(SetAccumulator(addr)) */
export function buildStellarProposeSetAccumulatorTx(
  opts: StellarBuilderOptions,
  args: { accumulator: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('SetAccumulator', addr(args.accumulator)),
    salt
  )
}

/** propose(SetLiquidityPoolTemplate(hash)) */
export function buildStellarProposeSetPoolTemplateTx(
  opts: StellarBuilderOptions,
  args: { wasmHash: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('SetLiquidityPoolTemplate', bytesN(args.wasmHash)),
    salt
  )
}

/** propose(EditAssetConfig(asset, cfg)) */
export function buildStellarProposeEditAssetConfigTx(
  opts: StellarBuilderOptions,
  args: EditAssetConfigArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('EditAssetConfig', addr(args.asset), encodeAssetConfigRaw(args.config)),
    salt
  )
}

/** propose(SetPositionLimits(limits)) */
export function buildStellarProposeSetPositionLimitsTx(
  opts: StellarBuilderOptions,
  args: PositionLimitsDto,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('SetPositionLimits', encodePositionLimits(args)),
    salt
  )
}

/** propose(SetMinBorrowCollateralUsd(floor_wad)) */
export function buildStellarProposeSetMinBorrowCollatTx(
  opts: StellarBuilderOptions,
  args: { floorWad: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('SetMinBorrowCollateralUsd', i128(args.floorWad)),
    salt
  )
}

/** propose(AddEModeCategory) — risk params are per-asset */
export function buildStellarProposeAddEModeCategoryTx(
  opts: StellarBuilderOptions,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('AddEModeCategory'), salt)
}

/** propose(RemoveEModeCategory(id)) */
export function buildStellarProposeRemoveEModeCategoryTx(
  opts: StellarBuilderOptions,
  args: RemoveEModeCategoryArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('RemoveEModeCategory', u32(args.id)), salt)
}

/** propose(AddAssetToEModeCategory(EModeAssetArgs)) */
export function buildStellarProposeAddAssetToEModeTx(
  opts: StellarBuilderOptions,
  args: EModeAssetArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('AddAssetToEModeCategory', encodeEModeAssetArgs(args)),
    salt
  )
}

/** propose(EditAssetInEModeCategory(EModeAssetArgs)) */
export function buildStellarProposeEditAssetInEModeTx(
  opts: StellarBuilderOptions,
  args: EModeAssetArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('EditAssetInEModeCategory', encodeEModeAssetArgs(args)),
    salt
  )
}

/** propose(UpdatePoolCaps(PoolCapsArgs)) */
export function buildStellarProposeUpdatePoolCapsTx(
  opts: StellarBuilderOptions,
  args: UpdatePoolCapsArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('UpdatePoolCaps', encodePoolCapsArgs(args)),
    salt
  )
}

/** propose(RemoveAssetFromEMode(RemoveAssetFromEModeArgs)) */
export function buildStellarProposeRemoveAssetFromEModeTx(
  opts: StellarBuilderOptions,
  args: RemoveEModeAssetArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('RemoveAssetFromEMode', encodeRemoveAssetFromEModeArgs(args)),
    salt
  )
}

/** propose(ApproveToken(token)) */
export function buildStellarProposeApproveTokenTx(
  opts: StellarBuilderOptions,
  args: { token: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('ApproveToken', addr(args.token)), salt)
}

/** propose(RevokeToken(token)) */
export function buildStellarProposeRevokeTokenTx(
  opts: StellarBuilderOptions,
  args: { token: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('RevokeToken', addr(args.token)), salt)
}

/** propose(ApproveBlendPool(pool)) */
export function buildStellarProposeApproveBlendPoolTx(
  opts: StellarBuilderOptions,
  args: { pool: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('ApproveBlendPool', addr(args.pool)), salt)
}

/** propose(RevokeBlendPool(pool)) */
export function buildStellarProposeRevokeBlendPoolTx(
  opts: StellarBuilderOptions,
  args: { pool: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('RevokeBlendPool', addr(args.pool)), salt)
}

/** propose(CreateLiquidityPool(CreatePoolArgs)) */
export function buildStellarProposeCreateLiquidityPoolTx(
  opts: StellarBuilderOptions,
  args: CreateLiquidityPoolArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('CreateLiquidityPool', encodeCreatePoolArgs(args)),
    salt
  )
}

/** propose(UpgradeLiquidityPoolParams(UpgradePoolParamsArgs)) */
export function buildStellarProposeUpgradePoolParamsTx(
  opts: StellarBuilderOptions,
  args: UpgradeLiquidityPoolParamsArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('UpgradeLiquidityPoolParams', encodeUpgradePoolParamsArgs(args)),
    salt
  )
}

/** propose(DeployPool) */
export function buildStellarProposeDeployPoolTx(
  opts: StellarBuilderOptions,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('DeployPool'), salt)
}

/** propose(UpgradePool(hash)) */
export function buildStellarProposeUpgradePoolTx(
  opts: StellarBuilderOptions,
  args: { wasmHash: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('UpgradePool', bytesN(args.wasmHash)), salt)
}

/** propose(DisableTokenOracle(asset)) */
export function buildStellarProposeDisableTokenOracleTx(
  opts: StellarBuilderOptions,
  args: { asset: string },
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('DisableTokenOracle', addr(args.asset)),
    salt
  )
}

/** propose(UpgradeController(hash)) */
export function buildStellarProposeUpgradeControllerTx(
  opts: StellarBuilderOptions,
  args: UpgradeArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('UpgradeController', bytesN(args.wasmHash)),
    salt
  )
}

/** propose(MigrateController(new_version)) */
export function buildStellarProposeMigrateControllerTx(
  opts: StellarBuilderOptions,
  args: MigrateArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('MigrateController', u32(args.newVersion)),
    salt
  )
}

/** propose(TransferCtrlOwnership(TransferOwnershipArgs)) */
export function buildStellarProposeTransferCtrlOwnershipTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('TransferCtrlOwnership', encodeTransferOwnershipArgs(args)),
    salt
  )
}

/**
 * propose(ConfigureMarketOracle(ConfigureOracleArgs))
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
    adminOp('ConfigureMarketOracle', encodeConfigureOracleArgs(args)),
    salt
  )
}

/** propose(EditOracleTolerance(EditToleranceArgs)) */
export function buildStellarProposeEditOracleToleranceTx(
  opts: StellarBuilderOptions,
  args: EditOracleToleranceArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('EditOracleTolerance', encodeEditToleranceArgs(args)),
    salt
  )
}

// -----------------------------------------------------------------------------
// GOVERNANCE-self proposers — proposer + AdminOperation + salt
// -----------------------------------------------------------------------------

/** propose(UpgradeGov(hash)) */
export function buildStellarProposeGovernanceUpgradeTx(
  opts: StellarBuilderOptions,
  args: UpgradeArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('UpgradeGov', bytesN(args.wasmHash)), salt)
}

/** propose(UpdateGovDelay(new_delay)) */
export function buildStellarProposeUpdateDelayTx(
  opts: StellarBuilderOptions,
  args: UpdateDelayArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('UpdateGovDelay', u32(args.newDelay)), salt)
}

/** propose(GrantGovRole(RoleArgs)) */
export function buildStellarProposeGrantGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('GrantGovRole', encodeRoleArgs(args)), salt)
}

/** propose(RevokeGovRole(RoleArgs)) */
export function buildStellarProposeRevokeGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(opts, adminOp('RevokeGovRole', encodeRoleArgs(args)), salt)
}

/** propose(TransferGovOwnership(TransferOwnershipArgs)) */
export function buildStellarProposeTransferGovOwnTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildPropose(
    opts,
    adminOp('TransferGovOwnership', encodeTransferOwnershipArgs(args)),
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
   * SAME ScVals the matching proposal scheduled (the timelock hashes them into
   * the op id), in the controller method's arg order. Reconstructed via
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
 *
 * Unchanged by the AdminOperation refactor: the scheduled `Operation` is
 * byte-identical, so callers reconstruct `(target, function, argsXdr)` from the
 * indexed proposal exactly as before.
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

/** execute_self(executor=None, UpgradeGov(hash), salt) */
export function buildStellarGovernanceExecuteGovernanceUpgradeTx(
  opts: StellarBuilderOptions,
  args: UpgradeArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(opts, adminOp('UpgradeGov', bytesN(args.wasmHash)), salt)
}

/** execute_self(executor=None, UpdateGovDelay(new_delay), salt) */
export function buildStellarGovernanceExecuteUpdateDelayTx(
  opts: StellarBuilderOptions,
  args: UpdateDelayArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    adminOp('UpdateGovDelay', u32(args.newDelay)),
    salt
  )
}

/** execute_self(executor=None, GrantGovRole(RoleArgs), salt) */
export function buildStellarGovernanceExecuteGrantGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(opts, adminOp('GrantGovRole', encodeRoleArgs(args)), salt)
}

/** execute_self(executor=None, RevokeGovRole(RoleArgs), salt) */
export function buildStellarGovernanceExecuteRevokeGovernanceRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    adminOp('RevokeGovRole', encodeRoleArgs(args)),
    salt
  )
}

/** execute_self(executor=None, TransferGovOwnership(TransferOwnershipArgs), salt) */
export function buildStellarGovernanceExecuteTransferGovOwnTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs,
  salt: StellarGovernanceSalt
): BuiltStellarTx {
  return buildExecuteSelf(
    opts,
    adminOp('TransferGovOwnership', encodeTransferOwnershipArgs(args)),
    salt
  )
}
