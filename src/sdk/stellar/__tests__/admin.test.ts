/**
 * Snapshot + structural tests for the Stellar lending admin / config / keeper /
 * access transaction builders.
 *
 * Beyond the function-name / arg-count / determinism / snapshot guards, this
 * suite decodes the complex `#[contracttype]` struct args
 * (`MarketOracleConfigInput`, `AssetConfigRaw`) back out of the XDR and asserts
 * the ScMap keys are ascending-sorted (the Soroban host requires sorted symbol
 * keys) and that the oracle union / custom-option tags are well-formed. For the
 * all-lowercase snake_case field sets used here, JS lexicographic order matches
 * Soroban's symbol collation.
 */

import { jest } from '@jest/globals'
import { Networks, Transaction, xdr as stellarXdr } from '@stellar/stellar-sdk'

import {
  buildStellarAcceptOwnershipTx,
  buildStellarAddRewardsTx,
  buildStellarApproveBlendPoolTx,
  buildStellarClaimRevenueTx,
  buildStellarCreateLiquidityPoolTx,
  buildStellarSetOracleToleranceTx,
  buildStellarSetOracleTx,
  buildStellarGrantRoleTx,
  buildStellarMigrateTx,
  buildStellarPauseTx,
  buildStellarRenewAccountTx,
  buildStellarRevokeRoleTx,
  buildStellarRevokeBlendPoolTx,
  buildStellarSetAccumulatorTx,
  buildStellarSetAggregatorTx,
  buildStellarSetPositionLimitsTx,
  buildStellarTransferOwnershipTx,
  buildStellarUnpauseTx,
  buildStellarUpdateAccountThresholdTx,
  buildStellarUpdateIndexesTx,
  buildStellarUpgradeControllerTx,
  buildStellarUpgradeLiquidityPoolParamsTx,
  type ConfigureMarketOracleArgs,
  type CreateLiquidityPoolArgs,
} from '../admin'
import type { StellarBuilderOptions } from '../lending'

// -----------------------------------------------------------------------------
// Deterministic fixtures
// -----------------------------------------------------------------------------

const FIXTURE_CALLER =
  'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR'
const FIXTURE_CONTROLLER =
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
const FIXTURE_USDC =
  'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3'
const FIXTURE_XLM =
  'CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW'
const FIXTURE_ORACLE =
  'CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U'
// A second valid C-strkey for the anchor source (reuses the controller test
// vector; distinctness from the primary oracle is not asserted).
const FIXTURE_ORACLE2 =
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
// 32-byte WASM hash (64 hex chars).
const FIXTURE_WASM_HASH = 'ab'.repeat(32)
const FIXTURE_SEQUENCE = '123456789'

beforeAll(() => {
  jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
})
afterAll(() => {
  jest.useRealTimers()
})

const BASE_OPTS: StellarBuilderOptions = {
  network: 'testnet',
  caller: FIXTURE_CALLER,
  sourceSequence: FIXTURE_SEQUENCE,
  controllerAddress: FIXTURE_CONTROLLER,
  fee: '100',
  timeoutSeconds: 300,
}

// `@xoxno/types` does not re-export its string enums for literal assignment, so
// these structurally-correct fixtures cast their enum fields. The encoders
// validate the runtime string values and the snapshots lock the bytes.
const createPoolArgs = {
  hubId: 1,
  asset: FIXTURE_USDC,
  params: {
    assetId: FIXTURE_USDC,
    assetDecimals: 7,
    maxBorrowRateRay: '2000000000000000000000000000',
    baseBorrowRateRay: '10000000000000000000000000',
    slope1Ray: '40000000000000000000000000',
    slope2Ray: '80000000000000000000000000',
    slope3Ray: '1000000000000000000000000000',
    midUtilizationRay: '450000000000000000000000000',
    optimalUtilizationRay: '800000000000000000000000000',
    maxUtilizationRay: '950000000000000000000000000',
    reserveFactorBps: 1000,
    isFlashloanable: true,
    flashloanFeeBps: 9,
  },
} satisfies CreateLiquidityPoolArgs

const configureOracleArgs = {
  key: { Token: FIXTURE_USDC },
  oracle: {
    assetDecimals: 7,
    maxPriceStaleSeconds: 900,
    toleranceBps: 500,
    independence: 'RequireDisjoint',
    sources: [
      {
        Feed: {
          provider: {
            Reflector: {
              contract: FIXTURE_ORACLE,
              asset: { Stellar: FIXTURE_USDC },
              readMode: { Twap: 12 },
            },
          },
          decimals: 14,
          maxStaleSeconds: 900,
        },
      },
      {
        Feed: {
          provider: {
            MultiFeed: {
              contract: FIXTURE_ORACLE2,
              feedId: 'USDC',
              kind: 'RedStone',
              nature: 'Fundamental',
            },
          },
          decimals: 8,
          maxStaleSeconds: 600,
        },
      },
    ],
    minSanityPriceWad: '900000000000000000',
    maxSanityPriceWad: '1100000000000000000',
  },
} as unknown as ConfigureMarketOracleArgs

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const parseInvoked = (
  xdrB64: string
): {
  functionName: string
  args: stellarXdr.ScVal[]
} => {
  const tx = new Transaction(xdrB64, Networks.TESTNET)
  expect(tx.operations).toHaveLength(1)
  const op = tx.operations[0] as unknown as {
    type: string
    func: stellarXdr.HostFunction
  }
  expect(op.type).toBe('invokeHostFunction')
  const invokeContract = op.func.invokeContract()
  const fnBuf = invokeContract.functionName()
  return {
    functionName: Buffer.isBuffer(fnBuf) ? fnBuf.toString('utf8') : String(fnBuf),
    args: invokeContract.args(),
  }
}

/** Read the symbol keys of an scvMap arg, in wire order. */
const mapKeys = (v: stellarXdr.ScVal): string[] => {
  expect(v.switch().name).toBe('scvMap')
  return v
    .map()!
    .map((e) => {
      const k = e.key()
      expect(k.switch().name).toBe('scvSymbol')
      return k.sym().toString()
    })
}

const isAscending = (keys: string[]): boolean =>
  keys.every((k, i) => i === 0 || keys[i - 1]! < k)

// -----------------------------------------------------------------------------
// Builder coverage — every admin/config/keeper/access entry point
// -----------------------------------------------------------------------------

interface Case {
  name: string
  expectedFn: string
  expectedArgCount: number
  build: () => { xdr: string }
}

const cases: Case[] = [
  // access.rs
  {
    name: 'upgrade',
    expectedFn: 'upgrade',
    expectedArgCount: 1,
    build: () => buildStellarUpgradeControllerTx(BASE_OPTS, { wasmHash: FIXTURE_WASM_HASH }),
  },
  {
    name: 'migrate',
    expectedFn: 'migrate',
    expectedArgCount: 1,
    build: () => buildStellarMigrateTx(BASE_OPTS, { newVersion: 2 }),
  },
  { name: 'pause', expectedFn: 'pause', expectedArgCount: 0, build: () => buildStellarPauseTx(BASE_OPTS) },
  { name: 'unpause', expectedFn: 'unpause', expectedArgCount: 0, build: () => buildStellarUnpauseTx(BASE_OPTS) },
  {
    name: 'grant_role',
    expectedFn: 'grant_role',
    expectedArgCount: 2,
    build: () => buildStellarGrantRoleTx(BASE_OPTS, { account: FIXTURE_CALLER, role: 'ORACLE' }),
  },
  {
    name: 'revoke_role',
    expectedFn: 'revoke_role',
    expectedArgCount: 2,
    build: () => buildStellarRevokeRoleTx(BASE_OPTS, { account: FIXTURE_CALLER, role: 'KEEPER' }),
  },
  {
    name: 'transfer_ownership',
    expectedFn: 'transfer_ownership',
    expectedArgCount: 2,
    build: () => buildStellarTransferOwnershipTx(BASE_OPTS, { newOwner: FIXTURE_CALLER, liveUntilLedger: 999999 }),
  },
  {
    name: 'accept_ownership',
    expectedFn: 'accept_ownership',
    expectedArgCount: 0,
    build: () => buildStellarAcceptOwnershipTx(BASE_OPTS),
  },
  // config.rs
  {
    name: 'set_swap_aggregator',
    expectedFn: 'set_swap_aggregator',
    expectedArgCount: 1,
    build: () => buildStellarSetAggregatorTx(BASE_OPTS, { aggregator: FIXTURE_XLM }),
  },
  {
    name: 'set_accumulator',
    expectedFn: 'set_accumulator',
    expectedArgCount: 1,
    build: () => buildStellarSetAccumulatorTx(BASE_OPTS, { accumulator: FIXTURE_XLM }),
  },
  {
    name: 'set_position_limits',
    expectedFn: 'set_position_limits',
    expectedArgCount: 1,
    build: () => buildStellarSetPositionLimitsTx(BASE_OPTS, { maxBorrowPositions: 8, maxSupplyPositions: 16 }),
  },
  {
    name: 'approve_blend_pool',
    expectedFn: 'approve_blend_pool',
    expectedArgCount: 1,
    build: () => buildStellarApproveBlendPoolTx(BASE_OPTS, { pool: FIXTURE_USDC }),
  },
  {
    name: 'revoke_blend_pool',
    expectedFn: 'revoke_blend_pool',
    expectedArgCount: 1,
    build: () => buildStellarRevokeBlendPoolTx(BASE_OPTS, { pool: FIXTURE_USDC }),
  },
  {
    name: 'set_oracle',
    expectedFn: 'set_oracle',
    expectedArgCount: 2,
    build: () => buildStellarSetOracleTx(BASE_OPTS, configureOracleArgs),
  },
  {
    name: 'set_tolerance',
    expectedFn: 'set_tolerance',
    expectedArgCount: 2,
    build: () =>
      buildStellarSetOracleToleranceTx(BASE_OPTS, {
        key: { Token: FIXTURE_USDC },
        toleranceBps: 500,
        upperRatioBps: 10_500,
        lowerRatioBps: 9_500,
      }),
  },
  // router.rs
  {
    name: 'update_indexes',
    expectedFn: 'update_indexes',
    expectedArgCount: 2,
    build: () =>
      buildStellarUpdateIndexesTx(BASE_OPTS, {
        assets: [
          { hubId: 1, asset: FIXTURE_USDC },
          { hubId: 1, asset: FIXTURE_XLM },
        ],
      }),
  },
  {
    name: 'renew_account',
    expectedFn: 'renew_account',
    expectedArgCount: 2,
    build: () => buildStellarRenewAccountTx(BASE_OPTS, { accountNonce: 42 }),
  },
  {
    name: 'create_liquidity_pool',
    expectedFn: 'create_liquidity_pool',
    expectedArgCount: 3,
    build: () => buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs),
  },
  {
    name: 'upgrade_liquidity_pool_params',
    expectedFn: 'upgrade_liquidity_pool_params',
    expectedArgCount: 2,
    build: () =>
      buildStellarUpgradeLiquidityPoolParamsTx(BASE_OPTS, {
        hubId: 1,
        asset: FIXTURE_USDC,
        params: createPoolArgs.params,
      }),
  },
  {
    name: 'claim_revenue',
    expectedFn: 'claim_revenue',
    expectedArgCount: 2,
    build: () =>
      buildStellarClaimRevenueTx(BASE_OPTS, {
        assets: [
          { hubId: 1, asset: FIXTURE_USDC },
          { hubId: 1, asset: FIXTURE_XLM },
        ],
      }),
  },
  {
    name: 'add_rewards',
    expectedFn: 'add_rewards',
    expectedArgCount: 2,
    build: () =>
      buildStellarAddRewardsTx(BASE_OPTS, {
        rewards: [{ hubId: 1, asset: FIXTURE_USDC, amount: '1000000' }],
      }),
  },
  {
    name: 'update_account_threshold',
    expectedFn: 'update_account_threshold',
    expectedArgCount: 3,
    build: () =>
      buildStellarUpdateAccountThresholdTx(BASE_OPTS, {
        hasRisks: true,
        accountNonces: [1, 2, 3],
      }),
  },
]

describe('Stellar lending admin builders', () => {
  for (const c of cases) {
    describe(c.name, () => {
      let built: { xdr: string }

      beforeAll(() => {
        built = c.build()
      })

      it('returns non-empty base64 XDR', () => {
        expect(typeof built.xdr).toBe('string')
        expect(built.xdr.length).toBeGreaterThan(0)
      })

      it(`encodes "${c.expectedFn}" with ${c.expectedArgCount} args`, () => {
        const parsed = parseInvoked(built.xdr)
        expect(parsed.functionName).toBe(c.expectedFn)
        expect(parsed.args).toHaveLength(c.expectedArgCount)
      })

      it('is deterministic', () => {
        expect(c.build().xdr).toBe(built.xdr)
      })

      it('matches stored snapshot', () => {
        expect(built.xdr).toMatchSnapshot()
      })
    })
  }
})

// -----------------------------------------------------------------------------
// Struct-encoding correctness — the on-chain-acceptance proxy
// -----------------------------------------------------------------------------

describe('complex struct encoding', () => {
  it('MarketParamsRaw is an scvMap with 13 ascending-sorted keys', () => {
    const parsed = parseInvoked(
      buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs).xdr
    )
    // create_liquidity_pool(hub_id, asset, params) → params is arg index 2.
    const keys = mapKeys(parsed.args[2]!)
    expect(keys).toHaveLength(13)
    expect(isAscending(keys)).toBe(true)
    expect(keys).toEqual(
      [
        'asset_decimals',
        'asset_id',
        'base_borrow_rate',
        'flashloan_fee',
        'is_flashloanable',
        'max_borrow_rate',
        'max_utilization',
        'mid_utilization',
        'optimal_utilization',
        'reserve_factor',
        'slope1',
        'slope2',
        'slope3',
      ].sort()
    )
  })

  it('AssetOracle is sorted; sources are Feed(Reflector) + Feed(MultiFeed)', () => {
    const parsed = parseInvoked(
      buildStellarSetOracleTx(BASE_OPTS, configureOracleArgs).xdr
    )
    // set_oracle(key, oracle) → oracle is arg index 1.
    const cfg = parsed.args[1]!
    const keys = mapKeys(cfg)
    expect(isAscending(keys)).toBe(true)
    expect(keys).toEqual([
      'asset_decimals',
      'independence',
      'max_price_stale_seconds',
      'max_sanity_price_wad',
      'min_sanity_price_wad',
      'sources',
      'tolerance',
    ])

    const entries = cfg.map()!
    const byKey = (name: string) =>
      entries.find((e) => e.key().sym().toString() === name)!.val()

    const sources = byKey('sources')
    expect(sources.switch().name).toBe('scvVec')
    expect(sources.vec()!.length).toBe(2)
    expect(sources.vec()![0]!.vec()![0]!.sym().toString()).toBe('Feed')
    expect(sources.vec()![1]!.vec()![0]!.sym().toString()).toBe('Feed')

    const independence = byKey('independence')
    expect(independence.vec()![0]!.sym().toString()).toBe('RequireDisjoint')
  })

  it('encodes MultiFeed kind Xoxno under sources', () => {
    const args = {
      key: { Token: FIXTURE_USDC },
      oracle: {
        ...configureOracleArgs.oracle,
        sources: [
          {
            Feed: {
              provider: {
                MultiFeed: {
                  contract: FIXTURE_ORACLE2,
                  feedId: 'USDC',
                  kind: 'Xoxno',
                  nature: 'Fundamental',
                },
              },
              decimals: 8,
              maxStaleSeconds: 600,
            },
          },
        ],
      },
    } as unknown as ConfigureMarketOracleArgs
    const parsed = parseInvoked(buildStellarSetOracleTx(BASE_OPTS, args).xdr)
    const cfg = parsed.args[1]!
    const sources = cfg
      .map()!
      .find((e) => e.key().sym().toString() === 'sources')!
      .val()
    const feed = sources.vec()![0]!
    expect(feed.vec()![0]!.sym().toString()).toBe('Feed')
    const provider = feed
      .vec()![1]!
      .map()!
      .find((e) => e.key().sym().toString() === 'provider')!
      .val()
    expect(provider.vec()![0]!.sym().toString()).toBe('MultiFeed')
  })

  it('encodes each struct field at its correct ScVal width (i128 vs u64 vs u32 vs bool)', () => {
    // MarketParamsRaw — RAY rates are i128, decimals/reserve are u32, asset is
    // address, flash-loan flag is bool.
    const params = parseInvoked(
      buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs).xdr
    ).args[2]!
    const pEntries = params.map()!
    const pField = (name: string) =>
      pEntries.find((e) => e.key().sym().toString() === name)!.val()
    expect(pField('max_borrow_rate').switch().name).toBe('scvI128')
    expect(pField('reserve_factor').switch().name).toBe('scvU32')
    expect(pField('asset_decimals').switch().name).toBe('scvU32')
    expect(pField('asset_id').switch().name).toBe('scvAddress')
    expect(pField('is_flashloanable').switch().name).toBe('scvBool')
    expect(pField('flashloan_fee').switch().name).toBe('scvU32')

    // AssetOracle — stale seconds are u64, sanity i128.
    const cfg = parseInvoked(
      buildStellarSetOracleTx(BASE_OPTS, configureOracleArgs).xdr
    ).args[1]!
    const cEntries = cfg.map()!
    const cField = (name: string) =>
      cEntries.find((e) => e.key().sym().toString() === name)!.val()
    expect(cField('max_price_stale_seconds').switch().name).toBe('scvU64')
    expect(cField('min_sanity_price_wad').switch().name).toBe('scvI128')
    expect(cField('max_sanity_price_wad').switch().name).toBe('scvI128')
    expect(cField('asset_decimals').switch().name).toBe('scvU32')
  })

  it('single-source oracle encodes one Feed only', () => {
    const single = {
      key: { Token: FIXTURE_USDC },
      oracle: {
        ...configureOracleArgs.oracle,
        sources: [configureOracleArgs.oracle.sources[0]],
      },
    } as unknown as ConfigureMarketOracleArgs
    const parsed = parseInvoked(buildStellarSetOracleTx(BASE_OPTS, single).xdr)
    const cfg = parsed.args[1]!
    const sources = cfg
      .map()!
      .find((e) => e.key().sym().toString() === 'sources')!
      .val()
    expect(sources.vec()!.length).toBe(1)
  })
})
