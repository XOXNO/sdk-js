import { jest } from '@jest/globals'

import { getStellarAggregatorQuote } from '../quote'

const FROM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'
const TO = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'

const mockFetch = () => {
  const fetchMock = jest.fn(async (_url: string) => ({
    ok: true,
    json: async () => ({ amountOut: '1' }),
  }))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe('getStellarAggregatorQuote', () => {
  it('sends simulate and never sends the ignored router field', async () => {
    const fetchMock = mockFetch()

    await getStellarAggregatorQuote(
      {
        from: FROM,
        to: TO,
        amountIn: '10000000',
        slippage: 0.01,
        sender: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        simulate: false,
        router: 'CCVENFSVCBYDHVOACFZXMNNYVOZ3LKXPZYU5LUI4N7KTXOKRVYD7F3TR',
      },
      { baseUrl: 'https://stellar-swap.example' }
    )

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/api/v1/quote')
    expect(url.searchParams.get('simulate')).toBe('false')
    expect(url.searchParams.get('amountIn')).toBe('10000000')
    expect(url.searchParams.has('router')).toBe(false)
  })

  it('requires exactly one of amountIn and amountOut', async () => {
    mockFetch()

    await expect(
      getStellarAggregatorQuote(
        { from: FROM, to: TO },
        { baseUrl: 'https://stellar-swap.example' }
      )
    ).rejects.toThrow('exactly one')
  })
})
