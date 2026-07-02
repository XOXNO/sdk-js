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
const none = (): xdr.ScVal => xdr.ScVal.scvVoid()
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

/** Deposit entry: array of 8 `[action, asset, scaled, index, amount, lt, lb, ltv]`. */
const depositEntry = (action: number, asset: string, amount: bigint): xdr.ScVal =>
  vecV([
    u32(action),
    addrV(asset),
    i128(amount * 10n ** 9n),
    i128(RAY),
    i128(amount),
    u32(8000),
    u32(500),
    u32(7500),
  ])

/** Borrow entry: array of 5 `[action, asset, scaled, index, amount]`. */
const borrowEntry = (action: number, asset: string, amount: bigint): xdr.ScVal =>
  vecV([u32(action), addrV(asset), i128(amount * 10n ** 9n), i128(RAY), i128(amount)])

/** Market entry: array of 9, trailing `asset_price_wad` is `Option<i128>`. */
const marketEntry = (asset: string, priceWad: bigint | null): xdr.ScVal =>
  vecV([
    addrV(asset),
    u64(1718000000000n),
    i128(1050000000000000000000000000n),
    i128(1100000000000000000000000000n),
    i128(7n * RAY),
    i128(500n * RAY),
    i128(300n * RAY),
    i128(2n * RAY),
    priceWad === null ? none() : i128(priceWad),
  ])

const V2_FIXTURES: Fixture[] = [
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
    // Data is the entries Vec directly — price present, then absent.
    data: b64(vecV([marketEntry(ASSET_A, 1230000000000000000n), marketEntry(ASSET_B, null)])),
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
  it('has a decoder for all 21 lending events and decodes every fixture', () => {
    expect(STELLAR_LENDING_TOPICS).toHaveLength(21)
    expect(FIXTURES.length).toBeGreaterThanOrEqual(21)
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
    expect(ev.data.maxBorrowRate).toBe('2000000000000000000000000000')
    expect(ev.data.baseBorrowRate).toBe('10000000000000000000000000')
    expect(ev.data.reserveFactor).toBe(1000)
    expect(ev.data.baseAsset).toMatch(/^C[A-Z2-7]{55}$/)
    expect(ev.data.config.eModeCategories).toEqual([1, 2])
    expect(ev.data.config.liquidationFeesBps).toBe(100)
  })

  it('position:batch_update (vec ABI v2) — merges deposits then borrows, maps action strings', () => {
    const ev = decodeFixture('position:batch_update')
    if (ev.topic !== 'position:batch_update') throw new Error('narrow')
    expect(ev.data.accountId).toBe('42')
    expect(ev.data.accountAttributes.owner).toBe(OWNER)
    expect(ev.data.accountAttributes.mode).toBe('Multiply')
    expect(ev.data.accountAttributes.eModeCategoryId).toBe(1)

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
    expect(deposit!.asset).toBe(ASSET_A)
    expect(deposit2!.asset).toBe(ASSET_B)
    expect(deposit!.amount).toBe('1000000')
    expect(deposit!.scaledAmountRay).toBe('1000000000000000')
    expect(deposit!.indexRay).toBe(RAY.toString())
    expect(deposit!.liquidationThresholdBps).toBe(8000)
    expect(deposit!.liquidationBonusBps).toBe(500)
    expect(deposit!.loanToValueBps).toBe(7500)

    expect(borrow!.asset).toBe(ASSET_B)
    expect(borrow!.amount).toBe('500000')
    // Borrow risk params are not applicable → undefined, NOT 0.
    expect(borrow!.liquidationThresholdBps).toBeUndefined()
    expect(borrow!.liquidationBonusBps).toBeUndefined()
    expect(borrow!.loanToValueBps).toBeUndefined()
    // assetPriceWad left the position-delta wire format in ABI v2.
    expect(Object.keys(deposit as object)).not.toContain('assetPriceWad')
    expect(Object.keys(borrow as object)).not.toContain('assetPriceWad')
  })

  it('position:batch_update — unknown action discriminant decodes as its decimal string', () => {
    const f = byTopic('position:batch_update_unknown_action')
    const ev = decodeStellarLendingEvent(f.topics, f.data)
    if (ev?.topic !== 'position:batch_update') throw new Error('narrow')
    expect(ev.data.accountId).toBe('7')
    expect(ev.data.accountAttributes.mode).toBe('None')
    expect(ev.data.updates.map((u) => u.action)).toEqual(['99', 'supply'])
  })

  it('market:batch_state_update (vec ABI v2) — price present and absent (null)', () => {
    const ev = decodeFixture('market:batch_state_update')
    if (ev.topic !== 'market:batch_state_update') throw new Error('narrow')
    expect(ev.data.updates).toHaveLength(2)
    const [withPrice, withoutPrice] = ev.data.updates
    expect(withPrice!.asset).toBe(ASSET_A)
    expect(withPrice!.timestamp).toBe(1718000000000)
    expect(withPrice!.supplyIndexRay).toBe('1050000000000000000000000000')
    expect(withPrice!.borrowIndexRay).toBe('1100000000000000000000000000')
    expect(withPrice!.reservesRay).toBe((7n * RAY).toString())
    expect(withPrice!.suppliedRay).toBe((500n * RAY).toString())
    expect(withPrice!.borrowedRay).toBe((300n * RAY).toString())
    expect(withPrice!.revenueRay).toBe((2n * RAY).toString())
    expect(withPrice!.assetPriceWad).toBe('1230000000000000000')
    expect(withoutPrice!.asset).toBe(ASSET_B)
    expect(withoutPrice!.assetPriceWad).toBeUndefined()
  })

  // Regression: `market:batch_params_update` is single-value — `data` is the
  // updates Vec directly. Reading `d.updates` yields [] and silently drops the
  // supply/borrow caps (the only fields unique to this event), leaving indexed
  // caps frozen at their create-time value.
  it('market:batch_params_update (single-value Vec) — decodes supply/borrow caps', () => {
    const params = mapV({
      asset_decimals: u32(7),
      asset_id: addrV(ASSET_A),
      base_borrow_rate_ray: i128(10000000000000000000000000n),
      borrow_cap: i128(50000000000000n),
      max_borrow_rate_ray: i128(800000000000000000000000000n),
      max_utilization_ray: i128(900000000000000000000000000n),
      mid_utilization_ray: i128(500000000000000000000000000n),
      optimal_utilization_ray: i128(800000000000000000000000000n),
      reserve_factor_bps: u32(2000),
      slope1_ray: i128(40000000000000000000000000n),
      slope2_ray: i128(100000000000000000000000000n),
      slope3_ray: i128(250000000000000000000000000n),
      supply_cap: i128(50000000000000n),
    })
    const data = b64(vecV([mapV({ asset: addrV(ASSET_A), params })]))
    const ev = decodeStellarLendingEvent(
      topicsFor('market', 'batch_params_update'),
      data
    )
    if (!ev || ev.topic !== 'market:batch_params_update') throw new Error('narrow')
    expect(ev.data.updates).toHaveLength(1)
    expect(ev.data.updates[0]!.asset).toBe(ASSET_A)
    expect(ev.data.updates[0]!.params.supplyCap).toBe('50000000000000')
    expect(ev.data.updates[0]!.params.borrowCap).toBe('50000000000000')
    expect(ev.data.updates[0]!.params.maxUtilizationRay).toBe(
      '900000000000000000000000000'
    )
  })

  it('decodes strategy:fee — i128 amounts as decimal strings', () => {
    const ev = decodeFixture('strategy:fee')
    if (ev.topic !== 'strategy:fee') throw new Error('narrow')
    expect(ev.data.asset).toMatch(/^C[A-Z2-7]{55}$/)
    expect(ev.data.amount).toBe('1000000000')
    expect(ev.data.fee).toBe('10000000')
    expect(ev.data.amountSent).toBe('990000000')
  })

  it('config:oracle — reconstructs primary/anchor sources + tolerance', () => {
    const ev = decodeFixture('config:oracle')
    if (ev.topic !== 'config:oracle') throw new Error('narrow')
    const o = ev.data.oracle
    expect(o.strategy).toBe('PrimaryWithAnchor')
    expect(o.quoteTokenId).toBe('USD')
    expect(o.assetDecimals).toBe(7)
    expect(o.maxPriceStaleSeconds).toBe(900)
    // TODO(oracle-failclosed): single band; exact values pending fixture regen post-redeploy.
    expect(typeof o.tolerance.upperRatio).toBe('number')
    expect(typeof o.tolerance.lowerRatio).toBe('number')
    expect(o.primary.provider).toBe('ReflectorSep40')
    expect(o.primary.readMode).toBe('Twap')
    expect(o.primary.twapRecords).toBe(12)
    expect(o.primary.decimals).toBe(14)
    expect(o.anchor).toBeDefined()
    expect(o.anchor!.readMode).toBe('Spot')
    expect(o.anchor!.twapRecords).toBeUndefined()
  })

  it('config:oracle with a RedStone anchor — exercises the RedStone decode branch', () => {
    const f = byTopic('config:oracle_redstone_anchor')
    const ev = decodeStellarLendingEvent(f.topics, f.data)
    expect(ev).not.toBeNull()
    if (ev!.topic !== 'config:oracle') throw new Error('narrow')
    const o = ev.data.oracle
    expect(o.strategy).toBe('PrimaryWithAnchor')
    expect(o.primary.provider).toBe('ReflectorSep40')
    expect(o.anchor).toBeDefined()
    expect(o.anchor!.provider).toBe('RedStonePriceFeed')
    expect(o.anchor!.feedId).toBe('USDC')
    expect(o.anchor!.asset).toBeUndefined()
    expect(o.anchor!.readMode).toBe('Spot')
    expect(o.anchor!.twapRecords).toBeUndefined()
    expect(o.anchor!.maxStaleSeconds).toBe(600)
    expect(o.anchor!.decimals).toBe(8)
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
