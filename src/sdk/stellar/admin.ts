/**
 * Stellar lending admin / config / keeper / access transaction builders. Each
 * builder returns an unsigned `BuiltStellarTx` XDR.
 *
 * Auth model:
 *   - `#[only_owner]` methods take no `caller` param — the tx source
 *     (`opts.caller`) must be the contract owner.
 *   - `#[only_role(caller, "ROLE")]` and caller-taking methods encode
 *     `opts.caller` as the leading `Address` arg; that account must hold the
 *     role and sign the tx.
 */

import type {
  AssetConfigRawDto,
  InterestRateModelDto,
  MarketOracleConfigInputDto,
  MarketParamsRawDto,
  OracleSourceConfigInputDto,
  PositionLimitsDto,
} from '@xoxno/types'

// String-enum shapes referenced via the DTOs' field types, since `@xoxno/types`
// does not re-export those enums on its top-level surface.
type OracleAssetRefInput = NonNullable<OracleSourceConfigInputDto['asset']>
type OracleReadModeInput = OracleSourceConfigInputDto['readMode']

import {
  addr,
  bool,
  bytesN,
  i128,
  scStruct,
  str,
  sym,
  u32,
  u64,
  vec,
} from './scval-encode'
import { buildTx, type BuiltStellarTx, type StellarBuilderOptions } from './lending'
import { xdr } from '@stellar/stellar-sdk'

// -----------------------------------------------------------------------------
// Enum string-value constants — the runtime values of the `@xoxno/types` string
// enums, referenced without importing them at runtime.
// -----------------------------------------------------------------------------

const ORACLE_STRATEGY_U32: Record<string, number> = {
  Single: 0,
  PrimaryWithAnchor: 1,
}
const PROVIDER_REFLECTOR = 'ReflectorSep40'
const PROVIDER_REDSTONE = 'RedStonePriceFeed'
const READ_MODE_TWAP = 'Twap'
const ASSET_REF_STELLAR = 'Stellar'
const ASSET_REF_SYMBOL = 'Symbol'
const ASSET_REF_STRING = 'String'

// -----------------------------------------------------------------------------
// Complex struct / union encoders
// -----------------------------------------------------------------------------

/** `InterestRateModel` — 8 RAY rates + reserve factor bps. */
export const encodeInterestRateModel = (m: InterestRateModelDto): xdr.ScVal =>
  scStruct({
    base_borrow_rate_ray: i128(m.baseBorrowRateRay),
    max_borrow_rate_ray: i128(m.maxBorrowRateRay),
    max_utilization_ray: i128(m.maxUtilizationRay),
    mid_utilization_ray: i128(m.midUtilizationRay),
    optimal_utilization_ray: i128(m.optimalUtilizationRay),
    reserve_factor_bps: u32(m.reserveFactorBps),
    slope1_ray: i128(m.slope1Ray),
    slope2_ray: i128(m.slope2Ray),
    slope3_ray: i128(m.slope3Ray),
  })

/** `MarketParamsRaw` — `InterestRateModel` plus the pool asset identity. */
export const encodeMarketParamsRaw = (p: MarketParamsRawDto): xdr.ScVal =>
  scStruct({
    asset_decimals: u32(p.assetDecimals),
    asset_id: addr(p.assetId),
    base_borrow_rate_ray: i128(p.baseBorrowRateRay),
    borrow_cap: i128(p.borrowCap),
    max_borrow_rate_ray: i128(p.maxBorrowRateRay),
    max_utilization_ray: i128(p.maxUtilizationRay),
    mid_utilization_ray: i128(p.midUtilizationRay),
    optimal_utilization_ray: i128(p.optimalUtilizationRay),
    reserve_factor_bps: u32(p.reserveFactorBps),
    slope1_ray: i128(p.slope1Ray),
    slope2_ray: i128(p.slope2Ray),
    slope3_ray: i128(p.slope3Ray),
    supply_cap: i128(p.supplyCap),
  })

/** `AssetConfigRaw` — risk flags and e-mode membership (hub caps live on pool params). */
export const encodeAssetConfigRaw = (c: AssetConfigRawDto): xdr.ScVal =>
  scStruct({
    // The contract's `AssetConfigRaw` carries `asset_decimals`, but the value is
    // derived on-chain and ignored on input: `create_liquidity_pool` copies it
    // from the pool's `MarketParamsRaw` and `edit_asset_config` preserves the
    // stored value. The field must still be present, or the 10-field struct
    // decodes as a 9-entry map and traps host-side with `Object/UnexpectedSize`.
    asset_decimals: u32(0),
    e_mode_categories: vec(c.eModeCategories.map((id) => u32(id))),
    flashloan_fee_bps: u32(c.flashloanFeeBps),
    is_borrowable: bool(c.isBorrowable),
    is_collateralizable: bool(c.isCollateralizable),
    is_flashloanable: bool(c.isFlashloanable),
    liquidation_bonus_bps: u32(c.liquidationBonusBps),
    liquidation_fees_bps: u32(c.liquidationFeesBps),
    liquidation_threshold_bps: u32(c.liquidationThresholdBps),
    loan_to_value_bps: u32(c.loanToValueBps),
  })

/** `PositionLimits` — per-account supply/borrow position caps. */
export const encodePositionLimits = (l: PositionLimitsDto): xdr.ScVal =>
  scStruct({
    max_borrow_positions: u32(l.maxBorrowPositions),
    max_supply_positions: u32(l.maxSupplyPositions),
  })

/** `OracleAssetRef` data-enum — `Stellar(Address)` | `Symbol(Symbol)` | `String(String)`. */
const encodeOracleAssetRef = (ref: OracleAssetRefInput): xdr.ScVal => {
  const kind = ref.kind as string
  switch (kind) {
    case ASSET_REF_STELLAR:
      return vec([sym('Stellar'), addr(ref.value)])
    case ASSET_REF_SYMBOL:
      return vec([sym('Symbol'), sym(ref.value)])
    case ASSET_REF_STRING:
      return vec([sym('String'), str(ref.value)])
    default:
      throw new Error(`Stellar builder: unknown oracle asset ref kind "${kind}"`)
  }
}

/** `OracleReadMode` data-enum — `Spot` | `Twap(u32 records)`. */
const encodeOracleReadMode = (
  readMode: OracleReadModeInput,
  twapRecords: number | undefined
): xdr.ScVal => {
  if ((readMode as string) === READ_MODE_TWAP) {
    if (typeof twapRecords !== 'number') {
      throw new Error(
        'Stellar builder: oracle source with Twap read mode requires `twapRecords`'
      )
    }
    return vec([sym('Twap'), u32(twapRecords)])
  }
  return vec([sym('Spot')])
}

/** `OracleSourceConfigInput` data-enum — `Reflector(...)` | `RedStone(...)`. */
export const encodeOracleSourceConfigInput = (
  src: OracleSourceConfigInputDto
): xdr.ScVal => {
  const provider = src.provider as string
  if (provider === PROVIDER_REFLECTOR) {
    if (!src.asset) {
      throw new Error('Stellar builder: Reflector oracle source requires `asset`')
    }
    return vec([
      sym('Reflector'),
      scStruct({
        asset: encodeOracleAssetRef(src.asset),
        contract: addr(src.contract),
        read_mode: encodeOracleReadMode(src.readMode, src.twapRecords),
      }),
    ])
  }
  if (provider === PROVIDER_REDSTONE) {
    if (typeof src.feedId !== 'string') {
      throw new Error('Stellar builder: RedStone oracle source requires `feedId`')
    }
    if (typeof src.maxStaleSeconds !== 'number') {
      throw new Error(
        'Stellar builder: RedStone oracle source requires `maxStaleSeconds`'
      )
    }
    return vec([
      sym('RedStone'),
      scStruct({
        contract: addr(src.contract),
        feed_id: str(src.feedId),
        max_stale_seconds: u64(src.maxStaleSeconds),
      }),
    ])
  }
  throw new Error(`Stellar builder: unknown oracle provider "${provider}"`)
}

/**
 * `OracleSourceConfigInputOption` — the contract's CUSTOM `None`/`Some` tagged
 * union (NOT a Soroban `Option`), so it encodes as `scvVec([sym("None")])` or
 * `scvVec([sym("Some"), <source>])`.
 */
const encodeOracleSourceConfigInputOption = (
  anchor: OracleSourceConfigInputDto | undefined
): xdr.ScVal =>
  anchor === undefined || anchor === null
    ? vec([sym('None')])
    : vec([sym('Some'), encodeOracleSourceConfigInput(anchor)])

/** `MarketOracleConfigInput` — strategy + primary/anchor sources + sanity bounds. */
export const encodeMarketOracleConfigInput = (
  cfg: MarketOracleConfigInputDto
): xdr.ScVal => {
  const strategy = ORACLE_STRATEGY_U32[cfg.strategy as string]
  if (strategy === undefined) {
    throw new Error(`Stellar builder: unknown oracle strategy "${cfg.strategy}"`)
  }
  return scStruct({
    anchor: encodeOracleSourceConfigInputOption(cfg.anchor),
    first_tolerance_bps: u32(cfg.firstToleranceBps),
    last_tolerance_bps: u32(cfg.lastToleranceBps),
    max_price_stale_seconds: u64(cfg.maxPriceStaleSeconds),
    max_sanity_price_wad: i128(cfg.maxSanityPriceWad),
    min_sanity_price_wad: i128(cfg.minSanityPriceWad),
    primary: encodeOracleSourceConfigInput(cfg.primary),
    strategy: u32(strategy),
  })
}

// -----------------------------------------------------------------------------
// Builder argument shapes (SDK-local — the on-chain structs live in @xoxno/types)
// -----------------------------------------------------------------------------

export interface RoleGrantArgs {
  account: string
  role: string
}
export interface TransferOwnershipArgs {
  newOwner: string
  liveUntilLedger: number
}
export interface EditAssetConfigArgs {
  asset: string
  config: AssetConfigRawDto
}
export interface EModeAssetArgs {
  asset: string
  categoryId: number
  canCollateral: boolean
  canBorrow: boolean
  ltv: number
  threshold: number
  bonus: number
  supplyCap: string
  borrowCap: string
}
export interface UpdatePoolCapsArgs {
  asset: string
  supplyCap: string
  borrowCap: string
}
export interface RemoveEModeAssetArgs {
  asset: string
  categoryId: number
}
export interface ConfigureMarketOracleArgs {
  asset: string
  config: MarketOracleConfigInputDto
}
export interface EditOracleToleranceArgs {
  asset: string
  firstTolerance: number
  lastTolerance: number
}
export interface CreateLiquidityPoolArgs {
  asset: string
  params: MarketParamsRawDto
  config: AssetConfigRawDto
}
export interface UpgradeLiquidityPoolParamsArgs {
  asset: string
  params: InterestRateModelDto
}
export interface UpgradeLiquidityPoolArgs {
  asset: string
  wasmHash: string
}
export interface RewardEntry {
  token: string
  amount: string
}
export interface UpdateAccountThresholdArgs {
  asset: string
  hasRisks: boolean
  accountNonces: number[]
}

// -----------------------------------------------------------------------------
// Access control (access.rs) — #[only_owner] unless noted
// -----------------------------------------------------------------------------

/** upgrade(new_wasm_hash: BytesN<32>) */
export function buildStellarUpgradeControllerTx(
  opts: StellarBuilderOptions,
  args: { wasmHash: string }
): BuiltStellarTx {
  return buildTx(opts, 'upgrade', [bytesN(args.wasmHash)])
}

/** migrate(new_version: u32) */
export function buildStellarMigrateTx(
  opts: StellarBuilderOptions,
  args: { newVersion: number }
): BuiltStellarTx {
  return buildTx(opts, 'migrate', [u32(args.newVersion)])
}

/** pause() */
export function buildStellarPauseTx(opts: StellarBuilderOptions): BuiltStellarTx {
  return buildTx(opts, 'pause', [])
}

/** unpause() */
export function buildStellarUnpauseTx(
  opts: StellarBuilderOptions
): BuiltStellarTx {
  return buildTx(opts, 'unpause', [])
}

/** grant_role(account: Address, role: Symbol) */
export function buildStellarGrantRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs
): BuiltStellarTx {
  return buildTx(opts, 'grant_role', [addr(args.account), sym(args.role)])
}

/** revoke_role(account: Address, role: Symbol) */
export function buildStellarRevokeRoleTx(
  opts: StellarBuilderOptions,
  args: RoleGrantArgs
): BuiltStellarTx {
  return buildTx(opts, 'revoke_role', [addr(args.account), sym(args.role)])
}

/** transfer_ownership(new_owner: Address, live_until_ledger: u32) */
export function buildStellarTransferOwnershipTx(
  opts: StellarBuilderOptions,
  args: TransferOwnershipArgs
): BuiltStellarTx {
  return buildTx(opts, 'transfer_ownership', [
    addr(args.newOwner),
    u32(args.liveUntilLedger),
  ])
}

/** accept_ownership() */
export function buildStellarAcceptOwnershipTx(
  opts: StellarBuilderOptions
): BuiltStellarTx {
  return buildTx(opts, 'accept_ownership', [])
}

// -----------------------------------------------------------------------------
// Config (config.rs)
// -----------------------------------------------------------------------------

/** set_aggregator(addr: Address) — #[only_owner] */
export function buildStellarSetAggregatorTx(
  opts: StellarBuilderOptions,
  args: { aggregator: string }
): BuiltStellarTx {
  return buildTx(opts, 'set_aggregator', [addr(args.aggregator)])
}

/** set_accumulator(addr: Address) — #[only_owner] */
export function buildStellarSetAccumulatorTx(
  opts: StellarBuilderOptions,
  args: { accumulator: string }
): BuiltStellarTx {
  return buildTx(opts, 'set_accumulator', [addr(args.accumulator)])
}

/** set_liquidity_pool_template(hash: BytesN<32>) — #[only_owner] */
export function buildStellarSetLiquidityPoolTemplateTx(
  opts: StellarBuilderOptions,
  args: { wasmHash: string }
): BuiltStellarTx {
  return buildTx(opts, 'set_liquidity_pool_template', [bytesN(args.wasmHash)])
}

/** edit_asset_config(asset: Address, cfg: AssetConfigRaw) — #[only_owner] */
export function buildStellarEditAssetConfigTx(
  opts: StellarBuilderOptions,
  args: EditAssetConfigArgs
): BuiltStellarTx {
  return buildTx(opts, 'edit_asset_config', [
    addr(args.asset),
    encodeAssetConfigRaw(args.config),
  ])
}

/** set_position_limits(limits: PositionLimits) — #[only_owner] */
export function buildStellarSetPositionLimitsTx(
  opts: StellarBuilderOptions,
  args: PositionLimitsDto
): BuiltStellarTx {
  return buildTx(opts, 'set_position_limits', [encodePositionLimits(args)])
}

/** add_e_mode_category() -> u32 — #[only_owner]. Risk params are per-asset. */
export function buildStellarAddEModeCategoryTx(
  opts: StellarBuilderOptions
): BuiltStellarTx {
  return buildTx(opts, 'add_e_mode_category', [])
}

/** remove_e_mode_category(id: u32) — #[only_owner] */
export function buildStellarRemoveEModeCategoryTx(
  opts: StellarBuilderOptions,
  args: { id: number }
): BuiltStellarTx {
  return buildTx(opts, 'remove_e_mode_category', [u32(args.id)])
}

/** add_asset_to_e_mode_category(asset, category_id, can_collateral, can_borrow, ltv, threshold, bonus, supply_cap, borrow_cap) — #[only_owner] */
export function buildStellarAddAssetToEModeCategoryTx(
  opts: StellarBuilderOptions,
  args: EModeAssetArgs
): BuiltStellarTx {
  return buildTx(opts, 'add_asset_to_e_mode_category', [
    addr(args.asset),
    u32(args.categoryId),
    bool(args.canCollateral),
    bool(args.canBorrow),
    u32(args.ltv),
    u32(args.threshold),
    u32(args.bonus),
    i128(args.supplyCap),
    i128(args.borrowCap),
  ])
}

/** edit_asset_in_e_mode_category(asset, category_id, can_collateral, can_borrow, ltv, threshold, bonus, supply_cap, borrow_cap) — #[only_owner] */
export function buildStellarEditAssetInEModeCategoryTx(
  opts: StellarBuilderOptions,
  args: EModeAssetArgs
): BuiltStellarTx {
  return buildTx(opts, 'edit_asset_in_e_mode_category', [
    addr(args.asset),
    u32(args.categoryId),
    bool(args.canCollateral),
    bool(args.canBorrow),
    u32(args.ltv),
    u32(args.threshold),
    u32(args.bonus),
    i128(args.supplyCap),
    i128(args.borrowCap),
  ])
}

/** update_pool_caps(asset, supply_cap, borrow_cap) — #[only_owner] */
export function buildStellarUpdatePoolCapsTx(
  opts: StellarBuilderOptions,
  args: UpdatePoolCapsArgs
): BuiltStellarTx {
  return buildTx(opts, 'update_pool_caps', [
    addr(args.asset),
    i128(args.supplyCap),
    i128(args.borrowCap),
  ])
}

/** remove_asset_from_e_mode(asset: Address, category_id: u32) — #[only_owner] */
export function buildStellarRemoveAssetFromEModeTx(
  opts: StellarBuilderOptions,
  args: RemoveEModeAssetArgs
): BuiltStellarTx {
  return buildTx(opts, 'remove_asset_from_e_mode', [
    addr(args.asset),
    u32(args.categoryId),
  ])
}

/** approve_token(token: Address) — #[only_owner] */
export function buildStellarApproveTokenTx(
  opts: StellarBuilderOptions,
  args: { token: string }
): BuiltStellarTx {
  return buildTx(opts, 'approve_token', [addr(args.token)])
}

/** revoke_token(token: Address) — #[only_owner] */
export function buildStellarRevokeTokenTx(
  opts: StellarBuilderOptions,
  args: { token: string }
): BuiltStellarTx {
  return buildTx(opts, 'revoke_token', [addr(args.token)])
}

/** configure_market_oracle(caller, asset, cfg) — #[only_role(caller, "ORACLE")] */
export function buildStellarConfigureMarketOracleTx(
  opts: StellarBuilderOptions,
  args: ConfigureMarketOracleArgs
): BuiltStellarTx {
  return buildTx(opts, 'configure_market_oracle', [
    addr(opts.caller),
    addr(args.asset),
    encodeMarketOracleConfigInput(args.config),
  ])
}

/** edit_oracle_tolerance(caller, asset, first_tolerance, last_tolerance) — #[only_role(caller, "ORACLE")] */
export function buildStellarEditOracleToleranceTx(
  opts: StellarBuilderOptions,
  args: EditOracleToleranceArgs
): BuiltStellarTx {
  return buildTx(opts, 'edit_oracle_tolerance', [
    addr(opts.caller),
    addr(args.asset),
    u32(args.firstTolerance),
    u32(args.lastTolerance),
  ])
}

/** disable_token_oracle(caller, asset) — #[only_role(caller, "ORACLE")] */
export function buildStellarDisableTokenOracleTx(
  opts: StellarBuilderOptions,
  args: { asset: string }
): BuiltStellarTx {
  return buildTx(opts, 'disable_token_oracle', [
    addr(opts.caller),
    addr(args.asset),
  ])
}

// -----------------------------------------------------------------------------
// Router (router.rs)
// -----------------------------------------------------------------------------

/** update_indexes(caller, assets: Vec<Address>) — #[only_role(caller, "KEEPER")] */
export function buildStellarUpdateIndexesTx(
  opts: StellarBuilderOptions,
  args: { assets: string[] }
): BuiltStellarTx {
  return buildTx(opts, 'update_indexes', [
    addr(opts.caller),
    vec(args.assets.map((a) => addr(a))),
  ])
}

/** renew_account(caller, account_id: u64) */
export function buildStellarRenewAccountTx(
  opts: StellarBuilderOptions,
  args: { accountNonce: number }
): BuiltStellarTx {
  return buildTx(opts, 'renew_account', [
    addr(opts.caller),
    u64(args.accountNonce),
  ])
}

/** create_liquidity_pool(asset, params: MarketParamsRaw, config: AssetConfigRaw) -> Address — #[only_owner] */
export function buildStellarCreateLiquidityPoolTx(
  opts: StellarBuilderOptions,
  args: CreateLiquidityPoolArgs
): BuiltStellarTx {
  return buildTx(opts, 'create_liquidity_pool', [
    addr(args.asset),
    encodeMarketParamsRaw(args.params),
    encodeAssetConfigRaw(args.config),
  ])
}

/** upgrade_liquidity_pool_params(asset, params: InterestRateModel) — #[only_owner] */
export function buildStellarUpgradeLiquidityPoolParamsTx(
  opts: StellarBuilderOptions,
  args: UpgradeLiquidityPoolParamsArgs
): BuiltStellarTx {
  return buildTx(opts, 'upgrade_liquidity_pool_params', [
    addr(args.asset),
    encodeInterestRateModel(args.params),
  ])
}

/** upgrade_liquidity_pool(asset, new_wasm_hash: BytesN<32>) — #[only_owner] */
export function buildStellarUpgradeLiquidityPoolTx(
  opts: StellarBuilderOptions,
  args: UpgradeLiquidityPoolArgs
): BuiltStellarTx {
  return buildTx(opts, 'upgrade_liquidity_pool', [
    addr(args.asset),
    bytesN(args.wasmHash),
  ])
}

/** claim_revenue(caller, assets: Vec<Address>) -> Vec<i128> — #[only_role(caller, "REVENUE")] */
export function buildStellarClaimRevenueTx(
  opts: StellarBuilderOptions,
  args: { assets: string[] }
): BuiltStellarTx {
  return buildTx(opts, 'claim_revenue', [
    addr(opts.caller),
    vec(args.assets.map((a) => addr(a))),
  ])
}

/** add_rewards(caller, rewards: Vec<(Address, i128)>) — #[only_role(caller, "REVENUE")] */
export function buildStellarAddRewardsTx(
  opts: StellarBuilderOptions,
  args: { rewards: RewardEntry[] }
): BuiltStellarTx {
  return buildTx(opts, 'add_rewards', [
    addr(opts.caller),
    vec(args.rewards.map((r) => vec([addr(r.token), i128(r.amount)]))),
  ])
}

/** update_account_threshold(caller, asset, has_risks, account_ids: Vec<u64>) — #[only_role(caller, "KEEPER")] */
export function buildStellarUpdateAccountThresholdTx(
  opts: StellarBuilderOptions,
  args: UpdateAccountThresholdArgs
): BuiltStellarTx {
  return buildTx(opts, 'update_account_threshold', [
    addr(opts.caller),
    addr(args.asset),
    bool(args.hasRisks),
    vec(args.accountNonces.map((n) => u64(n))),
  ])
}
