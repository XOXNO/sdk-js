/**
 * Account valuation and risk — the client mirror of
 * `rs-lending-xlm/contracts/controller/src/risk/totals.rs`
 * (`calculate_account_risk_totals`) and the post-action gate in
 * `contracts/controller/src/risk/validation.rs` (`require_post_pool_risk_gates`),
 * as specified in `docs/reference/formulas.md` §Valuation and health.
 *
 * Inputs are the generated API DTOs; all integer math runs in `BigInt` on the
 * raw string fields. Outputs carry both the raw WAD strings and display numbers.
 */

import type {
  AccountPositionDto,
  ReserveDto,
  StellarLendingLiveStateDto,
  StellarMarketIndexByHub,
} from '../lending-api-types'
import {
  BPS,
  RAY,
  WAD,
  baseToRay,
  baseToShort,
  mulDivCeil,
  mulDivFloor,
  numberToWad,
  positionValueWad,
  toBigInt,
  unscale,
  wadToNumber,
} from './scaled'

/**
 * `common/src/constants/shared.rs::DEFAULT_MIN_BORROW_COLLATERAL_USD_WAD` —
 * the floor `get_min_borrow_collateral_usd` returns until governance changes
 * it. Used only when `liveState.minBorrowCollateralUsdWad` is absent or null.
 */
export const DEFAULT_MIN_BORROW_COLLATERAL_USD_WAD = 5n * WAD

export type PositionSide = 'supply' | 'borrow'

/** One valued hub-asset leg of an account. */
export type PositionValue = {
  side: PositionSide
  hubId: number
  asset: string
  decimals: number
  /** Scaled shares (RAY) the valuation started from. */
  scaledRay: string
  /** Index (RAY) applied to the shares. */
  indexRay: string
  /** USD price per whole token (WAD) applied. */
  usdPriceWad: string
  usdPrice: number
  /** Token base units: supply = `unscale_supply_floor`, borrow = `unscale_borrow_ceil`. */
  amountBase: string
  amountShort: number
  /** USD (WAD): supply = half-up `position_value` (feeds `total_collateral`); borrow = `position_value_ceil` (risk debt). */
  usdWad: string
  usd: number
  /** USD (WAD) the risk gates weight: supply = `position_value_floor`; borrow = same as `usdWad`. */
  gateUsdWad: string
  entryLtvBps: number
  entryLiquidationThresholdBps: number
  entryLiquidationBonusBps: number
  entryLiquidationFeesBps: number
  /** Supplies: `floor(gateUsd * min(entryLtv, entryThreshold) / BPS)`; borrows: "0". */
  ltvWeightedUsdWad: string
  /** Supplies: `floor(gateUsd * entryThreshold / BPS)`; borrows: "0". */
  liquidationWeightedUsdWad: string
  /** Both the index and the price came from an accepted live-state row. */
  liveDataUsed: boolean
}

export type AccountRisk = {
  accountId: string
  owner: string
  spokeId: number
  /** `AccountPositionDto.positionMode`: 0 normal, 1 multiply, 2 long, 3 short. */
  mode: number
  supplies: PositionValue[]
  borrows: PositionValue[]
  /** Unweighted collateral, half-up (`AccountRiskTotals.total_collateral`). */
  totalCollateralUsdWad: string
  totalCollateralUsd: number
  /** Floor-valued collateral weighted by stored `min(LTV, threshold)` (`ltv_collateral`). */
  ltvWeightedCollateralUsdWad: string
  ltvWeightedCollateralUsd: number
  /** Floor-valued collateral weighted by stored liquidation threshold (`weighted_collateral`). */
  liquidationWeightedCollateralUsdWad: string
  liquidationWeightedCollateralUsd: number
  /** Ceil-valued debt (`total_debt`). */
  totalDebtUsdWad: string
  totalDebtUsd: number
  /** Contract convention `floor(weighted_collateral * WAD / debt)`; null when debt-free (the contract returns `i128::MAX`). */
  healthFactorWad: string | null
  healthFactor: number | null
  /** UI convention: `debt / threshold-weighted collateral × 100`; higher is riskier, 0 without collateral. */
  healthPercent: number
  /** Debt the LTV gate admits: `ltv_collateral` (`require_post_pool_risk_gates`). */
  borrowLimitUsdWad: string
  borrowLimitUsd: number
  /** `max(0, borrowLimit - debt)`; 0 when `ltv_collateral` is below the min-collateral floor. */
  availableBorrowUsdWad: string
  availableBorrowUsd: number
  /** Floor applied while debt remains (`get_min_borrow_collateral_usd`). */
  minBorrowCollateralUsdWad: string
  minBorrowCollateralUsd: number
  /** Debt > 0 and health factor < 1 WAD. */
  isLiquidatable: boolean
  /** `liveState` was supplied and every position was valued from an accepted live row. */
  liveDataValid: boolean
}

export type ReserveInput = Record<string, ReserveDto> | ReserveDto[]

/** Key used by `StellarLendingContextDto.reserveDetailsByKey`. */
export const reserveKey = (spokeId: number, hubId: number, asset: string): string =>
  `${spokeId}:${hubId}:${asset}`

/** Find the reserve backing a `(spokeId, hubId, asset)` coordinate; throws when missing. */
export function resolveReserve(reserves: ReserveInput, spokeId: number, hubId: number, asset: string): ReserveDto {
  const list = Array.isArray(reserves) ? reserves : undefined
  const found = list
    ? list.find((r) => r.spokeId === spokeId && r.hubId === hubId && r.asset === asset)
    : ((reserves as Record<string, ReserveDto>)[reserveKey(spokeId, hubId, asset)] ??
      Object.values(reserves as Record<string, ReserveDto>).find(
        (r) => r.spokeId === spokeId && r.hubId === hubId && r.asset === asset
      ))
  if (!found) {
    throw new Error(`Stellar math: no reserve for ${reserveKey(spokeId, hubId, asset)}`)
  }
  return found
}

// ---------------------------------------------------------------------------
// Live-state divergence guard — mirror of xoxno-ui `use-scaled-amount.ts`
// `buildStellarLiveSnapshot`: exact per-hub-asset indexes, asset-level price
// consistency, and the controller oracle flags (a row the contract's
// fail-closed solvency path would reject must not feed valuations either).
// ---------------------------------------------------------------------------

const POSITIVE_INTEGER = /^0*[1-9]\d*$/

const normalizedInteger = (value: string | null | undefined): string | null =>
  typeof value === 'string' && POSITIVE_INTEGER.test(value) ? BigInt(value).toString() : null

/** The live-state row plus the oracle flags newer API builds attach (`StellarDetailedMarketDto` shape). */
type LiveRow = StellarMarketIndexByHub & { valid?: boolean; stale?: boolean; deviation?: boolean }

export type LiveSnapshot = {
  /** Accepted index rows keyed `${hubId}:${asset}`. */
  indexes: Map<string, StellarMarketIndexByHub>
  /** Accepted USD prices (WAD) keyed by asset. */
  prices: Map<string, bigint>
  rejectedIndexKeys: Set<string>
  rejectedAssets: Set<string>
}

export const liveIndexKey = (hubId: number, asset: string): string => `${hubId}:${asset}`

/** Build the divergence-guarded snapshot from `liveState.indexes`. */
export function buildLiveSnapshot(liveState: StellarLendingLiveStateDto | undefined): LiveSnapshot {
  const indexes = new Map<string, StellarMarketIndexByHub>()
  const prices = new Map<string, bigint>()
  const rejectedIndexKeys = new Set<string>()
  const rejectedAssets = new Set<string>()

  for (const row of (liveState?.indexes ?? []) as LiveRow[]) {
    const key = liveIndexKey(row.hubId, row.asset)
    const supply = normalizedInteger(row.supplyIndex)
    const borrow = normalizedInteger(row.borrowIndex)
    const price = normalizedInteger(row.usdPrice)
    const existing = indexes.get(key)
    const sameAsExisting =
      existing &&
      normalizedInteger(existing.supplyIndex) === supply &&
      normalizedInteger(existing.borrowIndex) === borrow &&
      normalizedInteger(existing.usdPrice) === price
    if (supply == null || borrow == null || price == null || (existing && !sameAsExisting)) {
      rejectedIndexKeys.add(key)
    } else if (!existing) {
      indexes.set(key, row)
    }

    const oracleRejected = row.valid === false || row.stale === true || row.deviation === true
    const existingPrice = prices.get(row.asset)
    if (price == null || oracleRejected || (existingPrice !== undefined && existingPrice.toString() !== price)) {
      rejectedAssets.add(row.asset)
    } else if (existingPrice === undefined) {
      prices.set(row.asset, BigInt(price))
    }
  }
  for (const key of rejectedIndexKeys) indexes.delete(key)
  for (const asset of rejectedAssets) prices.delete(asset)
  return { indexes, prices, rejectedIndexKeys, rejectedAssets }
}

// ---------------------------------------------------------------------------
// Position valuation
// ---------------------------------------------------------------------------

type PositionSeed = {
  side: PositionSide
  hubId: number
  asset: string
  decimals: number
  scaledRay: bigint
  indexRay: bigint
  priceWad: bigint
  entryLtvBps: number
  entryLiquidationThresholdBps: number
  entryLiquidationBonusBps: number
  entryLiquidationFeesBps: number
  liveDataUsed: boolean
}

/** Weight a floor-valued gate USD by a BPS ratio, flooring (`Bps::apply_to_wad_floor`). */
const weightFloor = (gateUsdWad: bigint, bps: number): bigint => mulDivFloor(gateUsdWad, BigInt(bps), BPS)

function finishPositionValue(seed: PositionSeed, amountBase: bigint, usdWad: bigint, gateUsdWad: bigint): PositionValue {
  const isSupply = seed.side === 'supply'
  const effectiveLtv = Math.min(seed.entryLtvBps, seed.entryLiquidationThresholdBps)
  return {
    side: seed.side,
    hubId: seed.hubId,
    asset: seed.asset,
    decimals: seed.decimals,
    scaledRay: seed.scaledRay.toString(),
    indexRay: seed.indexRay.toString(),
    usdPriceWad: seed.priceWad.toString(),
    usdPrice: wadToNumber(seed.priceWad),
    amountBase: amountBase.toString(),
    amountShort: baseToShort(amountBase, seed.decimals),
    usdWad: usdWad.toString(),
    usd: wadToNumber(usdWad),
    gateUsdWad: gateUsdWad.toString(),
    entryLtvBps: seed.entryLtvBps,
    entryLiquidationThresholdBps: seed.entryLiquidationThresholdBps,
    entryLiquidationBonusBps: seed.entryLiquidationBonusBps,
    entryLiquidationFeesBps: seed.entryLiquidationFeesBps,
    ltvWeightedUsdWad: isSupply ? weightFloor(gateUsdWad, effectiveLtv).toString() : '0',
    liquidationWeightedUsdWad: isSupply
      ? weightFloor(gateUsdWad, seed.entryLiquidationThresholdBps).toString()
      : '0',
    liveDataUsed: seed.liveDataUsed,
  }
}

/**
 * Value scaled shares exactly as `calculate_account_risk_totals` does:
 * supply → `position_value` (half-up display/total) and
 * `position_value_floor` (gate); borrow → `position_value_ceil`.
 */
export function valueScaledPosition(seed: PositionSeed): PositionValue {
  if (seed.side === 'supply') {
    const amountBase = unscale(seed.scaledRay, seed.indexRay, seed.decimals, 'floor')
    const usdWad = positionValueWad(seed.scaledRay, seed.indexRay, seed.priceWad, 'halfUp')
    const gateUsdWad = positionValueWad(seed.scaledRay, seed.indexRay, seed.priceWad, 'floor')
    return finishPositionValue(seed, amountBase, usdWad, gateUsdWad)
  }
  const amountBase = unscale(seed.scaledRay, seed.indexRay, seed.decimals, 'ceil')
  const usdWad = positionValueWad(seed.scaledRay, seed.indexRay, seed.priceWad, 'ceil')
  return finishPositionValue(seed, amountBase, usdWad, usdWad)
}

/**
 * Shares minted when `amountBase` enters a leg — `scaling.rs`
 * `calculate_scaled_supply` (floor) / `calculate_scaled_borrow` (ceil), the
 * only entry conversions the pool performs (`ops/supply.rs`, `ops/borrow.rs`).
 */
export function mintShares(side: PositionSide, amountBase: bigint, decimals: number, indexRay: bigint): bigint {
  const amountRay = baseToRay(amountBase, decimals)
  return side === 'supply' ? mulDivFloor(amountRay, RAY, indexRay) : mulDivCeil(amountRay, RAY, indexRay)
}

/**
 * Shares burned by a partial exit of `amountBase` — `formulas.md` rounding
 * table: "Partial withdrawal burn: ceil", "Partial repayment burn: floor".
 * Full closes (withdraw ≥ half-up balance, repay ≥ ceil debt) burn every
 * share instead; callers handle that boundary.
 */
export function burnShares(side: PositionSide, amountBase: bigint, decimals: number, indexRay: bigint): bigint {
  const amountRay = baseToRay(amountBase, decimals)
  return side === 'supply' ? mulDivCeil(amountRay, RAY, indexRay) : mulDivFloor(amountRay, RAY, indexRay)
}

/**
 * Value a fresh leg entered with `amountBase`: shares come from
 * {@link mintShares} and the valuation runs on those shares exactly as
 * {@link valueScaledPosition} does (`position_value_*` never sees the base
 * amount). `amountBase` on the result is therefore the share-derived balance,
 * which can differ from the input by rounding when the index is not `RAY`.
 */
export function valueBasePosition(seed: Omit<PositionSeed, 'scaledRay'>, amountBase: bigint): PositionValue {
  return valueScaledPosition({ ...seed, scaledRay: mintShares(seed.side, amountBase, seed.decimals, seed.indexRay) })
}

const firstIndex = (...candidates: Array<string | null | undefined>): bigint => {
  for (const c of candidates) {
    const n = normalizedInteger(c)
    if (n != null) return BigInt(n)
  }
  return RAY
}

function valueDtoPosition(
  side: PositionSide,
  pos: AccountPositionDto,
  reserve: ReserveDto,
  snapshot: LiveSnapshot
): PositionValue | null {
  const scaledRay = toBigInt(side === 'supply' ? pos.supplyScaledRay : pos.borrowScaledRay, `${side}ScaledRay`)
  if (scaledRay === 0n) return null
  const liveRow = snapshot.indexes.get(liveIndexKey(pos.hubId, pos.asset))
  const livePrice = snapshot.prices.get(pos.asset)
  const indexRay =
    side === 'supply'
      ? firstIndex(liveRow?.supplyIndex, pos.liveSupplyIndexRay, reserve.liveSupplyIndexRay, pos.supplyIndexRay)
      : firstIndex(liveRow?.borrowIndex, pos.liveBorrowIndexRay, reserve.liveBorrowIndexRay, pos.borrowIndexRay)
  const priceWad = livePrice ?? numberToWad(reserve.usdPrice)
  return valueScaledPosition({
    side,
    hubId: pos.hubId,
    asset: pos.asset,
    decimals: reserve.assetDecimals,
    scaledRay,
    indexRay,
    priceWad,
    entryLtvBps: pos.entryLtvBps,
    entryLiquidationThresholdBps: pos.entryLiquidationThresholdBps,
    entryLiquidationBonusBps: pos.entryLiquidationBonusBps,
    entryLiquidationFeesBps: pos.entryLiquidationFeesBps,
    liveDataUsed: liveRow !== undefined && livePrice !== undefined,
  })
}

// ---------------------------------------------------------------------------
// Aggregation — `calculate_account_risk_totals_body`
// ---------------------------------------------------------------------------

export type AccountIdentity = Pick<AccountRisk, 'accountId' | 'owner' | 'spokeId' | 'mode'>

const sumWad = (positions: PositionValue[], pick: (p: PositionValue) => string): bigint =>
  positions.reduce((acc, p) => acc + BigInt(pick(p)), 0n)

/**
 * Fold valued positions into the contract's risk totals and the derived
 * limits. `formulas.md`: `health_factor_wad = floor(weighted_collateral_wad *
 * WAD / debt_wad)`; the post-action gate requires `debt <= ltv_collateral`,
 * `HF >= 1 WAD` and `ltv_collateral >= floor` while debt remains.
 */
export function aggregateAccountRisk(
  identity: AccountIdentity,
  supplies: PositionValue[],
  borrows: PositionValue[],
  minBorrowCollateralUsdWad: bigint,
  liveDataValid: boolean
): AccountRisk {
  const totalCollateral = sumWad(supplies, (p) => p.usdWad)
  const ltvCollateral = sumWad(supplies, (p) => p.ltvWeightedUsdWad)
  const weightedCollateral = sumWad(supplies, (p) => p.liquidationWeightedUsdWad)
  const totalDebt = sumWad(borrows, (p) => p.usdWad)

  const healthFactorWad = totalDebt === 0n ? null : mulDivFloor(weightedCollateral, WAD, totalDebt)
  const healthPercent =
    weightedCollateral === 0n ? 0 : (Number(totalDebt) / Number(weightedCollateral)) * 100
  const belowFloor = ltvCollateral < minBorrowCollateralUsdWad
  const availableBorrow = belowFloor || ltvCollateral <= totalDebt ? 0n : ltvCollateral - totalDebt

  return {
    ...identity,
    supplies,
    borrows,
    totalCollateralUsdWad: totalCollateral.toString(),
    totalCollateralUsd: wadToNumber(totalCollateral),
    ltvWeightedCollateralUsdWad: ltvCollateral.toString(),
    ltvWeightedCollateralUsd: wadToNumber(ltvCollateral),
    liquidationWeightedCollateralUsdWad: weightedCollateral.toString(),
    liquidationWeightedCollateralUsd: wadToNumber(weightedCollateral),
    totalDebtUsdWad: totalDebt.toString(),
    totalDebtUsd: wadToNumber(totalDebt),
    healthFactorWad: healthFactorWad === null ? null : healthFactorWad.toString(),
    healthFactor: healthFactorWad === null ? null : wadToNumber(healthFactorWad),
    healthPercent,
    borrowLimitUsdWad: ltvCollateral.toString(),
    borrowLimitUsd: wadToNumber(ltvCollateral),
    availableBorrowUsdWad: availableBorrow.toString(),
    availableBorrowUsd: wadToNumber(availableBorrow),
    minBorrowCollateralUsdWad: minBorrowCollateralUsdWad.toString(),
    minBorrowCollateralUsd: wadToNumber(minBorrowCollateralUsdWad),
    isLiquidatable: healthFactorWad !== null && healthFactorWad < WAD,
    liveDataValid,
  }
}

export type ComputeAccountRiskInput = {
  /** Every row of one account (same `accountId`), as `/accounts/{id}/positions` returns them. */
  positions: AccountPositionDto[]
  /** `context.reserveDetailsByKey` (keyed `${spokeId}:${hubId}:${asset}`) or a reserve array. */
  reserves: ReserveInput
  /** `/live-state`: live indexes, prices and the min-collateral floor. Optional; positions then fall back to their own applied indexes and the reserve price. */
  liveState?: StellarLendingLiveStateDto
}

/**
 * Value one account exactly as the controller's risk gates do.
 *
 * - Index: live-state row for `(hubId, asset)` when it passed the divergence
 *   guard, else the position's `liveSupplyIndexRay` / `liveBorrowIndexRay`,
 *   then the reserve's `live*IndexRay`, and last the position's stored
 *   `supplyIndexRay` / `borrowIndexRay` (undocumented in the API schema; the
 *   documented fields say "stored index on fallback", so it is treated as the
 *   stalest snapshot). The contract accrues to the current index before every
 *   gate, so fresher candidates win.
 * - Price: live-state `usdPrice` (WAD) when accepted, else `reserve.usdPrice`
 *   converted to WAD.
 * - Weights: the position's own `entry*Bps`, as the contract stores them.
 * - Min-collateral floor: `liveState.minBorrowCollateralUsdWad`, defaulting
 *   to 5 USD (`DEFAULT_MIN_BORROW_COLLATERAL_USD_WAD`) when absent or null.
 *
 * Throws when `positions` is empty, mixes account ids, or names a reserve
 * missing from `reserves`.
 */
export function computeAccountRisk(input: ComputeAccountRiskInput): AccountRisk {
  const { positions, reserves, liveState } = input
  const first = positions[0]
  if (!first) throw new Error('Stellar math: computeAccountRisk needs at least one position row')
  for (const p of positions) {
    if (p.accountId !== first.accountId) {
      throw new Error(
        `Stellar math: computeAccountRisk received mixed account ids (${first.accountId}, ${p.accountId})`
      )
    }
  }

  const snapshot = buildLiveSnapshot(liveState)
  const supplies: PositionValue[] = []
  const borrows: PositionValue[] = []
  for (const p of positions) {
    const reserve = resolveReserve(reserves, p.spokeId, p.hubId, p.asset)
    const supply = valueDtoPosition('supply', p, reserve, snapshot)
    if (supply) supplies.push(supply)
    const borrow = valueDtoPosition('borrow', p, reserve, snapshot)
    if (borrow) borrows.push(borrow)
  }

  const floorWad =
    liveState?.minBorrowCollateralUsdWad != null
      ? toBigInt(liveState.minBorrowCollateralUsdWad, 'minBorrowCollateralUsdWad')
      : DEFAULT_MIN_BORROW_COLLATERAL_USD_WAD
  const liveDataValid =
    liveState !== undefined && [...supplies, ...borrows].every((p) => p.liveDataUsed)

  return aggregateAccountRisk(
    { accountId: first.accountId, owner: first.owner, spokeId: first.spokeId, mode: first.positionMode },
    supplies,
    borrows,
    floorWad,
    liveDataValid
  )
}
