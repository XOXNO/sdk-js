// Check the distributed SDK in a browser-like realm without Node globals.
// Load the peer's browser distribution in the same realm as the SDK.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as nodeStellar from '@stellar/stellar-sdk'

const context = vm.createContext({
  TextEncoder, TextDecoder, URL, URLSearchParams, AbortController,
  Event, EventTarget, setTimeout, clearTimeout,
})
vm.runInContext(await readFile(
  new URL('../../dist/stellar-sdk.js', import.meta.resolve('@stellar/stellar-sdk')), 'utf8',
), context)
const stellar = context.StellarSdk
const bundle = new vm.SourceTextModule(
  await readFile(new URL('../dist/sdk/stellar/index.esm.js', import.meta.url), 'utf8'),
  { context },
)
await bundle.link(specifier => {
  assert.equal(specifier, '@stellar/stellar-sdk')
  return new vm.SyntheticModule(Object.keys(stellar), function () {
    for (const key of Object.keys(stellar)) this.setExport(key, stellar[key])
  }, { context })
})
await bundle.evaluate()
assert.equal(vm.runInContext('typeof process', context), 'undefined')
assert.equal(vm.runInContext('typeof Buffer', context), 'undefined')
const sdk = bundle.namespace
const opts = {
  network: 'testnet',
  caller: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
  controllerAddress: 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ',
  sourceSequence: '123',
}
const built = sdk.buildStellarSupplyTx(opts, {
  spokeId: 1, hubId: 1, asset: opts.controllerAddress, amount: '100',
})
assert.equal(stellar.TransactionBuilder.fromXDR(built.xdr, stellar.Networks.TESTNET).operations.length, 1)
// Exercise an SDK path that needs Buffer, beyond module import.
const strategy = sdk.buildStellarSwapCollateralTx(opts, {
  accountNonce: 1,
  current: { hubId: 1, asset: opts.controllerAddress },
  newCollateral: { hubId: 1, asset: opts.controllerAddress },
  fromAmount: '100',
  steps: { routeXdr: nodeStellar.xdr.ScVal.scvBytes(Buffer.from([1, 2, 3])).toXDR('base64') },
})
assert.ok(strategy.xdr.length > 0)
assert.equal(typeof sdk.stellarLendingRead(new sdk.XOXNOClient({ apiUrl: 'https://example.invalid' })).reserves, 'function')
console.log('Stellar ESM import, reads and builders work without process/Buffer globals')
