/**
 * Tests for the Stellar lending activity-id primitives, locking their outputs.
 */

import {
  buildStellarLendingIdentifier,
  extractEventOrder,
  mapStellarPositionActivityType,
  syntheticEventOrder,
} from '../events/id'

const NFT = 'CDVN5JU675MEDPVRPCYC45AHFC275UH57WEU5OTFE4WFGZBNN7HTLPSY'

describe('Stellar lending activity-id primitives', () => {
  it('buildStellarLendingIdentifier appends the decimal account id to the contract', () => {
    expect(buildStellarLendingIdentifier(NFT, '42')).toBe(`${NFT}-42`)
    expect(buildStellarLendingIdentifier(NFT, '5')).toBe(`${NFT}-5`)
    expect(buildStellarLendingIdentifier(NFT, '4294967295')).toBe(
      `${NFT}-4294967295`,
    )
  })

  it('extractEventOrder parses the index segment of a Soroban event id', () => {
    expect(extractEventOrder('0000000123456789-0000000001')).toBe(1)
    expect(extractEventOrder('1234567-7')).toBe(7)
    expect(extractEventOrder('1234567')).toBe(0)
    expect(extractEventOrder('')).toBe(0)
  })

  it('syntheticEventOrder = base * 10_000 + childIndex', () => {
    expect(syntheticEventOrder(5)).toBe(50000)
    expect(syntheticEventOrder(5, 2)).toBe(50002)
    expect(syntheticEventOrder(0, 0)).toBe(0)
    expect(syntheticEventOrder(7, 9999)).toBe(79999)
  })

  it('mapStellarPositionActivityType matches the action tags', () => {
    expect(mapStellarPositionActivityType('liq_repay')).toBe('lendingLiquidateRepayDebt')
    expect(mapStellarPositionActivityType('liq_seize')).toBe(
      'lendingLiquidateSeizeCollateral'
    )
    // The share-credit receiver leg is NOT a "liquidated by" activity — the
    // receiving account is the liquidator's, not the liquidated one's.
    expect(mapStellarPositionActivityType('liq_credit')).toBe(
      'lendingUpdateAccountPosition'
    )
    expect(mapStellarPositionActivityType('param_upd')).toBe(
      'lendingUpdateAccountParameters'
    )
    expect(mapStellarPositionActivityType('supply')).toBe('lendingUpdateAccountPosition')
    expect(mapStellarPositionActivityType('borrow')).toBe('lendingUpdateAccountPosition')
    expect(mapStellarPositionActivityType(undefined)).toBe('lendingUpdateAccountPosition')
  })

  it('composes the full NftActivityDoc.id formula (txHash-eventIdentifier-eventOrder)', () => {
    // A position delta: id = `${txHash}-${action}-${syntheticEventOrder}`.
    const txHash = 'a1b2c3'
    const action = 'supply'
    const baseOrder = extractEventOrder('0000000123-0000000003')
    const order = syntheticEventOrder(baseOrder, 0)
    expect(`${txHash}-${action}-${order}`).toBe('a1b2c3-supply-30000')

    // Second child of the same base event must not collide with the first.
    const child1 = syntheticEventOrder(baseOrder, 1)
    expect(child1).not.toBe(order)
    expect(`${txHash}-borrow-${child1}`).toBe('a1b2c3-borrow-30001')
  })
})
