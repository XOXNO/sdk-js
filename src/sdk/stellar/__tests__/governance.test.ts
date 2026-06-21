/**
 * Snapshot + structural tests for governance `propose_*` transaction builders
 * used by the admin dashboard (timelock proposals).
 */

import { jest } from '@jest/globals'
import { Networks, Transaction, xdr as stellarXdr } from '@stellar/stellar-sdk'

import { buildStellarProposeUpdatePoolCapsTx } from '../governance'
import type { StellarBuilderOptions } from '../lending'

const FIXTURE_CALLER =
  'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR'
const FIXTURE_GOVERNANCE =
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
const FIXTURE_USDC =
  'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3'
const FIXTURE_SEQUENCE = '123456789'
const FIXTURE_SALT = 'ab'.repeat(32)

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
  governanceAddress: FIXTURE_GOVERNANCE,
  fee: '100',
  timeoutSeconds: 300,
}

const parseInvoked = (
  xdrB64: string
): {
  functionName: string
  args: stellarXdr.ScVal[]
} => {
  const tx = new Transaction(xdrB64, Networks.TESTNET)
  expect(tx.operations).toHaveLength(1)
  const op = tx.operations[0] as unknown as {
    type: string
    func: stellarXdr.HostFunction
  }
  expect(op.type).toBe('invokeHostFunction')
  const invokeContract = op.func.invokeContract()
  const fnBuf = invokeContract.functionName()
  return {
    functionName: Buffer.isBuffer(fnBuf) ? fnBuf.toString('utf8') : String(fnBuf),
    args: invokeContract.args(),
  }
}

describe('Stellar lending governance builders', () => {
  describe('propose_update_pool_caps', () => {
    const build = () =>
      buildStellarProposeUpdatePoolCapsTx(
        BASE_OPTS,
        {
          asset: FIXTURE_USDC,
          supplyCap: '100000000000000',
          borrowCap: '50000000000000',
        },
        FIXTURE_SALT
      )

    let built: { xdr: string }

    beforeAll(() => {
      built = build()
    })

    it('returns non-empty base64 XDR', () => {
      expect(typeof built.xdr).toBe('string')
      expect(built.xdr.length).toBeGreaterThan(0)
    })

    it('encodes propose_update_pool_caps with proposer + 3 args + salt (5 total)', () => {
      const parsed = parseInvoked(built.xdr)
      expect(parsed.functionName).toBe('propose_update_pool_caps')
      expect(parsed.args).toHaveLength(5)
      expect(parsed.args[0]!.switch().name).toBe('scvAddress')
      expect(parsed.args[1]!.switch().name).toBe('scvAddress')
      expect(parsed.args[2]!.switch().name).toBe('scvI128')
      expect(parsed.args[3]!.switch().name).toBe('scvI128')
      expect(parsed.args[4]!.switch().name).toBe('scvBytes')
    })

    it('is deterministic', () => {
      expect(build().xdr).toBe(built.xdr)
    })

    it('matches stored snapshot', () => {
      expect(built.xdr).toMatchSnapshot()
    })
  })
})