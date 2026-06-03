import type { StellarAggregatorQuoteResponseDto } from '@xoxno/types'
import { Networks, Transaction, xdr as stellarXdr } from '@stellar/stellar-sdk'

import type { StellarBuilderOptions } from '../lending'
import {
  buildStellarBatchSwapTx,
  buildStellarExecuteStrategyTx,
  mapQuoteResponseToStrategyPayload,
  mapQuoteResponseToStrategySwap,
} from '../swap'

const FIXTURE_CALLER =
  'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR'
const FIXTURE_ROUTER =
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
const FIXTURE_USDC =
  'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3'
const FIXTURE_XLM =
  'CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW'
const FIXTURE_POOL =
  'CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U'
const FIXTURE_SEQUENCE = '123456789'
const FIXTURE_ROUTE_XDR = 'AQIDBA=='

beforeAll(() => {
  jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
})

afterAll(() => {
  jest.useRealTimers()
})

const BASE_OPTS: StellarBuilderOptions = {
  network: 'testnet',
  caller: FIXTURE_CALLER,
  sourceSequence: FIXTURE_SEQUENCE,
  fee: '100',
  timeoutSeconds: 300,
}

const parseInvocation = (
  xdrB64: string
): { functionName: string; args: stellarXdr.ScVal[] } => {
  const tx = new Transaction(xdrB64, Networks.TESTNET)
  expect(tx.operations).toHaveLength(1)
  const op = tx.operations[0] as unknown as {
    type: string
    func: stellarXdr.HostFunction
  }
  expect(op.type).toBe('invokeHostFunction')

  const invokeContract = op.func.invokeContract()
  const functionNameBuf = invokeContract.functionName()

  return {
    functionName: Buffer.isBuffer(functionNameBuf)
      ? functionNameBuf.toString('utf8')
      : String(functionNameBuf),
    args: invokeContract.args(),
  }
}

const quoteWithoutRouteXdr = {
  mode: 'forward',
  from: FIXTURE_USDC,
  tokenInKind: 'soroban',
  to: FIXTURE_XLM,
  tokenOutKind: 'soroban',
  amountIn: '1000000',
  amountOut: '1200000',
  amountInShort: 0.1,
  amountOutShort: 0.12,
  amountOutMin: '1180000',
  rate: 1.2,
  rateInverse: 0.8333333333,
  decimalsIn: 7,
  decimalsOut: 7,
  hops: [
    {
      dex: 'Soroswap',
      kind: 'ConstantProduct',
      address: FIXTURE_POOL,
      feeBps: 30,
      from: FIXTURE_USDC,
      tokenInKind: 'soroban',
      to: FIXTURE_XLM,
      tokenOutKind: 'soroban',
      amountIn: '1000000',
      amountOut: '1200000',
      amountInShort: 0.1,
      amountOutShort: 0.12,
    },
  ],
  platform: 'aggregator',
} as unknown as StellarAggregatorQuoteResponseDto

describe('Stellar aggregator direct swap builder', () => {
  it('builds execute_strategy with sender, total_in, and opaque swap bytes', () => {
    const built = buildStellarExecuteStrategyTx(
      {
        ...BASE_OPTS,
        routerAddress: FIXTURE_ROUTER,
        totalIn: '1000000',
      },
      { routeXdr: FIXTURE_ROUTE_XDR }
    )

    const parsed = parseInvocation(built.xdr)
    expect(parsed.functionName).toBe('execute_strategy')
    expect(parsed.args).toHaveLength(3)
    expect(parsed.args[2].switch().name).toBe('scvBytes')
  })

  it('keeps buildStellarBatchSwapTx as an execute_strategy compatibility wrapper', () => {
    const built = buildStellarBatchSwapTx(
      {
        ...BASE_OPTS,
        routerAddress: FIXTURE_ROUTER,
        totalIn: '1000000',
      },
      FIXTURE_ROUTE_XDR
    )

    expect(parseInvocation(built.xdr).functionName).toBe('execute_strategy')
  })

  it('prefers quote routeXdr when present', () => {
    const routed = mapQuoteResponseToStrategySwap({
      ...quoteWithoutRouteXdr,
      routeXdr: FIXTURE_ROUTE_XDR,
    } as StellarAggregatorQuoteResponseDto & { routeXdr: string })

    expect(routed).toEqual({ routeXdr: FIXTURE_ROUTE_XDR })
  })

  it('maps quote hops into a decoded StrategyPayload fallback', () => {
    const payload = mapQuoteResponseToStrategyPayload(quoteWithoutRouteXdr, {
      referralId: 7,
    })

    expect(payload).toEqual({
      paths: [
        {
          hops: [
            {
              amountOut: '1200000',
              pool: FIXTURE_POOL,
              tokenIn: FIXTURE_USDC,
              tokenOut: FIXTURE_XLM,
              venue: 'Soroswap',
            },
          ],
          splitPpm: 1_000_000,
        },
      ],
      referralId: 7,
      tokenIn: FIXTURE_USDC,
      tokenOut: FIXTURE_XLM,
      totalMinOut: '1180000',
    })
  })
})
