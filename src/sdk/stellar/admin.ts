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
  AssetOracleConfigInputDto,
  ConfigureAssetOracleArgsDto,
  EditOracleToleranceArgsDto,
  InterestRateModelDto,
  MarketParamsRawDto,
  PositionLimitsDto,
} from '@xoxno/types'
import type {
  StellarAssetOracle,
  StellarFeedSource,
  StellarIndependencePolicy,
  StellarPriceKey,
  StellarPriceSource,
  StellarProviderRef,
} from '@xoxno/types/stellar-lending'

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

/** On-chain `PriceKey` — `{ Token: "C…" }` or `{ Ref: "BTC" }`. */
export const encodePriceKey = (key: StellarPriceKey | Record<string, string>): xdr.ScVal => {
  if ('Token' in key && key.Token) return vec([sym('Token'), addr(key.Token)])
  if ('Ref' in key && key.Ref) return vec([sym('Ref'), sym(key.Ref)])
  throw new Error(`Stellar builder: PriceKey must be { Token } or { Ref }, got ${JSON.stringify(key)}`)
}

const encodeOracleAssetRef = (asset: Record<string, string>): xdr.ScVal => {
  if ('Stellar' in asset) return vec([sym('Stellar'), addr(asset.Stellar)])
  if ('Symbol' in asset) return vec([sym('Symbol'), sym(asset.Symbol)])
  if ('String' in asset) return vec([sym('String'), str(asset.String)])
  throw new Error(`Stellar builder: unknown OracleAssetRef ${JSON.stringify(asset)}`)
}

const encodeOracleReadMode = (mode: unknown): xdr.ScVal => {
  if (mode === 'Spot') return vec([sym('Spot')])
  if (mode && typeof mode === 'object' && 'Twap' in (mode as object)) {
    return vec([sym('Twap'), u32(Number((mode as { Twap: number }).Twap))])
  }
  throw new Error(`Stellar builder: unknown OracleReadMode ${JSON.stringify(mode)}`)
}

const encodeProviderKind = (kind: string): xdr.ScVal => {
  if (kind === 'Reflector' || kind === 'RedStone' || kind === 'Xoxno') {
    return vec([sym(kind)])
  }
  throw new Error(`Stellar builder: unknown ProviderKind "${kind}"`)
}

const encodeFeedNature = (nature: string): xdr.ScVal => {
  if (nature === 'Market' || nature === 'Fundamental') return vec([sym(nature)])
  throw new Error(`Stellar builder: unknown FeedNature "${nature}"`)
}

const encodeProviderRef = (provider: StellarProviderRef | Record<string, unknown>): xdr.ScVal => {
  if ('Reflector' in provider) {
    const r = provider.Reflector as {
      contract: string
      asset: Record<string, string>
      readMode: unknown
    }
    return vec([
      sym('Reflector'),
      scStruct({
        asset: encodeOracleAssetRef(r.asset),
        contract: addr(r.contract),
        read_mode: encodeOracleReadMode(r.readMode),
      }),
    ])
  }
  if ('MultiFeed' in provider) {
    const m = provider.MultiFeed as {
      contract: string
      feedId: string
      kind: string
      nature: string
    }
    return vec([
      sym('MultiFeed'),
      scStruct({
        contract: addr(m.contract),
        feed_id: str(m.feedId),
        kind: encodeProviderKind(m.kind),
        nature: encodeFeedNature(m.nature),
      }),
    ])
  }
  throw new Error(`Stellar builder: unknown ProviderRef ${JSON.stringify(provider)}`)
}

const encodeFeedSource = (feed: StellarFeedSource | Record<string, unknown>): xdr.ScVal => {
  const f = feed as StellarFeedSource
  return scStruct({
    decimals: u32(f.decimals),
    max_stale_seconds: u64(f.maxStaleSeconds),
    provider: encodeProviderRef(f.provider),
  })
}

const encodePriceSource = (source: StellarPriceSource | Record<string, unknown>): xdr.ScVal => {
  if ('Feed' in source) {
    return vec([sym('Feed'), encodeFeedSource(source.Feed as StellarFeedSource)])
  }
  if ('Scaled' in source) {
    const s = source.Scaled as {
      factor: StellarFeedSource
      quote: StellarPriceKey
      minFactorWad: string
      maxFactorWad: string
    }
    return vec([
      sym('Scaled'),
      scStruct({
        factor: encodeFeedSource(s.factor),
        max_factor_wad: i128(s.maxFactorWad),
        min_factor_wad: i128(s.minFactorWad),
        quote: encodePriceKey(s.quote),
      }),
    ])
  }
  if ('LpShare' in source) {
    const s = source.LpShare as {
      pool: string
      kind: string
      keyA: StellarPriceKey
      keyB: StellarPriceKey
      reserveADecimals: number
      reserveBDecimals: number
      shareDecimals: number
    }
    return vec([
      sym('LpShare'),
      scStruct({
        key_a: encodePriceKey(s.keyA),
        key_b: encodePriceKey(s.keyB),
        kind: vec([sym(s.kind || 'ConstantProduct')]),
        pool: addr(s.pool),
        reserve_a_decimals: u32(s.reserveADecimals),
        reserve_b_decimals: u32(s.reserveBDecimals),
        share_decimals: u32(s.shareDecimals),
      }),
    ])
  }
  throw new Error(`Stellar builder: unknown PriceSource ${JSON.stringify(source)}`)
}

const encodeIndependence = (policy: StellarIndependencePolicy | string | Record<string, unknown>): xdr.ScVal => {
  if (policy === 'RequireDisjoint') return vec([sym('RequireDisjoint')])
  if (policy && typeof policy === 'object' && 'AllowShared' in policy) {
    const domains = (policy as { AllowShared: { kind: string; contract: string }[] }).AllowShared
    return vec([
      sym('AllowShared'),
      vec(
        domains.map((d) =>
          scStruct({
            contract: addr(d.contract),
            kind: encodeProviderKind(d.kind),
          })
        )
      ),
    ])
  }
  throw new Error(`Stellar builder: unknown IndependencePolicy ${JSON.stringify(policy)}`)
}

/**
 * Encode on-chain `AssetOracle`. Accepts either the swagger DTO
 * (`toleranceBps` + sources) or a full `StellarAssetOracle` with tolerance
 * upper/lower bps (lower is derived as reciprocal when only bps is given).
 */
export const encodeAssetOracle = (
  cfg: AssetOracleConfigInputDto | StellarAssetOracle | Record<string, unknown>
): xdr.ScVal => {
  const c = cfg as Record<string, unknown>
  const sources = (c.sources as unknown[]) ?? []
  let upper: number
  let lower: number
  if (typeof c.toleranceBps === 'number') {
    upper = 10_000 + c.toleranceBps
    // reciprocal lower ≈ floor(1e8 / upper) style half-up is on-chain; SDK uses
    // symmetric inverse for proposal input (governance may re-derive via view).
    lower = Math.max(1, Math.floor((10_000 * 10_000) / upper))
  } else {
    const tol = (c.tolerance ?? {}) as { upperRatioBps?: number; lowerRatioBps?: number }
    upper = Number(tol.upperRatioBps)
    lower = Number(tol.lowerRatioBps)
  }
  return scStruct({
    asset_decimals: u32(Number(c.assetDecimals)),
    independence: encodeIndependence(c.independence as StellarIndependencePolicy),
    max_price_stale_seconds: u64(Number(c.maxPriceStaleSeconds)),
    max_sanity_price_wad: i128(String(c.maxSanityPriceWad)),
    min_sanity_price_wad: i128(String(c.minSanityPriceWad)),
    sources: vec(sources.map((s) => encodePriceSource(s as StellarPriceSource))),
    tolerance: scStruct({
      lower_ratio_bps: u32(lower),
      upper_ratio_bps: u32(upper),
    }),
  })
}

/** @deprecated Use {@link encodeAssetOracle}. */
export const encodeMarketOracleConfigInput = encodeAssetOracle

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
/** Governance / aggregator `ConfigureAssetOracle` args. */
export type ConfigureAssetOracleArgs = ConfigureAssetOracleArgsDto

/** @deprecated Alias — use ConfigureAssetOracleArgs. */
export type ConfigureMarketOracleArgs = ConfigureAssetOracleArgs

/** Edit dual-source tolerance (PriceKey + bps). */
export type EditOracleToleranceArgs = EditOracleToleranceArgsDto
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

/** set_swap_aggregator(addr: Address) — #[only_owner] */
export function buildStellarSetSwapAggregatorTx(
  opts: StellarBuilderOptions,
  args: { aggregator: string }
): BuiltStellarTx {
  return buildTx(opts, 'set_swap_aggregator', [addr(args.aggregator)])
}

/** set_price_aggregator(addr: Address) — #[only_owner] */
export function buildStellarSetPriceAggregatorTx(
  opts: StellarBuilderOptions,
  args: { aggregator: string }
): BuiltStellarTx {
  return buildTx(opts, 'set_price_aggregator', [addr(args.aggregator)])
}

/** @deprecated Use buildStellarSetSwapAggregatorTx. */
export const buildStellarSetAggregatorTx = buildStellarSetSwapAggregatorTx

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

/** approve_blend_pool(pool: Address) — #[only_owner] */
export function buildStellarApproveBlendPoolTx(
  opts: StellarBuilderOptions,
  args: { pool: string }
): BuiltStellarTx {
  return buildTx(opts, 'approve_blend_pool', [addr(args.pool)])
}

/** revoke_blend_pool(pool: Address) — #[only_owner] */
export function buildStellarRevokeBlendPoolTx(
  opts: StellarBuilderOptions,
  args: { pool: string }
): BuiltStellarTx {
  return buildTx(opts, 'revoke_blend_pool', [addr(args.pool)])
}

/** @deprecated Use buildStellarApproveBlendPoolTx. */
export const buildStellarApproveTokenTx = buildStellarApproveBlendPoolTx
/** @deprecated Use buildStellarRevokeBlendPoolTx. */
export const buildStellarRevokeTokenTx = buildStellarRevokeBlendPoolTx

/**
 * Direct price-aggregator `set_oracle(key, oracle)` — owner only (governance
 * contract address as tx source after deploy). Prefer governance propose path
 * in production.
 */
export function buildStellarSetOracleTx(
  opts: StellarBuilderOptions,
  args: ConfigureAssetOracleArgs
): BuiltStellarTx {
  return buildTx(opts, 'set_oracle', [
    encodePriceKey(args.key),
    encodeAssetOracle(args.oracle),
  ])
}

/** @deprecated Use buildStellarSetOracleTx. */
export const buildStellarSetMarketOracleConfigTx = buildStellarSetOracleTx

/** price-aggregator `set_tolerance(key, OracleTolerance)` — owner only. */
export function buildStellarSetOracleToleranceTx(
  opts: StellarBuilderOptions,
  args: EditOracleToleranceArgs & { upperRatioBps?: number; lowerRatioBps?: number }
): BuiltStellarTx {
  const bps = args.toleranceBps
  const upper = args.upperRatioBps ?? 10_000 + bps
  const lower =
    args.lowerRatioBps ?? Math.max(1, Math.floor((10_000 * 10_000) / upper))
  return buildTx(opts, 'set_tolerance', [
    encodePriceKey(args.key),
    scStruct({
      lower_ratio_bps: u32(lower),
      upper_ratio_bps: u32(upper),
    }),
  ])
}

/**
 * set_spoke_asset_flags(spoke_id, hub_asset, paused, frozen, no_seize) —
 * #[only_owner]. Flags-only listing edit; production callers route through the
 * GUARDIAN-gated governance forwarder
 * (`buildStellarGovernanceSetSpokeAssetFlagsImmediateTx`). Every flag is a
 * one-way ratchet here: clearing one requires the timelocked spoke-asset edit.
 */
export function buildStellarSetSpokeAssetFlagsTx(
  opts: StellarBuilderOptions,
  args: {
    spokeId: number
    hubId: number
    asset: string
    paused: boolean
    frozen: boolean
    /** Halts only the liquidation seizure leg for this listing (error 318). */
    noSeize: boolean
  }
): BuiltStellarTx {
  return buildTx(opts, 'set_spoke_asset_flags', [
    u32(args.spokeId),
    hubAsset(args.hubId, args.asset),
    bool(args.paused),
    bool(args.frozen),
    bool(args.noSeize),
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
