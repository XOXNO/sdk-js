import type { StellarAggregatorQuoteResponseDto } from '@xoxno/types'
import { StrKey, xdr } from '@stellar/stellar-sdk'

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
  const entries = xdr.ScVal.fromXDR(routeXdr, 'base64').map() ?? []
  const fields: Record<string, xdr.ScVal> = {}
  for (const entry of entries) fields[entry.key().sym().toString()] = entry.val()
  const ops = fields.ops as xdr.ScVal
  fields.ops = xdr.ScVal.scvBytes(edit(Buffer.from(ops.bytes())))
  return scStruct(fields).toXDR('base64')
}

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

  it('decodes a multi hop chain', () => {
    const route = decodeStellarRouteBytes(
      encodeStrategyPayloadToRouteXdr({
        ...singleHop,
        paths: [
          {
            hops: [
              { pool: POOL_A, tokenIn: USDC, tokenOut: EURC, venue: 'Aquarius' },
              { pool: POOL_B, tokenIn: EURC, tokenOut: XLM, venue: 'Phoenix' },
            ],
            splitPpm: 1_000_000,
          },
        ],
      })
    )
    expect(route.ops.map((op) => (op.kind === 'swap' ? [op.venue, op.mode.kind] : op.kind))).toEqual([
      ['Aquarius', 'all'],
      ['Phoenix', 'prev'],
    ])
  })

  it('decodes a split as a share of the remainder, then All', () => {
    const route = decodeStellarRouteBytes(
      encodeStrategyPayloadToRouteXdr({
        ...singleHop,
        paths: [
          {
            hops: [{ pool: POOL_A, tokenIn: USDC, tokenOut: XLM, venue: 'Soroswap' }],
            splitPpm: 600_000,
          },
          {
            hops: [{ pool: POOL_B, tokenIn: USDC, tokenOut: XLM, venue: 'Sushi' }],
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
    expectCode(() => decodeStellarRouteBytes(withProgram(routeXdr, patch(10, 7))), 'UNKNOWN_OPCODE')
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
