/**
 * Decoder tests locked against REAL captured event XDR.
 *
 * `fixtures/lending-events.json` was produced by publishing every controller
 * `#[contractevent]` in a soroban-sdk 26 test env and serializing each event's
 * topics + `data` to base64 XDR via `ScVal::to_xdr_base64` — byte-identical to
 * what Soroban RPC `getEvents` delivers. These tests prove the decoders match
 * on-chain reality (not a hand-built assumption) and that the four legacy
 * consumer bugs are fixed.
 */

import { xdr } from '@stellar/stellar-sdk'

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
const FIXTURES = fixtures as Fixture[]
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
  it('has a decoder for all 21 controller events and decodes every fixture', () => {
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
    expect(stellarLendingDispatchKey(byTopic('oracle:twap_degraded').topics)).toBe(
      'oracle:twap_degraded'
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

  it('position:batch_update — Deposit keeps risk fields, Borrow nulls them (bug fix)', () => {
    const ev = decodeFixture('position:batch_update')
    if (ev.topic !== 'position:batch_update') throw new Error('narrow')
    expect(ev.data.accountId).toBe('42')
    expect(ev.data.accountAttributes.mode).toBe('Multiply')
    expect(ev.data.accountAttributes.eModeCategoryId).toBe(1)
    expect(ev.data.accountAttributes.isolatedToken).toBeUndefined()

    const [deposit, borrow] = ev.data.updates
    expect(deposit!.positionType).toBe('Deposit')
    expect(deposit!.action).toBe('supply')
    expect(deposit!.liquidationThresholdBps).toBe(8000)
    expect(deposit!.liquidationBonusBps).toBe(500)
    expect(deposit!.loanToValueBps).toBe(7500)
    expect(deposit!.amount).toBe('1000000')

    expect(borrow!.positionType).toBe('Borrow')
    expect(borrow!.action).toBe('borrow')
    // Bug fix: borrow risk params are not-applicable → undefined, NOT 0.
    expect(borrow!.liquidationThresholdBps).toBeUndefined()
    expect(borrow!.liquidationBonusBps).toBeUndefined()
    expect(borrow!.loanToValueBps).toBeUndefined()
    // Bug fix: no phantom liquidationFeesBps on deltas.
    expect('liquidationFeesBps' in (borrow as object)).toBe(false)
    expect('liquidationFeesBps' in (deposit as object)).toBe(false)
  })

  it('decodes the REAL debt:ceiling_batch_update (not just the dead single)', () => {
    const batch = decodeFixture('debt:ceiling_batch_update')
    if (batch.topic !== 'debt:ceiling_batch_update') throw new Error('narrow')
    expect(batch.data.updates).toHaveLength(1)
    expect(batch.data.updates[0]!.totalDebtUsdWad).toBe('123000000000000000000')
    expect(batch.data.updates[0]!.asset).toMatch(/^C[A-Z2-7]{55}$/)
    // The dead single is still decodable for completeness.
    const single = decodeFixture('debt:ceiling_update')
    expect(single.topic).toBe('debt:ceiling_update')
  })

  it('decodes oracle:twap_degraded (previously unhandled by both consumers)', () => {
    const ev = decodeFixture('oracle:twap_degraded')
    if (ev.topic !== 'oracle:twap_degraded') throw new Error('narrow')
    expect(ev.data.reasonCode).toBe(3)
    expect(ev.data.oracle).toMatch(/^C[A-Z2-7]{55}$/)
  })

  it('config:oracle — reconstructs primary/anchor sources + tolerance', () => {
    const ev = decodeFixture('config:oracle')
    if (ev.topic !== 'config:oracle') throw new Error('narrow')
    const o = ev.data.oracle
    expect(o.strategy).toBe('PrimaryWithAnchor')
    expect(o.quoteTokenId).toBe('USD')
    expect(o.assetDecimals).toBe(7)
    expect(o.maxPriceStaleSeconds).toBe(900)
    expect(o.tolerance.firstUpperRatio).toBe(10200)
    expect(o.tolerance.lastLowerRatio).toBe(9500)
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
