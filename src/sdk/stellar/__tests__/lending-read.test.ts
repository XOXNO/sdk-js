import { XOXNOClient } from '../../../utils/api'
import {
  getStellarReserve,
  getStellarAssetMarkets,
  stellarLendingRead,
} from '../index'
import type { StellarReserve } from '../index'

describe('stellar lending read surface', () => {
  it('re-exports the read functions from the barrel', () => {
    expect(typeof getStellarReserve).toBe('function')
    expect(typeof getStellarAssetMarkets).toBe('function')
    expect(typeof stellarLendingRead).toBe('function')
  })

  it('binds a client and calls fetchWithTimeout with the right path + params', async () => {
    const captured: { path?: string; opts?: { params?: Record<string, unknown> } } = {}
    const client = new XOXNOClient()
    const sample: StellarReserve = {
      spokeId: 1,
      hubId: 2,
      asset: 'CASSET',
      supplyApy: 0,
      borrowApy: 0,
      utilization: 0,
      suppliedShort: 0,
      borrowedShort: 0,
      availableLiquidityShort: 0,
      supplyCapShort: 0,
      borrowCapShort: 0,
      depositCapFilledPct: 0,
      borrowCapFilledPct: 0,
      isFlashloanable: false,
      flashloanFeeBps: 0,
      collateralFactorBps: 0,
      liquidationThresholdBps: 0,
      liquidationPenaltyBps: 0,
      liquidationFeesBps: 0,
      isCollateralizable: false,
      isBorrowable: false,
      paused: false,
      frozen: false,
      useAsCollateral: false,
      targetHealthFactorWad: '0',
      healthFactorForMaxBonusWad: '0',
      liquidationBonusFactorBps: 0,
      irm: {
        baseRateRay: '0',
        slope1Ray: '0',
        slope2Ray: '0',
        slope3Ray: '0',
        optimalUtilizationRay: '0',
        midUtilizationRay: '0',
        maxUtilizationRay: '0',
        maxBorrowRateRay: '0',
        reserveFactorBps: 0,
      },
      supportedCollateral: [],
      borrowable: [],
    }
    client.fetchWithTimeout = (async (path: string, opts: { params?: Record<string, unknown> }) => {
      captured.path = path
      captured.opts = opts
      return sample
    }) as unknown as typeof client.fetchWithTimeout

    const read = stellarLendingRead(client)
    const reserve = await read.reserve(1, 2, 'CASSET')
    expect(reserve).toBe(sample)
    expect(captured.path).toBe('/stellar-lending/reserves/1/2/CASSET')

    await read.assetMarkets('CASSET', 'deposit')
    expect(captured.path).toBe('/stellar-lending/assets/CASSET/markets')
    expect(captured.opts?.params).toEqual({ side: 'deposit' })
  })
})
