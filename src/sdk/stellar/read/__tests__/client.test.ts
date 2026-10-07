import { jest } from '@jest/globals'
import { createStellarLendingReadClient, lendingAssetsSchema, lendingPositionsSchema } from '../index'
import type { LendingAsset, LendingPosition } from '../types'

const baseUrl = 'https://api.example/api/'
const positionsPath = '/api/stellar-lending/v1/users/GOWNER/positions'
const page = (rows: unknown[], link?: string, status = 200) =>
  new Response(JSON.stringify(rows), { status, headers: link ? { Link: link } : {} })
const position: LendingPosition = {
  accountId: '9007199254740993', nftContract: 'CNFT', network: 'mainnet',
  nftImage: 'https://api.xoxno.com/user/lending/image/9007199254740993?isStatic=true&chain=STELLAR',
  spokeId: null, spokeName: null, supplied: [], borrow: [],
  hasDebt: null, healthFactor: null, borrowLimitUsd: null,
  availableBorrowUsd: null, netApy: null, dataStatus: 'incomplete',
}
const asset: LendingAsset = {
  sac: 'CTOKEN', name: 'Token', symbol: 'TKN', decimals: 7, logoUrl: null,
  hubId: 1, hubName: 'Hub', network: 'mainnet', supplyApy: 0.05,
  borrowApy: null, priceUsd: null,
  priceStatus: { valid: false, stale: true, deviation: false, timestamp: null },
  spokes: [{
    spokeId: 1, spokeName: 'Spoke', ltvBps: 8000,
    supplyCapacity: { amountRaw: '9007199254740993', amount: '900719925.4740993', usd: null },
    borrowCapacity: { amountRaw: '0', amount: '0', usd: 0 },
    canSupply: true, canBeCollateral: true, canBorrow: false, canOpenAccount: true,
  }],
  dataStatus: 'stale', indexedAt: 123, indexedLedger: 456,
}

describe('dependency-free integrator reads', () => {
  it('preserves values, defaults usage on the server, and passes the signal', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockImplementation(async () => page([asset]))
    const client = createStellarLendingReadClient({ baseUrl, fetch })
    const signal = new AbortController().signal
    expect(await client.assets({ signal })).toEqual([asset])
    expect(fetch).toHaveBeenCalledWith('https://api.example/api/stellar-lending/v1/assets', { signal, redirect: 'error' })
    await client.assets({ usage: 'borrow' })
    expect(fetch.mock.calls[1][0]).toBe('https://api.example/api/stellar-lending/v1/assets?usage=borrow')
  })

  it('collects every position page, including empty pages and other link relations', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(page([position], `<${positionsPath}?cursor=1>; rel="prev next"; title="a,b"`))
      .mockResolvedValueOnce(page([], '<?cursor=2>; rel=next'))
      .mockResolvedValueOnce(page([position], '<https://elsewhere.invalid/>; rel="prev"'))
    expect(await createStellarLendingReadClient({ baseUrl, fetch }).positions('GOWNER')).toEqual([position, position])
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example${positionsPath}`,
      `https://api.example${positionsPath}?cursor=1`,
      `https://api.example${positionsPath}?cursor=2`,
    ])
  })

  it('encodes the owner as a single path segment', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(page([]))
    await createStellarLendingReadClient({ baseUrl, fetch }).positions('GOWNER/other?x=1')
    expect(fetch.mock.calls[0][0]).toBe('https://api.example/api/stellar-lending/v1/users/GOWNER%2Fother%3Fx%3D1/positions')
  })

  it.each([
    'https://evil.invalid/page', '//evil.invalid/page',
    '/stellar-lending/v1/users/GOWNER/positions?cursor=1',
    '/api/stellar-lending/v1/users/OTHER/positions?cursor=1',
    'https://user:secret@api.example/api/stellar-lending/v1/users/GOWNER/positions',
    '?cursor=1#fragment',
  ])('rejects pagination drift before another fetch: %s', async target => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(page([], `<${target}>; rel="next"`))
    await expect(createStellarLendingReadClient({ baseUrl, fetch }).positions('GOWNER')).rejects.toThrow('same API endpoint')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    'not a Link header', '<?cursor=1>; rel="next', '<?cursor=1>; rel="next",',
    '<?cursor=1>; rel="next", <?cursor=2>; rel="next"',
    '<?cursor=1>; rel="prev"; rel="next"',
  ])('rejects malformed or ambiguous links: %s', async link => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(page([], link))
    await expect(createStellarLendingReadClient({ baseUrl, fetch }).positions('GOWNER')).rejects.toThrow(/pagination/i)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not mistake a quoted title for a next relation', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(page([], '<?cursor=1>; title="text; rel=next"; rel=prev'))
    expect(await createStellarLendingReadClient({ baseUrl, fetch }).positions('GOWNER')).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects pagination cycles', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(page([], `<${positionsPath}>; rel=next`))
    await expect(createStellarLendingReadClient({ baseUrl, fetch }).positions('GOWNER')).rejects.toThrow('cycle')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects drift reported by fetch implementations that ignore redirect options', async () => {
    const response = page([])
    Object.defineProperty(response, 'url', { value: 'https://evil.invalid/page' })
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(response)
    await expect(createStellarLendingReadClient({ baseUrl, fetch }).assets()).rejects.toThrow('redirects')
  })

  it('propagates HTTP, transport, abort, JSON and unexpected response errors', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>()
    const client = createStellarLendingReadClient({ baseUrl, fetch })
    fetch.mockResolvedValueOnce(page([], undefined, 503))
    await expect(client.assets()).rejects.toThrow('HTTP 503')
    const aborted = new DOMException('Aborted', 'AbortError')
    fetch.mockRejectedValueOnce(aborted)
    await expect(client.positions('GOWNER')).rejects.toBe(aborted)
    fetch.mockResolvedValueOnce(new Response('bad JSON'))
    await expect(client.assets()).rejects.toThrow()
    fetch.mockResolvedValueOnce(new Response('{}'))
    await expect(client.assets()).rejects.toThrow('must be an array')
  })

  it.each(['ftp://api.example', 'https://user:secret@api.example', 'https://api.example?token=secret', 'https://api.example#fragment'])('rejects invalid API roots: %s', root => {
    expect(() => createStellarLendingReadClient({ baseUrl: root })).toThrow('HTTP API root')
  })

  it('publishes inline schemas covering the response interfaces', () => {
    expect(lendingAssetsSchema.items.required.sort()).toEqual(Object.keys(asset).sort())
    expect(lendingPositionsSchema.items.required.sort()).toEqual(Object.keys(position).sort())
    expect(lendingAssetsSchema.items.properties.spokes.items.required.sort()).toEqual(Object.keys(asset.spokes[0]).sort())
    expect(lendingAssetsSchema.items.properties.spokes.items.properties.supplyCapacity.required.sort()).toEqual(Object.keys(asset.spokes[0].supplyCapacity).sort())
    expect(lendingPositionsSchema.items.properties.healthFactor.nullable).toBe(true)
    expect(lendingPositionsSchema.items.properties.supplied.items.properties.amountRaw.type).toBe('string')
    expect(JSON.stringify([lendingAssetsSchema, lendingPositionsSchema])).not.toMatch(/\$ref/)
  })
})
