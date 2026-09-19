/**
 * Parity between the SDK math and the xoxno-ui mirrors it replaces. The UI
 * functions are re-implemented inline below as the oracle, ported verbatim
 * (BigNumber integer ops → BigInt, floats kept as floats) from:
 *   - xoxno-ui/src/modules/lending/stellar-scaled-math.ts
 *       (`unscaleSupplyFloor`, `unscaleBorrowCeil`)
 *   - xoxno-ui/src/modules/lending/utils.ts
 *       (`getBorrowApy`, `getSupplyApy`, `getNewCollateral` + `getHealthPercentage`,
 *        `calculateMaxBorrow` cap headroom)
 *   - xoxno-ui/src/modules/lending/stellar-limits.ts
 *       (`resolveMaxUtilization`, `utilCapBorrowUsd`, `utilCapWithdrawUsd`)
 * Inputs are random but deterministic (mulberry32, fixed seed).
 */

import {
  RAY,
  WAD,
  aggregateAccountRisk,
  annualBorrowRateRay,
  depositRateRay,
  maxBorrow,
  maxWithdraw,
  rayAprToNumber,
  unscaleBorrowCeil,
  unscaleSupplyFloor,
  valueBasePosition,
} from '../../index'
import type { AccountRisk, ReserveDto, ReserveIrmCurveDto } from '../../index'

// ---------------------------------------------------------------------------
// UI oracle — stellar-scaled-math.ts
// ---------------------------------------------------------------------------
const uiMulDivFloor = (x: bigint, y: bigint, d: bigint): bigint => (x * y) / d
/** UI rounds the share product half-up, then ceils the decimal rescale. */
const uiMulDivHalfUp = (x: bigint, y: bigint, d: bigint): bigint => (x * y + d / 2n) / d
const uiRescaleFloor = (a: bigint, from: number, to: number): bigint =>
  to === from ? a : to > from ? a * 10n ** BigInt(to - from) : a / 10n ** BigInt(from - to)
const uiRescaleCeil = (a: bigint, from: number, to: number): bigint => {
  if (to === from) return a
  if (to > from) return a * 10n ** BigInt(to - from)
  const factor = 10n ** BigInt(from - to)
  const q = a / factor
  return a % factor === 0n ? q : q + 1n
}
const uiUnscaleSupplyFloor = (scaled: bigint, index: bigint, decimals: number): bigint =>
  uiRescaleFloor(uiMulDivFloor(scaled, index, RAY), 27, decimals)
const uiUnscaleBorrowCeil = (scaled: bigint, index: bigint, decimals: number): bigint =>
  uiRescaleCeil(uiMulDivHalfUp(scaled, index, RAY), 27, decimals)

// ---------------------------------------------------------------------------
// UI oracle — utils.ts getBorrowApy / getSupplyApy (floats)
// ---------------------------------------------------------------------------
type UiApyMarket = {
  baseRate: number
  slopeRate1: number
  slopeRate2: number
  slopeRate3: number
  midUsageRate: number
  optimalUsageRate: number
  maxBorrowRate: number
  reserveFactor: number
}
function uiGetBorrowApy(u: number, m: UiApyMarket): number {
  if (u <= m.midUsageRate) return m.baseRate + (u * m.slopeRate1) / m.midUsageRate
  if (u < m.optimalUsageRate && m.midUsageRate < u) {
    const r = m.baseRate + m.slopeRate1 + ((u - m.midUsageRate) * m.slopeRate2) / (m.optimalUsageRate - m.midUsageRate)
    return Math.min(r, m.maxBorrowRate)
  }
  const headroom = 1 - m.optimalUsageRate
  const r = m.baseRate + m.slopeRate1 + m.slopeRate2 + ((u - m.optimalUsageRate) * m.slopeRate3) / headroom
  return Math.min(r, m.maxBorrowRate)
}
const uiGetSupplyApy = (u: number, borrowRate: number, m: UiApyMarket): number => u * borrowRate * (1 - m.reserveFactor)

// ---------------------------------------------------------------------------
// UI oracle — utils.ts getNewCollateral + getHealthPercentage (floats)
// ---------------------------------------------------------------------------
type UiLeg = { amount: number; decimals: number; usdPrice: number; ltv: number; liquidationThreshold: number }
function uiGetHealthPercentage(supplied: UiLeg[], borrowed: UiLeg[]) {
  const usd = (l: UiLeg) => (l.amount / 10 ** l.decimals) * l.usdPrice
  const collateralInDollars = supplied.reduce((a, l) => a + usd(l), 0)
  const borrowedInDollars = borrowed.reduce((a, l) => a + usd(l), 0)
  const liquidationCollateralInDollars = supplied.reduce((a, l) => a + usd(l) * l.liquidationThreshold, 0)
  const weightedCollateralInDollars = supplied.reduce((a, l) => a + usd(l) * l.ltv, 0)
  const healthFactor = liquidationCollateralInDollars > 0 ? (borrowedInDollars / liquidationCollateralInDollars) * 100 : 0
  return { collateralInDollars, borrowedInDollars, liquidationCollateralInDollars, weightedCollateralInDollars, healthFactor }
}

// ---------------------------------------------------------------------------
// UI oracle — stellar-limits.ts
// ---------------------------------------------------------------------------
function uiResolveMaxUtilization(maxUtilizationRay: string): number | null {
  const ray = BigInt(maxUtilizationRay)
  if (ray <= 0n) return null
  if (ray >= RAY) return null
  return Number(ray) / 1e27
}
const uiUtilCapBorrowUsd = (supplied: number, borrowed: number, maxUtil: number | null): number =>
  maxUtil == null ? Infinity : Math.max(supplied * maxUtil - borrowed, 0)
const uiUtilCapWithdrawUsd = (supplied: number, borrowed: number, maxUtil: number | null): number => {
  if (maxUtil == null || maxUtil === 0) return Infinity
  if (borrowed <= 0) return Infinity
  return Math.max(supplied - borrowed / maxUtil, 0)
}
/** utils.ts calculateMaxBorrow: min(reserves, borrowCap − borrowAmount) in USD. */
const uiCalculateMaxBorrowUsd = (reservesBase: number, borrowCap: number, borrowAmount: number, decimals: number, price: number) =>
  (Math.min(reservesBase, Math.max(borrowCap - borrowAmount, 0)) / 10 ** decimals) * price

// ---------------------------------------------------------------------------
// deterministic randomness
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x5eed)
const randBigInt = (digits: number): bigint => {
  let s = ''
  for (let i = 0; i < digits; i += 1) s += Math.floor(rnd() * 10)
  return BigInt(s)
}
const rayFromNumber = (n: number): bigint => BigInt(Math.round(n * 1e9)) * 10n ** 18n
const ITERATIONS = 12
const DECIMALS = [6, 7, 18]

describe('parity: share → base units (stellar-scaled-math.ts)', () => {
  it('unscaleSupplyFloor matches the UI exactly', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const scaled = randBigInt(30)
      const index = RAY + randBigInt(27)
      const decimals = DECIMALS[i % DECIMALS.length] as number
      expect(unscaleSupplyFloor(scaled, index, decimals)).toBe(uiUnscaleSupplyFloor(scaled, index, decimals))
    }
  })

  it('unscaleBorrowCeil: UI half-up product can undershoot the contract ceil by one unit', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const scaled = randBigInt(30)
      const index = RAY + randBigInt(27)
      const decimals = DECIMALS[i % DECIMALS.length] as number
      const diff = unscaleBorrowCeil(scaled, index, decimals) - uiUnscaleBorrowCeil(scaled, index, decimals)
      expect(diff === 0n || diff === 1n).toBe(true)
    }
    // Constructed divergence: contract (mul_ceil + to_asset_ceil) charges 2, UI charges 1.
    expect(unscaleBorrowCeil(10n ** 20n, RAY + 3n, 7)).toBe(2n)
    expect(uiUnscaleBorrowCeil(10n ** 20n, RAY + 3n, 7)).toBe(1n)
  })
})

describe('parity: rate curve (utils.ts getBorrowApy / getSupplyApy)', () => {
  it('annualBorrowRateRay / depositRateRay match the float curve', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const mid = 0.2 + rnd() * 0.4
      const optimal = mid + 0.05 + rnd() * (0.9 - mid)
      const m: UiApyMarket = {
        baseRate: rnd() * 0.05,
        slopeRate1: rnd() * 0.1,
        slopeRate2: rnd() * 0.3,
        slopeRate3: rnd() * 2,
        midUsageRate: mid,
        optimalUsageRate: optimal,
        maxBorrowRate: 0.5 + rnd() * 1.5,
        reserveFactor: Math.floor(rnd() * 5000) / 10_000,
      }
      const irm: ReserveIrmCurveDto = {
        baseRateRay: rayFromNumber(m.baseRate).toString(),
        slope1Ray: rayFromNumber(m.slopeRate1).toString(),
        slope2Ray: rayFromNumber(m.slopeRate2).toString(),
        slope3Ray: rayFromNumber(m.slopeRate3).toString(),
        midUtilizationRay: rayFromNumber(m.midUsageRate).toString(),
        optimalUtilizationRay: rayFromNumber(m.optimalUsageRate).toString(),
        maxUtilizationRay: RAY.toString(),
        maxBorrowRateRay: rayFromNumber(m.maxBorrowRate).toString(),
        reserveFactorBps: Math.round(m.reserveFactor * 10_000),
      }
      // the RAY inputs are 9-decimal roundings of the floats; re-read them so both sides see the same numbers
      const exact = (r: string) => Number(BigInt(r)) / 1e27
      const mExact: UiApyMarket = {
        ...m,
        baseRate: exact(irm.baseRateRay),
        slopeRate1: exact(irm.slope1Ray),
        slopeRate2: exact(irm.slope2Ray),
        slopeRate3: exact(irm.slope3Ray),
        midUsageRate: exact(irm.midUtilizationRay),
        optimalUsageRate: exact(irm.optimalUtilizationRay),
        maxBorrowRate: exact(irm.maxBorrowRateRay),
      }
      const u = rnd() * 1.1
      const uRay = rayFromNumber(u)
      const uExact = exact(uRay.toString())
      const borrowRay = annualBorrowRateRay(uRay, irm)
      const uiBorrow = uiGetBorrowApy(Math.min(uExact, 1), mExact)
      expect(rayAprToNumber(borrowRay)).toBeCloseTo(uiBorrow, 9)
      const uiSupply = uiGetSupplyApy(Math.min(uExact, 1), uiBorrow, mExact)
      const sdkSupply = rayAprToNumber(depositRateRay(uRay > RAY ? RAY : uRay, borrowRay, irm.reserveFactorBps))
      expect(sdkSupply).toBeCloseTo(uiSupply, 9)
    }
  })
})

const baseReserve = (asset: string, decimals: number, price: number, over: Partial<ReserveDto> = {}): ReserveDto => ({
  spokeId: 1,
  hubId: 1,
  asset,
  assetDecimals: decimals,
  supplyApy: 0,
  borrowApy: 0,
  utilization: 0,
  suppliedShort: 0,
  borrowedShort: 0,
  availableLiquidityShort: 1e9,
  usdPrice: price,
  depositsUsd: 0,
  borrowsUsd: 0,
  availableLiquidityUsd: 0,
  hubPool: { suppliedShort: 1e9, borrowedShort: 0, depositsUsd: 0, borrowsUsd: 0 },
  supplyCap: '1' + '0'.repeat(30),
  borrowCap: '1' + '0'.repeat(30),
  supplyCapShort: 0,
  borrowCapShort: 0,
  depositCapFilledPct: 0,
  borrowCapFilledPct: 0,
  isFlashloanable: false,
  flashloanFeeBps: 0,
  liveSupplyIndexRay: RAY.toString(),
  liveBorrowIndexRay: RAY.toString(),
  collateralFactorBps: 7000,
  liquidationThresholdBps: 8000,
  liquidationPenaltyBps: 0,
  liquidationFeesBps: 0,
  isCollateralizable: true,
  isBorrowable: true,
  paused: false,
  frozen: false,
  noSeize: false,
  useAsCollateral: true,
  targetHealthFactorWad: WAD.toString(),
  healthFactorForMaxBonusWad: WAD.toString(),
  liquidationBonusFactorBps: 0,
  irm: {
    baseRateRay: '0',
    slope1Ray: '0',
    slope2Ray: '0',
    slope3Ray: '0',
    midUtilizationRay: (RAY / 2n).toString(),
    optimalUtilizationRay: ((RAY * 4n) / 5n).toString(),
    maxUtilizationRay: RAY.toString(),
    maxBorrowRateRay: RAY.toString(),
    reserveFactorBps: 0,
  },
  supportedCollateral: [],
  borrowable: [],
  ...over,
})

/** Build an AccountRisk from base-unit legs (prices as WAD from integer cents). */
function riskFromLegs(supplies: UiLeg[], borrows: UiLeg[]): AccountRisk {
  const toPv = (side: 'supply' | 'borrow', l: UiLeg, i: number) =>
    valueBasePosition(
      {
        side,
        hubId: 1,
        asset: `${side}-${i}`,
        decimals: l.decimals,
        indexRay: RAY,
        priceWad: BigInt(Math.round(l.usdPrice * 1e6)) * 10n ** 12n,
        entryLtvBps: Math.round(l.ltv * 10_000),
        entryLiquidationThresholdBps: Math.round(l.liquidationThreshold * 10_000),
        entryLiquidationBonusBps: 0,
        entryLiquidationFeesBps: 0,
        liveDataUsed: false,
      },
      BigInt(l.amount)
    )
  return aggregateAccountRisk(
    { accountId: '1', owner: 'G', spokeId: 1, mode: 0 },
    supplies.map((l, i) => toPv('supply', l, i)),
    borrows.map((l, i) => toPv('borrow', l, i)),
    5n * WAD,
    false
  )
}

const randLeg = (): UiLeg => {
  const decimals = DECIMALS[Math.floor(rnd() * DECIMALS.length)] as number
  const thr = 0.5 + Math.floor(rnd() * 4000) / 10_000
  return {
    amount: Math.floor(rnd() * 1e6) * 10 ** Math.max(decimals - 6, 0) + 1,
    decimals,
    usdPrice: Math.round((0.01 + rnd() * 100) * 1e6) / 1e6,
    ltv: thr - Math.floor(rnd() * 2000) / 10_000,
    liquidationThreshold: thr,
  }
}

describe('parity: health percentage (utils.ts getHealthPercentage)', () => {
  it('healthPercent and USD totals agree to float precision', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const supplies = [randLeg(), randLeg()]
      const borrows = [randLeg()]
      const ui = uiGetHealthPercentage(supplies, borrows)
      const sdk = riskFromLegs(supplies, borrows)
      const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9)
      expect(rel(sdk.totalCollateralUsd, ui.collateralInDollars)).toBeLessThan(1e-9)
      expect(rel(sdk.totalDebtUsd, ui.borrowedInDollars)).toBeLessThan(1e-9)
      expect(rel(sdk.liquidationWeightedCollateralUsd, ui.liquidationCollateralInDollars)).toBeLessThan(1e-9)
      expect(rel(sdk.ltvWeightedCollateralUsd, ui.weightedCollateralInDollars)).toBeLessThan(1e-9)
      expect(rel(sdk.healthPercent, ui.healthFactor)).toBeLessThan(1e-9)
      // contract HF is the inverse of the UI percentage
      expect(rel((sdk.healthFactor as number) * ui.healthFactor, 100)).toBeLessThan(1e-9)
    }
  })
})

describe('parity: utilization and cap limits (stellar-limits.ts, utils.ts calculateMaxBorrow)', () => {
  const whale = riskFromLegs(
    [{ amount: 1e15, decimals: 6, usdPrice: 1, ltv: 0.8, liquidationThreshold: 0.9 }],
    []
  )

  it('maxBorrow utilization ceiling matches utilCapBorrowUsd', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const supplied = Math.floor(rnd() * 1e6) + 1000
      const borrowed = Math.floor(rnd() * supplied * 0.5)
      const maxUtilRay = rayFromNumber(0.5 + rnd() * 0.45).toString()
      const price = Math.round((0.1 + rnd() * 10) * 1e6) / 1e6
      const reserve = baseReserve('A', 7, price, {
        hubPool: { suppliedShort: supplied, borrowedShort: borrowed, depositsUsd: 0, borrowsUsd: 0 },
        availableLiquidityShort: supplied,
        irm: { ...baseReserve('A', 7, price).irm, maxUtilizationRay: maxUtilRay },
      })
      const sdk = maxBorrow(whale, reserve)
      expect(sdk.reason).toBe('utilizationCap')
      const uiUsd = uiUtilCapBorrowUsd(supplied * price, borrowed * price, uiResolveMaxUtilization(maxUtilRay))
      expect(Math.abs(sdk.amountShort * price - uiUsd) / Math.max(uiUsd, 1)).toBeLessThan(1e-6)
    }
  })

  it('maxWithdraw utilization ceiling matches utilCapWithdrawUsd', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const supplied = Math.floor(rnd() * 1e6) + 1000
      const borrowed = Math.floor(rnd() * supplied * 0.5) + 1
      const maxUtilRay = rayFromNumber(0.6 + rnd() * 0.35).toString()
      const price = Math.round((0.1 + rnd() * 10) * 1e6) / 1e6
      const reserve = baseReserve('supply-0', 7, price, {
        hubPool: { suppliedShort: supplied, borrowedShort: borrowed, depositsUsd: 0, borrowsUsd: 0 },
        availableLiquidityShort: supplied,
        irm: { ...baseReserve('supply-0', 7, price).irm, maxUtilizationRay: maxUtilRay },
      })
      const risk = riskFromLegs([{ amount: 1e15, decimals: 7, usdPrice: price, ltv: 0.8, liquidationThreshold: 0.9 }], [])
      const sdk = maxWithdraw(risk, reserve)
      expect(sdk.reason).toBe('utilizationCap')
      const uiUsd = uiUtilCapWithdrawUsd(supplied * price, borrowed * price, uiResolveMaxUtilization(maxUtilRay))
      expect(Math.abs(sdk.amountShort * price - uiUsd) / Math.max(uiUsd, 1)).toBeLessThan(1e-6)
    }
  })

  it('maxBorrow cap headroom matches calculateMaxBorrow', () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const decimals = 7
      const cap = Math.floor(rnd() * 1e6) + 1
      const used = Math.floor(rnd() * cap)
      const cash = Math.floor(rnd() * 1e6) + 1
      const price = Math.round((0.1 + rnd() * 10) * 1e6) / 1e6
      const reserve = baseReserve('B', decimals, price, {
        borrowCap: (BigInt(cap) * 10n ** 7n).toString(),
        borrowedShort: used,
        availableLiquidityShort: cash,
        // no buffer: an empty hub pool has nothing to reserve
        hubPool: { suppliedShort: 0, borrowedShort: 0, depositsUsd: 0, borrowsUsd: 0 },
      })
      const sdk = maxBorrow(whale, reserve)
      expect(['cap', 'liquidity']).toContain(sdk.reason)
      const uiUsd = uiCalculateMaxBorrowUsd(cash * 1e7, cap * 1e7, used * 1e7, decimals, price)
      expect(Math.abs(sdk.amountShort * price - uiUsd) / Math.max(uiUsd, 1)).toBeLessThan(1e-9)
    }
  })
})
