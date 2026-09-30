import { Account, Asset, Contract, Networks, Operation, StrKey, TransactionBuilder, xdr } from '@stellar/stellar-sdk'

import { decodeStellarSwapEnvelope } from '../swap-history'
import { addr, encodeStrategyPayloadToBytes, i128 } from '../scval-encode'

const account = (n: number) => StrKey.encodeEd25519PublicKey(Buffer.alloc(32, n))
const contract = (n: number) => StrKey.encodeContract(Buffer.alloc(32, n))
const VIEWER = account(1)
const OTHER = account(2)
const ROUTER = contract(1)
const INPUT = contract(2)
const OUTPUT = contract(3)
const AMOUNT = '170141183460469231731687303715884105727'
const route = encodeStrategyPayloadToBytes({
  tokenIn: INPUT,
  tokenOut: OUTPUT,
  totalMinOut: '1',
  paths: [{ splitPpm: 1_000_000, hops: [{ pool: contract(4), tokenIn: INPUT, tokenOut: OUTPUT, venue: 'Aquarius' }] }],
})
const swap = (sender = VIEWER, amount = AMOUNT, router = ROUTER, fn = 'execute_strategy', bytes = route) =>
  new Contract(router).call(fn, addr(sender), i128(amount), bytes)
const envelope = (operations = [swap()], feeBump = false) => {
  const builder = new TransactionBuilder(new Account(OTHER, '1'), { fee: '100', networkPassphrase: Networks.PUBLIC })
  for (const operation of operations) builder.addOperation(operation)
  const tx = builder.setTimeout(0).build()
  return (feeBump ? TransactionBuilder.buildFeeBumpTransaction(OTHER, '100', tx, Networks.PUBLIC) : tx).toXDR()
}
const options = { networkPassphrase: Networks.PUBLIC, viewer: VIEWER, routerAddress: ROUTER }
const decode = (envelopeXdr: string, operationIndex?: number) => decodeStellarSwapEnvelope({ ...options, envelopeXdr, operationIndex })
const result = { tokenIn: INPUT, tokenOut: OUTPUT, amountInAtoms: AMOUNT, operationIndex: 0 }

it('decodes regular and fee-bump envelopes without rounding or using the transaction source as viewer', () => {
  expect(decode(envelope())).toEqual(result)
  expect(decode(envelope([swap()], true))).toEqual(result)
})

it('selects an inner operation index; unindexed multiple swaps are ambiguous', () => {
  const payment = Operation.payment({ destination: VIEWER, amount: '1', asset: Asset.native() })
  const multi = envelope([payment, swap(), swap(VIEWER, '15')])
  expect(decode(multi)).toBeNull()
  expect(decode(multi, 1)).toEqual({ ...result, operationIndex: 1 })
  expect(decode(envelope([swap(), swap(VIEWER, '15')], true), 1)?.amountInAtoms).toBe('15')
  for (const index of [-1, 0.5, 10, NaN]) expect(decode(multi, index)).toBeNull()
  expect(decode(multi, 0)).toBeNull()
})

it('rejects unrelated providers, methods, viewers, nonpositive amounts and malformed routes', () => {
  for (const op of [swap(OTHER), swap(VIEWER, AMOUNT, contract(9)), swap(VIEWER, AMOUNT, ROUTER, 'other'), swap(VIEWER, '0'), swap(VIEWER, '-1'), swap(VIEWER, AMOUNT, ROUTER, 'execute_strategy', xdr.ScVal.scvBytes(Buffer.from('bad')))]) {
    expect(decode(envelope([op]))).toBeNull()
  }
  const extraArgs = new Contract(ROUTER).call('execute_strategy', addr(VIEWER), i128(AMOUNT), route, i128('1'))
  const wrongAmount = new Contract(ROUTER).call('execute_strategy', addr(VIEWER), xdr.ScVal.scvU32(1), route)
  expect(decode(envelope([extraArgs]))).toBeNull()
  expect(decode(envelope([wrongAmount]))).toBeNull()
})

it('returns null for invalid envelope/options and trailing envelope bytes', () => {
  for (const raw of ['', 'bad', Buffer.from('bad').toString('base64'), envelope() + 'AAAA', 'A'.repeat(1024 * 1024 + 4)]) expect(decode(raw)).toBeNull()
  expect(decodeStellarSwapEnvelope({ ...options, envelopeXdr: envelope(), networkPassphrase: '' })).toBeNull()
  expect(decodeStellarSwapEnvelope({ ...options, envelopeXdr: envelope(), routerAddress: VIEWER })).toBeNull()
  expect(decodeStellarSwapEnvelope({ ...options, envelopeXdr: envelope(), viewer: 'invalid' })).toBeNull()
})
