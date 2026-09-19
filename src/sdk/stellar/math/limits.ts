/**
 * Largest valid amount per action, in token base units, with the reason that
 * binds. Mirrors the gates the contract enforces rather than capping:
 *
 * - risk gate: `contracts/controller/src/risk/validation.rs`
 *   `require_post_pool_risk_gates` (debt ≤ `min(LTV, threshold)`-weighted
 *   collateral, HF ≥ 1, `ltv_collateral ≥ min_borrow_collateral_usd`);
 * - listing flags: `positions/mod.rs::enforce_spoke_asset_flags`
 *   (`paused` blocks every verb, `frozen` blocks entry only);
 * - spoke caps: `formulas.md` §Caps (native units, no unlimited sentinel);
 * - pool cash and the 200 BPS liquidation buffer:
 *   `contracts/pool/src/guards.rs::require_liquidation_buffer`;
 * - hub utilization ceiling: `guards.rs::require_utilization_below_max`
 *   (skipped when `max_utilization >= RAY`; repay and liquidation are exempt).
 *
 * Hub totals and pool cash come from the `*Short` display numbers on
 * `ReserveDto`, so cap / liquidity / utilization candidates are exact only to
 * the double precision of those fields; the risk-gate candidate is exact.
 * xoxno-ui parity: `stellar-limits.ts::computeStellarLimits`,
 * `utils.ts::calculateMaxBorrow / calculateMaxSupply / calculateMaxRemove`.
 */

import type { ReserveDto, StellarLendingLiveStateDto } from '../lending-api-types'
import type { AccountRisk, PositionValue } from './account'
import { buildLiveSnapshot, burnShares, liveIndexKey, mintShares } from './account'
import { utilizationRay } from './rates'
import {
  BPS,
  RAY,
  baseToRay,
  baseToShort,
  mulDivCeil,
  mulDivFloor,
  mulDivHalfUp,
  numberToScaled,
  numberToWad,
  positionValueWad,
  toBigInt,
  unscale,
} from './scaled'

export type LimitReason =
  | 'healthFactor'
  | 'ltv'
  | 'cap'
  | 'liquidity'
  | 'utilizationCap'
  | 'minCollateral'
  | 'paused'
  | 'frozen'
  | null

export type Limit = {
  /** Token base units. For a full-close withdraw this is the floor payout; sign `"0"` (the builder's withdraw-all sentinel) instead. */
  amountBase: bigint
  amountShort: number
  /** The amount closes the whole position (withdraw: pays the floor balance; repay: burns every debt share and refunds excess). */
  isFullClose: boolean
  /** Which gate produced `amountBase`; null when only the position size bounds it. */
  reason: LimitReason
  /** Hub utilization (0..1) after the action at `amountBase`; null when not applicable. */
  projectedUtilization: number | null
}

/** `common/src/constants/pool.rs::LIQUIDATION_BUFFER_BPS`. */
export const LIQUIDATION_BUFFER_BPS = 200n

type Candidate = { amount: bigint; reason: LimitReason }

const pickMin = (candidates: Candidate[]): Candidate =>
  candidates.reduce((best, c) => (c.amount < best.amount ? c : best))

const nonNegative = (v: bigint): bigint => (v < 0n ? 0n : v)

const finish = (
  chosen: Candidate,
  decimals: number,
  isFullClose: boolean,
  projectedUtilization: number | null
): Limit => ({
  amountBase: chosen.amount,
  amountShort: baseToShort(chosen.amount, decimals),
  isFullClose,
  reason: chosen.reason,
  projectedUtilization,
})

const zero = (reason: LimitReason): Limit => ({
  amountBase: 0n,
  amountShort: 0,
  isFullClose: false,
  reason,
  projectedUtilization: null,
})

type HubTotals = {
  suppliedBase: bigint
  borrowedBase: bigint
  cashBase: bigint
  spokeSuppliedBase: bigint
  spokeBorrowedBase: bigint
  /** null when the guard is disabled (`max_utilization >= RAY`). */
  maxUtilizationRay: bigint | null
}

/**
 * Reserve totals in base units from the API's display numbers.
 *
 * Assumption (Unverified against the API source): `availableLiquidityShort`
 * is the hub pool's cash (`pool/cache/mod.rs::cash()`), the base both
 * `require_reserves` and the liquidation buffer are checked against. The DTO
 * describes it only as "Available liquidity / cash" without a scope marker
 * while `suppliedShort` / `borrowedShort` are marked spoke-scoped and
 * `HubPoolDto` carries no cash field; if the API serves it spoke-scoped the
 * `liquidity` candidates are computed against the wrong base.
 */
function hubTotals(reserve: ReserveDto): HubTotals {
  const d = reserve.assetDecimals
  const maxUtil = toBigInt(reserve.irm.maxUtilizationRay, 'irm.maxUtilizationRay')
  return {
    suppliedBase: numberToScaled(reserve.hubPool.suppliedShort, d),
    borrowedBase: numberToScaled(reserve.hubPool.borrowedShort, d),
    cashBase: numberToScaled(reserve.availableLiquidityShort, d),
    spokeSuppliedBase: numberToScaled(reserve.suppliedShort, d),
    spokeBorrowedBase: numberToScaled(reserve.borrowedShort, d),
    maxUtilizationRay: maxUtil >= RAY ? null : maxUtil,
  }
}

const projectedUtil = (suppliedBase: bigint, borrowedBase: bigint): number | null =>
  suppliedBase <= 0n ? null : Number(borrowedBase) / Number(suppliedBase)

/** Price the reserve the way `computeAccountRisk` would: accepted live row, else `reserve.usdPrice`. */
function reservePriceWad(reserve: ReserveDto, liveState?: StellarLendingLiveStateDto): bigint {
  return buildLiveSnapshot(liveState).prices.get(reserve.asset) ?? numberToWad(reserve.usdPrice)
}

/**
 * Largest `x` in `[0, hi]` with `ok(x)` true, for a predicate that is true on
 * a prefix (every gate here is monotone in the amount). Binary search, so the
 * estimate feeding `hi` only needs to be an upper bound: rounding slack in the
 * gates is not bounded in base units (an 18-decimal token at $0.01 needs
 * hundreds of single-unit steps), so no fixed decrement count is safe.
 */
function fitMax(hi: bigint, ok: (x: bigint) => boolean): bigint {
  if (hi <= 0n || !ok(0n)) return 0n
  let lo = 0n // ok
  let bad = hi + 1n
  while (bad - lo > 1n) {
    const mid = (lo + bad) / 2n
    if (ok(mid)) lo = mid
    else bad = mid
  }
  return lo
}

/** Slack added to a rounding-free estimate before searching, so the exact answer is never above `hi`. */
const ESTIMATE_SLACK = 16n

/** Largest borrow keeping `half_up(borrowed / supplied) <= maxUtilization`; null when the guard does not apply. */
function utilizationBorrowCap(totals: HubTotals, decimals: number): bigint | null {
  const max = totals.maxUtilizationRay
  if (max === null) return null
  const suppliedRay = baseToRay(totals.suppliedBase, decimals)
  // `require_utilization_below_max` returns early with no supply; cash then binds.
  if (suppliedRay === 0n) return null
  const estimate = nonNegative(mulDivFloor(totals.suppliedBase, max, RAY) - totals.borrowedBase)
  return fitMax(
    estimate + ESTIMATE_SLACK,
    (x) => utilizationRay(baseToRay(totals.borrowedBase + x, decimals), suppliedRay) <= max
  )
}

/** Largest withdraw keeping `half_up(borrowed / (supplied - x)) <= maxUtilization`; null when unbounded. */
function utilizationWithdrawCap(totals: HubTotals, decimals: number): bigint | null {
  const max = totals.maxUtilizationRay
  if (max === null || totals.borrowedBase === 0n) return null
  if (max === 0n) return 0n
  const minSupplied = mulDivCeil(totals.borrowedBase, RAY, max)
  const hi = totals.suppliedBase < minSupplied ? 0n : totals.suppliedBase - minSupplied + ESTIMATE_SLACK
  const borrowedRay = baseToRay(totals.borrowedBase, decimals)
  return fitMax(hi > totals.suppliedBase ? totals.suppliedBase : hi, (x) => {
    const remaining = baseToRay(totals.suppliedBase - x, decimals)
    return remaining > 0n && utilizationRay(borrowedRay, remaining) <= max
  })
}

const findPosition = (list: PositionValue[], reserve: ReserveDto): PositionValue | undefined =>
  list.find((p) => p.hubId === reserve.hubId && p.asset === reserve.asset)

/**
 * Largest borrow of `reserve` the account can open now. Candidates, all in
 * base units:
 *
 * - LTV gate: the contract mints `calculate_scaled_borrow` (ceil) shares,
 *   merges them into the existing debt leg and requires
 *   `ltv_collateral >= total_debt` with the merged leg valued by
 *   `position_value_ceil` (`ops/borrow.rs::mint_debt`, `risk/totals.rs`,
 *   `risk/validation.rs`). The search runs on exactly that predicate, with
 *   the index and price `computeAccountRisk` used for the leg (else the
 *   accepted live row, else `reserve.liveBorrowIndexRay` / `reserve.usdPrice`).
 * - min-collateral floor, spoke borrow-cap headroom, pool cash minus the
 *   liquidation buffer, and the hub utilization ceiling.
 *
 * A reserve that is not borrowable reports 0 with reason `cap` (same effect
 * as a zero `borrowCap`).
 */
export function maxBorrow(risk: AccountRisk, reserve: ReserveDto, liveState?: StellarLendingLiveStateDto): Limit {
  if (reserve.paused) return zero('paused')
  if (reserve.frozen) return zero('frozen')
  if (!reserve.isBorrowable) return zero('cap')
  const d = reserve.assetDecimals
  const totals = hubTotals(reserve)
  const existing = findPosition(risk.borrows, reserve)
  const liveRow = buildLiveSnapshot(liveState).indexes.get(liveIndexKey(reserve.hubId, reserve.asset))
  const indexRay = existing
    ? BigInt(existing.indexRay)
    : toBigInt(liveRow?.borrowIndex ?? reserve.liveBorrowIndexRay, 'borrowIndex')
  const priceWad = existing ? BigInt(existing.usdPriceWad) : reservePriceWad(reserve, liveState)
  const existingScaled = existing ? BigInt(existing.scaledRay) : 0n
  const otherDebt = BigInt(risk.totalDebtUsdWad) - (existing ? BigInt(existing.usdWad) : 0n)

  const ltvCollateral = BigInt(risk.ltvWeightedCollateralUsdWad)
  const floorWad = BigInt(risk.minBorrowCollateralUsdWad)
  const candidates: Candidate[] = []
  if (ltvCollateral < floorWad) {
    candidates.push({ amount: 0n, reason: 'minCollateral' })
  } else {
    const headroom = ltvCollateral - BigInt(risk.totalDebtUsdWad)
    const estimate = headroom <= 0n || priceWad <= 0n ? 0n : mulDivFloor(headroom, 10n ** BigInt(d), priceWad)
    const debtAfter = (x: bigint): bigint =>
      otherDebt + positionValueWad(existingScaled + mintShares('borrow', x, d, indexRay), indexRay, priceWad, 'ceil')
    candidates.push({
      amount: estimate === 0n ? 0n : fitMax(estimate + ESTIMATE_SLACK, (x) => debtAfter(x) <= ltvCollateral),
      reason: 'ltv',
    })
  }
  candidates.push({
    amount: nonNegative(toBigInt(reserve.borrowCap, 'borrowCap') - totals.spokeBorrowedBase),
    reason: 'cap',
  })
  const buffer = mulDivHalfUp(totals.suppliedBase, LIQUIDATION_BUFFER_BPS, BPS)
  candidates.push({ amount: nonNegative(totals.cashBase - buffer), reason: 'liquidity' })
  const utilCap = utilizationBorrowCap(totals, d)
  if (utilCap !== null) candidates.push({ amount: utilCap, reason: 'utilizationCap' })

  const chosen = pickMin(candidates)
  return finish(chosen, d, false, projectedUtil(totals.suppliedBase, totals.borrowedBase + chosen.amount))
}

/**
 * Largest withdraw of the account's `reserve` supply. Candidates: the risk
 * gate (LTV-weighted collateral must stay ≥ `max(debt, floor)` — reported as
 * `healthFactor`, or `minCollateral` when the floor is the stricter bound),
 * pool cash, and the hub utilization ceiling. `paused` reports 0. When the
 * whole position can go, `amountBase` is the floor payout and `isFullClose`
 * is true — sign `"0"` so the contract takes the withdraw-all path
 * (`resolve_withdrawal` treats any request ≥ the half-up balance as full).
 * The position is priced as `risk` valued it, so `_liveState` is accepted for
 * signature symmetry with {@link maxBorrow} but not consulted.
 */
export function maxWithdraw(risk: AccountRisk, reserve: ReserveDto, _liveState?: StellarLendingLiveStateDto): Limit {
  if (reserve.paused) return zero('paused')
  const pos = findPosition(risk.supplies, reserve)
  if (!pos) return zero(null)
  const d = pos.decimals
  const totals = hubTotals(reserve)
  const scaled = BigInt(pos.scaledRay)
  const index = BigInt(pos.indexRay)
  const price = BigInt(pos.usdPriceWad)
  const payout = BigInt(pos.amountBase)
  const halfUp = unscale(scaled, index, d, 'halfUp')

  const debt = BigInt(risk.totalDebtUsdWad)
  const floorWad = BigInt(risk.minBorrowCollateralUsdWad)
  const bps = BigInt(Math.min(pos.entryLtvBps, pos.entryLiquidationThresholdBps))
  const candidates: Candidate[] = []
  let fullAllowed = true
  if (debt > 0n && bps > 0n) {
    const required = debt > floorWad ? debt : floorWad
    const reason: LimitReason = floorWad > debt ? 'minCollateral' : 'healthFactor'
    const others = BigInt(risk.ltvWeightedCollateralUsdWad) - BigInt(pos.ltvWeightedUsdWad)
    if (others < required) {
      fullAllowed = false
      const need = required - others
      const keepGateWad = mulDivCeil(need, BPS, bps)
      const removableWad = BigInt(pos.gateUsdWad) - keepGateWad
      const estimate = removableWad <= 0n ? 0n : mulDivFloor(removableWad, 10n ** BigInt(d), price)
      // A partial request at or above the half-up balance becomes a full close.
      const partialMax = halfUp > 0n ? halfUp - 1n : 0n
      const hi = estimate + ESTIMATE_SLACK > partialMax ? partialMax : estimate + ESTIMATE_SLACK
      const ltvAfter = (amount: bigint): bigint => {
        const burned = burnShares('supply', amount, d, index)
        const remaining = burned >= scaled ? 0n : scaled - burned
        return mulDivFloor(positionValueWad(remaining, index, price, 'floor'), bps, BPS)
      }
      candidates.push({ amount: fitMax(hi, (x) => ltvAfter(x) >= need), reason })
    }
  }
  candidates.push({ amount: payout, reason: null })
  candidates.push({ amount: totals.cashBase, reason: 'liquidity' })
  const utilCap = utilizationWithdrawCap(totals, d)
  if (utilCap !== null) candidates.push({ amount: utilCap, reason: 'utilizationCap' })

  const chosen = pickMin(candidates)
  const isFullClose = fullAllowed && chosen.amount >= payout
  return finish(chosen, d, isFullClose, projectedUtil(totals.suppliedBase - chosen.amount, totals.borrowedBase))
}

/**
 * Largest supply into `reserve`: the spoke supply-cap headroom
 * (`supplyCap - spoke supplied`, always enforced, `0` closes the side).
 * `paused` and `frozen` both block entry.
 */
export function maxSupply(reserve: ReserveDto): Limit {
  if (reserve.paused) return zero('paused')
  if (reserve.frozen) return zero('frozen')
  const d = reserve.assetDecimals
  const totals = hubTotals(reserve)
  const chosen: Candidate = {
    amount: nonNegative(toBigInt(reserve.supplyCap, 'supplyCap') - totals.spokeSuppliedBase),
    reason: 'cap',
  }
  return finish(chosen, d, false, projectedUtil(totals.suppliedBase + chosen.amount, totals.borrowedBase))
}

/**
 * Largest repay of the account's `reserve` debt: the ceil-rounded debt
 * (`unscale_borrow_ceil`, which `resolve_repay` treats as a full close and
 * refunds anything above), bounded by `walletBalance` (base units) when
 * given — reported as `liquidity`. `paused` reports 0.
 */
export function maxRepay(risk: AccountRisk, reserve: ReserveDto, walletBalance?: string | bigint): Limit {
  if (reserve.paused) return zero('paused')
  const pos = findPosition(risk.borrows, reserve)
  if (!pos) return zero(null)
  const d = pos.decimals
  const totals = hubTotals(reserve)
  const debt = BigInt(pos.amountBase)
  const wallet = walletBalance === undefined ? null : toBigInt(walletBalance, 'walletBalance')
  const chosen: Candidate =
    wallet !== null && wallet < debt ? { amount: wallet, reason: 'liquidity' } : { amount: debt, reason: null }
  return finish(
    chosen,
    d,
    chosen.amount >= debt,
    projectedUtil(totals.suppliedBase, nonNegative(totals.borrowedBase - chosen.amount))
  )
}
