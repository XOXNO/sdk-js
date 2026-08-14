import { XOXNOClient } from '../../../utils/api'
import { buildSdk } from '../../index'
import {
  getStellarAsset,
  getStellarAssets,
  getStellarHubs,
  getStellarLendingContext,
  getStellarLendingLiveState,
  getStellarReserve,
  getStellarReserves,
  getStellarSpokes,
  getStellarAssetMarkets,
  stellarLendingRead,
} from '../index'
import type { StellarAsset, StellarReserve } from '../index'

describe('stellar lending read surface', () => {
  it('re-exports the read functions from the barrel', () => {
    expect(typeof getStellarReserve).toBe('function')
    expect(typeof getStellarAssetMarkets).toBe('function')
    expect(typeof getStellarAssets).toBe('function')
    expect(typeof getStellarHubs).toBe('function')
    expect(typeof getStellarSpokes).toBe('function')
    expect(typeof getStellarReserves).toBe('function')
    expect(typeof getStellarLendingContext).toBe('function')
    expect(typeof getStellarLendingLiveState).toBe('function')
    expect(typeof stellarLendingRead).toBe('function')
  })

  it('lists global rows: context/assets/hubs/spokes hit the base routes, reserves passes filters', async () => {
    const captured: {
      path?: string
      opts?: { params?: Record<string, unknown>; debug?: boolean }
    } = {}
    const client = new XOXNOClient()
    client.fetchWithTimeout = (async (
      path: string,
      opts: { params?: Record<string, unknown> }
    ) => {
      captured.path = path
      captured.opts = opts
      return []
    }) as unknown as typeof client.fetchWithTimeout

    const read = stellarLendingRead(client)

    await read.context()
    expect(captured.path).toBe('/stellar-lending/context')

    await read.liveState()
    expect(captured.path).toBe('/stellar-lending/live-state')

    await read.assets()
    expect(captured.path).toBe('/stellar-lending/assets')

    await read.hubs()
    expect(captured.path).toBe('/stellar-lending/hubs')

    await read.spokes()
    expect(captured.path).toBe('/stellar-lending/spokes')

    await read.reserves()
    expect(captured.path).toBe('/stellar-lending/reserves')
    expect(captured.opts?.params).toEqual({})

    await read.reserves({ hubId: 1, spokeId: 2, asset: 'CASSET' })
    expect(captured.opts?.params).toEqual({ hubId: 1, spokeId: 2, asset: 'CASSET' })

    await read.reserves({ debug: true })
    expect(captured.path).toBe('/stellar-lending/reserves')
    expect(captured.opts?.debug).toBe(true)
    expect(captured.opts?.params).toEqual({})
  })

  it('exposes the generated live-state route with response typing', async () => {
    const client = new XOXNOClient()
    let capturedPath = ''
    client.fetchWithTimeout = (async (path: string) => {
      capturedPath = path
      return { indexes: [], minBorrowCollateralUsdWad: null }
    }) as unknown as typeof client.fetchWithTimeout

    const liveState = await buildSdk(client).stellarLending.liveState()

    expect(capturedPath).toBe('/stellar-lending/live-state')
    expect(liveState.minBorrowCollateralUsdWad).toBeNull()
  })

  it('binds a client and calls fetchWithTimeout with the right path + params', async () => {
    const captured: { path?: string; opts?: { params?: Record<string, unknown> } } = {}
    const client = new XOXNOClient()
    const sample: StellarReserve = {
      spokeId: 1,
      hubId: 2,
      asset: 'CASSET',
      assetDecimals: 7,
      supplyApy: 0,
      borrowApy: 0,
      utilization: 0,
      suppliedShort: 0,
      borrowedShort: 0,
      availableLiquidityShort: 0,
      usdPrice: 1,
      depositsUsd: 0,
      borrowsUsd: 0,
      availableLiquidityUsd: 0,
      supplyCap: '0',
      borrowCap: '0',
      supplyCapShort: 0,
      borrowCapShort: 0,
      depositCapFilledPct: 0,
      borrowCapFilledPct: 0,
      isFlashloanable: false,
      flashloanFeeBps: 0,
      liveSupplyIndexRay: '1000000000000000000000000000',
      liveBorrowIndexRay: '1000000000000000000000000000',
      collateralFactorBps: 0,
      liquidationThresholdBps: 0,
      liquidationPenaltyBps: 0,
      liquidationFeesBps: 0,
      isCollateralizable: false,
      isBorrowable: false,
      paused: false,
      frozen: false,
      noSeize: false,
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

  it('getStellarAsset parses oracle provider config', async () => {
    const client = new XOXNOClient()
    const assetSample: StellarAsset = {
      asset: 'CASSET:CA...',
      symbol: 'CASSET',
      name: 'Custom Asset',
      decimals: 18,
      usdPrice: 1,
      totalDepositsUsd: 1_000_000,
      totalBorrowsUsd: 500_000,
      availableLiquidityUsd: 500_000,
      hubCount: 1,
      reserveCount: 2,
      minSupplyApy: 0.01,
      maxSupplyApy: 0.05,
      minBorrowApy: 0.02,
      maxBorrowApy: 0.08,
      oracleProvider: {
        assetDecimals: 7,
        maxPriceStaleSeconds: 3600,
        sources: [],
        tolerance: { upperRatioBps: 10500, lowerRatioBps: 9524 },
        independence: 'RequireDisjoint',
        minSanityPriceWad: '500000000000000000',
        maxSanityPriceWad: '2000000000000000000',
      },
    }
    client.fetchWithTimeout = (async () => assetSample) as unknown as typeof client.fetchWithTimeout

    const asset = await getStellarAsset(client, 'CASSET')
    expect(asset).toBe(assetSample)
    expect(asset.oracleProvider).toBeDefined()
    expect(asset.oracleProvider?.assetDecimals).toBe(7)
    expect(asset.oracleProvider?.independence).toBe('RequireDisjoint')
  })
})
