/**
 * Interest-rate curve mirror of `rs-lending-xlm/common/src/rates/curve.rs`.
 * Annual RAY in, annual RAY out; `Ray::mul` / `Ray::div` are half-up
 * (`fp.rs`), matching the pool's view getters.
 */

import type { ReserveIrmCurveDto } from '../lending-api-types'
import { BPS, RAY, mulDivHalfUp, rayToNumber, toBigInt } from './scaled'

/** `Ray::mul` — half_up(a * b / RAY). */
const rayMul = (a: bigint, b: bigint): bigint => mulDivHalfUp(a, b, RAY)
/** `Ray::div` — half_up(a * RAY / b). */
const rayDiv = (a: bigint, b: bigint): bigint => mulDivHalfUp(a, RAY, b)

/**
 * `curve.rs::utilization` — `borrowed / supplied` half-up in RAY; zero when
 * nothing is supplied. The contract feeds it half-up-valued debt and supply
 * (`formulas.md` §Utilization and annual rates).
 */
export function utilizationRay(borrowedRay: bigint, suppliedRay: bigint): bigint {
  if (suppliedRay === 0n) return 0n
  return rayDiv(borrowedRay, suppliedRay)
}

/**
 * `curve.rs::calculate_annual_borrow_rate` — three-segment piecewise-linear
 * curve. Utilization is clamped to one RAY; below `mid` the rate ramps from
 * `base` by `slope1`, between `mid` and `optimal` by `slope2`, above
 * `optimal` by `slope3`; the result is capped at `maxBorrowRate`.
 */
export function annualBorrowRateRay(utilization: bigint, irm: ReserveIrmCurveDto): bigint {
  const u = utilization > RAY ? RAY : utilization
  const base = toBigInt(irm.baseRateRay, 'irm.baseRateRay')
  const slope1 = toBigInt(irm.slope1Ray, 'irm.slope1Ray')
  const slope2 = toBigInt(irm.slope2Ray, 'irm.slope2Ray')
  const slope3 = toBigInt(irm.slope3Ray, 'irm.slope3Ray')
  const mid = toBigInt(irm.midUtilizationRay, 'irm.midUtilizationRay')
  const optimal = toBigInt(irm.optimalUtilizationRay, 'irm.optimalUtilizationRay')
  const max = toBigInt(irm.maxBorrowRateRay, 'irm.maxBorrowRateRay')

  let rate: bigint
  if (u < mid) {
    rate = base + rayDiv(rayMul(u, slope1), mid)
  } else if (u < optimal) {
    const range = optimal - mid
    rate = base + slope1 + rayDiv(rayMul(u - mid, slope2), range)
  } else {
    const excess = u - optimal
    const range = RAY - optimal
    // `optimal == RAY` forces `u == RAY` (clamped) so `excess == 0`; the contract
    // would trap on the zero divisor, the SDK reports the kink rate instead.
    const contribution = range === 0n ? 0n : rayDiv(rayMul(excess, slope3), range)
    rate = base + slope1 + slope2 + contribution
  }
  return rate > max ? max : rate
}

/**
 * `curve.rs::calculate_deposit_rate` — supplier rate after the reserve factor:
 * `half_up(half_up(u * borrowRate / RAY) * (BPS - rf) / BPS)`. Zero at zero
 * utilization or a reserve factor outside `0..BPS`.
 */
export function depositRateRay(utilization: bigint, borrowRateRay: bigint, reserveFactorBps: number): bigint {
  if (utilization === 0n) return 0n
  if (!Number.isInteger(reserveFactorBps) || reserveFactorBps < 0 || reserveFactorBps >= 10_000) return 0n
  const rateXUtil = rayMul(utilization, borrowRateRay)
  return mulDivHalfUp(rateXUtil, BPS - BigInt(reserveFactorBps), BPS)
}

/** Annual RAY rate → simple APR as a fraction (`0.05` = 5%). */
export const rayAprToNumber = (rateRay: bigint): number => rayToNumber(rateRay)

/**
 * Annual RAY rate → continuously compounded APY fraction, `e^apr − 1`. The
 * pool compounds per millisecond with an eighth-order Taylor series
 * (`compound.rs`), which the continuous exponential approximates to well
 * within display precision.
 */
export const rayAprToApy = (rateRay: bigint): number => Math.expm1(rayToNumber(rateRay))
