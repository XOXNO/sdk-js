/**
 * Multi-hub ABI encoding tests for the Stellar lending builders.
 *
 * Asserts the on-the-wire ScVal shape after the migration from the old
 * `(Address, i128)` + `e_mode_category` ABI to the multi-hub
 * `(HubAssetKey, i128)` + `spoke_id` ABI:
 *   - `supply` carries `spoke_id` as a `u32` and a `Vec<(HubAssetKey, i128)>`.
 *   - each `HubAssetKey` is a struct/map whose symbol keys are sorted
 *     (`asset`, `hub_id`) — the canonical Soroban `#[contracttype]` layout.
 *   - `borrow` carries the same `Vec<(HubAssetKey, i128)>` payload.
 */

import { Networks, Transaction, xdr } from '@stellar/stellar-sdk'

import {
  buildStellarBorrowTx,
  buildStellarSupplyTx,
  type StellarBuilderOptions,
} from '../lending'

const FIXTURE_CALLER =
  'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR'
const FIXTURE_CONTROLLER =
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
const FIXTURE_USDC =
  'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3'

const BASE_OPTS: StellarBuilderOptions = {
  network: 'testnet',
  caller: FIXTURE_CALLER,
  sourceSequence: '123456789',
  controllerAddress: FIXTURE_CONTROLLER,
}

/** Pull the host-function args ScVal[] from a single-op InvokeHostFunction tx. */
const invokeArgsOf = (xdrB64: string): xdr.ScVal[] => {
  const tx = new Transaction(xdrB64, Networks.TESTNET)
  const op = tx.operations[0] as unknown as { func: xdr.HostFunction }
  return op.func.invokeContract().args()
}

/** Sorted symbol-key names of a HubAssetKey struct ScVal (an scvMap). */
const hubAssetKeyNames = (hubAssetKey: xdr.ScVal): string[] =>
  hubAssetKey
    .map()!
    .map((e) => e.key().sym().toString())
    .sort()

describe('multi-hub builder ABI encoding', () => {
  it('supply encodes spoke_id (u32) + Vec<(HubAssetKey, i128)>', () => {
    const { xdr: b64 } = buildStellarSupplyTx(BASE_OPTS, {
      spokeId: 2,
      hubId: 1,
      asset: FIXTURE_USDC,
      amount: '100',
    })
    const args = invokeArgsOf(b64)

    // [caller, account_id(u64), spoke_id(u32), assets vec]
    expect(args).toHaveLength(4)
    expect(args[2].switch()).toBe(xdr.ScValType.scvU32())
    expect(args[2].u32()).toBe(2)

    const firstTuple = args[3].vec()![0].vec()! // (HubAssetKey, i128)
    expect(hubAssetKeyNames(firstTuple[0])).toEqual(['asset', 'hub_id'])

    // hub_id round-trips as the u32 we passed.
    const hubIdEntry = firstTuple[0]
      .map()!
      .find((e) => e.key().sym().toString() === 'hub_id')
    expect(hubIdEntry?.val().u32()).toBe(1)

    // amount is the i128 second tuple element.
    expect(firstTuple[1].switch()).toBe(xdr.ScValType.scvI128())
  })

  it('borrow encodes Vec<(HubAssetKey, i128)> + trailing Option<to>', () => {
    const { xdr: b64 } = buildStellarBorrowTx(BASE_OPTS, {
      accountNonce: 7,
      hubId: 0,
      asset: FIXTURE_USDC,
      amount: '500',
    })
    const args = invokeArgsOf(b64)

    // [caller, account_id(u64), borrows vec, to (None -> Void)]
    expect(args).toHaveLength(4)
    const firstTuple = args[2].vec()![0].vec()!
    expect(hubAssetKeyNames(firstTuple[0])).toEqual(['asset', 'hub_id'])
    expect(args[3].switch()).toBe(xdr.ScValType.scvVoid())
  })
})
