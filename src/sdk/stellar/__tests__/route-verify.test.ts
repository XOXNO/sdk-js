import type { StellarAggregatorQuoteResponseDto } from '@xoxno/types'
import { readFileSync } from 'node:fs'
import { StrKey, xdr } from '@stellar/stellar-sdk'
import { xdrBytes, xdrField } from '../xdr-compat'

import {
  decodeStellarRouteBytes,
  StellarRouteVerificationError,
  type StellarRouteErrorCode,
  verifyStellarRouteBytes,
} from '../route-verify'
import { scStruct, type StellarStrategyPayloadInput } from '../scval-encode'
import { encodeStrategyPayloadToRouteXdr, mapQuoteResponseToStrategySwap } from '../swap'

const contract = (n: number): string => StrKey.encodeContract(Buffer.alloc(32, n))

const USDC = contract(1)
const XLM = contract(2)
const EURC = contract(3)
const POOL_A = contract(10)
const POOL_B = contract(11)
const LP_POOL = contract(12)
const LP_SHARE = contract(13)

const singleHop: StellarStrategyPayloadInput = {
  paths: [
    {
      hops: [{ pool: POOL_A, tokenIn: USDC, tokenOut: XLM, venue: 'Soroswap' }],
      splitPpm: 1_000_000,
    },
  ],
  referralId: 7,
  tokenIn: USDC,
  tokenOut: XLM,
  totalMinOut: '995000',
}

const expectCode = (run: () => unknown, code: StellarRouteErrorCode): void => {
  let thrown: unknown
  try {
    run()
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(StellarRouteVerificationError)
  expect((thrown as StellarRouteVerificationError).code).toBe(code)
}

/** Re-encode `routeXdr` with its program bytes rewritten. */
const withProgram = (routeXdr: string, edit: (ops: Buffer) => Buffer): string => {
  const entries = xdrField(xdr.ScVal.fromXDR(routeXdr, 'base64'), 'map') ?? []
  const fields: Record<string, xdr.ScVal> = {}
  for (const entry of entries) fields[xdrField(xdrField(entry, 'key'), 'sym').toString()] = xdrField(entry, 'val')
  const ops = fields.ops as xdr.ScVal
  fields.ops = xdr.ScVal.scvBytes(edit(Buffer.from(xdrBytes(ops))))
  return scStruct(fields).toXDR('base64')
}

describe('Curve opcode 7', () => {
  // Same arb-algo fixture executed against the production router WASM.
  const golden = readFileSync(new URL('./fixtures/curve-opcode7.xdr', import.meta.url))
  const payload: StellarStrategyPayloadInput = {
    tokenIn: 'CCABDO7UZXYE4W6GVSEGSNNZTKSLFQGKXXQTH6OX7M7GKZ4Z6CUJNGZN',
    tokenOut: 'CDLDVFKHEZ2RVB3NG4UQA4VPD3TSHV6XMHXMHP2BSGCJ2IIWVTOHGDSG',
    totalMinOut: '9969012',
    paths: [{ splitPpm: 1_000_000, hops: [{
      pool: 'CD5M24KZHINN46ZCECBNWYKINAIJGRO4WTZNGUCISPZIYUZZAWDS6H7Y',
      tokenIn: 'CCABDO7UZXYE4W6GVSEGSNNZTKSLFQGKXXQTH6OX7M7GKZ4Z6CUJNGZN',
      tokenOut: 'CDLDVFKHEZ2RVB3NG4UQA4VPD3TSHV6XMHXMHP2BSGCJ2IIWVTOHGDSG',
      venue: 'Curve',
    }] }],
  }
  const expected = { tokenIn: payload.tokenIn, tokenOut: payload.tokenOut, minOut: payload.totalMinOut, amountIn: '10000000' }
  const quote: StellarAggregatorQuoteResponseDto = {
    mode: 'forward', from: payload.tokenIn, to: payload.tokenOut,
    amountIn: '10000000', amountOut: '9999012', amountOutMin: payload.totalMinOut,
    tokenInKind: 'soroban', tokenOutKind: 'soroban', amountInShort: 1, amountOutShort: 0.9999012,
    rate: 0.9999012, rateInverse: 1 / 0.9999012, decimalsIn: 7, decimalsOut: 7,
    routeXdr: golden.toString('base64'), platform: 'aggregator',
    hops: [{ address: payload.paths[0]!.hops[0]!.pool, from: payload.tokenIn, to: payload.tokenOut,
      amountIn: '10000000', amountOut: '9999012', dex: 'Curve', kind: 'stable', feeBps: 3,
      tokenInKind: 'soroban', tokenOutKind: 'soroban', amountInShort: 1, amountOutShort: 0.9999012 }],
  }

  it('encodes byte-for-byte like arb-algo and verifies its golden route', () => {
    expect(Buffer.from(encodeStrategyPayloadToRouteXdr(payload), 'base64')).toEqual(golden)
    expect(verifyStellarRouteBytes(golden, expected).ops).toEqual([{
      kind: 'swap', venue: 'Curve', mode: { kind: 'all' },
      pool: payload.paths[0]!.hops[0]!.pool, tokenIn: payload.tokenIn, tokenOut: payload.tokenOut,
    }])
  })

  it('maps opaque quotes and locally encoded fallback quotes', () => {
    expect(mapQuoteResponseToStrategySwap(quote, { expected })).toEqual({ routeXdr: quote.routeXdr })
    expect(verifyStellarRouteBytes(mapQuoteResponseToStrategySwap({ ...quote, routeXdr: undefined }, { expected }), expected).ops[0])
      .toMatchObject({ kind: 'swap', venue: 'Curve' })
  })

  it('preserves pair, floor, fixed-input and chaining checks', () => {
    expectCode(() => mapQuoteResponseToStrategySwap(quote, { expected: { ...expected, tokenIn: USDC } }), 'TOKEN_IN_MISMATCH')
    expectCode(() => mapQuoteResponseToStrategySwap(quote, { expected: { ...expected, tokenOut: XLM } }), 'TOKEN_OUT_MISMATCH')
    expectCode(() => mapQuoteResponseToStrategySwap(quote, { expected: { ...expected, minOut: '9969013' } }), 'MIN_OUT_TOO_LOW')
    expectCode(() => decodeStellarRouteBytes(withProgram(quote.routeXdr!, (ops) => { ops[11] = 1; return ops })), 'INVALID_STRUCTURE')
    const fixed = withProgram(quote.routeXdr!, (ops) => { ops[11] = 2; return ops })
    expectCode(() => verifyStellarRouteBytes(fixed, { ...expected, amountIn: '1' }), 'AMOUNT_IN_EXCEEDED')
  })

  it.each([
    ['Soroswap', 0], ['Aquarius', 1], ['Phoenix', 2], ['Sushi', 3], ['CometDex', 4], ['Curve', 7],
  ] as const)('preserves %s opcode %i', (venue, opcode) => {
    const routeXdr = withProgram(quote.routeXdr!, (ops) => { ops[10] = opcode; return ops })
    expect(decodeStellarRouteBytes(routeXdr).ops[0]).toMatchObject({ kind: 'swap', venue })
  })
})

describe('decodeStellarRouteBytes round trip', () => {
  it('decodes a single hop', () => {
    const route = decodeStellarRouteBytes(encodeStrategyPayloadToRouteXdr(singleHop))
    expect(route).toMatchObject({
      version: 1,
      tokenIn: USDC,
      tokenOut: XLM,
      totalMinOut: 995000n,
      referralId: 7,
      weights: [],
    })
    expect(route.ops).toEqual([
      {
        kind: 'swap',
        venue: 'Soroswap',
        mode: { kind: 'all' },
        pool: POOL_A,
        tokenIn: USDC,
        tokenOut: XLM,
      },
    ])
  })

  it.each(['Phoenix', 'Curve'] as const)('decodes a multi hop chain through %s', (venue) => {
    const route = decodeStellarRouteBytes(
      encodeStrategyPayloadToRouteXdr({
        ...singleHop,
        paths: [
          {
            hops: [
              { pool: POOL_A, tokenIn: USDC, tokenOut: EURC, venue: 'Aquarius' },
              { pool: POOL_B, tokenIn: EURC, tokenOut: XLM, venue },
            ],
            splitPpm: 1_000_000,
          },
        ],
      })
    )
    expect(route.ops.map((op) => (op.kind === 'swap' ? [op.venue, op.mode.kind] : op.kind))).toEqual([
      ['Aquarius', 'all'],
      [venue, 'prev'],
    ])
  })

  it.each(['Sushi', 'Curve'] as const)('decodes a split through %s as a share of the remainder, then All', (venue) => {
    const route = decodeStellarRouteBytes(
      encodeStrategyPayloadToRouteXdr({
        ...singleHop,
        paths: [
          {
            hops: [{ pool: POOL_A, tokenIn: USDC, tokenOut: XLM, venue: 'Soroswap' }],
            splitPpm: 600_000,
          },
          {
            hops: [{ pool: POOL_B, tokenIn: USDC, tokenOut: XLM, venue }],
            splitPpm: 400_000,
          },
        ],
      })
    )
    expect(route.weights).toEqual([600_000])
    expect(route.ops.map((op) => (op.kind === 'swap' ? op.mode : op.kind))).toEqual([
      { kind: 'ppm', ppm: 600_000 },
      { kind: 'all' },
    ])
  })

  it('decodes an LP burn and an LP mint with a fixed pre-swap', () => {
    const burn = decodeStellarRouteBytes(
      encodeStrategyPayloadToRouteXdr({
        ...singleHop,
        tokenIn: LP_SHARE,
        burnPool: LP_POOL,
        burnMinAmounts: ['10', '20'],
      })
    )
    expect(burn.ops[0]).toEqual({ kind: 'burn', pool: LP_POOL, shareToken: LP_SHARE, amountIndex: 1 })
    expect(burn.amounts).toEqual([995000n, 10n, 20n])

    const mint = decodeStellarRouteBytes(
      encodeStrategyPayloadToRouteXdr({
        paths: [],
        tokenIn: USDC,
        tokenOut: LP_SHARE,
        totalMinOut: '5',
        mintPool: LP_POOL,
        mintMinShares: '4',
        mintPoolTokens: [USDC, XLM],
        preSwapAmount: '300',
        preSwapFromA: true,
      })
    )
    expect(mint.ops).toEqual([
      {
        kind: 'swap',
        venue: 'Aquarius',
        mode: { kind: 'fixed', amount: 300n },
        pool: LP_POOL,
        tokenIn: USDC,
        tokenOut: XLM,
      },
      { kind: 'mint', pool: LP_POOL, shareToken: LP_SHARE, amountIndex: 2 },
    ])
  })
})

describe('verifyStellarRouteBytes', () => {
  const routeXdr = encodeStrategyPayloadToRouteXdr(singleHop)
  const expected = { tokenIn: USDC, tokenOut: XLM, minOut: '995000', amountIn: '1000000' }

  it('accepts a route that matches the request, from base64, hex and bytes', () => {
    const raw = Buffer.from(routeXdr, 'base64')
    expect(verifyStellarRouteBytes(routeXdr, expected).totalMinOut).toBe(995000n)
    expect(verifyStellarRouteBytes(`0x${raw.toString('hex')}`, expected).tokenOut).toBe(XLM)
    expect(verifyStellarRouteBytes(new Uint8Array(raw), expected).tokenIn).toBe(USDC)
  })

  it('rejects an encoded minimum of 1 when the request expects 99.5%', () => {
    const drained = encodeStrategyPayloadToRouteXdr({ ...singleHop, totalMinOut: '1' })
    expectCode(() => verifyStellarRouteBytes(drained, expected), 'MIN_OUT_TOO_LOW')
  })

  it('rejects the wrong output or input token', () => {
    expectCode(
      () => verifyStellarRouteBytes(routeXdr, { ...expected, tokenOut: EURC }),
      'TOKEN_OUT_MISMATCH'
    )
    expectCode(
      () => verifyStellarRouteBytes(routeXdr, { ...expected, tokenIn: EURC }),
      'TOKEN_IN_MISMATCH'
    )
  })

  it('rejects a fixed leg that spends more than the input', () => {
    const mint = encodeStrategyPayloadToRouteXdr({
      paths: [],
      tokenIn: USDC,
      tokenOut: LP_SHARE,
      totalMinOut: '5',
      mintPool: LP_POOL,
      mintPoolTokens: [USDC, XLM],
      preSwapAmount: '300',
      preSwapFromA: true,
    })
    expectCode(
      () =>
        verifyStellarRouteBytes(mint, {
          tokenIn: USDC,
          tokenOut: LP_SHARE,
          minOut: 5n,
          amountIn: 299n,
        }),
      'AMOUNT_IN_EXCEEDED'
    )
  })

  it('rejects truncated and trailing bytes', () => {
    const raw = Buffer.from(routeXdr, 'base64')
    expectCode(() => decodeStellarRouteBytes(new Uint8Array(raw.subarray(0, raw.length - 4))), 'MALFORMED')
    expectCode(
      () => decodeStellarRouteBytes(new Uint8Array(Buffer.concat([raw, Buffer.alloc(4)]))),
      'MALFORMED'
    )
    // Same checks inside the packed program.
    expectCode(
      () => decodeStellarRouteBytes(withProgram(routeXdr, (ops) => ops.subarray(0, ops.length - 1))),
      'MALFORMED'
    )
    expectCode(
      () => decodeStellarRouteBytes(withProgram(routeXdr, (ops) => Buffer.concat([ops, Buffer.alloc(3)]))),
      'MALFORMED'
    )
  })

  it('rejects a bad version, an unknown opcode and an oversized payload', () => {
    const patch = (at: number, value: number) => (ops: Buffer) => {
      const copy = Buffer.from(ops)
      copy[at] = value
      return copy
    }
    expectCode(() => decodeStellarRouteBytes(withProgram(routeXdr, patch(0, 2))), 'UNSUPPORTED_VERSION')
    expectCode(() => decodeStellarRouteBytes(withProgram(routeXdr, patch(10, 8))), 'UNKNOWN_OPCODE')
    expectCode(() => decodeStellarRouteBytes(new Uint8Array(17 * 1024)), 'OVERSIZED')
    expectCode(() => decodeStellarRouteBytes('AQIDBA=='), 'MALFORMED')
  })

  it('rejects a Prev instruction with no predecessor and a min_out index out of range', () => {
    const patch = (at: number, value: number) => (ops: Buffer) => {
      const copy = Buffer.from(ops)
      copy[at] = value
      return copy
    }
    expectCode(() => decodeStellarRouteBytes(withProgram(routeXdr, patch(11, 1))), 'INVALID_STRUCTURE')
    expectCode(() => decodeStellarRouteBytes(withProgram(routeXdr, patch(3, 9))), 'MALFORMED')
  })
})

describe('mapQuoteResponseToStrategySwap route check', () => {
  const quote = (routeXdr: string, amountOutMin?: string): StellarAggregatorQuoteResponseDto =>
    ({
      mode: 'forward',
      from: USDC,
      to: XLM,
      amountIn: '1000000',
      amountOut: '1000000',
      amountOutMin,
      routeXdr,
      hops: [],
      platform: 'aggregator',
    }) as unknown as StellarAggregatorQuoteResponseDto

  it('passes an honest route through unchanged', () => {
    const routeXdr = encodeStrategyPayloadToRouteXdr(singleHop)
    expect(mapQuoteResponseToStrategySwap(quote(routeXdr, '995000'))).toEqual({ routeXdr })
  })

  it('rejects a route whose minimum is below the JSON amountOutMin', () => {
    const routeXdr = encodeStrategyPayloadToRouteXdr({ ...singleHop, totalMinOut: '1' })
    expectCode(() => mapQuoteResponseToStrategySwap(quote(routeXdr, '995000')), 'MIN_OUT_TOO_LOW')
  })

  it('rejects a self-consistent response that is below the caller floor or pair', () => {
    const routeXdr = encodeStrategyPayloadToRouteXdr({ ...singleHop, totalMinOut: '1' })
    expectCode(
      () => mapQuoteResponseToStrategySwap(quote(routeXdr, '1'), { expected: { minOut: '995000' } }),
      'MIN_OUT_TOO_LOW'
    )
    expectCode(
      () => mapQuoteResponseToStrategySwap(quote(routeXdr, '1'), { expected: { tokenOut: EURC } }),
      'TOKEN_OUT_MISMATCH'
    )
  })

  it('requires a minimum from the JSON or the caller', () => {
    const routeXdr = encodeStrategyPayloadToRouteXdr(singleHop)
    expectCode(() => mapQuoteResponseToStrategySwap(quote(routeXdr)), 'EXPECTATION_MISSING')
    expect(
      mapQuoteResponseToStrategySwap(quote(routeXdr), { expected: { minOut: 995000n } })
    ).toEqual({ routeXdr })
  })
})
