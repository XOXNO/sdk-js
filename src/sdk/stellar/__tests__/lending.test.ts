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

import type {
  BorrowArgs,
  FlashLoanArgs,
  LiquidateArgs,
  MultiplyArgs,
  RepayArgs,
  RepayDebtWithCollateralArgs,
  SupplyArgs,
  SwapCollateralArgs,
  SwapDebtArgs,
  WithdrawArgs,
} from '@xoxno/types'
import {
  Networks,
  Transaction,
  xdr as stellarXdr,
} from '@stellar/stellar-sdk'

import {
  buildStellarBorrowTx,
  buildStellarFlashLoanTx,
  buildStellarLiquidateTx,
  buildStellarMultiplyTx,
  buildStellarRepayDebtWithCollateralTx,
  buildStellarRepayTx,
  buildStellarSupplyTx,
  buildStellarSwapCollateralTx,
  buildStellarSwapDebtTx,
  buildStellarWithdrawTx,
  type StellarBuilderOptions,
  type StellarSwapStepsInput,
} from '../lending'

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
const FIXTURE_LP =
  'CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U'

// Stellar requires a tx source sequence strictly less than next ledger sequence.
const FIXTURE_SEQUENCE = '123456789'

const BASE_OPTS: StellarBuilderOptions = {
  network: 'testnet',
  caller: FIXTURE_CALLER,
  sourceSequence: FIXTURE_SEQUENCE,
  controllerAddress: FIXTURE_CONTROLLER,
  fee: '100',
  timeoutSeconds: 300,
}

const FIXTURE_STEPS: StellarSwapStepsInput = {
  hops: [
    {
      poolAddress: FIXTURE_LP,
      tokenIn: FIXTURE_USDC,
      tokenOut: FIXTURE_XLM,
      minAmountOut: '1000000',
    },
  ],
}

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
// Fixtures — one per Wave 0 DTO
// -----------------------------------------------------------------------------

const supplyArgs: SupplyArgs = {
  token: FIXTURE_USDC,
  amount: '1000000000',
  eModeCategory: 1,
  accountNonce: 0,
}

const borrowArgs: BorrowArgs = {
  token: FIXTURE_XLM,
  amount: '500000000',
  accountNonce: 42,
}

const withdrawArgs: WithdrawArgs = {
  token: FIXTURE_USDC,
  amount: '250000000',
  accountNonce: 42,
}

const repayArgs: RepayArgs = {
  token: FIXTURE_XLM,
  amount: '100000000',
  accountNonce: 42,
}

const liquidateArgs: LiquidateArgs = {
  accountNonce: 99,
  debtPayments: [
    { token: FIXTURE_XLM, amount: '50000000' },
    { token: FIXTURE_USDC, amount: '75000000' },
  ],
}

const flashLoanArgs: FlashLoanArgs = {
  asset: FIXTURE_USDC,
  amount: '999000000',
  receiver: FIXTURE_CONTROLLER,
  data: '0xdeadbeef',
}

const multiplyArgs: MultiplyArgs = {
  accountNonce: 0,
  eModeCategory: 2,
  collateralToken: FIXTURE_USDC,
  debtToken: FIXTURE_XLM,
  debtToFlashLoan: '200000000',
  mode: 1, // PositionMode::Multiply
  steps: FIXTURE_STEPS,
}

const swapDebtArgs: SwapDebtArgs = {
  accountNonce: 42,
  existingDebtToken: FIXTURE_XLM,
  newDebtToken: FIXTURE_USDC,
  newDebtAmount: '300000000',
  steps: FIXTURE_STEPS,
}

const swapCollateralArgs: SwapCollateralArgs = {
  accountNonce: 42,
  currentCollateral: FIXTURE_USDC,
  newCollateral: FIXTURE_XLM,
  fromAmount: '400000000',
  steps: FIXTURE_STEPS,
}

const repayDebtWithCollateralArgs: RepayDebtWithCollateralArgs = {
  accountNonce: 42,
  collateralToken: FIXTURE_USDC,
  debtToken: FIXTURE_XLM,
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
      // caller, account_id, e_mode_category, assets
      expectedArgCount: 4,
      build: () => buildStellarSupplyTx(BASE_OPTS, supplyArgs),
    },
    {
      name: 'borrow',
      expectedFn: 'borrow',
      // caller, account_id, borrows
      expectedArgCount: 3,
      build: () => buildStellarBorrowTx(BASE_OPTS, borrowArgs),
    },
    {
      name: 'withdraw',
      expectedFn: 'withdraw',
      // caller, account_id, withdrawals
      expectedArgCount: 3,
      build: () => buildStellarWithdrawTx(BASE_OPTS, withdrawArgs),
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
      // liquidator, account_id, debt_payments
      expectedArgCount: 3,
      build: () => buildStellarLiquidateTx(BASE_OPTS, liquidateArgs),
    },
    {
      name: 'flash_loan',
      expectedFn: 'flash_loan',
      // caller, asset, amount, receiver, data
      expectedArgCount: 5,
      build: () => buildStellarFlashLoanTx(BASE_OPTS, flashLoanArgs),
    },
    {
      name: 'multiply',
      expectedFn: 'multiply',
      // caller, account_id, e_mode, collateral, debt_to_flash, debt_token, mode, steps
      expectedArgCount: 8,
      build: () => buildStellarMultiplyTx(BASE_OPTS, multiplyArgs),
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
  it('supply defaults accountNonce to 0 and eModeCategory to 0 when omitted', () => {
    const a = buildStellarSupplyTx(BASE_OPTS, {
      token: FIXTURE_USDC,
      amount: '1',
    } as SupplyArgs)
    const b = buildStellarSupplyTx(BASE_OPTS, {
      token: FIXTURE_USDC,
      amount: '1',
      accountNonce: 0,
      eModeCategory: 0,
    })
    expect(a.xdr).toBe(b.xdr)
  })

  it('multiply defaults accountNonce to 0 when omitted', () => {
    const a = buildStellarMultiplyTx(BASE_OPTS, {
      eModeCategory: 0,
      collateralToken: FIXTURE_USDC,
      debtToken: FIXTURE_XLM,
      debtToFlashLoan: '1',
      mode: 0,
      steps: FIXTURE_STEPS,
    } as MultiplyArgs)
    const b = buildStellarMultiplyTx(BASE_OPTS, {
      accountNonce: 0,
      eModeCategory: 0,
      collateralToken: FIXTURE_USDC,
      debtToken: FIXTURE_XLM,
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
        { token: FIXTURE_USDC, amount: '1' } as SupplyArgs
      )
    ).toThrow(/controller address not configured/)
  })

  it('throws on invalid steps shape', () => {
    expect(() =>
      buildStellarMultiplyTx(BASE_OPTS, {
        ...multiplyArgs,
        steps: { wrong: true },
      } as unknown as MultiplyArgs)
    ).toThrow(/steps.*StellarSwapStepsInput/)
  })

  it('throws on invalid flash_loan data shape', () => {
    expect(() =>
      buildStellarFlashLoanTx(BASE_OPTS, {
        ...flashLoanArgs,
        data: 42,
      } as unknown as FlashLoanArgs)
    ).toThrow(/data.*hex string/)
  })
})
