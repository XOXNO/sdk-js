/**
 * Decoder tests locked against captured event XDR.
 *
 * `fixtures/lending-events.json` holds the map-encoded controller
 * `#[contractevent]`s' topics + `data` serialized to base64 XDR, exactly as
 * Soroban RPC `getEvents` delivers them. The two vec-encoded ABI v2 topics
 * (`position:batch_update`, `market:batch_state_update`) are constructed below
 * with ScVal builders so the wire field order stays explicit.
 */

import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk'

import {
  decodeStellarLendingEvent,
  stellarLendingDispatchKey,
  toBase64Xdr,
  STELLAR_LENDING_TOPICS,
} from '../events/decode'
import fixtures from './fixtures/lending-events.json'

interface Fixture {
  topic: string
  topics: string[]
  data: string
}

// ---- ABI v2 vec-encoded fixture construction ---------------------------------

const sym = (s: string): xdr.ScVal => xdr.ScVal.scvSymbol(s)
const u32 = (n: number): xdr.ScVal => xdr.ScVal.scvU32(n)
const u64 = (n: bigint): xdr.ScVal => nativeToScVal(n, { type: 'u64' })
const i128 = (n: bigint): xdr.ScVal => nativeToScVal(n, { type: 'i128' })
const vecV = (items: xdr.ScVal[]): xdr.ScVal => xdr.ScVal.scvVec(items)
const mapV = (entries: Record<string, xdr.ScVal>): xdr.ScVal =>
  xdr.ScVal.scvMap(
    Object.keys(entries)
      .sort()
      .map((k) => new xdr.ScMapEntry({ key: sym(k), val: entries[k]! }))
  )
const addrV = (a: string): xdr.ScVal => Address.fromString(a).toScVal()
const b64 = (v: xdr.ScVal): string => v.toXDR('base64')
const topicsFor = (domain: string, action: string): string[] => [
  b64(sym(domain)),
  b64(sym(action)),
]

const OWNER = Address.account(Buffer.alloc(32, 9)).toString()
const ASSET_A = Address.contract(Buffer.alloc(32, 1)).toString()
const ASSET_B = Address.contract(Buffer.alloc(32, 2)).toString()

const RAY = 10n ** 27n

/** Deposit entry: array of 10
 * `[action, hub_id, asset, scaled, index, amount, lt, lb, ltv, liq_fees]`. */
const depositEntry = (action: number, asset: string, amount: bigint): xdr.ScVal =>
  vecV([
    u32(action),
    u32(1),
    addrV(asset),
    i128(amount * 10n ** 9n),
    i128(RAY),
    i128(amount),
    u32(8000),
    u32(500),
    u32(7500),
    u32(100),
  ])

/** Borrow entry: array of 6 `[action, hub_id, asset, scaled, index, amount]`. */
const borrowEntry = (action: number, asset: string, amount: bigint): xdr.ScVal =>
  vecV([
    u32(action),
    u32(1),
    addrV(asset),
    i128(amount * 10n ** 9n),
    i128(RAY),
    i128(amount),
  ])

/** Market entry: array of 9
 * `[hub_id, asset, ts, supply_index, borrow_index, cash, supplied, borrowed,
 * revenue]`. */
const marketEntry = (asset: string): xdr.ScVal =>
  vecV([
    u32(1),
    addrV(asset),
    u64(1718000000000n),
    i128(1050000000000000000000000000n),
    i128(1100000000000000000000000000n),
    i128(7n * RAY),
    i128(500n * RAY),
    i128(300n * RAY),
    i128(2n * RAY),
  ])

// ---- price-aggregator `config:oracle` fixtures -------------------------------
// Wire shape: `{asset, config: MarketOracleConfig}`; sources/read modes/bases
// are Soroban enums (`ScVec [Symbol(variant), payload?]`).

const reflectorSource = (
  contract: string,
  asset: string,
  readMode: xdr.ScVal,
  quoted?: string
): xdr.ScVal =>
  vecV([
    sym('Reflector'),
    mapV({
      contract: addrV(contract),
      asset: vecV([sym('Stellar'), addrV(asset)]),
      read_mode: readMode,
      decimals: u32(14),
      resolution_seconds: u32(300),
      base: quoted ? vecV([sym('Quoted'), addrV(quoted)]) : vecV([sym('Usd')]),
    }),
  ])

const redstoneSource = (tag: 'RedStone' | 'Xoxno', contract: string): xdr.ScVal =>
  vecV([
    sym(tag),
    mapV({
      contract: addrV(contract),
      feed_id: xdr.ScVal.scvString('USDC'),
      decimals: u32(8),
      max_stale_seconds: u64(600n),
    }),
  ])

const oracleConfigData = (
  asset: string,
  strategy: number,
  primary: xdr.ScVal,
  anchor?: xdr.ScVal
): string =>
  b64(
    mapV({
      asset: addrV(asset),
      config: mapV({
        asset_decimals: u32(7),
        max_price_stale_seconds: u64(900n),
        tolerance: mapV({ upper_ratio_bps: u32(10200), lower_ratio_bps: u32(9800) }),
        strategy: u32(strategy),
        primary,
        anchor: anchor ? vecV([sym('Some'), anchor]) : vecV([sym('None')]),
        min_sanity_price_wad: i128(900000000000000000n),
        max_sanity_price_wad: i128(1100000000000000000n),
      }),
    })
  )

const V2_FIXTURES: Fixture[] = [
  {
    topic: 'config:oracle',
    topics: topicsFor('config', 'oracle'),
    // Reflector TWAP primary + Reflector spot anchor quoted in ASSET_B.
    data: oracleConfigData(
      ASSET_A,
      1,
      reflectorSource(ASSET_B, ASSET_A, vecV([sym('Twap'), u32(12)])),
      reflectorSource(ASSET_B, ASSET_A, vecV([sym('Spot')]), ASSET_B)
    ),
  },
  {
    topic: 'config:oracle_redstone_anchor',
    topics: topicsFor('config', 'oracle'),
    data: oracleConfigData(
      ASSET_A,
      1,
      reflectorSource(ASSET_B, ASSET_A, vecV([sym('Twap'), u32(12)])),
      redstoneSource('RedStone', ASSET_B)
    ),
  },
  {
    topic: 'config:oracle_xoxno_single',
    topics: topicsFor('config', 'oracle'),
    data: oracleConfigData(ASSET_A, 0, redstoneSource('Xoxno', ASSET_B)),
  },
  {
    topic: 'position:batch_update',
    topics: topicsFor('position', 'batch_update'),
    // [account_id, attributes, deposits, borrows] — liquidation-shaped.
    data: b64(
      vecV([
        u64(42n),
        vecV([addrV(OWNER), u32(1), u32(1)]),
        vecV([depositEntry(5, ASSET_A, 1000000n), depositEntry(5, ASSET_B, 2000000n)]),
        vecV([borrowEntry(4, ASSET_B, 500000n), borrowEntry(4, ASSET_A, 750000n)]),
      ])
    ),
  },
  {
    topic: 'position:batch_update_unknown_action',
    topics: topicsFor('position', 'batch_update'),
    // Unknown action discriminant (99).
    data: b64(
      vecV([
        u64(7n),
        vecV([addrV(OWNER), u32(0), u32(0)]),
        vecV([depositEntry(99, ASSET_A, 1n), depositEntry(0, ASSET_B, 1n)]),
        vecV([]),
      ])
    ),
  },
  {
    topic: 'market:batch_state_update',
    topics: topicsFor('market', 'batch_state_update'),
    // Data is the entries Vec directly.
    data: b64(vecV([marketEntry(ASSET_A), marketEntry(ASSET_B)])),
  },
  {
    topic: 'market:create',
    topics: topicsFor('market', 'create'),
    data: b64(
      mapV({
        hub_id: u32(1),
        base_asset: addrV(ASSET_A),
        max_borrow_rate: i128(2000000000000000000000000000n),
        base_borrow_rate: i128(10000000000000000000000000n),
        slope1: i128(40000000000000000000000000n),
        slope2: i128(80000000000000000000000000n),
        slope3: i128(1000000000000000000000000000n),
        mid_utilization: i128(450000000000000000000000000n),
        optimal_utilization: i128(800000000000000000000000000n),
        max_utilization: i128(950000000000000000000000000n),
        reserve_factor: u32(1000),
        market_address: addrV(ASSET_B),
      })
    ),
  },
  {
    topic: 'market:params_update',
    topics: topicsFor('market', 'params_update'),
    data: b64(
      mapV({
        asset: addrV(ASSET_A),
        max_borrow_rate: i128(2000000000000000000000000000n),
        base_borrow_rate: i128(10000000000000000000000000n),
        slope1: i128(40000000000000000000000000n),
        slope2: i128(80000000000000000000000000n),
        slope3: i128(1000000000000000000000000000n),
        mid_utilization: i128(450000000000000000000000000n),
        optimal_utilization: i128(800000000000000000000000000n),
        max_utilization: i128(950000000000000000000000000n),
        reserve_factor: u32(1000),
      })
    ),
  },
  {
    topic: 'position:flash_loan',
    topics: topicsFor('position', 'flash_loan'),
    data: b64(
      mapV({
        hub_id: u32(2),
        asset: addrV(ASSET_A),
        receiver: addrV(ASSET_B),
        caller: addrV(ASSET_B),
        amount: i128(1000000000n),
        fee: i128(900000n),
      })
    ),
  },
  {
    topic: 'strategy:fee',
    topics: topicsFor('strategy', 'fee'),
    data: b64(
      mapV({
        hub_id: u32(2),
        asset: addrV(ASSET_A),
        amount: i128(1000000000n),
        fee: i128(10000000n),
        amount_sent: i128(990000000n),
      })
    ),
  },
  {
    topic: 'position:liquidation',
    topics: topicsFor('position', 'liquidation'),
    data: b64(
      mapV({
        liquidator: xdr.ScVal.scvAddress(
          Address.fromString(OWNER).toScAddress()
        ),
        account_id: u64(42n),
        repaid_usd_wad: i128(125000000000000000000n),
        bonus_bps: i128(350n),
      })
    ),
  },
  {
    topic: 'config:spoke',
    topics: topicsFor('config', 'spoke'),
    // Map-encoded, constructed here (postdates the captured JSON): the
    // controller stamps the liquidation curve into the spoke at creation.
    data: b64(
      mapV({
        spoke: mapV({
          spoke_id: u32(3),
          is_deprecated: xdr.ScVal.scvBool(false),
          liquidation_target_hf_wad: i128(1020000000000000000n),
          hf_for_max_bonus_wad: i128(510000000000000000n),
          liquidation_bonus_factor_bps: u32(10000),
        }),
      })
    ),
  },
]

const FIXTURES = [...(fixtures as Fixture[]), ...V2_FIXTURES]
const byTopic = (t: string): Fixture => {
  const f = FIXTURES.find((x) => x.topic === t)
  if (!f) throw new Error(`fixture not found: ${t}`)
  return f
}
const decodeFixture = (t: string) => {
  const f = byTopic(t)
  const ev = decodeStellarLendingEvent(f.topics, f.data)
  if (!ev) throw new Error(`decoder returned null for ${t}`)
  return ev
}

describe('decodeStellarLendingEvent — real fixtures', () => {
  it('has a decoder for registered lending topics and decodes every fixture', () => {
    expect(STELLAR_LENDING_TOPICS.length).toBeGreaterThanOrEqual(18)
    expect(FIXTURES.length).toBeGreaterThanOrEqual(18)
    for (const f of FIXTURES) {
      const ev = decodeStellarLendingEvent(f.topics, f.data)
      expect(ev).not.toBeNull()
      // The decoded topic is the dispatch key derived from the topic symbols
      // (fixture labels like `config:oracle_redstone_anchor` are variants).
      expect(ev!.topic).toBe(stellarLendingDispatchKey(f.topics))
    }
  })

  it('returns null for an unknown topic (e.g. access-control events)', () => {
    const fake = byTopic('config:aggregator')
    const roleTopic = xdr.ScVal.scvSymbol('role_granted').toXDR('base64')
    expect(decodeStellarLendingEvent([roleTopic, roleTopic], fake.data)).toBeNull()
  })

  it('builds the dispatch key from the two topic symbols', () => {
    expect(stellarLendingDispatchKey(byTopic('market:create').topics)).toBe('market:create')
    expect(stellarLendingDispatchKey(byTopic('config:oracle_disabled').topics)).toBe(
      'config:oracle_disabled'
    )
  })

  it('decodes bigints (i128/u64) as decimal strings, u32 as numbers', () => {
    const ev = decodeFixture('market:create')
    if (ev.topic !== 'market:create') throw new Error('narrow')
    expect(ev.data.hubId).toBe(1)
    expect(ev.data.maxBorrowRate).toBe('2000000000000000000000000000')
    expect(ev.data.baseBorrowRate).toBe('10000000000000000000000000')
    expect(ev.data.maxUtilization).toBe('950000000000000000000000000')
    expect(ev.data.reserveFactor).toBe(1000)
    expect(ev.data.baseAsset).toMatch(/^C[A-Z2-7]{55}$/)
  })

  it('position:batch_update (vec ABI v2) — merges deposits then borrows, maps action strings', () => {
    const ev = decodeFixture('position:batch_update')
    if (ev.topic !== 'position:batch_update') throw new Error('narrow')
    expect(ev.data.accountId).toBe('42')
    expect(ev.data.accountAttributes.owner).toBe(OWNER)
    expect(ev.data.accountAttributes.mode).toBe('Multiply')
    expect(ev.data.accountAttributes.spokeId).toBe(1)

    // Merged order: ALL deposit entries first (in order), then all borrows.
    expect(ev.data.updates).toHaveLength(4)
    expect(ev.data.updates.map((u) => u.positionType)).toEqual([
      'Deposit',
      'Deposit',
      'Borrow',
      'Borrow',
    ])
    expect(ev.data.updates.map((u) => u.action)).toEqual([
      'liq_seize',
      'liq_seize',
      'liq_repay',
      'liq_repay',
    ])
    const [deposit, deposit2, borrow] = ev.data.updates
    expect(deposit!.hubId).toBe(1)
    expect(deposit!.asset).toBe(ASSET_A)
    expect(deposit2!.asset).toBe(ASSET_B)
    expect(deposit!.amount).toBe('1000000')
    expect(deposit!.scaledAmountRay).toBe('1000000000000000')
    expect(deposit!.indexRay).toBe(RAY.toString())
    expect(deposit!.liquidationThresholdBps).toBe(8000)
    expect(deposit!.liquidationBonusBps).toBe(500)
    expect(deposit!.loanToValueBps).toBe(7500)
    expect(deposit!.liquidationFeesBps).toBe(100)

    expect(borrow!.hubId).toBe(1)
    expect(borrow!.asset).toBe(ASSET_B)
    expect(borrow!.amount).toBe('500000')
    // Borrow risk params are not applicable → undefined, NOT 0.
    expect(borrow!.liquidationThresholdBps).toBeUndefined()
    expect(borrow!.liquidationBonusBps).toBeUndefined()
    expect(borrow!.loanToValueBps).toBeUndefined()
    expect(borrow!.liquidationFeesBps).toBeUndefined()
  })

  it('position:batch_update — unknown action discriminant decodes as its decimal string', () => {
    const f = byTopic('position:batch_update_unknown_action')
    const ev = decodeStellarLendingEvent(f.topics, f.data)
    if (ev?.topic !== 'position:batch_update') throw new Error('narrow')
    expect(ev.data.accountId).toBe('7')
    expect(ev.data.accountAttributes.mode).toBe('None')
    expect(ev.data.updates.map((u) => u.action)).toEqual(['99', 'supply'])
  })

  it('market:batch_state_update (vec ABI v2) — hub_id-keyed snapshots', () => {
    const ev = decodeFixture('market:batch_state_update')
    if (ev.topic !== 'market:batch_state_update') throw new Error('narrow')
    expect(ev.data.updates).toHaveLength(2)
    const [first, second] = ev.data.updates
    expect(first!.hubId).toBe(1)
    expect(first!.asset).toBe(ASSET_A)
    expect(first!.timestamp).toBe(1718000000000)
    expect(first!.supplyIndexRay).toBe('1050000000000000000000000000')
    expect(first!.borrowIndexRay).toBe('1100000000000000000000000000')
    expect(first!.cash).toBe((7n * RAY).toString())
    expect(first!.suppliedRay).toBe((500n * RAY).toString())
    expect(first!.borrowedRay).toBe((300n * RAY).toString())
    expect(first!.revenueRay).toBe((2n * RAY).toString())
    expect(second!.asset).toBe(ASSET_B)
  })

  // Regression: `market:batch_params_update` is single-value — `data` is the
  // updates Vec directly. Reading `d.updates` would yield [] and silently drop
  // the rate-model updates, leaving indexed params frozen at create-time.
  it('market:batch_params_update (single-value Vec) — decodes rate-model params', () => {
    const params = mapV({
      asset_decimals: u32(7),
      asset_id: addrV(ASSET_A),
      base_borrow_rate: i128(10000000000000000000000000n),
      flashloan_fee: u32(9),
      is_flashloanable: xdr.ScVal.scvBool(true),
      max_borrow_rate: i128(800000000000000000000000000n),
      max_utilization: i128(900000000000000000000000000n),
      mid_utilization: i128(500000000000000000000000000n),
      optimal_utilization: i128(800000000000000000000000000n),
      reserve_factor: u32(2000),
      slope1: i128(40000000000000000000000000n),
      slope2: i128(100000000000000000000000000n),
      slope3: i128(250000000000000000000000000n),
    })
    const data = b64(
      vecV([mapV({ asset: addrV(ASSET_A), hub_id: u32(1), params })])
    )
    const ev = decodeStellarLendingEvent(
      topicsFor('market', 'batch_params_update'),
      data
    )
    if (!ev || ev.topic !== 'market:batch_params_update') throw new Error('narrow')
    expect(ev.data.updates).toHaveLength(1)
    expect(ev.data.updates[0]!.hubId).toBe(1)
    expect(ev.data.updates[0]!.asset).toBe(ASSET_A)
    expect(ev.data.updates[0]!.params.maxUtilizationRay).toBe(
      '900000000000000000000000000'
    )
  })

  it('decodes strategy:fee — i128 amounts as decimal strings', () => {
    const ev = decodeFixture('strategy:fee')
    if (ev.topic !== 'strategy:fee') throw new Error('narrow')
    expect(ev.data.hubId).toBe(2)
    expect(ev.data.asset).toMatch(/^C[A-Z2-7]{55}$/)
    expect(ev.data.amount).toBe('1000000000')
    expect(ev.data.fee).toBe('10000000')
    expect(ev.data.amountSent).toBe('990000000')
  })

  it('position:flash_loan and position:liquidation decode hub/actor fields', () => {
    const flash = decodeFixture('position:flash_loan')
    if (flash.topic !== 'position:flash_loan') throw new Error('narrow')
    expect(flash.data.hubId).toBe(2)
    expect(flash.data.amount).toBe('1000000000')
    expect(flash.data.fee).toBe('900000')

    const liq = decodeFixture('position:liquidation')
    if (liq.topic !== 'position:liquidation') throw new Error('narrow')
    expect(liq.data.liquidator).toBe(OWNER)
    expect(liq.data.accountId).toBe('42')
    expect(liq.data.repaidUsdWad).toBe('125000000000000000000')
    expect(liq.data.bonusBps).toBe('350')
  })

  it('config:oracle — legacy payload maps into AssetOracle-shaped oracle field', () => {
    const ev = decodeFixture('config:oracle')
    if (ev.topic !== 'config:oracle') throw new Error('narrow')
    expect(ev.data.asset).toBe(ASSET_A)
    const o = ev.data.oracle
    // Legacy fixtures may only partially fill AssetOracle; assert fields we decode.
    expect(o.assetDecimals).toBeDefined()
    expect(o.maxPriceStaleSeconds).toBeDefined()
    expect(Array.isArray(o.sources)).toBe(true)
  })

  it('config:oracle_redstone_anchor — still decodes as legacy config:oracle topic', () => {
    const f = byTopic('config:oracle_redstone_anchor')
    const ev = decodeStellarLendingEvent(f.topics, f.data)
    expect(ev).not.toBeNull()
    if (ev!.topic !== 'config:oracle') throw new Error('narrow')
    expect(ev.data.oracle.sources).toBeDefined()
  })

  it('config:oracle_xoxno_single — still decodes as legacy config:oracle topic', () => {
    const f = byTopic('config:oracle_xoxno_single')
    const ev = decodeStellarLendingEvent(f.topics, f.data)
    expect(ev).not.toBeNull()
    if (ev!.topic !== 'config:oracle') throw new Error('narrow')
    expect(ev.data.oracle.sources).toBeDefined()
  })

  it('decodes single-field / batch events that serialize as a wrapping ScMap', () => {
    const disabled = decodeFixture('config:oracle_disabled')
    if (disabled.topic !== 'config:oracle_disabled') throw new Error('narrow')
    expect(disabled.data.asset).toMatch(/^C[A-Z2-7]{55}$/)

    const agg = decodeFixture('config:aggregator')
    if (agg.topic !== 'config:aggregator') throw new Error('narrow')
    expect(agg.data.aggregator).toMatch(/^C[A-Z2-7]{55}$/)

    const limits = decodeFixture('config:position_limits')
    if (limits.topic !== 'config:position_limits') throw new Error('narrow')
    expect(limits.data.maxSupplyPositions).toBe(16)
    expect(limits.data.maxBorrowPositions).toBe(8)
  })

  it('config:spoke — decodes the stamped liquidation curve', () => {
    const ev = decodeFixture('config:spoke')
    if (ev.topic !== 'config:spoke') throw new Error('narrow')
    expect(ev.data.spokeId).toBe(3)
    expect(ev.data.isDeprecated).toBe(false)
    expect(ev.data.liquidationTargetHfWad).toBe('1020000000000000000')
    expect(ev.data.healthFactorForMaxBonusWad).toBe('510000000000000000')
    expect(ev.data.liquidationBonusFactorBps).toBe(10000)
  })

  it('config:approve_token — BytesN<32> wasm hash → 64-char hex', () => {
    const ev = decodeFixture('config:approve_token')
    if (ev.topic !== 'config:approve_token') throw new Error('narrow')
    expect(ev.data.approved).toBe(true)
    expect(ev.data.wasmHash).toBe('07'.repeat(32))
  })

  it('toBase64Xdr round-trips a live ScVal back to the wire string', () => {
    // Simulates a consumer holding a parsed ScVal (e.g. from the high-level RPC
    // client) and serializing it for the string-only decoder API.
    const f = byTopic('config:oracle_disabled')
    const live = xdr.ScVal.fromXDR(f.data, 'base64')
    expect(toBase64Xdr(live)).toBe(f.data)
    const ev = decodeStellarLendingEvent(f.topics.map((t) => toBase64Xdr(xdr.ScVal.fromXDR(t, 'base64'))), toBase64Xdr(live))
    expect(ev!.topic).toBe('config:oracle_disabled')
  })
})
