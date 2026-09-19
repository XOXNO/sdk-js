/**
 * Hand-checked unit tests for the fixed-point primitives (`scaled.ts`) and the
 * rate curve (`rates.ts`). Expected values are worked by hand from
 * `rs-lending-xlm/common/src/math/fp_core.rs` and `common/src/rates/curve.rs`.
 */

import {
  BPS,
  RAY,
  WAD,
  annualBorrowRateRay,
  baseToRay,
  baseValueWad,
  depositRateRay,
  divByIntHalfUp,
  mulDivCeil,
  mulDivFloor,
  mulDivHalfUp,
  numberToScaled,
  numberToWad,
  positionValueWad,
  rayAprToApy,
  rayAprToNumber,
  rescaleCeil,
  rescaleFloor,
  rescaleHalfUp,
  toBigInt,
  unscaleBorrowCeil,
  unscaleHalfUp,
  unscaleSupplyFloor,
  utilizationRay,
} from '../../index'
import type { ReserveIrmCurveDto } from '../../index'

/** Decimal string → RAY, e.g. `ray('1.5')`. */
const ray = (n: string): bigint => {
  const [whole = '0', frac = ''] = n.split('.')
  return BigInt(whole + frac.padEnd(27, '0'))
}

describe('fixed-point primitives', () => {
  it('constants', () => {
    expect(RAY).toBe(10n ** 27n)
    expect(WAD).toBe(10n ** 18n)
    expect(BPS).toBe(10_000n)
    expect(ray('1.5')).toBe(1_500_000_000_000_000_000_000_000_000n)
  })

  it('mul_div rounding: (2RAY+1)(RAY+1)/RAY = 2RAY + 3 + 1/RAY', () => {
    const x = 2n * RAY + 1n
    const y = RAY + 1n
    expect(mulDivFloor(x, y, RAY)).toBe(2n * RAY + 3n)
    expect(mulDivCeil(x, y, RAY)).toBe(2n * RAY + 4n)
    expect(mulDivHalfUp(x, y, RAY)).toBe(2n * RAY + 3n)
    // exact half rounds up
    expect(mulDivHalfUp(1n, 1n, 2n)).toBe(1n)
    expect(mulDivHalfUp(1n, 1n, 3n)).toBe(0n)
    expect(() => mulDivFloor(1n, 1n, 0n)).toThrow('division by zero')
  })

  it('div_by_int_half_up: odd divisor uses ceil(b/2)', () => {
    expect(divByIntHalfUp(7n, 3n)).toBe(2n) // 2.33
    expect(divByIntHalfUp(8n, 3n)).toBe(3n) // 2.67
    expect(divByIntHalfUp(5n, 2n)).toBe(3n) // 2.5 → 3
    expect(divByIntHalfUp(4n, 3n)).toBe(1n) // 1.33
  })

  it('rescale between decimal scales', () => {
    expect(rescaleFloor(2n * RAY + 3n, 27, 18)).toBe(2n * WAD)
    expect(rescaleCeil(2n * RAY + 4n, 27, 18)).toBe(2n * WAD + 1n)
    expect(rescaleHalfUp(2n * RAY + 500_000_000n, 27, 18)).toBe(2n * WAD + 1n)
    expect(rescaleHalfUp(2n * RAY + 499_999_999n, 27, 18)).toBe(2n * WAD)
    expect(rescaleFloor(5n, 7, 27)).toBe(5n * 10n ** 20n)
    expect(rescaleCeil(5n, 7, 7)).toBe(5n)
    expect(baseToRay(10_000_000n, 7)).toBe(RAY)
  })

  it('toBigInt validates the string boundary', () => {
    expect(toBigInt(' 42 ')).toBe(42n)
    expect(toBigInt(7)).toBe(7n)
    expect(() => toBigInt('-1')).toThrow('non-negative')
    expect(() => toBigInt('1.5')).toThrow('decimal integer string')
    expect(() => toBigInt(1.5)).toThrow('safe integer')
  })

  it('numberToScaled / numberToWad avoid float arithmetic', () => {
    expect(numberToWad(0.5)).toBe(500_000_000_000_000_000n)
    expect(numberToWad(120_000)).toBe(120_000n * WAD)
    expect(numberToScaled(1.2345678, 7)).toBe(12_345_678n)
    expect(numberToScaled(Number.NaN, 7)).toBe(0n)
    expect(numberToScaled(-3, 7)).toBe(0n)
    expect(numberToScaled(1e21, 7)).toBe(0n) // toFixed would yield '1e+21'
  })
})

describe('share ↔ base-unit conversion (scaling.rs)', () => {
  it('a single RAY unit of value: floor pays 0, ceil charges 1', () => {
    expect(unscaleSupplyFloor('1', RAY, 7)).toBe(0n)
    expect(unscaleBorrowCeil('1', RAY, 7)).toBe(1n)
    expect(unscaleHalfUp('1', RAY, 7)).toBe(0n)
  })

  it('1000 shares at index 1.1 with 7 decimals = 1100 tokens', () => {
    const scaled = 1000n * RAY
    const index = ray('1.1')
    expect(unscaleSupplyFloor(scaled, index, 7)).toBe(11_000_000_000n)
    expect(unscaleBorrowCeil(scaled, index, 7)).toBe(11_000_000_000n)
  })

  it('mul_ceil then to_asset_ceil (contract) vs half-up then ceil (UI mirror)', () => {
    // scaled = 1e20 (1e-7 shares), index = RAY + 3 → product = 1e20 + 3e-7 RAY units.
    // contract: ceil → 1e20 + 1 → to_asset_ceil(7) = 2. UI: half-up → 1e20 → 1.
    expect(unscaleBorrowCeil(10n ** 20n, RAY + 3n, 7)).toBe(2n)
  })

  it('position_value rounding directions (value.rs)', () => {
    const scaled = 3n * RAY + 1n // 3 shares + dust
    const index = RAY + 1n
    const price = numberToWad(0.5)
    // product = 3RAY + 4 + 1/RAY → floor 3RAY+4, ceil 3RAY+5, half-up 3RAY+4
    // to WAD: floor → 3e18, ceil → 3e18+1, half-up → 3e18
    // × 0.5: floor → 1.5e18, ceil → ceil(1.5e18 + 0.5) = 1.5e18+1, half-up → 1.5e18
    expect(positionValueWad(scaled, index, price, 'floor')).toBe(1_500_000_000_000_000_000n)
    expect(positionValueWad(scaled, index, price, 'ceil')).toBe(1_500_000_000_000_000_001n)
    expect(positionValueWad(scaled, index, price, 'halfUp')).toBe(1_500_000_000_000_000_000n)
    expect(baseValueWad(30_000_000n, 7, price, 'floor')).toBe(1_500_000_000_000_000_000n)
  })
})

const irm: ReserveIrmCurveDto = {
  baseRateRay: ray('0.02').toString(),
  slope1Ray: ray('0.04').toString(),
  slope2Ray: ray('0.1').toString(),
  slope3Ray: ray('1').toString(),
  midUtilizationRay: ray('0.4').toString(),
  optimalUtilizationRay: ray('0.8').toString(),
  maxUtilizationRay: ray('0.9').toString(),
  maxBorrowRateRay: ray('2').toString(),
  reserveFactorBps: 1000,
}

describe('rate curve (curve.rs)', () => {
  it('utilization = borrowed / supplied half-up, zero without supply', () => {
    expect(utilizationRay(300n * RAY, 1000n * RAY)).toBe(ray('0.3'))
    expect(utilizationRay(1n, 0n)).toBe(0n)
    expect(utilizationRay(1n * RAY, 3n * RAY)).toBe(333_333_333_333_333_333_333_333_333n)
    expect(utilizationRay(2n * RAY, 3n * RAY)).toBe(666_666_666_666_666_666_666_666_667n)
  })

  it('three segments, clamp and cap', () => {
    expect(annualBorrowRateRay(ray('0.2'), irm)).toBe(ray('0.04')) // 0.02 + 0.2·0.04/0.4
    expect(annualBorrowRateRay(ray('0.4'), irm)).toBe(ray('0.06')) // kink: base + slope1
    expect(annualBorrowRateRay(ray('0.6'), irm)).toBe(ray('0.11')) // 0.06 + 0.2·0.1/0.4
    expect(annualBorrowRateRay(ray('0.9'), irm)).toBe(ray('0.66')) // 0.16 + 0.1·1/0.2
    expect(annualBorrowRateRay(ray('1.5'), irm)).toBe(ray('1.16')) // clamped to 1
    expect(annualBorrowRateRay(ray('0.9'), { ...irm, maxBorrowRateRay: ray('0.5').toString() })).toBe(ray('0.5'))
    // optimal == RAY: the third segment has no range; kink rate is reported instead of trapping
    expect(annualBorrowRateRay(RAY, { ...irm, optimalUtilizationRay: RAY.toString() })).toBe(ray('0.16'))
  })

  it('deposit rate = u × borrow × (1 − rf)', () => {
    expect(depositRateRay(ray('0.6'), ray('0.11'), 1000)).toBe(ray('0.0594'))
    expect(depositRateRay(0n, ray('0.11'), 1000)).toBe(0n)
    expect(depositRateRay(ray('0.6'), ray('0.11'), 10_000)).toBe(0n)
    expect(depositRateRay(ray('0.6'), ray('0.11'), -1)).toBe(0n)
  })

  it('APR / APY display conversion', () => {
    expect(rayAprToNumber(ray('0.05'))).toBeCloseTo(0.05, 15)
    expect(rayAprToApy(ray('0.05'))).toBeCloseTo(Math.exp(0.05) - 1, 15)
    expect(rayAprToApy(0n)).toBe(0)
  })
})
