/**
 * What-if projections: account risk after hypothetical position changes and
 * reserve rates after hypothetical pool flows. Reuses the same aggregation
 * (`aggregateAccountRisk`) and curve (`rates.ts`) as the live computations.
 * xoxno-ui parity: `utils.ts::getProjectedHealthPercentage`,
 * `getProjectedUtilization`, `getApyProjection`.
 */

import type { ReserveDto } from '../lending-api-types'
import type { AccountRisk, PositionSide, PositionValue } from './account'
import { aggregateAccountRisk, burnShares, mintShares, valueBasePosition, valueScaledPosition } from './account'
import { annualBorrowRateRay, depositRateRay, rayAprToApy, rayAprToNumber, utilizationRay } from './rates'
import { baseToRay, numberToScaled, numberToWad, rayToNumber, toBigInt, unscale } from './scaled'

export type PositionDelta = {
  side: PositionSide
  hubId: number
  asset: string
  /** Signed token base units: positive supplies/borrows, negative withdraws/repays. */
  amountBase: bigint | string
  /** Required when the account has no such position yet: decimals, `usdPrice` and the `collateralFactorBps` / `liquidationThresholdBps` a new position would snapshot. */
  reserve?: ReserveDto
}

const sameLeg = (p: { hubId: number; asset: string }, d: PositionDelta): boolean =>
  p.hubId === d.hubId && p.asset === d.asset

const signedBigInt = (value: bigint | string): bigint => {
  if (typeof value === 'bigint') return value
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) throw new Error(`Stellar math: delta amountBase must be an integer string, got "${value}"`)
  return BigInt(trimmed)
}

/**
 * Re-value the account after applying `deltas`, moving shares the way the
 * pool does. Existing legs change in shares (`mintShares` on entry,
 * `burnShares` on a partial exit; a withdraw ≥ the half-up balance or a
 * repay ≥ the ceil debt burns every share) and are revalued with
 * `valueScaledPosition`; a new leg is minted from `amountBase`
 * (`valueBasePosition`) and takes its index, price and entry weights from
 * `delta.reserve` (no live price: pass the reserve you would supply into).
 * A leg driven to zero is dropped. The min-collateral floor and
 * `liveDataValid` carry over from `risk`.
 */
export function projectAccountRisk(risk: AccountRisk, deltas: PositionDelta[]): AccountRisk {
  const supplies = [...risk.supplies]
  const borrows = [...risk.borrows]
  for (const delta of deltas) {
    const list = delta.side === 'supply' ? supplies : borrows
    const idx = list.findIndex((p) => sameLeg(p, delta))
    const existing = idx === -1 ? undefined : list[idx]
    const change = signedBigInt(delta.amountBase)

    let projected: PositionValue | null
    if (!existing) {
      projected = change <= 0n ? null : valueBasePosition(seedFromReserve(delta), change)
    } else {
      const seed = {
        side: existing.side,
        hubId: existing.hubId,
        asset: existing.asset,
        decimals: existing.decimals,
        indexRay: BigInt(existing.indexRay),
        priceWad: BigInt(existing.usdPriceWad),
        entryLtvBps: existing.entryLtvBps,
        entryLiquidationThresholdBps: existing.entryLiquidationThresholdBps,
        entryLiquidationBonusBps: existing.entryLiquidationBonusBps,
        entryLiquidationFeesBps: existing.entryLiquidationFeesBps,
        liveDataUsed: existing.liveDataUsed,
      }
      const scaled = BigInt(existing.scaledRay)
      let next: bigint
      if (change >= 0n) {
        next = scaled + mintShares(seed.side, change, seed.decimals, seed.indexRay)
      } else {
        const exit = -change
        const closeAt =
          seed.side === 'supply' ? unscale(scaled, seed.indexRay, seed.decimals, 'halfUp') : BigInt(existing.amountBase)
        const burned = exit >= closeAt ? scaled : burnShares(seed.side, exit, seed.decimals, seed.indexRay)
        next = burned >= scaled ? 0n : scaled - burned
      }
      projected = next === 0n ? null : valueScaledPosition({ ...seed, scaledRay: next })
    }

    if (idx === -1) {
      if (projected) list.push(projected)
    } else if (projected) {
      list[idx] = projected
    } else {
      list.splice(idx, 1)
    }
  }
  return aggregateAccountRisk(
    { accountId: risk.accountId, owner: risk.owner, spokeId: risk.spokeId, mode: risk.mode },
    supplies,
    borrows,
    BigInt(risk.minBorrowCollateralUsdWad),
    risk.liveDataValid
  )
}

function seedFromReserve(delta: PositionDelta) {
  const reserve = delta.reserve
  if (!reserve) {
    throw new Error(
      `Stellar math: projectAccountRisk needs \`reserve\` for a new ${delta.side} position on ${delta.hubId}:${delta.asset}`
    )
  }
  return {
    side: delta.side,
    hubId: delta.hubId,
    asset: delta.asset,
    decimals: reserve.assetDecimals,
    indexRay: toBigInt(
      delta.side === 'supply' ? reserve.liveSupplyIndexRay : reserve.liveBorrowIndexRay,
      'reserve live index'
    ),
    priceWad: numberToWad(reserve.usdPrice),
    entryLtvBps: reserve.collateralFactorBps,
    entryLiquidationThresholdBps: reserve.liquidationThresholdBps,
    entryLiquidationBonusBps: reserve.liquidationPenaltyBps,
    entryLiquidationFeesBps: reserve.liquidationFeesBps,
    liveDataUsed: false,
  }
}

export type ReserveApyProjection = {
  /** Hub utilization after the flows, 0..1. */
  utilization: number
  utilizationRay: string
  /** Annual RAY rates from the curve. */
  borrowAprRay: string
  supplyAprRay: string
  /** Simple annual rates as fractions (`0.05` = 5%). */
  borrowApr: number
  supplyApr: number
  /** Continuously compounded `e^apr - 1`, fractions. */
  borrowApy: number
  supplyApy: number
}

/**
 * Hub rates after adding `supplyDeltaBase` / `borrowDeltaBase` (signed base
 * units) to the reserve's hub-pool totals. Utilization is
 * `curve.rs::utilization` over the projected totals; rates follow
 * `annualBorrowRateRay` / `depositRateRay`. Whether `ReserveDto.supplyApy`
 * / `borrowApy` are simple or compounded is not pinned by the API contract,
 * so both `*Apr` and `*Apy` are returned.
 */
export function projectReserveApy(
  reserve: ReserveDto,
  supplyDeltaBase: bigint | string = 0n,
  borrowDeltaBase: bigint | string = 0n
): ReserveApyProjection {
  const d = reserve.assetDecimals
  const clamp = (v: bigint): bigint => (v < 0n ? 0n : v)
  const supplied = clamp(numberToScaled(reserve.hubPool.suppliedShort, d) + signedBigInt(supplyDeltaBase))
  const borrowed = clamp(numberToScaled(reserve.hubPool.borrowedShort, d) + signedBigInt(borrowDeltaBase))
  const util = utilizationRay(baseToRay(borrowed, d), baseToRay(supplied, d))
  const borrowRate = annualBorrowRateRay(util, reserve.irm)
  const supplyRate = depositRateRay(util, borrowRate, reserve.irm.reserveFactorBps)
  return {
    utilization: rayToNumber(util),
    utilizationRay: util.toString(),
    borrowAprRay: borrowRate.toString(),
    supplyAprRay: supplyRate.toString(),
    borrowApr: rayAprToNumber(borrowRate),
    supplyApr: rayAprToNumber(supplyRate),
    borrowApy: rayAprToApy(borrowRate),
    supplyApy: rayAprToApy(supplyRate),
  }
}
