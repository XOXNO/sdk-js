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
  hubAsset,
  i128,
  scStruct,
  str,
  sym,
  tupleHubAssetAmountVec,
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
const PROVIDER_XOXNO = 'XoxnoPriceFeed'
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
    base_borrow_rate: i128(m.baseBorrowRateRay),
    max_borrow_rate: i128(m.maxBorrowRateRay),
    max_utilization: i128(m.maxUtilizationRay),
    mid_utilization: i128(m.midUtilizationRay),
    optimal_utilization: i128(m.optimalUtilizationRay),
    reserve_factor: u32(m.reserveFactorBps),
    slope1: i128(m.slope1Ray),
    slope2: i128(m.slope2Ray),
    slope3: i128(m.slope3Ray),
  })

/** `MarketParamsRaw` — `InterestRateModel` plus the pool asset identity. */
export const encodeMarketParamsRaw = (p: MarketParamsRawDto): xdr.ScVal =>
  scStruct({
    asset_decimals: u32(p.assetDecimals),
    asset_id: addr(p.assetId),
    base_borrow_rate: i128(p.baseBorrowRateRay),
    flashloan_fee: u32(p.flashloanFeeBps),
    is_flashloanable: bool(p.isFlashloanable),
    max_borrow_rate: i128(p.maxBorrowRateRay),
    max_utilization: i128(p.maxUtilizationRay),
    mid_utilization: i128(p.midUtilizationRay),
    optimal_utilization: i128(p.optimalUtilizationRay),
    reserve_factor: u32(p.reserveFactorBps),
    slope1: i128(p.slope1Ray),
    slope2: i128(p.slope2Ray),
    slope3: i128(p.slope3Ray),
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

/** `OracleSourceConfigInput` data-enum — `Reflector(...)` | `RedStone(...)` | `Xoxno(...)`. */
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
  // RedStone and the first-party XOXNO adapter share a wire shape (contract +
  // feed id + per-source staleness); only the variant symbol differs.
  if (provider === PROVIDER_REDSTONE || provider === PROVIDER_XOXNO) {
    const variant = provider === PROVIDER_REDSTONE ? 'RedStone' : 'Xoxno'
    if (typeof src.feedId !== 'string') {
      throw new Error(
        `Stellar builder: ${variant} oracle source requires \`feedId\``
      )
    }
    if (typeof src.maxStaleSeconds !== 'number') {
      throw new Error(
        `Stellar builder: ${variant} oracle source requires \`maxStaleSeconds\``
      )
    }
    return vec([
      sym(variant),
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
    max_price_stale_seconds: u64(cfg.maxPriceStaleSeconds),
    max_sanity_price_wad: i128(cfg.maxSanityPriceWad),
    min_sanity_price_wad: i128(cfg.minSanityPriceWad),
    primary: encodeOracleSourceConfigInput(cfg.primary),
    strategy: u32(strategy),
    tolerance_bps: u32(cfg.toleranceBps),
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
export interface ConfigureMarketOracleArgs {
  hubId: number
  asset: string
  config: MarketOracleConfigInputDto
}
export interface EditOracleToleranceArgs {
  asset: string
  upperRatioBps: number
  lowerRatioBps: number
}
export interface CreateLiquidityPoolArgs {
  hubId: number
  asset: string
  params: MarketParamsRawDto
}
export interface UpgradeLiquidityPoolParamsArgs {
  hubId: number
  asset: string
  params: InterestRateModelDto
}
export interface RewardEntry {
  hubId: number
  asset: string
  amount: string
}
export interface UpdateAccountThresholdArgs {
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

/** set_position_limits(limits: PositionLimits) — #[only_owner] */
export function buildStellarSetPositionLimitsTx(
  opts: StellarBuilderOptions,
  args: PositionLimitsDto
): BuiltStellarTx {
  return buildTx(opts, 'set_position_limits', [encodePositionLimits(args)])
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
export function buildStellarSetMarketOracleConfigTx(
  opts: StellarBuilderOptions,
  args: ConfigureMarketOracleArgs
): BuiltStellarTx {
  return buildTx(opts, 'set_market_oracle_config', [
    hubAsset(args.hubId, args.asset),
    encodeMarketOracleConfigInput(args.config),
  ])
}

/** set_oracle_tolerance(asset, tolerance: OraclePriceFluctuation) — #[only_owner] */
export function buildStellarSetOracleToleranceTx(
  opts: StellarBuilderOptions,
  args: EditOracleToleranceArgs
): BuiltStellarTx {
  return buildTx(opts, 'set_oracle_tolerance', [
    addr(args.asset),
    scStruct({
      lower_ratio_bps: u32(args.lowerRatioBps),
      upper_ratio_bps: u32(args.upperRatioBps),
    }),
  ])
}

/**
 * set_spoke_asset_flags(spoke_id, hub_asset, paused, frozen) — #[only_owner].
 * Flags-only listing edit; production callers route through the GUARDIAN-gated
 * governance forwarder (`buildStellarGovernanceSetSpokeAssetFlagsImmediateTx`).
 */
export function buildStellarSetSpokeAssetFlagsTx(
  opts: StellarBuilderOptions,
  args: {
    spokeId: number
    hubId: number
    asset: string
    paused: boolean
    frozen: boolean
  }
): BuiltStellarTx {
  return buildTx(opts, 'set_spoke_asset_flags', [
    u32(args.spokeId),
    hubAsset(args.hubId, args.asset),
    bool(args.paused),
    bool(args.frozen),
  ])
}

/**
 * set_oracle_sanity_bounds(asset, min_wad, max_wad) — #[only_owner].
 * Band-only oracle edit; production callers route through the ORACLE-gated
 * governance forwarder (`buildStellarGovernanceSetOracleSanityBoundsImmediateTx`).
 */
export function buildStellarSetOracleSanityBoundsTx(
  opts: StellarBuilderOptions,
  args: { asset: string; minPriceWad: string; maxPriceWad: string }
): BuiltStellarTx {
  return buildTx(opts, 'set_oracle_sanity_bounds', [
    addr(args.asset),
    i128(args.minPriceWad),
    i128(args.maxPriceWad),
  ])
}

// -----------------------------------------------------------------------------
// Router (router.rs)
// -----------------------------------------------------------------------------

/** update_indexes(caller, assets: Vec<HubAssetKey>) */
export function buildStellarUpdateIndexesTx(
  opts: StellarBuilderOptions,
  args: { assets: Array<{ hubId: number; asset: string }> }
): BuiltStellarTx {
  return buildTx(opts, 'update_indexes', [
    addr(opts.caller),
    vec(args.assets.map((a) => hubAsset(a.hubId, a.asset))),
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

/** create_liquidity_pool(hub_id, asset, params: MarketParamsRaw) -> Address — #[only_owner] */
export function buildStellarCreateLiquidityPoolTx(
  opts: StellarBuilderOptions,
  args: CreateLiquidityPoolArgs
): BuiltStellarTx {
  return buildTx(opts, 'create_liquidity_pool', [
    u32(args.hubId),
    addr(args.asset),
    encodeMarketParamsRaw(args.params),
  ])
}

/** upgrade_liquidity_pool_params(hub_asset: HubAssetKey, params) — #[only_owner] */
export function buildStellarUpgradeLiquidityPoolParamsTx(
  opts: StellarBuilderOptions,
  args: UpgradeLiquidityPoolParamsArgs
): BuiltStellarTx {
  return buildTx(opts, 'upgrade_liquidity_pool_params', [
    hubAsset(args.hubId, args.asset),
    encodeInterestRateModel(args.params),
  ])
}

/** claim_revenue(caller, assets: Vec<HubAssetKey>) -> Vec<i128> */
export function buildStellarClaimRevenueTx(
  opts: StellarBuilderOptions,
  args: { assets: Array<{ hubId: number; asset: string }> }
): BuiltStellarTx {
  return buildTx(opts, 'claim_revenue', [
    addr(opts.caller),
    vec(args.assets.map((a) => hubAsset(a.hubId, a.asset))),
  ])
}

/** add_rewards(caller, rewards: Vec<(HubAssetKey, i128)>) */
export function buildStellarAddRewardsTx(
  opts: StellarBuilderOptions,
  args: { rewards: RewardEntry[] }
): BuiltStellarTx {
  return buildTx(opts, 'add_rewards', [
    addr(opts.caller),
    tupleHubAssetAmountVec(args.rewards),
  ])
}

/** update_account_threshold(caller, asset, has_risks, account_ids: Vec<u64>) — #[only_role(caller, "KEEPER")] */
export function buildStellarUpdateAccountThresholdTx(
  opts: StellarBuilderOptions,
  args: UpdateAccountThresholdArgs
): BuiltStellarTx {
  return buildTx(opts, 'update_account_threshold', [
    addr(opts.caller),
    bool(args.hasRisks),
    vec(args.accountNonces.map((n) => u64(n))),
  ])
}
