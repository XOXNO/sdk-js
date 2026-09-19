/**
 * Fixture-driven tests for `computeAccountRisk`, the limit helpers and the
 * projections. Expected health factors are worked by hand from
 * `rs-lending-xlm/docs/reference/formulas.md` §Valuation and health:
 *   value_usd = round(round(round(shares·index/RAY)/1e9)·price/WAD)
 *   ltv_collateral = Σ floor(floor-value · min(ltv, threshold) / BPS)
 *   weighted_collateral = Σ floor(floor-value · threshold / BPS)
 *   debt = Σ ceil-value; HF = floor(weighted_collateral · WAD / debt)
 */

import {
  DEFAULT_MIN_BORROW_COLLATERAL_USD_WAD,
  RAY,
  WAD,
  computeAccountRisk,
  maxBorrow,
  maxRepay,
  maxSupply,
  maxWithdraw,
  projectAccountRisk,
  projectReserveApy,
} from '../../index'
import type { AccountPositionDto, ReserveDto, StellarLendingLiveStateDto } from '../../index'

const ray = (n: string): bigint => {
  const [whole = '0', frac = ''] = n.split('.')
  return BigInt(whole + frac.padEnd(27, '0'))
}
const wad = (n: string): bigint => {
  const [whole = '0', frac = ''] = n.split('.')
  return BigInt(whole + frac.padEnd(18, '0'))
}

const XLM = 'CXLM'
const USDC = 'CUSDC'

const reserve = (overrides: Partial<ReserveDto> & Pick<ReserveDto, 'asset' | 'assetDecimals' | 'usdPrice'>): ReserveDto => ({
  spokeId: 1,
  hubId: 1,
  supplyApy: 0,
  borrowApy: 0,
  utilization: 0,
  suppliedShort: 0,
  borrowedShort: 0,
  availableLiquidityShort: 9790,
  depositsUsd: 0,
  borrowsUsd: 0,
  availableLiquidityUsd: 0,
  hubPool: { suppliedShort: 10_000, borrowedShort: 210, depositsUsd: 0, borrowsUsd: 0 },
  supplyCap: '100000000000000',
  borrowCap: '100000000000000',
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
  liquidationPenaltyBps: 500,
  liquidationFeesBps: 1000,
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
    baseRateRay: ray('0.02').toString(),
    slope1Ray: ray('0.04').toString(),
    slope2Ray: ray('0.1').toString(),
    slope3Ray: ray('1').toString(),
    midUtilizationRay: ray('0.4').toString(),
    optimalUtilizationRay: ray('0.8').toString(),
    maxUtilizationRay: ray('0.9').toString(),
    maxBorrowRateRay: ray('2').toString(),
    reserveFactorBps: 1000,
  },
  supportedCollateral: [],
  borrowable: [],
  ...overrides,
})

const xlmReserve = reserve({
  asset: XLM,
  assetDecimals: 7,
  usdPrice: 0.5,
  suppliedShort: 1100,
  liveSupplyIndexRay: ray('1.1').toString(),
  supplyCap: '100000000000', // 10,000 XLM
})
const usdcReserve = reserve({
  asset: USDC,
  assetDecimals: 6,
  usdPrice: 1,
  borrowedShort: 210,
  liveBorrowIndexRay: ray('1.05').toString(),
  borrowCap: '1000000000000', // 1,000,000 USDC
})
const reserves = { [`1:1:${XLM}`]: xlmReserve, [`1:1:${USDC}`]: usdcReserve }

const position = (overrides: Partial<AccountPositionDto> & Pick<AccountPositionDto, 'asset'>): AccountPositionDto => ({
  accountId: '7',
  owner: 'GOWNER',
  spokeId: 1,
  hubId: 1,
  positionMode: 0,
  supplyScaledRay: '0',
  borrowScaledRay: '0',
  supplyIndexRay: null,
  borrowIndexRay: null,
  supplyAmount: '0',
  borrowAmount: '0',
  liveSupplyIndexRay: null,
  liveBorrowIndexRay: null,
  entryLtvBps: 7000,
  entryLiquidationThresholdBps: 8000,
  entryLiquidationBonusBps: 500,
  entryLiquidationFeesBps: 1000,
  initialPaymentMultiplier: null,
  updatedAt: 0,
  ledger: 0,
  ...overrides,
})

/** 1000 XLM shares at index 1.1 → 1100 XLM → $550; ltv-weighted $385, threshold-weighted $440. */
const xlmSupply = position({
  asset: XLM,
  supplyScaledRay: (1000n * RAY).toString(),
  liveSupplyIndexRay: ray('1.1').toString(),
})
/** 200 USDC debt shares at index 1.05 → 210 USDC → $210. */
const usdcDebt210 = position({
  asset: USDC,
  borrowScaledRay: (200n * RAY).toString(),
  liveBorrowIndexRay: ray('1.05').toString(),
})
/** 450 USDC debt shares at index 1.0 → $450. */
const usdcDebt450 = position({
  asset: USDC,
  borrowScaledRay: (450n * RAY).toString(),
  liveBorrowIndexRay: RAY.toString(),
})

const liveState: StellarLendingLiveStateDto = {
  indexes: [
    {
      hubId: 1,
      asset: XLM,
      supplyIndex: ray('1.1').toString(),
      supplyIndexShort: 1.1,
      borrowIndex: RAY.toString(),
      borrowIndexShort: 1,
      usdPrice: wad('0.5').toString(),
      usdPriceShort: 0.5,
      primaryPriceUsd: wad('0.5').toString(),
      primaryPriceUsdShort: 0.5,
      anchorPriceUsd: wad('0.5').toString(),
      anchorPriceUsdShort: 0.5,
      chain: 'stellar' as never,
    },
    {
      hubId: 1,
      asset: USDC,
      supplyIndex: RAY.toString(),
      supplyIndexShort: 1,
      borrowIndex: ray('1.05').toString(),
      borrowIndexShort: 1.05,
      usdPrice: WAD.toString(),
      usdPriceShort: 1,
      primaryPriceUsd: WAD.toString(),
      primaryPriceUsdShort: 1,
      anchorPriceUsd: WAD.toString(),
      anchorPriceUsdShort: 1,
      chain: 'stellar' as never,
    },
  ],
  minBorrowCollateralUsdWad: (5n * WAD).toString(),
}

describe('computeAccountRisk — hand-built scenarios', () => {
  it('scenario A: single collateral, no debt', () => {
    const risk = computeAccountRisk({ positions: [xlmSupply], reserves, liveState })
    expect(risk.accountId).toBe('7')
    expect(risk.supplies).toHaveLength(1)
    expect(risk.borrows).toHaveLength(0)
    const [s] = risk.supplies
    expect(s?.amountBase).toBe('11000000000')
    expect(s?.amountShort).toBe(1100)
    expect(s?.usdWad).toBe(wad('550').toString())
    expect(s?.ltvWeightedUsdWad).toBe(wad('385').toString())
    expect(s?.liquidationWeightedUsdWad).toBe(wad('440').toString())
    expect(risk.totalCollateralUsd).toBe(550)
    expect(risk.ltvWeightedCollateralUsd).toBe(385)
    expect(risk.liquidationWeightedCollateralUsd).toBe(440)
    expect(risk.totalDebtUsdWad).toBe('0')
    expect(risk.healthFactorWad).toBeNull()
    expect(risk.healthFactor).toBeNull()
    expect(risk.healthPercent).toBe(0)
    expect(risk.borrowLimitUsd).toBe(385)
    expect(risk.availableBorrowUsd).toBe(385)
    expect(risk.minBorrowCollateralUsdWad).toBe((5n * WAD).toString())
    expect(risk.isLiquidatable).toBe(false)
    expect(risk.liveDataValid).toBe(true)
  })

  it('scenario B: collateral + debt, healthy — HF = floor(440e36 / 210e18)', () => {
    const risk = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState })
    expect(risk.borrows[0]?.amountBase).toBe('210000000')
    expect(risk.totalDebtUsdWad).toBe(wad('210').toString())
    expect(risk.healthFactorWad).toBe('2095238095238095238')
    expect(risk.healthFactor).toBeCloseTo(2.095238095238095, 12)
    expect(risk.healthPercent).toBeCloseTo((210 / 440) * 100, 12)
    expect(risk.availableBorrowUsd).toBe(175)
    expect(risk.isLiquidatable).toBe(false)
  })

  it('scenario C: collateral + debt, liquidatable — HF = floor(440e36 / 450e18)', () => {
    // live USDC borrow index at par so 450 shares are $450
    const atPar: StellarLendingLiveStateDto = {
      ...liveState,
      indexes: liveState.indexes.map((row) => (row.asset === USDC ? { ...row, borrowIndex: RAY.toString() } : row)),
    }
    const risk = computeAccountRisk({ positions: [xlmSupply, usdcDebt450], reserves, liveState: atPar })
    expect(risk.totalDebtUsdWad).toBe(wad('450').toString())
    expect(risk.healthFactorWad).toBe('977777777777777777')
    expect(risk.isLiquidatable).toBe(true)
    expect(risk.availableBorrowUsdWad).toBe('0')
    expect(risk.healthPercent).toBeCloseTo((450 / 440) * 100, 12)
  })

  it('falls back to position indexes and reserve price without live state', () => {
    const risk = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves })
    expect(risk.healthFactorWad).toBe('2095238095238095238')
    expect(risk.liveDataValid).toBe(false)
    expect(risk.minBorrowCollateralUsdWad).toBe(DEFAULT_MIN_BORROW_COLLATERAL_USD_WAD.toString())
    expect(risk.minBorrowCollateralUsd).toBe(5)
  })

  it('rejects divergent live rows and flagged oracle rows, then falls back', () => {
    const divergent: StellarLendingLiveStateDto = {
      ...liveState,
      indexes: [
        ...liveState.indexes,
        { ...(liveState.indexes[0] as StellarLendingLiveStateDto['indexes'][number]), supplyIndex: ray('1.2').toString() },
      ],
    }
    const risk = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState: divergent })
    expect(risk.liveDataValid).toBe(false)
    expect(risk.supplies[0]?.liveDataUsed).toBe(false)
    expect(risk.healthFactorWad).toBe('2095238095238095238')

    const flagged: StellarLendingLiveStateDto = {
      ...liveState,
      indexes: liveState.indexes.map((row, i) => (i === 1 ? ({ ...row, valid: false } as never) : row)),
    }
    const risk2 = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState: flagged })
    expect(risk2.borrows[0]?.liveDataUsed).toBe(false)
    expect(risk2.liveDataValid).toBe(false)
  })

  it('uses the live-state floor and zeroes available borrow below it', () => {
    const dust = position({ asset: XLM, supplyScaledRay: (5n * RAY).toString(), liveSupplyIndexRay: RAY.toString() })
    const risk = computeAccountRisk({ positions: [dust], reserves, liveState })
    // 5 shares × live index 1.1 = 5.5 XLM at $0.5 = $2.75; ltv-weighted $1.925 < $5 floor
    expect(risk.ltvWeightedCollateralUsd).toBe(1.925)
    expect(risk.availableBorrowUsd).toBe(0)
  })

  it('throws on mixed account ids, empty input and unknown reserves', () => {
    expect(() =>
      computeAccountRisk({ positions: [xlmSupply, { ...usdcDebt210, accountId: '8' }], reserves })
    ).toThrow('mixed account ids')
    expect(() => computeAccountRisk({ positions: [], reserves })).toThrow('at least one position')
    expect(() => computeAccountRisk({ positions: [{ ...xlmSupply, hubId: 2 }], reserves })).toThrow('no reserve')
    expect(computeAccountRisk({ positions: [xlmSupply], reserves: Object.values(reserves) }).totalCollateralUsd).toBe(550)
  })
})

describe('limits', () => {
  const healthy = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState })
  const debtFree = computeAccountRisk({ positions: [xlmSupply], reserves, liveState })

  /**
   * Contract-style borrow gate (`ops/borrow.rs::mint_debt` → `risk/totals.rs`
   * → `validation.rs`): mint ceil shares, merge with the existing leg, value
   * the merged leg with `position_value_ceil`, require `ltv >= debt`.
   */
  const contractBorrowPasses = (
    x: bigint,
    existingShares: bigint,
    indexRay: bigint,
    priceWad: bigint,
    decimals: number,
    ltvCollateralWad: bigint,
    otherDebtWad = 0n
  ): boolean => {
    const ceil = (a: bigint, b: bigint): bigint => (a % b === 0n ? a / b : a / b + 1n)
    const merged = existingShares + ceil(x * 10n ** BigInt(27 - decimals) * RAY, indexRay)
    const valueWad = ceil(ceil(ceil(merged * indexRay, RAY), 10n ** 9n) * priceWad, WAD)
    return otherDebtWad + valueWad <= ltvCollateralWad
  }

  it('maxBorrow: LTV gate binds ($385 − $210 headroom, one unit lost to the share ceil at index 1.05)', () => {
    const limit = maxBorrow(healthy, usdcReserve, liveState)
    expect(limit.amountBase).toBe(174_999_999n)
    expect(limit.amountShort).toBeCloseTo(174.999999, 12)
    expect(limit.reason).toBe('ltv')
    expect(limit.isFullClose).toBe(false)
    expect(limit.projectedUtilization).toBeCloseTo((210 + 174.999999) / 10_000, 12)
    // regression: the contract admits amountBase and rejects amountBase + 1
    const gate = (x: bigint): boolean => contractBorrowPasses(x, 200n * RAY, ray('1.05'), WAD, 6, wad('385'))
    expect(gate(limit.amountBase)).toBe(true)
    expect(gate(limit.amountBase + 1n)).toBe(false)
    expect(gate(175_000_000n)).toBe(false)
  })

  it('maxBorrow: at index RAY the share round-trip is exact (175 USDC)', () => {
    const atPar: StellarLendingLiveStateDto = {
      ...liveState,
      indexes: liveState.indexes.map((row) => (row.asset === USDC ? { ...row, borrowIndex: RAY.toString() } : row)),
    }
    // 200 shares at index 1.0 = $200 debt → headroom $185
    const risk = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState: atPar })
    const limit = maxBorrow(risk, usdcReserve, atPar)
    expect(limit.amountBase).toBe(185_000_000n)
    expect(contractBorrowPasses(185_000_001n, 200n * RAY, RAY, WAD, 6, wad('385'))).toBe(false)
  })

  it('maxBorrow: fresh 18-decimal leg at $0.01 and index 1.05 — exact on the contract predicate', () => {
    const cheap = reserve({
      asset: 'CCHEAP',
      assetDecimals: 18,
      usdPrice: 0.01,
      liveBorrowIndexRay: ray('1.05').toString(),
      availableLiquidityShort: 1e9,
      hubPool: { suppliedShort: 1e9, borrowedShort: 0, depositsUsd: 0, borrowsUsd: 0 },
      supplyCap: '1000000000000000000000000000',
      borrowCap: '1000000000000000000000000000',
    })
    const limit = maxBorrow(healthy, cheap)
    expect(limit.reason).toBe('ltv')
    const gate = (x: bigint): boolean =>
      contractBorrowPasses(x, 0n, ray('1.05'), wad('0.01'), 18, wad('385'), wad('210'))
    expect(gate(limit.amountBase)).toBe(true)
    expect(gate(limit.amountBase + 1n)).toBe(false)
    expect(limit.amountBase).toBe(17_500n * 10n ** 18n - 1n) // the price-step ceil costs one base unit
  })

  it('maxBorrow: no hub supply skips the utilization guard, cash binds', () => {
    const empty = reserve({
      ...usdcReserve,
      availableLiquidityShort: 0,
      hubPool: { suppliedShort: 0, borrowedShort: 0, depositsUsd: 0, borrowsUsd: 0 },
    })
    expect(maxBorrow(healthy, empty, liveState)).toMatchObject({ amountBase: 0n, reason: 'liquidity' })
  })

  it('maxBorrow: utilization ceiling, cap, liquidity buffer, min-collateral, flags', () => {
    const tightUtil = reserve({ ...usdcReserve, irm: { ...usdcReserve.irm, maxUtilizationRay: ray('0.03').toString() } })
    const util = maxBorrow(healthy, tightUtil, liveState)
    expect(util.amountBase).toBe(90_000_000n) // 0.03·10,000 − 210
    expect(util.reason).toBe('utilizationCap')

    const capped = reserve({ ...usdcReserve, borrowCap: '250000000' }) // 250 USDC cap, 210 used
    expect(maxBorrow(healthy, capped, liveState)).toMatchObject({ amountBase: 40_000_000n, reason: 'cap' })

    // cash 250 − 2% buffer of 10,000 supplied (200) = 50
    const thin = reserve({ ...usdcReserve, availableLiquidityShort: 250 })
    expect(maxBorrow(healthy, thin, liveState)).toMatchObject({ amountBase: 50_000_000n, reason: 'liquidity' })

    const dust = computeAccountRisk({
      positions: [position({ asset: XLM, supplyScaledRay: (5n * RAY).toString(), liveSupplyIndexRay: RAY.toString() })],
      reserves,
      liveState,
    })
    expect(maxBorrow(dust, usdcReserve, liveState)).toMatchObject({ amountBase: 0n, reason: 'minCollateral' })

    expect(maxBorrow(healthy, { ...usdcReserve, paused: true }).reason).toBe('paused')
    expect(maxBorrow(healthy, { ...usdcReserve, frozen: true }).reason).toBe('frozen')
    expect(maxBorrow(healthy, { ...usdcReserve, isBorrowable: false })).toMatchObject({ amountBase: 0n, reason: 'cap' })
  })

  it('maxWithdraw: debt-free closes the position at the floor payout', () => {
    const limit = maxWithdraw(debtFree, xlmReserve)
    expect(limit.amountBase).toBe(11_000_000_000n)
    expect(limit.isFullClose).toBe(true)
    expect(limit.reason).toBeNull()
    expect(limit.projectedUtilization).toBeCloseTo(210 / (10_000 - 1100), 12)
  })

  it('maxWithdraw: risk gate keeps ltv-weighted collateral ≥ debt', () => {
    // need $210 of ltv weight at 70% → keep $300 of floor value → remove $250 = 500 XLM,
    // minus one base unit lost to the ceil share burn + floor revaluation.
    const limit = maxWithdraw(healthy, xlmReserve)
    expect(limit.amountBase).toBe(4_999_999_999n)
    expect(limit.reason).toBe('healthFactor')
    expect(limit.isFullClose).toBe(false)
    // contract-style: burn ceil shares, floor-value the remainder, weight by 70%
    const ceil = (a: bigint, b: bigint): bigint => (a % b === 0n ? a / b : a / b + 1n)
    const ltvAfter = (x: bigint): bigint => {
      const remaining = 1000n * RAY - ceil(x * 10n ** 20n * RAY, ray('1.1'))
      return ((((remaining * ray('1.1')) / RAY / 10n ** 9n) * wad('0.5')) / WAD) * 7000n / 10_000n
    }
    expect(ltvAfter(limit.amountBase)).toBe(210_000_000_034_999_999_999n)
    expect(ltvAfter(limit.amountBase + 1n) < wad('210')).toBe(true)
    const after = projectAccountRisk(healthy, [{ side: 'supply', hubId: 1, asset: XLM, amountBase: -limit.amountBase }])
    expect(after.ltvWeightedCollateralUsdWad).toBe(ltvAfter(limit.amountBase).toString())
    expect(after.supplies[0]?.scaledRay).toBe((1000n * RAY - ceil(limit.amountBase * 10n ** 20n * RAY, ray('1.1'))).toString())
  })

  it('maxWithdraw: min-collateral floor, cash, utilization and paused', () => {
    const highFloor: StellarLendingLiveStateDto = { ...liveState, minBorrowCollateralUsdWad: wad('300').toString() }
    const risk = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState: highFloor })
    expect(maxWithdraw(risk, xlmReserve).reason).toBe('minCollateral')

    const thin = reserve({ ...xlmReserve, availableLiquidityShort: 100 })
    expect(maxWithdraw(debtFree, thin)).toMatchObject({ amountBase: 1_000_000_000n, reason: 'liquidity', isFullClose: false })

    // borrowed 210 / max 0.5 → supplied must stay ≥ 420 → withdraw ≤ 10,000 − 420
    const tight = reserve({
      ...xlmReserve,
      hubPool: { ...xlmReserve.hubPool, suppliedShort: 1000, borrowedShort: 210 },
      irm: { ...xlmReserve.irm, maxUtilizationRay: ray('0.5').toString() },
    })
    expect(maxWithdraw(debtFree, tight)).toMatchObject({ amountBase: 5_800_000_000n, reason: 'utilizationCap' })

    expect(maxWithdraw(debtFree, { ...xlmReserve, paused: true })).toMatchObject({ amountBase: 0n, reason: 'paused' })
    expect(maxWithdraw(debtFree, usdcReserve)).toMatchObject({ amountBase: 0n, reason: null })
  })

  it('maxSupply: spoke cap headroom, frozen/paused', () => {
    expect(maxSupply(xlmReserve)).toMatchObject({ amountBase: 89_000_000_000n, reason: 'cap', isFullClose: false })
    expect(maxSupply({ ...xlmReserve, supplyCap: '0' }).amountBase).toBe(0n)
    expect(maxSupply({ ...xlmReserve, frozen: true }).reason).toBe('frozen')
    expect(maxSupply({ ...xlmReserve, paused: true }).reason).toBe('paused')
  })

  it('maxRepay: ceil debt, wallet bound, paused', () => {
    expect(maxRepay(healthy, usdcReserve)).toMatchObject({ amountBase: 210_000_000n, isFullClose: true, reason: null })
    expect(maxRepay(healthy, usdcReserve, '100000000')).toMatchObject({
      amountBase: 100_000_000n,
      isFullClose: false,
      reason: 'liquidity',
    })
    expect(maxRepay(healthy, usdcReserve, 300_000_000n).isFullClose).toBe(true)
    expect(maxRepay(healthy, { ...usdcReserve, paused: true }).reason).toBe('paused')
    expect(maxRepay(healthy, xlmReserve)).toMatchObject({ amountBase: 0n, reason: null })
  })
})

describe('projections', () => {
  const healthy = computeAccountRisk({ positions: [xlmSupply, usdcDebt210], reserves, liveState })

  it('projectAccountRisk: extra borrow moves shares — 200 + ceil(100/1.05) shares, ceil-valued', () => {
    const after = projectAccountRisk(healthy, [{ side: 'borrow', hubId: 1, asset: USDC, amountBase: 100_000_000n }])
    // minted = ceil(100e27·RAY / 1.05e27) = 95.238095238095238095238095239 RAY; merged × 1.05 ceils to $310 + 1 WAD unit
    expect(after.borrows[0]?.scaledRay).toBe('295238095238095238095238095239')
    expect(after.totalDebtUsdWad).toBe('310000000000000000001')
    expect(after.healthFactorWad).toBe('1419354838709677419') // floor(440e36 / (310e18 + 1))
    expect(after.borrows[0]?.amountBase).toBe('310000001') // unscale_borrow_ceil of the merged shares (6 decimals)
    expect(healthy.totalDebtUsdWad).toBe(wad('210').toString()) // input untouched
  })

  it('projectAccountRisk: partial repay burns floor shares, full repay at the ceil debt closes', () => {
    const partial = projectAccountRisk(healthy, [{ side: 'borrow', hubId: 1, asset: USDC, amountBase: -10_500_000n }])
    expect(partial.borrows[0]?.scaledRay).toBe((190n * RAY).toString()) // 10.5 / 1.05 = 10 shares exactly
    expect(partial.totalDebtUsdWad).toBe(wad('199.5').toString())
    const closed = projectAccountRisk(healthy, [{ side: 'borrow', hubId: 1, asset: USDC, amountBase: -209_999_999n }])
    expect(closed.borrows[0]?.scaledRay).toBe('952380952380952380953') // 200 RAY − floor(209.999999e27·RAY / 1.05e27)
    expect(projectAccountRisk(healthy, [{ side: 'borrow', hubId: 1, asset: USDC, amountBase: -210_000_000n }]).borrows).toHaveLength(0)
    // supply: a withdraw at the half-up balance closes the leg
    expect(projectAccountRisk(healthy, [{ side: 'supply', hubId: 1, asset: XLM, amountBase: -11_000_000_000n }]).supplies).toHaveLength(0)
  })

  it('projectAccountRisk: full repay drops the leg, new leg needs a reserve', () => {
    const repaid = projectAccountRisk(healthy, [{ side: 'borrow', hubId: 1, asset: USDC, amountBase: '-210000000' }])
    expect(repaid.borrows).toHaveLength(0)
    expect(repaid.healthFactorWad).toBeNull()

    expect(() => projectAccountRisk(healthy, [{ side: 'supply', hubId: 1, asset: USDC, amountBase: 1n }])).toThrow(
      'needs `reserve`'
    )
    const added = projectAccountRisk(healthy, [
      { side: 'supply', hubId: 1, asset: USDC, amountBase: 100_000_000n, reserve: usdcReserve },
    ])
    // +$100 USDC collateral at the reserve's 70% / 80%
    expect(added.totalCollateralUsd).toBe(650)
    expect(added.ltvWeightedCollateralUsd).toBe(455)
    expect(added.liquidationWeightedCollateralUsd).toBe(520)
  })

  it('projectReserveApy: curve on projected hub totals', () => {
    // 210 / 10,000 = 2.1% util → 0.02 + 0.021·0.04/0.4 = 0.0221; deposit = 0.021·0.0221·0.9
    const now = projectReserveApy(usdcReserve)
    expect(now.utilizationRay).toBe(ray('0.021').toString())
    expect(now.borrowAprRay).toBe(ray('0.0221').toString())
    expect(now.supplyAprRay).toBe(ray('0.00041769').toString())
    expect(now.borrowApy).toBeCloseTo(Math.exp(0.0221) - 1, 15)

    // borrow 3,790 more → 4,000 / 10,000 = 40% → kink rate 0.06
    const later = projectReserveApy(usdcReserve, 0n, 3_790_000_000n)
    expect(later.utilization).toBeCloseTo(0.4, 15)
    expect(later.borrowApr).toBeCloseTo(0.06, 15)
    // withdraw everything → zero supply → zero utilization
    expect(projectReserveApy(usdcReserve, '-10000000000', 0n).utilization).toBe(0)
  })
})
