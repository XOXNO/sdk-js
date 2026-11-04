import { jest } from '@jest/globals'
import {
  Address, Networks, Operation, SorobanDataBuilder, StrKey, Transaction,
  TransactionBuilder, rpc, xdr,
} from '@stellar/stellar-sdk'

import { buildStellarPauseTx } from '../admin'
import { assertStellarPreparedTxAuth } from '../auth-policy'
import { buildStellarCctpForwardTx } from '../cctp'
import { STELLAR_NETWORKS } from '../contracts'
import { buildStellarGovernancePauseTx } from '../governance'
import { buildStellarSupplyTx, type StellarBuilderOptions } from '../lending'
import { prepareStellarBuiltTx, type StellarAuthorizationOptions } from '../prepare'
import { buildStellarExecuteStrategyTx, encodeStrategyPayloadToRouteXdr } from '../swap'
import { xdrField, xdrType } from '../xdr-compat'
import { i128 } from '../scval-encode'

const account = (n: number) => StrKey.encodeEd25519PublicKey(Buffer.alloc(32, n))
const contract = (n: number) => StrKey.encodeContract(Buffer.alloc(32, n))
const SOURCE = account(1), CALLER = contract(2), TOKEN = contract(3), OTHER = account(4)
const deployment = STELLAR_NETWORKS.stellarTestnet
const options: StellarBuilderOptions = { network: 'testnet', caller: CALLER, sourceAccount: SOURCE, sourceSequence: '123' }
const supply = (opts = options) => buildStellarSupplyTx({ ...opts, controllerAddress: deployment.lendingController }, {
  spokeId: 1, hubId: 1, asset: TOKEN, amount: '100',
})
const route = encodeStrategyPayloadToRouteXdr({
  tokenIn: TOKEN, tokenOut: contract(4), totalMinOut: '1',
  paths: [{ splitPpm: 1_000_000, hops: [{ venue: 'Aquarius', pool: contract(5), tokenIn: TOKEN, tokenOut: contract(4) }] }],
})

const builders = [
  ['lending', supply],
  ['admin', (opts: StellarBuilderOptions) => buildStellarPauseTx({ ...opts, controllerAddress: deployment.lendingController })],
  ['swap', (opts: StellarBuilderOptions) => buildStellarExecuteStrategyTx({ ...opts, routerAddress: deployment.aggregatorRouter, totalIn: '100' }, route)],
  ['governance', (opts: StellarBuilderOptions) => buildStellarGovernancePauseTx({ ...opts, governanceAddress: deployment.governance })],
  ['CCTP', (opts: StellarBuilderOptions) => buildStellarCctpForwardTx({ ...opts, forwarderAddress: contract(6), message: 'ab', attestation: 'cd' })],
] as const

describe.each(builders)('%s caller/source separation', (name, build) => {
  it.each([CALLER, OTHER])('preserves caller %s while using the G source and sequence', caller => {
    const tx = new Transaction(build({ ...options, caller }).xdr, Networks.TESTNET)
    expect(tx.source).toBe(SOURCE)
    expect(tx.sequence).toBe('124')
    const op = tx.operations[0]
    if (op.type !== 'invokeHostFunction') throw new Error('expected invocation')
    if (name !== 'CCTP' && name !== 'admin') {
      const arg = xdrField(xdrField(op.func, 'invokeContract'), 'args')[0]
      expect(Address.fromScAddress(xdrField(arg, 'address')).toString()).toBe(caller)
    }
  })

  it('preserves legacy G output and rejects missing/invalid sources for C callers', () => {
    const legacy = { ...options, caller: SOURCE, sourceAccount: undefined }
    expect(build(legacy).xdr).toBe(build({ ...legacy, sourceAccount: SOURCE }).xdr)
    expect(() => build({ ...options, sourceAccount: undefined })).toThrow()
    expect(() => build({ ...options, sourceAccount: CALLER })).toThrow()
    expect(() => build({ ...options, sourceAccount: 'invalid' })).toThrow()
  })
})

const invocation = (target: string, fn: string, args: xdr.ScVal[], subInvocations: xdr.SorobanAuthorizedInvocation[] = []) =>
  new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(new xdr.InvokeContractArgs({
      contractAddress: new Address(target).toScAddress(), functionName: fn, args,
    })), subInvocations,
  })

const entryFor = (signer: string, root: xdr.SorobanAuthorizedInvocation, nonce = '99', signed = false) =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
      address: new Address(signer).toScAddress(), nonce: xdr.Int64.fromString(nonce),
      signatureExpirationLedger: signed ? 200 : 0, signature: signed ? xdr.ScVal.scvBool(true) : xdr.ScVal.scvVoid(),
    })), rootInvocation: root,
  })

const sourceEntry = (root: xdr.SorobanAuthorizedInvocation) => new xdr.SorobanAuthorizationEntry({
  credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(), rootInvocation: root,
})

const originalFetch = globalThis.fetch
beforeEach(() => { jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') }) })
afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers() })

function fixture(built = supply(), withTransfer = true) {
  const tx = new Transaction(built.xdr, Networks.TESTNET)
  const op = tx.operations[0]
  if (op.type !== 'invokeHostFunction') throw new Error('expected invocation')
  const transfer = invocation(TOKEN, 'transfer', [
    new Address(CALLER).toScVal(), new Address(deployment.lendingPool).toScVal(), i128('100'),
  ])
  const root = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(xdrField(op.func, 'invokeContract')),
    subInvocations: withTransfer ? [transfer] : [],
  })
  let auth = [entryFor(CALLER, root)]
  let enforceError: string | undefined
  const calls: Array<{ tx: Transaction; mode: string }> = []
  globalThis.fetch = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body))
    const enforced = request.params.authMode === 'enforce'
    calls.push({ tx: new Transaction(request.params.transaction, Networks.TESTNET), mode: request.params.authMode })
    const result = enforced && enforceError ? { latestLedger: 101, error: enforceError, events: [] } : {
      latestLedger: enforced ? 101 : 100, events: [], minResourceFee: enforced ? '2000' : '1000',
      transactionData: new SorobanDataBuilder().setResources(enforced ? 50_000_000 : 1_000_000, 100, 100)
        .setResourceFee(enforced ? '2000' : '1000').build().toXDR('base64'),
      results: [{ auth: auth.map(e => e.toXDR('base64')), xdr: xdr.ScVal.scvVoid().toXDR('base64') }],
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { status: 200 })
  }) as typeof fetch
  const authorizeEntry = jest.fn(async (encoded: string, context: { networkPassphrase: string; latestLedger: number }) => {
    expect(context).toEqual({ networkPassphrase: Networks.TESTNET, latestLedger: 100 })
    const recorded = xdr.SorobanAuthorizationEntry.fromXDR(encoded, 'base64')
    expect(xdrType(xdrField(xdrField(xdrField(recorded, 'credentials'), 'address'), 'signature'))).toBe('scvVoid')
    return entryFor(CALLER, xdrField(recorded, 'rootInvocation'), '99', true).toXDR('base64')
  })
  const authorization: StellarAuthorizationOptions = { caller: CALLER, authorizeEntry }
  const server = new rpc.Server('https://example.invalid')
  return { built, root, authorization, authorizeEntry, server, calls,
    setAuth: (entries: xdr.SorobanAuthorizationEntry[]) => { auth = entries },
    setEnforceError: (error: string) => { enforceError = error },
  }
}

it('records, validates, authorizes and enforces with signed entries and final account resources', async () => {
  const f = fixture()
  const result = await prepareStellarBuiltTx(f.server, f.built, { network: 'testnet', authorization: f.authorization })
  expect(f.calls.map(c => c.mode)).toEqual(['record', 'enforce'])
  expect(f.authorizeEntry).toHaveBeenCalledTimes(1)
  const tx = new Transaction(result, Networks.TESTNET)
  expect(tx.source).toBe(SOURCE)
  expect(tx.sequence).toBe('124')
  expect(tx.signatures).toHaveLength(0)
  expect(tx.fee).toBe('2100')
  const op = tx.operations[0], enforcedOp = f.calls[1].tx.operations[0]
  if (op.type !== 'invokeHostFunction' || enforcedOp.type !== 'invokeHostFunction') throw new Error('expected invocation')
  expect(op.auth?.map(e => e.toXDR('base64'))).toEqual(enforcedOp.auth?.map(e => e.toXDR('base64')))
  expect(xdrType(xdrField(xdrField(xdrField(op.auth![0], 'credentials'), 'address'), 'signature'))).toBe('scvBool')
  const data = xdrField(xdrField(xdrField(tx.toEnvelope(), 'v1'), 'tx'), 'ext')
  expect(xdrField(xdrField(xdrField(data, 'sorobanData'), 'resources'), 'instructions')).toBe(50_000_000)
})

it('replaces stale quote-envelope auth before recording fresh entries', async () => {
  const f = fixture(), tx = new Transaction(f.built.xdr, Networks.TESTNET), op = tx.operations[0]
  if (op.type !== 'invokeHostFunction') throw new Error('expected invocation')
  const stale = TransactionBuilder.cloneFrom(tx).clearOperations().addOperation(Operation.invokeHostFunction({
    ...op, auth: [entryFor(CALLER, f.root, '1')],
  })).build()
  await prepareStellarBuiltTx(f.server, { xdr: stale.toXDR() }, { network: 'testnet', authorization: f.authorization })
  const recorded = f.calls[0].tx.operations[0]
  if (recorded.type !== 'invokeHostFunction') throw new Error('expected invocation')
  expect(recorded.auth).toHaveLength(0)
})

it.each(['source', 'payerAddress', 'unknownAddress', 'rogueTransfer', 'policyCaller', 'rootArguments'])('rejects %s authority before signing', async kind => {
  const f = fixture()
  if (kind === 'source') f.setAuth([sourceEntry(f.root), entryFor(CALLER, f.root)])
  if (kind === 'payerAddress') f.setAuth([entryFor(SOURCE, f.root), entryFor(CALLER, f.root)])
  if (kind === 'unknownAddress') f.setAuth([entryFor(OTHER, f.root), entryFor(CALLER, f.root)])
  if (kind === 'rogueTransfer') f.setAuth([entryFor(CALLER, new xdr.SorobanAuthorizedInvocation({
    function: xdrField(f.root, 'function'), subInvocations: [invocation(TOKEN, 'transfer', [new Address(CALLER).toScVal(), new Address(OTHER).toScVal(), i128('100')])],
  }))])
  if (kind === 'policyCaller') f.authorization.policy = { caller: OTHER, root: { contract: deployment.lendingController, fn: 'supply' }, transfers: [] }
  if (kind === 'rootArguments') f.setAuth([entryFor(CALLER, invocation(deployment.lendingController, 'supply', [], xdrField(f.root, 'subInvocations')))])
  await expect(prepareStellarBuiltTx(f.server, f.built, { network: 'testnet', authorization: f.authorization })).rejects.toThrow()
  expect(f.authorizeEntry).not.toHaveBeenCalled()
  expect(f.calls).toHaveLength(1)
})

it.each(['signer', 'nonce', 'invocation', 'credentials'])('rejects callback changes to %s', async kind => {
  const f = fixture()
  f.authorization.authorizeEntry = async () => (kind === 'credentials' ? sourceEntry(f.root) : entryFor(
    kind === 'signer' ? OTHER : CALLER,
    kind === 'invocation' ? invocation(deployment.lendingController, 'borrow', []) : f.root,
    kind === 'nonce' ? '100' : '99', true,
  )).toXDR('base64')
  await expect(prepareStellarBuiltTx(f.server, f.built, { network: 'testnet', authorization: f.authorization })).rejects.toThrow('authorization callback changed')
  expect(f.calls).toHaveLength(1)
})

it('rejects enforced custom-account auth failures without returning signable output', async () => {
  const f = fixture()
  f.setEnforceError('HostError: Error(Auth, InvalidAction)')
  await expect(prepareStellarBuiltTx(f.server, f.built, { network: 'testnet', authorization: f.authorization })).rejects.toThrow('Auth, InvalidAction')
  expect(f.calls.map(c => c.mode)).toEqual(['record', 'enforce'])
})

it.each([false, true])('prepares C admin auth with an explicit root-only policy; rogue child=%s', async rogueChild => {
  const f = fixture(buildStellarPauseTx({ ...options, controllerAddress: deployment.lendingController }), false)
  f.authorization.policy = { caller: CALLER, root: { contract: deployment.lendingController, fn: 'pause' }, transfers: [] }
  if (rogueChild) f.setAuth([entryFor(CALLER, invocation(deployment.lendingController, 'pause', [], [
    invocation(TOKEN, 'transfer', [new Address(CALLER).toScVal(), new Address(OTHER).toScVal(), i128('100')]),
  ]))])
  const prepared = prepareStellarBuiltTx(f.server, f.built, { network: 'testnet', authorization: f.authorization })
  if (rogueChild) {
    await expect(prepared).rejects.toThrow('authorization check failed')
    expect(f.authorizeEntry).not.toHaveBeenCalled()
  } else {
    await expect(prepared).resolves.toEqual(expect.any(String))
    expect(f.authorizeEntry).toHaveBeenCalledTimes(1)
  }
})

it('requires an explicit signing network before invoking RPC or a callback', async () => {
  const f = fixture()
  await expect(prepareStellarBuiltTx(f.server, f.built, { authorization: f.authorization })).rejects.toThrow('network is required')
  expect(f.calls).toHaveLength(0)
  expect(f.authorizeEntry).not.toHaveBeenCalled()
})

it('rejects source substitution even when the contract invocation is unchanged', () => {
  const f = fixture()
  const changed = supply({ ...options, sourceAccount: OTHER })
  expect(() => assertStellarPreparedTxAuth(changed.xdr, {
    network: 'testnet', caller: CALLER, builtXdr: f.built.xdr,
  })).toThrow('SOURCE_CHANGED')
})
