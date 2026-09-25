import { jest } from '@jest/globals'
import { Networks, SorobanDataBuilder, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk'
import { XOXNOClient } from '../../../utils/api'
import { buildSdk } from '../../index'
import { endpoints } from '../../swagger'
import { stellarSchemaTypes } from '../../stellar-schema'
import { stellarLendingRead } from '../lending-read'
import { getStellarAggregatorQuote } from '../quote'
import { buildStellarSupplyTx } from '../lending'
import { prepareStellarBuiltTx, prepareStellarTxXdr } from '../prepare'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function captureFetch() {
  const calls: Array<{ url: URL; init: RequestInit }> = []
  globalThis.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init: init ?? {} })
    return new Response('[]', { status: 200 })
  }) as typeof fetch
  return calls
}

it('binds all generated Stellar lending and integration routes without unresolved parameters', async () => {
  const calls = captureFetch()
  const sdk = buildSdk(new XOXNOClient({ apiUrl: 'https://example.invalid' }))
  const routes = Object.keys(endpoints).filter(p => p.startsWith('/stellar-lending/') || p.startsWith('/integrations/lending/stellar'))
  expect(routes).toHaveLength(47)
  for (const path of routes) {
    let method: any = sdk
    for (const part of path.split('/').filter(Boolean)) {
      const key = part.replace(/^:/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      method = part.startsWith(':') ? method[key]('1') : method[key]
    }
    await method({})
    expect(calls[calls.length - 1]?.url.pathname).toBe(path.replace(/:[A-Za-z_]+/g, '1'))
  }
})

it('keeps per-call fetch options out of queries and preserves client defaults', async () => {
  const calls = captureFetch()
  // A read is composed with its own deadline, so the forwarded signal is no
  // longer the caller's object. Assert the behaviour that matters instead: the
  // caller's abort still reaches the request.
  const controller = new AbortController()
  const sdk = buildSdk(new XOXNOClient({ apiUrl: 'https://example.invalid', signal: controller.signal, credentials: 'omit' }))
  await sdk.stellarLending.reserves({ hubId: undefined, spokeId: undefined })
  expect(calls[0]?.url.search).toBe('')
  expect(calls[0]?.init.credentials).toBe('omit')
  expect(calls[0]?.init.signal?.aborted).toBe(false)
  controller.abort()
  expect(calls[0]?.init.signal?.aborted).toBe(true)
  const override = new AbortController()
  await sdk.stellarLending.assets({ signal: override.signal, credentials: 'include', redirect: 'error' })
  expect(calls[1]?.url.search).toBe('')
  expect(calls[1]?.init).toMatchObject({ credentials: 'include', redirect: 'error' })
  override.abort()
  expect(calls[1]?.init.signal?.aborted).toBe(true)
})

it('sends Stellar cursors in query parameters through both facades', async () => {
  const calls = captureFetch()
  const client = new XOXNOClient({ apiUrl: 'https://example.invalid' })
  const sdk = buildSdk(client)
  const read = stellarLendingRead(client)
  await sdk.stellarLending.governance.proposals({ continuationToken: 'a+/=' })
  await sdk.stellarLending.users.owner('wallet').activity.page({ continuationToken: 'a+/=' })
  await read.userActivityPage('wallet', { continuationToken: 'a+/=' })
  for (const { url, init } of calls) {
    expect(url.searchParams.get('continuationToken')).toBe('a+/=')
    expect(new Headers(init.headers).has('X-Continuation-Token')).toBe(false)
  }
})

it('preserves init with empty reserve filters and exposes the supported reader set', async () => {
  const calls = captureFetch()
  const read = stellarLendingRead(new XOXNOClient({ apiUrl: 'https://example.invalid' }))
  const controller = new AbortController()
  await read.reserves({}, { cache: 'no-store', signal: controller.signal })
  expect(calls[0]?.init).toMatchObject({ cache: 'no-store' })
  // Composed with the read deadline; the caller's abort still propagates.
  controller.abort()
  expect(calls[0]?.init.signal?.aborted).toBe(true)
  await read.assetPage('token', { from: '2026-09-01', to: '2026-09-02', bin: '1d' })
  expect(calls[1]?.url.pathname).toBe('/stellar-lending/assets/token/page')
  await read.walletBalance('wallet', 'token')
  expect(calls[2]?.url.pathname).toBe('/stellar-lending/users/wallet/assets/token/balance')
  expect(Object.keys(read)).toHaveLength(43)
  expect('protocolConfig' in read).toBe(false)
  expect('blendPools' in read).toBe(false)
})

it('forwards quote referral zero and nonzero values', async () => {
  const calls = captureFetch()
  for (const referralId of [0, 42]) {
    await getStellarAggregatorQuote({ from: 'A', to: 'B', amountIn: '100', referralId }, { baseUrl: 'https://example.invalid' })
    expect(calls[calls.length - 1]?.url.searchParams.get('referralId')).toBe(String(referralId))
  }
})

it('requires the host to select a quote-server URL', async () => {
  await expect(
    getStellarAggregatorQuote(
      { from: 'A', to: 'B', amountIn: '100' },
      {} as never
    )
  ).rejects.toThrow('baseUrl is required')
})

it('prepares unsigned builder XDR with the selected signing domain and preserves the invocation', async () => {
  const opts = {
    network: 'testnet' as const,
    caller: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
    controllerAddress: 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ',
    sourceSequence: '123',
  }
  const built = buildStellarSupplyTx(opts, { spokeId: 1, hubId: 1, asset: opts.controllerAddress, amount: '100' })
  globalThis.fetch = jest.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body))
    expect(request.method).toBe('simulateTransaction')
    expect(request.params.transaction).toBe(built.xdr)
    expect(request.params.resourceConfig).toEqual({ instructionLeeway: 20_000_000 })
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
      latestLedger: 1, events: [], minResourceFee: '1000',
      transactionData: new SorobanDataBuilder().setResources(24_343_254, 116, 1080).setResourceFee('1000').build().toXDR('base64'),
      results: [{ auth: [], xdr: xdr.ScVal.scvVoid().toXDR('base64') }],
    } }), { status: 200 })
  }) as typeof fetch
  const prepared = await prepareStellarBuiltTx(new rpc.Server('https://example.invalid'), built, { network: opts.network })
  const tx = TransactionBuilder.fromXDR(prepared, Networks.TESTNET)
  expect(tx.signatures).toHaveLength(0)
  expect(tx.fee).toBe('1100')
  expect(tx.toEnvelope().v1().tx().ext().sorobanData().resources().instructions()).toBe(24_343_254)
  expect(tx.toEnvelope().v1().tx().operations()).toEqual(TransactionBuilder.fromXDR(built.xdr, Networks.TESTNET).toEnvelope().v1().tx().operations())
})

it.each([0, 5_000_000, 0xffffffff])('forwards instruction leeway %i and retains contract error context', async instructionLeeway => {
  const built = buildStellarSupplyTx({
    network: 'testnet', caller: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
    controllerAddress: 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ', sourceSequence: '123',
  }, { spokeId: 1, hubId: 1, asset: 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ', amount: '100' })
  const simulateTransaction = jest.fn(async () => ({
    _parsed: true as const, id: 'offline', latestLedger: 1, events: [], error: 'Error(Contract, #1)',
  }))
  await expect(prepareStellarTxXdr({ simulateTransaction }, built.xdr, {
    network: 'testnet', invokedContractId: 'controller', instructionLeeway,
  })).rejects.toThrow('[xoxno-invoked:controller] Error(Contract, #1)')
  expect(simulateTransaction).toHaveBeenCalledWith(expect.anything(), { cpuInstructions: instructionLeeway })
})

it.each([-1, 1.5, NaN, Infinity, 0x100000000])('rejects invalid instruction leeway %s before RPC', async instructionLeeway => {
  const simulateTransaction = jest.fn<rpc.Server['simulateTransaction']>()
  await expect(prepareStellarTxXdr({ simulateTransaction }, '', { instructionLeeway }))
    .rejects.toThrow('instructionLeeway must be an integer from 0 to 4294967295')
  expect(simulateTransaction).not.toHaveBeenCalled()
})

it('renders nested, nullable and enum OpenAPI contracts and fails on dangling references', () => {
  const types = stellarSchemaTypes({
    Page: { type: 'object', required: ['rows'], properties: {
      rows: { type: 'array', items: { $ref: '#/components/schemas/Row' } },
    } },
    Row: { type: 'object', required: ['amount'], properties: {
      amount: { type: 'integer', nullable: true, description: 'Exact display count.' },
      side: { type: 'string', enum: ['supply', 'borrow'] },
    } },
  })
  expect(types.type({ $ref: '#/components/schemas/Page' })).toBe('Page')
  const rendered = types.render()
  expect(rendered).toContain('"rows": Array<Row>')
  expect(rendered).toContain('"amount": (number) | null')
  expect(rendered).toContain('"side"?: "supply" | "borrow"')
  expect(rendered).toContain('Exact display count.')
  expect(() => types.type({ $ref: '#/components/schemas/Missing' })).toThrow(/Missing Stellar schema/)
})
