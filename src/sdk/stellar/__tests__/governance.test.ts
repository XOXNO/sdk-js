/**
 * Snapshot + structural tests for governance `propose_*` transaction builders
 * used by the admin dashboard (timelock proposals).
 */

import { jest } from '@jest/globals'
import { Networks, Transaction, xdr as stellarXdr } from '@stellar/stellar-sdk'

import {
  buildStellarGovernanceExecuteUpdateDelayTx,
  buildStellarProposeDeployPoolTx,
  buildStellarProposeSetAggregatorTx,
  buildStellarProposeUpdateDelayTx,
  buildStellarProposeUpdatePoolCapsTx,
} from '../governance'
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

/** Read the variant symbol of an `AdminOperation` enum ScVal (`scvVec[sym,...]`). */
const adminOpVariant = (op: stellarXdr.ScVal): string => {
  expect(op.switch().name).toBe('scvVec')
  const elems = op.vec()!
  expect(elems[0]!.switch().name).toBe('scvSymbol')
  return elems[0]!.sym().toString()
}

describe('Stellar lending governance builders', () => {
  // Every proposal routes through `propose(proposer, op: AdminOperation, salt)`:
  // arg0 = proposer Address, arg1 = the AdminOperation enum, arg2 = salt bytes.
  describe('propose — generic AdminOperation entrypoint', () => {
    describe('UpdatePoolCaps (struct-payload variant)', () => {
      const build = () =>
        buildStellarProposeUpdatePoolCapsTx(
          BASE_OPTS,
          {
            hubId: 1,
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

      it('calls propose with [proposer, AdminOperation, salt]', () => {
        const parsed = parseInvoked(built.xdr)
        expect(parsed.functionName).toBe('propose')
        expect(parsed.args).toHaveLength(3)
        expect(parsed.args[0]!.switch().name).toBe('scvAddress')
        expect(parsed.args[1]!.switch().name).toBe('scvVec')
        expect(parsed.args[2]!.switch().name).toBe('scvBytes')
      })

      it('wraps the UpdatePoolCaps variant with a struct payload', () => {
        const op = parseInvoked(built.xdr).args[1]!
        expect(adminOpVariant(op)).toBe('UpdatePoolCaps')
        // [symbol, PoolCapsArgs struct]
        expect(op.vec()).toHaveLength(2)
        expect(op.vec()![1]!.switch().name).toBe('scvMap')
      })

      it('is deterministic', () => {
        expect(build().xdr).toBe(built.xdr)
      })

      it('matches stored snapshot', () => {
        expect(built.xdr).toMatchSnapshot()
      })
    })

    describe('SetAggregator (single Address variant)', () => {
      // Built inside `it` so the outer `beforeAll` fake timers are active and
      // the tx timebounds (hence the snapshot) are deterministic.
      const build = () =>
        buildStellarProposeSetAggregatorTx(
          BASE_OPTS,
          { aggregator: FIXTURE_USDC },
          FIXTURE_SALT
        )

      it('wraps SetAggregator with an Address payload', () => {
        const op = parseInvoked(build().xdr).args[1]!
        expect(adminOpVariant(op)).toBe('SetAggregator')
        expect(op.vec()).toHaveLength(2)
        expect(op.vec()![1]!.switch().name).toBe('scvAddress')
      })

      it('matches stored snapshot', () => {
        expect(build().xdr).toMatchSnapshot()
      })
    })

    describe('DeployPool (unit variant)', () => {
      const build = () => buildStellarProposeDeployPoolTx(BASE_OPTS, FIXTURE_SALT)

      it('encodes DeployPool as a tag-only enum', () => {
        const op = parseInvoked(build().xdr).args[1]!
        expect(adminOpVariant(op)).toBe('DeployPool')
        expect(op.vec()).toHaveLength(1)
      })

      it('matches stored snapshot', () => {
        expect(build().xdr).toMatchSnapshot()
      })
    })
  })

  // Byte-parity gate: the AdminOperation ScVal the SDK encodes MUST match the
  // contract's own XDR for the same value, because the timelock hashes it into
  // the operation id. Expected values are produced by the governance crate test
  // `op::xdr_parity::print_canonical_admin_op_xdrs` (rs-lending-xlm) using the
  // address below. If the contract enum/struct layout changes, regenerate them.
  describe('AdminOperation byte-parity with contract', () => {
    const PARITY_ADDR =
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'
    const opXdr = (xdrB64: string): string =>
      parseInvoked(xdrB64).args[1]!.toXDR('base64')

    it('DeployPool', () => {
      expect(opXdr(buildStellarProposeDeployPoolTx(BASE_OPTS, FIXTURE_SALT).xdr)).toBe(
        'AAAAEAAAAAEAAAABAAAADwAAAApEZXBsb3lQb29sAAA='
      )
    })

    it('UpdateGovDelay(34560)', () => {
      expect(
        opXdr(
          buildStellarProposeUpdateDelayTx(BASE_OPTS, { newDelay: 34560 }, FIXTURE_SALT).xdr
        )
      ).toBe('AAAAEAAAAAEAAAACAAAADwAAAA5VcGRhdGVHb3ZEZWxheQAAAAAAAwAAhwA=')
    })

    it('SetAggregator(addr)', () => {
      expect(
        opXdr(
          buildStellarProposeSetAggregatorTx(
            BASE_OPTS,
            { aggregator: PARITY_ADDR },
            FIXTURE_SALT
          ).xdr
        )
      ).toBe(
        'AAAAEAAAAAEAAAACAAAADwAAAA1TZXRBZ2dyZWdhdG9yAAAAAAAAEgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ=='
      )
    })

    it('UpdatePoolCaps (struct field order: borrow_cap, hub_asset, supply_cap)', () => {
      expect(
        opXdr(
          buildStellarProposeUpdatePoolCapsTx(
            BASE_OPTS,
            {
              hubId: 1,
              asset: PARITY_ADDR,
              supplyCap: '100000000000000',
              borrowCap: '50000000000000',
            },
            FIXTURE_SALT
          ).xdr
        )
      ).toBe(
        'AAAAEAAAAAEAAAACAAAADwAAAA5VcGRhdGVQb29sQ2FwcwAAAAAAEQAAAAEAAAADAAAADwAAAApib3Jyb3dfY2FwAAAAAAAKAAAAAAAAAAAAAC15iD0gAAAAAA8AAAAJaHViX2Fzc2V0AAAAAAAAEQAAAAEAAAACAAAADwAAAAVhc3NldAAAAAAAABIAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAPAAAABmh1Yl9pZAAAAAAAAwAAAAEAAAAPAAAACnN1cHBseV9jYXAAAAAAAAoAAAAAAAAAAAAAWvMQekAA'
      )
    })
  })

  // Governance-self ops execute through `execute_self(executor, op, salt)`:
  // arg0 = executor (None/Void), arg1 = the AdminOperation, arg2 = salt.
  describe('execute_self — governance-self ops', () => {
    const build = () =>
      buildStellarGovernanceExecuteUpdateDelayTx(
        BASE_OPTS,
        { newDelay: 34560 },
        FIXTURE_SALT
      )

    it('calls execute_self with [None, AdminOperation, salt]', () => {
      const parsed = parseInvoked(build().xdr)
      expect(parsed.functionName).toBe('execute_self')
      expect(parsed.args).toHaveLength(3)
      expect(parsed.args[0]!.switch().name).toBe('scvVoid')
      expect(adminOpVariant(parsed.args[1]!)).toBe('UpdateGovDelay')
      expect(parsed.args[2]!.switch().name).toBe('scvBytes')
    })

    it('matches stored snapshot', () => {
      expect(build().xdr).toMatchSnapshot()
    })
  })
})