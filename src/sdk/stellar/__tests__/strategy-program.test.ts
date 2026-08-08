/**
 * Cross-language wire-format check for the aggregator's packed strategy program.
 *
 * The same fixtures are asserted byte-for-byte in
 * `contracts/swap-aggregator/tests/unit/payload_wire_format.rs` and
 * `arb-algo/stellar-indexer/src/transaction/abi.rs`. If this file and those
 * diverge, routes built by this SDK will be rejected on-chain.
 */

import { xdr } from '@stellar/stellar-sdk'

import {
  PPM_DENOMINATOR,
  STELLAR_PROGRAM_VERSION,
  STELLAR_SWAP_VENUE_OPCODE,
  encodeStrategyPayload,
  type StellarStrategyPayloadInput,
} from '../scval-encode'

const TOKEN_IN = 'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3'
const TOKEN_OUT = 'CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW'
const MID = 'CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U'
const POOL_ONE = 'CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST'
const POOL_TWO = 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR'
const POOL_THREE = 'CAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQMCJ'

/** Pull the three registries back out of an encoded payload. */
const decode = (payload: StellarStrategyPayloadInput) => {
  const map = encodeStrategyPayload(payload).map()
  if (!map) throw new Error('payload must encode as a map')
  const keys = map.map((e) => e.key().sym().toString())
  expect(keys).toEqual(['amounts', 'assets', 'ops'])
  return {
    amounts: (map[0] as xdr.ScMapEntry)
      .val()
      .vec()!
      .map((v) => {
        const parts = v.i128()
        return (BigInt(parts.hi().toString()) << 64n) | BigInt(parts.lo().toString())
      }),
    assets: (map[1] as xdr.ScMapEntry).val().vec()!.length,
    ops: Array.from((map[2] as xdr.ScMapEntry).val().bytes()),
  }
}

describe('packed strategy program', () => {
  it('lays a two-hop path out exactly as the contract decodes it', () => {
    const { ops } = decode({
      paths: [
        {
          splitPpm: PPM_DENOMINATOR,
          hops: [
            { venue: 'Soroswap', pool: POOL_ONE, tokenIn: TOKEN_IN, tokenOut: MID },
            { venue: 'Phoenix', pool: POOL_TWO, tokenIn: MID, tokenOut: TOKEN_OUT },
          ],
        },
      ],
      referralId: 7,
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      totalMinOut: '990000',
    })

    // Registry order follows first use: tokenIn, tokenOut, poolOne, mid, poolTwo.
    expect(ops).toEqual([
      STELLAR_PROGRAM_VERSION, 0, 1, 0,
      0, 0, 0, 7,
      2, 0,
      0, 0, 2, 0, 3,
      2, 1, 4, 3, 1,
    ])
  })

  it('rewrites absolute split weights as shares of the remainder', () => {
    const leg = (pool: string, splitPpm: number) => ({
      splitPpm,
      hops: [
        { venue: 'Soroswap' as const, pool, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT },
      ],
    })
    const { ops } = decode({
      paths: [leg(POOL_ONE, 500_000), leg(POOL_TWO, 300_000), leg(POOL_THREE, 200_000)],
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      totalMinOut: '1',
    })

    expect(ops[8]).toBe(3)
    expect(ops[9]).toBe(2)
    const weightsAt = 10 + 5 * 3
    const weight = (i: number) =>
      ((ops[weightsAt + 3 * i] as number) << 16) |
      ((ops[weightsAt + 3 * i + 1] as number) << 8) |
      (ops[weightsAt + 3 * i + 2] as number)
    expect(weight(0)).toBe(500_000) // half of the whole
    expect(weight(1)).toBe(600_000) // 30/50 of what is left
    expect(ops[10 + 5 * 2 + 1]).toBe(0) // final leg sweeps with All
  })

  it('carries a repeated address exactly once', () => {
    const { assets, ops } = decode({
      paths: [
        {
          splitPpm: 500_000,
          hops: [
            { venue: 'Aquarius', pool: POOL_ONE, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT },
          ],
        },
        {
          splitPpm: 500_000,
          hops: [
            { venue: 'Soroswap', pool: POOL_ONE, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT },
          ],
        },
      ],
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      totalMinOut: '1',
    })
    expect(assets).toBe(3)
    expect(ops[8]).toBe(2)
  })

  it('reserves a run of constituent floors for a burn leg', () => {
    const { amounts, ops } = decode({
      burnPool: POOL_THREE,
      burnMinAmounts: ['10', '20'],
      paths: [
        {
          splitPpm: PPM_DENOMINATOR,
          hops: [
            { venue: 'Aquarius', pool: POOL_ONE, tokenIn: MID, tokenOut: TOKEN_OUT },
          ],
        },
      ],
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      totalMinOut: '1',
    })
    expect(amounts).toEqual([1n, 10n, 20n])
    expect(ops[10]).toBe(5) // OP_BURN
    expect(ops[11]).toBe(0) // All
    expect(ops[14]).toBe(1) // floors start at amounts[1]
  })

  it('lowers a pre-swap ahead of the mint', () => {
    const { amounts, ops } = decode({
      mintPool: POOL_THREE,
      mintPoolTokens: [TOKEN_IN, MID],
      mintMinShares: '5',
      preSwapAmount: '300',
      preSwapFromA: true,
      paths: [],
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      totalMinOut: '1',
    })
    expect(ops[8]).toBe(2)
    expect(ops[10]).toBe(STELLAR_SWAP_VENUE_OPCODE.Aquarius)
    expect(ops[11]).toBe(3) // MODE_FIXED_BASE + amounts[1]
    expect(amounts[1]).toBe(300n)
    expect(ops[15]).toBe(6) // OP_MINT
    expect(ops[16]).toBe(0) // All
  })

  it('rejects a broken hop chain before it reaches the wire', () => {
    expect(() =>
      encodeStrategyPayload({
        paths: [
          {
            splitPpm: PPM_DENOMINATOR,
            hops: [
              { venue: 'Soroswap', pool: POOL_ONE, tokenIn: TOKEN_IN, tokenOut: MID },
              { venue: 'Phoenix', pool: POOL_TWO, tokenIn: TOKEN_OUT, tokenOut: TOKEN_OUT },
            ],
          },
        ],
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        totalMinOut: '1',
      })
    ).toThrow()
  })

  it('rejects an over-allocated split group', () => {
    const leg = (pool: string, splitPpm: number) => ({
      splitPpm,
      hops: [
        { venue: 'Soroswap' as const, pool, tokenIn: TOKEN_IN, tokenOut: TOKEN_OUT },
      ],
    })
    expect(() =>
      encodeStrategyPayload({
        paths: [leg(POOL_ONE, 600_000), leg(POOL_TWO, 600_000)],
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        totalMinOut: '1',
      })
    ).toThrow()
  })

  it('rejects a strategy that lowers to no instructions', () => {
    expect(() =>
      encodeStrategyPayload({
        paths: [],
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        totalMinOut: '1',
      })
    ).toThrow()
  })

  /** The same route cost 1972 bytes under the per-hop struct encoding. */
  it('keeps a three-way two-hop route inside the size budget', () => {
    const mids = [MID, POOL_ONE, POOL_TWO]
    const payload: StellarStrategyPayloadInput = {
      paths: mids.map((mid, i) => ({
        splitPpm: 333_333,
        hops: [
          {
            venue: 'Soroswap' as const,
            pool: [POOL_ONE, POOL_TWO, POOL_THREE][i] as string,
            tokenIn: TOKEN_IN,
            tokenOut: mid,
          },
          {
            venue: 'Aquarius' as const,
            pool: POOL_THREE,
            tokenIn: mid,
            tokenOut: TOKEN_OUT,
          },
        ],
      })),
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      totalMinOut: '1',
    }
    const len = Buffer.from(
      encodeStrategyPayload(payload).toXDR('base64'),
      'base64'
    ).length
    expect(len).toBeLessThanOrEqual(640)
  })
})
