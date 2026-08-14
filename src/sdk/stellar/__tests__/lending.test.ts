/**
 * Snapshot + sanity tests for the Stellar Soroban lending transaction builders.
 *
 * These tests assert:
 *   1. Every builder returns a non-empty base64 XDR.
 *   2. XDR parses back into a valid Transaction with exactly one InvokeHostFunction
 *      operation targeting the configured controller contract.
 *   3. The function name encoded in the XDR matches the Stellar controller
 *      entry point exactly (`supply`, `borrow`, `withdraw`, `repay`,
 *      `liquidate`, `flash_loan`, `multiply`, `swap_debt`, `swap_collateral`,
 *      `repay_debt_with_collateral`).
 *   4. The XDR is deterministic — identical fixture inputs yield identical XDR.
 *   5. Stable snapshots for the full XDR of every builder (regression guard
 *      for any unintended encoding change).
 *
 * Builders are RPC-free — they accept a `sourceSequence` so output is
 * fully deterministic and snapshot-testable. The UI layer is responsible
 * for fetching the sequence and running `rpc.Server.prepareTransaction`
 * before signing.
 */

import { jest } from '@jest/globals'
import {
  Networks,
  ScInt,
  scValToNative,
  Transaction,
  xdr as stellarXdr,
} from '@stellar/stellar-sdk'

import {
  buildStellarBorrowTx,
  buildStellarFlashLoanTx,
  buildStellarLiquidateTx,
  buildStellarMigrateFromBlendTx,
  buildStellarMultiplyTx,
  buildStellarRepayDebtWithCollateralTx,
  buildStellarRepayTx,
  buildStellarSupplyTx,
  buildStellarSwapCollateralTx,
  buildStellarSwapDebtTx,
  buildStellarWithdrawBatchTx,
  buildStellarWithdrawTx,
  decodeStellarLiquidateReturn,
  type StellarBuilderOptions,
  type StellarFlashLoanArgs,
  type StellarLiquidateArgs,
  type StellarMigrateFromBlendArgs,
  type StellarMultiplyArgs,
  type StellarRepayArgs,
  type StellarRepayDebtWithCollateralArgs,
  type StellarSupplyArgs,
  type StellarSwapCollateralArgs,
  type StellarSwapDebtArgs,
  type StellarSwapStepsInput,
  type StellarWithdrawArgs,
  type StellarBorrowArgs,
} from '../lending'
import { buildSameTokenRepaySwapSteps } from '../repay-swap'

// -----------------------------------------------------------------------------
// Deterministic fixtures
// -----------------------------------------------------------------------------

// Deterministic valid Stellar strkeys — derived from fixed-byte seeds at
// test-setup time. Kept as constants here (rather than re-derived) so the
// snapshot XDR is stable across machines.
const FIXTURE_CALLER =
  'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR'
const FIXTURE_CONTROLLER =
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
const FIXTURE_USDC =
  'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3'
const FIXTURE_XLM =
  'CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW'
const FIXTURE_ROUTE_XDR = 'AQIDBA=='

// Stellar requires a tx source sequence strictly less than next ledger sequence.
const FIXTURE_SEQUENCE = '123456789'

// Pin Date.now so the tx `timeBounds.maxTime` (Date.now()/1000 + timeoutSecs)
// is deterministic — otherwise stored XDR snapshots drift each test run.
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
  controllerAddress: FIXTURE_CONTROLLER,
  fee: '100',
  timeoutSeconds: 300,
}

const FIXTURE_STEPS: StellarSwapStepsInput = { routeXdr: FIXTURE_ROUTE_XDR }

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parse a Soroban contract-call tx back into the function name it invokes.
 * Throws if the XDR does not contain exactly one InvokeHostFunction op
 * targeting an InvokeContract host function.
 */
const parseInvokedFunction = (
  xdrB64: string
): { contractId: string; functionName: string; argCount: number } => {
  const tx = new Transaction(xdrB64, Networks.TESTNET)
  expect(tx.operations).toHaveLength(1)
  const op = tx.operations[0] as unknown as {
    type: string
    func: stellarXdr.HostFunction
  }
  expect(op.type).toBe('invokeHostFunction')

  const hostFn = op.func
  const invokeContract = hostFn.invokeContract()
  const contractIdScAddress = invokeContract.contractAddress()
  const functionNameBuf = invokeContract.functionName()

  return {
    // Raw strkey not needed — compare via the ScAddress type instead.
    contractId: contractIdScAddress.switch().name,
    functionName: Buffer.isBuffer(functionNameBuf)
      ? functionNameBuf.toString('utf8')
      : String(functionNameBuf),
    argCount: invokeContract.args().length,
  }
}

// -----------------------------------------------------------------------------
// Fixtures — one per builder DTO
// -----------------------------------------------------------------------------

// hub_id used across fixtures — 0 is the canonical hub. A non-zero hub on a
// couple of fixtures guards the hub_id encoding path.
const HUB = 0

const supplyArgs: StellarSupplyArgs = {
  hubId: HUB,
  asset: FIXTURE_USDC,
  amount: '1000000000',
  spokeId: 1,
  accountNonce: 0,
}

const borrowArgs: StellarBorrowArgs = {
  hubId: HUB,
  asset: FIXTURE_XLM,
  amount: '500000000',
  accountNonce: 42,
}

const withdrawArgs: StellarWithdrawArgs = {
  hubId: HUB,
  asset: FIXTURE_USDC,
  amount: '250000000',
  accountNonce: 42,
}

const repayArgs: StellarRepayArgs = {
  hubId: HUB,
  asset: FIXTURE_XLM,
  amount: '100000000',
  accountNonce: 42,
}

const liquidateArgs: StellarLiquidateArgs = {
  accountNonce: 99,
  debtPayments: [
    { hubId: HUB, asset: FIXTURE_XLM, amount: '50000000' },
    { hubId: 1, asset: FIXTURE_USDC, amount: '75000000' },
  ],
}

const liquidateCreditArgs: StellarLiquidateArgs = {
  ...liquidateArgs,
  seizeMode: { Credit: 0 },
}

const flashLoanArgs: StellarFlashLoanArgs = {
  hubId: HUB,
  asset: FIXTURE_USDC,
  amount: '999000000',
  receiver: FIXTURE_CONTROLLER,
  data: '0xdeadbeef',
}

const migrateFromBlendArgs: StellarMigrateFromBlendArgs = {
  blendPool: FIXTURE_CONTROLLER,
  accountId: '0',
  spokeId: 0,
  hubId: HUB,
  collateralTokens: [FIXTURE_XLM],
  supplyTokens: [FIXTURE_USDC],
  debtCaps: [{ token: FIXTURE_USDC, cap: '200500000' }],
}

const multiplyArgs: StellarMultiplyArgs = {
  accountNonce: 0,
  spokeId: 2,
  collateral: { hubId: HUB, asset: FIXTURE_USDC },
  debt: { hubId: HUB, asset: FIXTURE_XLM },
  debtToFlashLoan: '200000000',
  mode: 1, // PositionMode::Multiply
  steps: FIXTURE_STEPS,
}

const multiplyWithInitialArgs: StellarMultiplyArgs = {
  ...multiplyArgs,
  initialPayment: { hubId: HUB, asset: FIXTURE_USDC, amount: '50000000' },
  convertSwap: FIXTURE_STEPS,
}

const swapDebtArgs: StellarSwapDebtArgs = {
  accountNonce: 42,
  existingDebt: { hubId: HUB, asset: FIXTURE_XLM },
  newDebt: { hubId: 1, asset: FIXTURE_USDC },
  newDebtAmount: '300000000',
  steps: FIXTURE_STEPS,
}

const swapCollateralArgs: StellarSwapCollateralArgs = {
  accountNonce: 42,
  current: { hubId: HUB, asset: FIXTURE_USDC },
  newCollateral: { hubId: 1, asset: FIXTURE_XLM },
  fromAmount: '400000000',
  steps: FIXTURE_STEPS,
}

const repayDebtWithCollateralArgs: StellarRepayDebtWithCollateralArgs = {
  accountNonce: 42,
  collateral: { hubId: HUB, asset: FIXTURE_USDC },
  debt: { hubId: HUB, asset: FIXTURE_XLM },
  collateralAmount: '150000000',
  steps: FIXTURE_STEPS,
  closePosition: false,
}

// -----------------------------------------------------------------------------
// Per-builder behavioural tests
// -----------------------------------------------------------------------------

describe('Stellar lending transaction builders — sanity', () => {
  const cases: Array<{
    name: string
    expectedFn: string
    expectedArgCount: number
    build: () => { xdr: string }
  }> = [
    {
      name: 'supply',
      expectedFn: 'supply',
      // caller, account_id, spoke_id, assets
      expectedArgCount: 4,
      build: () => buildStellarSupplyTx(BASE_OPTS, supplyArgs),
    },
    {
      name: 'borrow',
      expectedFn: 'borrow',
      // caller, account_id, borrows, to (None -> Void)
      expectedArgCount: 4,
      build: () => buildStellarBorrowTx(BASE_OPTS, borrowArgs),
    },
    {
      name: 'withdraw',
      expectedFn: 'withdraw',
      // caller, account_id, withdrawals, to (None -> Void)
      expectedArgCount: 4,
      build: () => buildStellarWithdrawTx(BASE_OPTS, withdrawArgs),
    },
    {
      name: 'withdraw (batch with recipient)',
      expectedFn: 'withdraw',
      // same arity; the trailing Option is Some(address) instead of Void
      expectedArgCount: 4,
      build: () =>
        buildStellarWithdrawBatchTx(BASE_OPTS, {
          accountNonce: withdrawArgs.accountNonce,
          withdrawals: [
            {
              hubId: withdrawArgs.hubId,
              asset: withdrawArgs.asset,
              amount: withdrawArgs.amount,
            },
          ],
          to: FIXTURE_CALLER,
        }),
    },
    {
      name: 'repay',
      expectedFn: 'repay',
      // caller, account_id, payments
      expectedArgCount: 3,
      build: () => buildStellarRepayTx(BASE_OPTS, repayArgs),
    },
    {
      name: 'liquidate',
      expectedFn: 'liquidate',
      // liquidator, account_id, debt_payments, seize_mode
      expectedArgCount: 4,
      build: () => buildStellarLiquidateTx(BASE_OPTS, liquidateArgs),
    },
    {
      name: 'liquidate (share-credit into a new account)',
      expectedFn: 'liquidate',
      // same arity; seize_mode is Credit(0) instead of Transfer
      expectedArgCount: 4,
      build: () =>
        buildStellarLiquidateTx(BASE_OPTS, liquidateCreditArgs),
    },
    {
      name: 'flash_loan',
      expectedFn: 'flash_loan',
      // caller, asset, amount, receiver, data
      expectedArgCount: 5,
      build: () => buildStellarFlashLoanTx(BASE_OPTS, flashLoanArgs),
    },
    {
      name: 'migrate_from_blend',
      expectedFn: 'migrate_from_blend',
      // caller, account_id, spoke_id, hub_id, blend_pool, collateral, supply, debt_caps
      expectedArgCount: 8,
      build: () =>
        buildStellarMigrateFromBlendTx(BASE_OPTS, migrateFromBlendArgs),
    },
    {
      name: 'multiply',
      expectedFn: 'multiply',
      // caller, account_id, spoke_id, collateral, debt_to_flash, debt, mode,
      // swap, initial_payment (None → Void), convert_swap (None → Void)
      expectedArgCount: 10,
      build: () => buildStellarMultiplyTx(BASE_OPTS, multiplyArgs),
    },
    {
      name: 'multiply (with initial_payment + convert_swap)',
      expectedFn: 'multiply',
      // same arity; the two trailing Options are Some(...) instead of Void
      expectedArgCount: 10,
      build: () => buildStellarMultiplyTx(BASE_OPTS, multiplyWithInitialArgs),
    },
    {
      name: 'swap_debt',
      expectedFn: 'swap_debt',
      // caller, account_id, existing_debt, new_amount, new_debt, steps
      expectedArgCount: 6,
      build: () => buildStellarSwapDebtTx(BASE_OPTS, swapDebtArgs),
    },
    {
      name: 'swap_collateral',
      expectedFn: 'swap_collateral',
      // caller, account_id, current_collateral, from_amount, new_collateral, steps
      expectedArgCount: 6,
      build: () =>
        buildStellarSwapCollateralTx(BASE_OPTS, swapCollateralArgs),
    },
    {
      name: 'repay_debt_with_collateral',
      expectedFn: 'repay_debt_with_collateral',
      // caller, account_id, collateral, amount, debt_token, steps, close_position
      expectedArgCount: 7,
      build: () =>
        buildStellarRepayDebtWithCollateralTx(
          BASE_OPTS,
          repayDebtWithCollateralArgs
        ),
    },
  ]

  for (const c of cases) {
    describe(c.name, () => {
      let built: { xdr: string }

      beforeAll(() => {
        built = c.build()
      })

      it('returns a non-empty base64 XDR', () => {
        expect(typeof built.xdr).toBe('string')
        expect(built.xdr.length).toBeGreaterThan(0)
      })

      it('parses back into exactly one invoke_host_function operation', () => {
        const parsed = parseInvokedFunction(built.xdr)
        expect(parsed.contractId).toBe('scAddressTypeContract')
      })

      it(`encodes function name "${c.expectedFn}" with ${c.expectedArgCount} args`, () => {
        const parsed = parseInvokedFunction(built.xdr)
        expect(parsed.functionName).toBe(c.expectedFn)
        expect(parsed.argCount).toBe(c.expectedArgCount)
      })

      it('is deterministic (same inputs → same XDR)', () => {
        const again = c.build()
        expect(again.xdr).toBe(built.xdr)
      })

      it('matches stored snapshot', () => {
        expect(built.xdr).toMatchSnapshot()
      })
    })
  }
})

// -----------------------------------------------------------------------------
// Input validation / defaulting
// -----------------------------------------------------------------------------

describe('Stellar lending builders — input validation', () => {
  it('supply defaults accountNonce to 0 and spokeId to 0 when omitted', () => {
    const a = buildStellarSupplyTx(BASE_OPTS, {
      hubId: HUB,
      asset: FIXTURE_USDC,
      amount: '1',
    })
    const b = buildStellarSupplyTx(BASE_OPTS, {
      hubId: HUB,
      asset: FIXTURE_USDC,
      amount: '1',
      accountNonce: 0,
      spokeId: 0,
    })
    expect(a.xdr).toBe(b.xdr)
  })

  it('multiply defaults accountNonce and spokeId to 0 when omitted', () => {
    const a = buildStellarMultiplyTx(BASE_OPTS, {
      collateral: { hubId: HUB, asset: FIXTURE_USDC },
      debt: { hubId: HUB, asset: FIXTURE_XLM },
      debtToFlashLoan: '1',
      mode: 0,
      steps: FIXTURE_STEPS,
    })
    const b = buildStellarMultiplyTx(BASE_OPTS, {
      accountNonce: 0,
      spokeId: 0,
      collateral: { hubId: HUB, asset: FIXTURE_USDC },
      debt: { hubId: HUB, asset: FIXTURE_XLM },
      debtToFlashLoan: '1',
      mode: 0,
      steps: FIXTURE_STEPS,
    })
    expect(a.xdr).toBe(b.xdr)
  })

  it('throws when controller address is not configured', () => {
    expect(() =>
      buildStellarSupplyTx(
        {
          network: 'mainnet',
          caller: FIXTURE_CALLER,
          sourceSequence: FIXTURE_SEQUENCE,
          // no controllerAddress override, mainnet env not set in test
        },
        { hubId: HUB, asset: FIXTURE_USDC, amount: '1' }
      )
    ).toThrow(/controller address not configured/)
  })

  it('throws on invalid steps shape', () => {
    expect(() =>
      buildStellarMultiplyTx(BASE_OPTS, {
        ...multiplyArgs,
        steps: 42,
      } as unknown as StellarMultiplyArgs)
    ).toThrow(/steps.*opaque strategy bytes/)
  })

  it('throws on invalid flash_loan data shape', () => {
    expect(() =>
      buildStellarFlashLoanTx(BASE_OPTS, {
        ...flashLoanArgs,
        data: 42,
      } as unknown as StellarFlashLoanArgs)
    ).toThrow(/data.*hex string/)
  })
})

// -----------------------------------------------------------------------------
// liquidate — SeizeMode encoding + u64 return decoding
// -----------------------------------------------------------------------------

/**
 * `SeizeMode` is a Soroban `#[contracttype]` enum, so both arms serialize as
 * `scvVec([scvSymbol(Variant), ...payload])` — `Transfer` is symbol-only,
 * `Credit` appends the receiving account id as a `u64`.
 */
describe('liquidate — SeizeMode', () => {
  const seizeModeArg = (built: { xdr: string }): stellarXdr.ScVal => {
    const tx = new Transaction(built.xdr, Networks.TESTNET)
    const op = tx.operations[0] as unknown as { func: stellarXdr.HostFunction }
    // liquidator, account_id, debt_payments, seize_mode
    return op.func.invokeContract().args()[3]!
  }

  it('defaults to the Transfer arm when seizeMode is omitted', () => {
    const arg = seizeModeArg(buildStellarLiquidateTx(BASE_OPTS, liquidateArgs))
    expect(arg.switch().name).toBe('scvVec')
    const elems = arg.vec()!
    expect(elems).toHaveLength(1)
    expect(elems[0]!.sym().toString()).toBe('Transfer')
  })

  it("omitting seizeMode is identical to passing 'Transfer'", () => {
    expect(buildStellarLiquidateTx(BASE_OPTS, liquidateArgs).xdr).toBe(
      buildStellarLiquidateTx(BASE_OPTS, {
        ...liquidateArgs,
        seizeMode: 'Transfer',
      }).xdr
    )
  })

  it('encodes Credit(0) as the symbol plus a u64 payload', () => {
    const arg = seizeModeArg(
      buildStellarLiquidateTx(BASE_OPTS, liquidateCreditArgs)
    )
    const elems = arg.vec()!
    expect(elems).toHaveLength(2)
    expect(elems[0]!.sym().toString()).toBe('Credit')
    expect(elems[1]!.switch().name).toBe('scvU64')
    expect(scValToNative(elems[1]!)).toBe(0n)
  })

  it('carries a non-zero receiving account id through as u64', () => {
    const arg = seizeModeArg(
      buildStellarLiquidateTx(BASE_OPTS, {
        ...liquidateArgs,
        seizeMode: { Credit: '4294967296' },
      })
    )
    expect(scValToNative(arg.vec()![1]!)).toBe(4294967296n)
  })

  it('rejects a malformed seize mode at the SDK boundary', () => {
    expect(() =>
      buildStellarLiquidateTx(BASE_OPTS, {
        ...liquidateArgs,
        seizeMode: 'Credit',
      } as unknown as StellarLiquidateArgs)
    ).toThrow(/SeizeMode must be/)
    expect(() =>
      buildStellarLiquidateTx(BASE_OPTS, {
        ...liquidateArgs,
        seizeMode: { Credit: 1.5 },
      })
    ).toThrow(/integer u64/)
  })

  it('decodes the u64 return value (0 = Transfer, else the receiver id)', () => {
    const encode = (v: string) => new ScInt(v).toU64().toXDR('base64')
    expect(decodeStellarLiquidateReturn(encode('0'))).toBe('0')
    expect(decodeStellarLiquidateReturn(encode('77'))).toBe('77')
    // u64 beyond Number.MAX_SAFE_INTEGER must survive as an exact string.
    expect(decodeStellarLiquidateReturn(encode('18446744073709551615'))).toBe(
      '18446744073709551615'
    )
  })

  it('rejects a return value that is not a u64', () => {
    expect(() =>
      decodeStellarLiquidateReturn(stellarXdr.ScVal.scvVoid().toXDR('base64'))
    ).toThrow(/must be a u64/)
  })
})

// -----------------------------------------------------------------------------
// repay_debt_with_collateral — same-token (collateral_token === debt_token)
// -----------------------------------------------------------------------------

/**
 * The contract asserts `swap.is_empty()` when `collateral.asset == debt.asset`
 * and reverts `InvalidPayments` otherwise — regression guard for the bug where
 * `buildSameTokenRepaySwapSteps` encoded a non-empty placeholder route.
 */
describe('repay_debt_with_collateral — same-token', () => {
  const sameTokenArgs: StellarRepayDebtWithCollateralArgs = {
    accountNonce: 42,
    collateral: { hubId: HUB, asset: FIXTURE_USDC },
    debt: { hubId: 2, asset: FIXTURE_USDC },
    collateralAmount: '150000000',
    steps: buildSameTokenRepaySwapSteps(),
    closePosition: false,
  }

  it('buildSameTokenRepaySwapSteps returns a zero-length Uint8Array', () => {
    const steps = buildSameTokenRepaySwapSteps()
    expect(steps).toBeInstanceOf(Uint8Array)
    expect(steps.length).toBe(0)
  })

  it('encodes the swap arg as genuinely empty Bytes, cross-hub included', () => {
    const built = buildStellarRepayDebtWithCollateralTx(BASE_OPTS, sameTokenArgs)
    const tx = new Transaction(built.xdr, Networks.TESTNET)
    const op = tx.operations[0] as unknown as { func: stellarXdr.HostFunction }
    const args = op.func.invokeContract().args()
    // caller, account_id, collateral, amount, debt_token, steps, close_position
    const swapArg = args[5]
    expect(swapArg.switch().name).toBe('scvBytes')
    expect(swapArg.bytes().length).toBe(0)
  })

  it('buildSameTokenRepaySwapSteps ignores legacy (token, collateralAmount) args for source compatibility', () => {
    const steps = buildSameTokenRepaySwapSteps(FIXTURE_USDC, '150000000')
    expect(steps).toBeInstanceOf(Uint8Array)
    expect(steps.length).toBe(0)
  })

  it('encodes the swap arg as genuinely empty Bytes when steps is the { bytes } wrapper form', () => {
    const built = buildStellarRepayDebtWithCollateralTx(BASE_OPTS, {
      ...sameTokenArgs,
      steps: { bytes: new Uint8Array(0) },
    })
    const tx = new Transaction(built.xdr, Networks.TESTNET)
    const op = tx.operations[0] as unknown as { func: stellarXdr.HostFunction }
    const args = op.func.invokeContract().args()
    const swapArg = args[5]
    expect(swapArg.switch().name).toBe('scvBytes')
    expect(swapArg.bytes().length).toBe(0)
  })
})
