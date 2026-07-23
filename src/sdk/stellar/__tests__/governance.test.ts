/**
 * Snapshot + structural tests for governance `propose_*` transaction builders
 * used by the admin dashboard (timelock proposals).
 */

import { jest } from '@jest/globals'
import { Networks, Transaction, xdr as stellarXdr } from '@stellar/stellar-sdk'

import {
  buildStellarExecuteCancellerResetTx,
  buildStellarGovernanceExecuteUpdateDelayTx,
  buildStellarProposeCancellerResetTx,
  buildStellarProposeDeployPoolTx,
  buildStellarProposeSetAggregatorTx,
  buildStellarProposeUpdateDelayTx,
  buildStellarProposeAddAssetToSpokeTx,
  buildStellarProposeAddSpokeTx,
  buildStellarProposeEditAssetInSpokeTx,
  buildStellarProposeRemoveAssetFromSpokeTx,
  buildStellarProposeRemoveSpokeTx,
  buildStellarProposeSetPositionManagerTx,
  buildStellarProposeSetSpokeLiquidationCurveTx,
  buildStellarProposeUnpauseTx,
  buildStellarProposeUpgradePoolParamsTx,
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
const FIXTURE_WASM_HASH = 'ab'.repeat(32)

const PARAMS_FIXTURE = {
  maxBorrowRateRay: '2000000000000000000000000000',
  baseBorrowRateRay: '10000000000000000000000000',
  slope1Ray: '40000000000000000000000000',
  slope2Ray: '80000000000000000000000000',
  slope3Ray: '1000000000000000000000000000',
  midUtilizationRay: '450000000000000000000000000',
  optimalUtilizationRay: '800000000000000000000000000',
  maxUtilizationRay: '950000000000000000000000000',
  reserveFactorBps: 1000,
}

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
    describe('UpgradeLiquidityPoolParams (struct-payload variant)', () => {
      const build = () =>
        buildStellarProposeUpgradePoolParamsTx(
          BASE_OPTS,
          {
            hubId: 1,
            asset: FIXTURE_USDC,
            params: PARAMS_FIXTURE,
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

      it('wraps the UpgradeLiquidityPoolParams variant with a struct payload', () => {
        const op = parseInvoked(built.xdr).args[1]!
        expect(adminOpVariant(op)).toBe('UpgradeLiquidityPoolParams')
        // [symbol, UpgradePoolParamsArgs struct]
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

    describe('Spoke admin ops', () => {
      const SPOKE_ARGS = {
        hubId: 1,
        spokeId: 3,
        asset: FIXTURE_USDC,
        canCollateral: true,
        canBorrow: false,
        paused: false,
        frozen: true,
        ltv: 6500,
        threshold: 7000,
        bonus: 700,
        liquidationFees: 100,
        supplyCap: '1000000000',
        borrowCap: '0',
      }

      it('AddSpoke is a tag-only enum', () => {
        const op = parseInvoked(
          buildStellarProposeAddSpokeTx(BASE_OPTS, FIXTURE_SALT).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('AddSpoke')
        expect(op.vec()).toHaveLength(1)
      })

      it('RemoveSpoke carries the spoke id as u32', () => {
        const op = parseInvoked(
          buildStellarProposeRemoveSpokeTx(
            BASE_OPTS,
            { spokeId: 3 },
            FIXTURE_SALT
          ).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('RemoveSpoke')
        expect(op.vec()).toHaveLength(2)
        expect(op.vec()![1]!.switch().name).toBe('scvU32')
        expect(op.vec()![1]!.u32()).toBe(3)
      })

      it('AddAssetToSpoke encodes SpokeAssetArgs with the 14 sorted wire keys', () => {
        const op = parseInvoked(
          buildStellarProposeAddAssetToSpokeTx(
            BASE_OPTS,
            SPOKE_ARGS,
            FIXTURE_SALT
          ).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('AddAssetToSpoke')
        const entries = op.vec()![1]!.map()!
        const keys = entries.map((e) => e.key().sym().toString())
        expect(keys).toEqual([
          'asset',
          'bonus',
          'borrow_cap',
          'can_borrow',
          'can_collateral',
          'frozen',
          'hub_id',
          'liquidation_fees',
          'ltv',
          'oracle_override',
          'paused',
          'spoke_id',
          'supply_cap',
          'threshold',
        ])
        const field = (name: string) =>
          entries.find((e) => e.key().sym().toString() === name)!.val()
        expect(field('supply_cap').switch().name).toBe('scvI128')
        expect(field('borrow_cap').switch().name).toBe('scvI128')
        expect(field('can_borrow').switch().name).toBe('scvBool')
        // Per-listing incident flags carry through the wire encoding verbatim.
        expect(field('paused').b()).toBe(false)
        expect(field('frozen').b()).toBe(true)
        // oracle_override is always the None arm of MarketOracleConfigOption.
        expect(field('oracle_override').vec()![0]!.sym().toString()).toBe(
          'None'
        )
      })

      it('EditAssetInSpoke reuses the SpokeAssetArgs payload', () => {
        const op = parseInvoked(
          buildStellarProposeEditAssetInSpokeTx(
            BASE_OPTS,
            SPOKE_ARGS,
            FIXTURE_SALT
          ).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('EditAssetInSpoke')
        expect(op.vec()![1]!.switch().name).toBe('scvMap')
      })

      it('RemoveAssetFromSpoke wraps hub_asset + spoke_id', () => {
        const op = parseInvoked(
          buildStellarProposeRemoveAssetFromSpokeTx(
            BASE_OPTS,
            { hubId: 1, spokeId: 3, asset: FIXTURE_USDC },
            FIXTURE_SALT
          ).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('RemoveAssetFromSpoke')
        const keys = op
          .vec()![1]!
          .map()!
          .map((e) => e.key().sym().toString())
        expect(keys).toEqual(['hub_asset', 'spoke_id'])
      })

      it('SetSpokeLiquidationCurve encodes the 4 sorted wire keys', () => {
        const op = parseInvoked(
          buildStellarProposeSetSpokeLiquidationCurveTx(
            BASE_OPTS,
            {
              spokeId: 3,
              targetHfWad: '1020000000000000000',
              hfForMaxBonusWad: '510000000000000000',
              liquidationBonusFactorBps: 10000,
            },
            FIXTURE_SALT
          ).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('SetSpokeLiquidationCurve')
        const entries = op.vec()![1]!.map()!
        const keys = entries.map((e) => e.key().sym().toString())
        expect(keys).toEqual([
          'hf_for_max_bonus_wad',
          'liquidation_bonus_factor_bps',
          'spoke_id',
          'target_hf_wad',
        ])
        const field = (name: string) =>
          entries.find((e) => e.key().sym().toString() === name)!.val()
        expect(field('target_hf_wad').switch().name).toBe('scvI128')
        expect(field('hf_for_max_bonus_wad').switch().name).toBe('scvI128')
        expect(field('liquidation_bonus_factor_bps').switch().name).toBe(
          'scvU32'
        )
        expect(field('liquidation_bonus_factor_bps').u32()).toBe(10000)
        expect(field('spoke_id').u32()).toBe(3)
      })

      it('SetPositionManager is a two-field tuple variant', () => {
        const op = parseInvoked(
          buildStellarProposeSetPositionManagerTx(
            BASE_OPTS,
            { manager: FIXTURE_USDC, isActive: true },
            FIXTURE_SALT
          ).xdr
        ).args[1]!
        expect(adminOpVariant(op)).toBe('SetPositionManager')
        expect(op.vec()).toHaveLength(3)
        expect(op.vec()![1]!.switch().name).toBe('scvAddress')
        expect(op.vec()![2]!.switch().name).toBe('scvBool')
      })
    })

    describe('DeployPool (hash variant)', () => {
      const build = () =>
        buildStellarProposeDeployPoolTx(BASE_OPTS, { wasmHash: FIXTURE_WASM_HASH }, FIXTURE_SALT)

      it('encodes DeployPool with a BytesN payload', () => {
        const op = parseInvoked(build().xdr).args[1]!
        expect(adminOpVariant(op)).toBe('DeployPool')
        expect(op.vec()).toHaveLength(2)
      })

      it('matches stored snapshot', () => {
        expect(build().xdr).toMatchSnapshot()
      })
    })

    describe('Unpause (unit variant)', () => {
      const build = () => buildStellarProposeUnpauseTx(BASE_OPTS, FIXTURE_SALT)

      it('encodes Unpause as a tag-only enum', () => {
        const op = parseInvoked(build().xdr).args[1]!
        expect(adminOpVariant(op)).toBe('Unpause')
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
      expect(
        opXdr(
          buildStellarProposeDeployPoolTx(
            BASE_OPTS,
            { wasmHash: FIXTURE_WASM_HASH },
            FIXTURE_SALT
          ).xdr
        )
      ).toBe(
        'AAAAEAAAAAEAAAACAAAADwAAAApEZXBsb3lQb29sAAAAAAANAAAAIKurq6urq6urq6urq6urq6urq6urq6urq6urq6urq6ur'
      )
    })

    it('Unpause', () => {
      expect(opXdr(buildStellarProposeUnpauseTx(BASE_OPTS, FIXTURE_SALT).xdr)).toBe(
        'AAAAEAAAAAEAAAABAAAADwAAAAdVbnBhdXNlAA=='
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

  // Recovery — owner-gated canceller-council reset. Direct entrypoints, NOT
  // `AdminOperation`: `propose_canceller_reset` / `execute_canceller_reset`
  // are their own methods, so args are NOT wrapped in the enum encoding used
  // by `propose` / `execute_self` above.
  describe('propose_canceller_reset — owner-only, direct entrypoint', () => {
    const NEW_CANCELLERS = [FIXTURE_GOVERNANCE, FIXTURE_USDC]
    const build = () =>
      buildStellarProposeCancellerResetTx(
        BASE_OPTS,
        { newCancellers: NEW_CANCELLERS },
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

    it('calls propose_canceller_reset with [Vec<Address>, salt] — no AdminOperation wrapper', () => {
      const parsed = parseInvoked(built.xdr)
      expect(parsed.functionName).toBe('propose_canceller_reset')
      expect(parsed.args).toHaveLength(2)
      expect(parsed.args[0]!.switch().name).toBe('scvVec')
      const elems = parsed.args[0]!.vec()!
      expect(elems).toHaveLength(2)
      expect(elems[0]!.switch().name).toBe('scvAddress')
      expect(elems[1]!.switch().name).toBe('scvAddress')
      expect(parsed.args[1]!.switch().name).toBe('scvBytes')
    })

    it('is deterministic', () => {
      expect(build().xdr).toBe(built.xdr)
    })

    it('matches stored snapshot', () => {
      expect(built.xdr).toMatchSnapshot()
    })
  })

  describe('execute_canceller_reset — open executor, direct entrypoint', () => {
    const NEW_CANCELLERS = [FIXTURE_GOVERNANCE, FIXTURE_USDC]
    const build = () =>
      buildStellarExecuteCancellerResetTx(
        BASE_OPTS,
        { newCancellers: NEW_CANCELLERS },
        FIXTURE_SALT
      )

    let built: { xdr: string }
    beforeAll(() => {
      built = build()
    })

    it('calls execute_canceller_reset with [None, Vec<Address>, salt] when executor omitted', () => {
      const parsed = parseInvoked(built.xdr)
      expect(parsed.functionName).toBe('execute_canceller_reset')
      expect(parsed.args).toHaveLength(3)
      expect(parsed.args[0]!.switch().name).toBe('scvVoid')
      expect(parsed.args[1]!.switch().name).toBe('scvVec')
      expect(parsed.args[1]!.vec()).toHaveLength(2)
      expect(parsed.args[2]!.switch().name).toBe('scvBytes')
    })

    it('encodes a present executor as a bare Address (Soroban Option::Some is unwrapped)', () => {
      const parsed = parseInvoked(
        buildStellarExecuteCancellerResetTx(
          BASE_OPTS,
          { executor: FIXTURE_CALLER, newCancellers: NEW_CANCELLERS },
          FIXTURE_SALT
        ).xdr
      )
      expect(parsed.args[0]!.switch().name).toBe('scvAddress')
    })

    it('is deterministic', () => {
      expect(build().xdr).toBe(built.xdr)
    })

    it('matches stored snapshot', () => {
      expect(built.xdr).toMatchSnapshot()
    })
  })
})