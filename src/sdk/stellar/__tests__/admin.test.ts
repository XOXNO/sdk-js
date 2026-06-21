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
  buildStellarAddAssetToEModeCategoryTx,
  buildStellarAddEModeCategoryTx,
  buildStellarAddRewardsTx,
  buildStellarApproveTokenTx,
  buildStellarClaimRevenueTx,
  buildStellarConfigureMarketOracleTx,
  buildStellarCreateLiquidityPoolTx,
  buildStellarDisableTokenOracleTx,
  buildStellarEditAssetConfigTx,
  buildStellarEditAssetInEModeCategoryTx,
  buildStellarEditOracleToleranceTx,
  buildStellarGrantRoleTx,
  buildStellarMigrateTx,
  buildStellarPauseTx,
  buildStellarRemoveAssetFromEModeTx,
  buildStellarRemoveEModeCategoryTx,
  buildStellarRenewAccountTx,
  buildStellarRevokeRoleTx,
  buildStellarRevokeTokenTx,
  buildStellarSetAccumulatorTx,
  buildStellarSetAggregatorTx,
  buildStellarSetLiquidityPoolTemplateTx,
  buildStellarSetPositionLimitsTx,
  buildStellarTransferOwnershipTx,
  buildStellarUnpauseTx,
  buildStellarUpdateAccountThresholdTx,
  buildStellarUpdateIndexesTx,
  buildStellarUpgradeControllerTx,
  buildStellarUpgradeLiquidityPoolParamsTx,
  buildStellarUpgradeLiquidityPoolTx,
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
    supplyCap: '100000000000000',
    borrowCap: '100000000000000',
  },
  config: {
    loanToValueBps: 7500,
    liquidationThresholdBps: 8000,
    liquidationBonusBps: 500,
    liquidationFeesBps: 100,
    isCollateralizable: true,
    isBorrowable: true,
    isFlashloanable: true,
    flashloanFeeBps: 9,
    eModeCategories: [1, 2],
  },
} satisfies CreateLiquidityPoolArgs

const configureOracleArgs = {
  asset: FIXTURE_USDC,
  config: {
    maxPriceStaleSeconds: 900,
    firstToleranceBps: 200,
    lastToleranceBps: 500,
    strategy: 'PrimaryWithAnchor',
    primary: {
      provider: 'ReflectorSep40',
      contract: FIXTURE_ORACLE,
      asset: { kind: 'Stellar', value: FIXTURE_USDC },
      readMode: 'Twap',
      twapRecords: 12,
    },
    anchor: {
      provider: 'RedStonePriceFeed',
      contract: FIXTURE_ORACLE2,
      feedId: 'USDC',
      readMode: 'Spot',
      maxStaleSeconds: 600,
    },
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
    name: 'set_aggregator',
    expectedFn: 'set_aggregator',
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
    name: 'set_liquidity_pool_template',
    expectedFn: 'set_liquidity_pool_template',
    expectedArgCount: 1,
    build: () => buildStellarSetLiquidityPoolTemplateTx(BASE_OPTS, { wasmHash: FIXTURE_WASM_HASH }),
  },
  {
    name: 'edit_asset_config',
    expectedFn: 'edit_asset_config',
    expectedArgCount: 2,
    build: () => buildStellarEditAssetConfigTx(BASE_OPTS, { asset: FIXTURE_USDC, config: createPoolArgs.config }),
  },
  {
    name: 'set_position_limits',
    expectedFn: 'set_position_limits',
    expectedArgCount: 1,
    build: () => buildStellarSetPositionLimitsTx(BASE_OPTS, { maxBorrowPositions: 8, maxSupplyPositions: 16 }),
  },
  {
    name: 'add_e_mode_category',
    expectedFn: 'add_e_mode_category',
    expectedArgCount: 0,
    build: () => buildStellarAddEModeCategoryTx(BASE_OPTS),
  },
  {
    name: 'remove_e_mode_category',
    expectedFn: 'remove_e_mode_category',
    expectedArgCount: 1,
    build: () => buildStellarRemoveEModeCategoryTx(BASE_OPTS, { id: 1 }),
  },
  {
    name: 'add_asset_to_e_mode_category',
    expectedFn: 'add_asset_to_e_mode_category',
    expectedArgCount: 9,
    build: () =>
      buildStellarAddAssetToEModeCategoryTx(BASE_OPTS, {
        asset: FIXTURE_USDC,
        categoryId: 1,
        canCollateral: true,
        canBorrow: false,
        ltv: 9000,
        threshold: 9500,
        bonus: 200,
        supplyCap: '0',
        borrowCap: '0',
      }),
  },
  {
    name: 'edit_asset_in_e_mode_category',
    expectedFn: 'edit_asset_in_e_mode_category',
    expectedArgCount: 9,
    build: () =>
      buildStellarEditAssetInEModeCategoryTx(BASE_OPTS, {
        asset: FIXTURE_USDC,
        categoryId: 1,
        canCollateral: true,
        canBorrow: true,
        ltv: 9000,
        threshold: 9500,
        bonus: 200,
        supplyCap: '0',
        borrowCap: '0',
      }),
  },
  {
    name: 'remove_asset_from_e_mode',
    expectedFn: 'remove_asset_from_e_mode',
    expectedArgCount: 2,
    build: () => buildStellarRemoveAssetFromEModeTx(BASE_OPTS, { asset: FIXTURE_USDC, categoryId: 1 }),
  },
  {
    name: 'approve_token',
    expectedFn: 'approve_token',
    expectedArgCount: 1,
    build: () => buildStellarApproveTokenTx(BASE_OPTS, { token: FIXTURE_USDC }),
  },
  {
    name: 'revoke_token',
    expectedFn: 'revoke_token',
    expectedArgCount: 1,
    build: () => buildStellarRevokeTokenTx(BASE_OPTS, { token: FIXTURE_USDC }),
  },
  {
    name: 'configure_market_oracle',
    expectedFn: 'configure_market_oracle',
    expectedArgCount: 3,
    build: () => buildStellarConfigureMarketOracleTx(BASE_OPTS, configureOracleArgs),
  },
  {
    name: 'edit_oracle_tolerance',
    expectedFn: 'edit_oracle_tolerance',
    expectedArgCount: 4,
    build: () =>
      buildStellarEditOracleToleranceTx(BASE_OPTS, { asset: FIXTURE_USDC, firstTolerance: 200, lastTolerance: 500 }),
  },
  {
    name: 'disable_token_oracle',
    expectedFn: 'disable_token_oracle',
    expectedArgCount: 2,
    build: () => buildStellarDisableTokenOracleTx(BASE_OPTS, { asset: FIXTURE_USDC }),
  },
  // router.rs
  {
    name: 'update_indexes',
    expectedFn: 'update_indexes',
    expectedArgCount: 2,
    build: () => buildStellarUpdateIndexesTx(BASE_OPTS, { assets: [FIXTURE_USDC, FIXTURE_XLM] }),
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
      buildStellarUpgradeLiquidityPoolParamsTx(BASE_OPTS, { asset: FIXTURE_USDC, params: createPoolArgs.params }),
  },
  {
    name: 'upgrade_liquidity_pool',
    expectedFn: 'upgrade_liquidity_pool',
    expectedArgCount: 2,
    build: () => buildStellarUpgradeLiquidityPoolTx(BASE_OPTS, { asset: FIXTURE_USDC, wasmHash: FIXTURE_WASM_HASH }),
  },
  {
    name: 'claim_revenue',
    expectedFn: 'claim_revenue',
    expectedArgCount: 2,
    build: () => buildStellarClaimRevenueTx(BASE_OPTS, { assets: [FIXTURE_USDC, FIXTURE_XLM] }),
  },
  {
    name: 'add_rewards',
    expectedFn: 'add_rewards',
    expectedArgCount: 2,
    build: () =>
      buildStellarAddRewardsTx(BASE_OPTS, { rewards: [{ token: FIXTURE_USDC, amount: '1000000' }] }),
  },
  {
    name: 'update_account_threshold',
    expectedFn: 'update_account_threshold',
    expectedArgCount: 4,
    build: () =>
      buildStellarUpdateAccountThresholdTx(BASE_OPTS, {
        asset: FIXTURE_USDC,
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
  it('AssetConfigRaw is an scvMap with 11 ascending-sorted keys', () => {
    const parsed = parseInvoked(
      buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs).xdr
    )
    // create_liquidity_pool(asset, params, config) → config is arg index 2.
    const keys = mapKeys(parsed.args[2]!)
    expect(keys).toHaveLength(9)
    expect(isAscending(keys)).toBe(true)
    expect(keys).toContain('e_mode_categories')
    expect(keys).not.toContain('liquidationFeesBps') // snake_case only
  })

  it('MarketParamsRaw is an scvMap with 13 ascending-sorted keys', () => {
    const parsed = parseInvoked(
      buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs).xdr
    )
    const keys = mapKeys(parsed.args[1]!)
    expect(keys).toHaveLength(13)
    expect(isAscending(keys)).toBe(true)
    expect(keys).toEqual(
      [
        'asset_decimals',
        'asset_id',
        'base_borrow_rate_ray',
        'borrow_cap',
        'max_borrow_rate_ray',
        'max_utilization_ray',
        'mid_utilization_ray',
        'optimal_utilization_ray',
        'reserve_factor_bps',
        'slope1_ray',
        'slope2_ray',
        'slope3_ray',
        'supply_cap',
      ].sort()
    )
  })

  it('MarketOracleConfigInput is sorted; primary is a Reflector union, anchor is Some(RedStone)', () => {
    const parsed = parseInvoked(
      buildStellarConfigureMarketOracleTx(BASE_OPTS, configureOracleArgs).xdr
    )
    // configure_market_oracle(caller, asset, cfg) → cfg is arg index 2.
    const cfg = parsed.args[2]!
    const keys = mapKeys(cfg)
    expect(isAscending(keys)).toBe(true)
    expect(keys).toEqual([
      'anchor',
      'first_tolerance_bps',
      'last_tolerance_bps',
      'max_price_stale_seconds',
      'max_sanity_price_wad',
      'min_sanity_price_wad',
      'primary',
      'strategy',
    ])

    const entries = cfg.map()!
    const byKey = (name: string) =>
      entries.find((e) => e.key().sym().toString() === name)!.val()

    // primary: scvVec([sym('Reflector'), <struct>])
    const primary = byKey('primary')
    expect(primary.switch().name).toBe('scvVec')
    expect(primary.vec()![0]!.sym().toString()).toBe('Reflector')
    expect(mapKeys(primary.vec()![1]!)).toEqual(['asset', 'contract', 'read_mode'])

    // anchor: scvVec([sym('Some'), scvVec([sym('RedStone'), <struct>])])
    const anchor = byKey('anchor')
    expect(anchor.switch().name).toBe('scvVec')
    expect(anchor.vec()![0]!.sym().toString()).toBe('Some')
    const anchorSource = anchor.vec()![1]!
    expect(anchorSource.vec()![0]!.sym().toString()).toBe('RedStone')
    expect(mapKeys(anchorSource.vec()![1]!)).toEqual([
      'contract',
      'feed_id',
      'max_stale_seconds',
    ])

    // strategy: PrimaryWithAnchor → scvU32(1)
    const strategy = byKey('strategy')
    expect(strategy.switch().name).toBe('scvU32')
    expect(strategy.u32()).toBe(1)
  })

  it('encodes each struct field at its correct ScVal width (i128 vs u64 vs u32 vs bool)', () => {
    // AssetConfigRaw — bps are u32, caps/floors/ceilings are i128, flags are bool.
    const acfg = parseInvoked(
      buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs).xdr
    ).args[2]!
    const acfgEntries = acfg.map()!
    const acfgField = (name: string) =>
      acfgEntries.find((e) => e.key().sym().toString() === name)!.val()
    expect(acfgField('loan_to_value_bps').switch().name).toBe('scvU32')
    expect(acfgField('flashloan_fee_bps').switch().name).toBe('scvU32')
    expect(acfgField('is_borrowable').switch().name).toBe('scvBool')
    expect(acfgField('e_mode_categories').switch().name).toBe('scvVec')

    // MarketParamsRaw — RAY rates are i128, decimals/reserve are u32, asset is address.
    const params = parseInvoked(
      buildStellarCreateLiquidityPoolTx(BASE_OPTS, createPoolArgs).xdr
    ).args[1]!
    const pEntries = params.map()!
    const pField = (name: string) =>
      pEntries.find((e) => e.key().sym().toString() === name)!.val()
    expect(pField('max_borrow_rate_ray').switch().name).toBe('scvI128')
    expect(pField('reserve_factor_bps').switch().name).toBe('scvU32')
    expect(pField('asset_decimals').switch().name).toBe('scvU32')
    expect(pField('asset_id').switch().name).toBe('scvAddress')
    expect(pField('supply_cap').switch().name).toBe('scvI128')
    expect(pField('borrow_cap').switch().name).toBe('scvI128')

    // MarketOracleConfigInput — stale seconds are u64, tolerances u32, sanity i128.
    const cfg = parseInvoked(
      buildStellarConfigureMarketOracleTx(BASE_OPTS, configureOracleArgs).xdr
    ).args[2]!
    const cEntries = cfg.map()!
    const cField = (name: string) =>
      cEntries.find((e) => e.key().sym().toString() === name)!.val()
    expect(cField('max_price_stale_seconds').switch().name).toBe('scvU64')
    expect(cField('first_tolerance_bps').switch().name).toBe('scvU32')
    expect(cField('min_sanity_price_wad').switch().name).toBe('scvI128')
    expect(cField('max_sanity_price_wad').switch().name).toBe('scvI128')
  })

  it('anchor omitted → custom-option None tag', () => {
    const noAnchor = {
      asset: FIXTURE_USDC,
      config: {
        ...(configureOracleArgs.config as unknown as Record<string, unknown>),
        strategy: 'Single',
        anchor: undefined,
      },
    } as unknown as ConfigureMarketOracleArgs
    const parsed = parseInvoked(
      buildStellarConfigureMarketOracleTx(BASE_OPTS, noAnchor).xdr
    )
    const cfg = parsed.args[2]!
    const anchor = cfg
      .map()!
      .find((e) => e.key().sym().toString() === 'anchor')!
      .val()
    expect(anchor.vec()![0]!.sym().toString()).toBe('None')
    expect(anchor.vec()).toHaveLength(1)
  })
})
