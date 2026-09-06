import { jest } from '@jest/globals'
import { Networks, SorobanDataBuilder, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk'
import { XOXNOClient } from '../../../utils/api'
import { buildSdk } from '../../index'
import { endpoints } from '../../swagger'
import { stellarSchemaTypes } from '../../stellar-schema'
import { stellarLendingRead } from '../lending-read'
import { getStellarAggregatorQuote } from '../quote'
import { buildStellarSupplyTx } from '../lending'
import { prepareStellarBuiltTx } from '../prepare'

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
  const signal = new AbortController().signal
  const sdk = buildSdk(new XOXNOClient({ apiUrl: 'https://example.invalid', signal, credentials: 'omit' }))
  await sdk.stellarLending.reserves({ hubId: undefined, spokeId: undefined })
  expect(calls[0]?.url.search).toBe('')
  expect(calls[0]?.init.signal).toBe(signal)
  expect(calls[0]?.init.credentials).toBe('omit')
  const override = new AbortController().signal
  await sdk.stellarLending.assets({ signal: override, credentials: 'include', redirect: 'error' })
  expect(calls[1]?.url.search).toBe('')
  expect(calls[1]?.init).toMatchObject({ signal: override, credentials: 'include', redirect: 'error' })
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
  const signal = new AbortController().signal
  await read.reserves({}, { cache: 'no-store', signal })
  expect(calls[0]?.init).toMatchObject({ cache: 'no-store', signal })
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
  const prepared = await prepareStellarBuiltTx({
    prepareTransaction: async tx => {
      expect(tx.networkPassphrase).toBe(Networks.TESTNET)
      const simulation: rpc.Api.SimulateTransactionSuccessResponse = {
        _parsed: true, id: 'offline', latestLedger: 1, events: [], minResourceFee: '1000',
        transactionData: new SorobanDataBuilder().setResourceFee('1000'), result: { auth: [], retval: xdr.ScVal.scvVoid() },
      }
      return rpc.assembleTransaction(tx, simulation).build()
    },
  }, built, { network: opts.network })
  const tx = TransactionBuilder.fromXDR(prepared, Networks.TESTNET)
  expect(tx.signatures).toHaveLength(0)
  expect(tx.fee).toBe('1100')
  expect(tx.toEnvelope().v1().tx().operations()).toEqual(TransactionBuilder.fromXDR(built.xdr, Networks.TESTNET).toEnvelope().v1().tx().operations())
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
