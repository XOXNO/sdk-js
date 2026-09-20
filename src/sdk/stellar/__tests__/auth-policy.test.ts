import { Address, StrKey, xdr } from '@stellar/stellar-sdk'

import {
  assertStellarAuthEntries,
  assertStellarPreparedTxAuth,
  StellarAuthPolicyError,
  type StellarAuthPolicyErrorCode,
} from '../auth-policy'
import { STELLAR_NETWORKS } from '../contracts'
import {
  buildStellarMigrateFromBlendTx,
  buildStellarMultiplyTx,
  buildStellarSupplyBatchTx,
  buildStellarSwapCollateralTx,
  type StellarLendingBuilderOptions,
} from '../lending'
import { addr, i128, scStruct, u32 } from '../scval-encode'
import { buildStellarExecuteStrategyTx, encodeStrategyPayloadToRouteXdr } from '../swap'

const contract = (n: number): string => StrKey.encodeContract(Buffer.alloc(32, n))
const account = (n: number): string => StrKey.encodeEd25519PublicKey(Buffer.alloc(32, n))

const { lendingController: CONTROLLER, lendingPool: POOL, aggregatorRouter: ROUTER } =
  STELLAR_NETWORKS.stellarTestnet
const CALLER = account(1)
const ATTACKER = account(2)
const USDC = contract(1)
const XLM = contract(2)
const WALLET_TOKEN = contract(3)
const DEX_POOL = contract(10)
const BLEND_POOL = contract(11)

const OPTS: StellarLendingBuilderOptions = {
  network: 'testnet',
  caller: CALLER,
  sourceSequence: '1',
  controllerAddress: CONTROLLER,
}

const ROUTE = encodeStrategyPayloadToRouteXdr({
  paths: [
    { hops: [{ pool: DEX_POOL, tokenIn: USDC, tokenOut: XLM, venue: 'Soroswap' }], splitPpm: 1_000_000 },
  ],
  tokenIn: USDC,
  tokenOut: XLM,
  totalMinOut: '990',
})

const call = (
  target: string,
  fn: string,
  args: xdr.ScVal[],
  subInvocations: xdr.SorobanAuthorizedInvocation[] = []
): xdr.SorobanAuthorizedInvocation =>
  new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(target).toScAddress(),
        functionName: fn,
        args,
      })
    ),
    subInvocations,
  })

const transfer = (token: string, from: string, to: string, amount: string) =>
  call(token, 'transfer', [addr(from), addr(to), i128(amount)])

const sourceEntry = (root: xdr.SorobanAuthorizedInvocation) =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: root,
  })

const addressEntry = (signer: string, root: xdr.SorobanAuthorizedInvocation) =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(signer).toScAddress(),
        nonce: xdr.Int64.fromString('1'),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVoid(),
      })
    ),
    rootInvocation: root,
  })

/** What simulation does: attach auth entries whose root is the built invocation. */
const prepare = (
  builtXdr: string,
  children: xdr.SorobanAuthorizedInvocation[],
  extra: xdr.SorobanAuthorizationEntry[] = []
): string => {
  const envelope = xdr.TransactionEnvelope.fromXDR(builtXdr, 'base64')
  const op = envelope.v1().tx().operations()[0]?.body().invokeHostFunctionOp()
  if (!op) throw new Error('fixture has no operation')
  const invoked = op.hostFunction().invokeContract()
  const root = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(invoked),
    subInvocations: children,
  })
  op.auth([sourceEntry(root), ...extra])
  return envelope.toXDR('base64')
}

const expectCode = (run: () => unknown, code: StellarAuthPolicyErrorCode): StellarAuthPolicyError => {
  let thrown: unknown
  try {
    run()
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(StellarAuthPolicyError)
  const error = thrown as StellarAuthPolicyError
  expect(error.code).toBe(code)
  return error
}

const check = (preparedXdr: string, builtXdr?: string) =>
  assertStellarPreparedTxAuth(preparedXdr, { network: 'testnet', caller: CALLER, builtXdr })

describe('supply policy', () => {
  const built = buildStellarSupplyBatchTx(OPTS, {
    spokeId: 1,
    assets: [
      { hubId: 1, asset: USDC, amount: '600' },
      { hubId: 2, asset: USDC, amount: '400' },
      { hubId: 1, asset: XLM, amount: '50' },
    ],
  }).xdr

  it('accepts one transfer per leg to the pool, within the per-token total', () => {
    const honest = prepare(built, [
      transfer(USDC, CALLER, POOL, '600'),
      transfer(USDC, CALLER, POOL, '400'),
      transfer(XLM, CALLER, POOL, '50'),
    ])
    expect(() => check(honest, built)).not.toThrow()
  })

  it('names a rogue transfer to an attacker', () => {
    const error = expectCode(
      () => check(prepare(built, [transfer(USDC, CALLER, ATTACKER, '600')])),
      'UNEXPECTED_RECIPIENT'
    )
    expect(error.offender).toEqual({ contract: USDC, fn: 'transfer', args: [CALLER, ATTACKER, '600'] })
    expect(error.message).toContain(ATTACKER)
  })

  it('rejects an unexpected token, an amount above the total, and a foreign sender', () => {
    expectCode(
      () => check(prepare(built, [transfer(WALLET_TOKEN, CALLER, POOL, '1')])),
      'UNEXPECTED_TOKEN'
    )
    expectCode(() => check(prepare(built, [transfer(USDC, CALLER, POOL, '1001')])), 'AMOUNT_EXCEEDED')
    expectCode(
      () =>
        check(prepare(built, [transfer(USDC, CALLER, POOL, '600'), transfer(USDC, CALLER, POOL, '401')])),
      'AMOUNT_EXCEEDED'
    )
    expectCode(() => check(prepare(built, [transfer(USDC, ATTACKER, POOL, '1')])), 'UNEXPECTED_SENDER')
  })

  it('rejects a non-transfer child and a child with its own sub-invocations', () => {
    expectCode(
      () => check(prepare(built, [call(USDC, 'approve', [addr(CALLER), addr(ATTACKER), i128('1'), u32(9)])])),
      'UNEXPECTED_CALL'
    )
    const nested = call(
      USDC,
      'transfer',
      [addr(CALLER), addr(POOL), i128('1')],
      [transfer(WALLET_TOKEN, CALLER, ATTACKER, '1')]
    )
    expectCode(() => check(prepare(built, [nested])), 'NESTED_INVOCATION')
  })

  it('rejects a second entry for the caller and ignores entries of other addresses', () => {
    const rogueRoot = transfer(WALLET_TOKEN, CALLER, ATTACKER, '7')
    expectCode(() => check(prepare(built, [], [addressEntry(CALLER, rogueRoot)])), 'DUPLICATE_ENTRY')
    expect(() =>
      check(prepare(built, [], [addressEntry(ATTACKER, transfer(WALLET_TOKEN, ATTACKER, CALLER, '7'))]))
    ).not.toThrow()
  })

  it('rejects a prepared transaction that invokes something else than was built', () => {
    const other = buildStellarSupplyBatchTx(OPTS, {
      spokeId: 1,
      assets: [{ hubId: 1, asset: USDC, amount: '999999' }],
    }).xdr
    expectCode(() => check(prepare(other, []), built), 'INVOCATION_CHANGED')
  })
})

describe('strategy policies', () => {
  const swapCollateral = buildStellarSwapCollateralTx(OPTS, {
    accountNonce: 5,
    current: { hubId: 1, asset: USDC },
    fromAmount: '1000',
    newCollateral: { hubId: 1, asset: XLM },
    steps: ROUTE,
  }).xdr

  it('swap_collateral: root only; the F-15b rogue hop transfer fails', () => {
    expect(() => check(prepare(swapCollateral, []))).not.toThrow()
    const error = expectCode(
      () => check(prepare(swapCollateral, [transfer(WALLET_TOKEN, CALLER, ATTACKER, '77770000000')])),
      'UNEXPECTED_TOKEN'
    )
    expect(error.offender?.contract).toBe(WALLET_TOKEN)
  })

  it('multiply: only the initial payment to the controller', () => {
    const args = {
      spokeId: 1,
      collateral: { hubId: 1, asset: XLM },
      debtToFlashLoan: '1000',
      debt: { hubId: 1, asset: USDC },
      mode: 1,
      steps: ROUTE,
    }
    const funded = buildStellarMultiplyTx(OPTS, {
      ...args,
      initialPayment: { hubId: 1, asset: XLM, amount: '250' },
    }).xdr
    expect(() => check(prepare(funded, [transfer(XLM, CALLER, CONTROLLER, '250')]))).not.toThrow()
    expectCode(() => check(prepare(funded, [transfer(XLM, CALLER, POOL, '250')])), 'UNEXPECTED_RECIPIENT')
    expectCode(() => check(prepare(funded, [transfer(XLM, CALLER, CONTROLLER, '251')])), 'AMOUNT_EXCEEDED')

    const unfunded = buildStellarMultiplyTx(OPTS, args).xdr
    expect(() => check(prepare(unfunded, []))).not.toThrow()
    expectCode(() => check(prepare(unfunded, [transfer(XLM, CALLER, CONTROLLER, '1')])), 'UNEXPECTED_TOKEN')
  })

  it('migrate_from_blend: only submit(caller, controller, controller, withdraw/repay)', () => {
    const built = buildStellarMigrateFromBlendTx(OPTS, {
      blendPool: BLEND_POOL,
      accountId: '0',
      spokeId: 1,
      hubId: 1,
      collateralTokens: [XLM],
      supplyTokens: [],
      debtCaps: [{ token: USDC, cap: '100' }],
    }).xdr
    const request = (type: number) =>
      scStruct({ address: addr(USDC), amount: i128('100'), request_type: u32(type) })
    const submit = (spender: string, type: number) =>
      call(BLEND_POOL, 'submit', [
        addr(CALLER),
        addr(spender),
        addr(CONTROLLER),
        xdr.ScVal.scvVec([request(type)]),
      ])

    expect(() => check(prepare(built, [submit(CONTROLLER, 5), submit(CONTROLLER, 3)]))).not.toThrow()
    // Blend request type 4 is a borrow.
    expectCode(() => check(prepare(built, [submit(CONTROLLER, 4)])), 'UNEXPECTED_CALL')
    expectCode(() => check(prepare(built, [submit(ATTACKER, 5)])), 'UNEXPECTED_CALL')
    expectCode(
      () => check(prepare(built, [submit(CONTROLLER, 5), submit(CONTROLLER, 3), submit(CONTROLLER, 1)])),
      'UNEXPECTED_CALL'
    )
    expectCode(() => check(prepare(built, [transfer(USDC, CALLER, BLEND_POOL, '100')])), 'UNEXPECTED_TOKEN')
  })
})

describe('direct router swap policy', () => {
  const built = buildStellarExecuteStrategyTx(
    { network: 'testnet', caller: CALLER, sourceSequence: '1', routerAddress: ROUTER, totalIn: '1000' },
    ROUTE
  ).xdr

  it('accepts exactly transfer(sender, router, total_in) on the route input token', () => {
    expect(() => check(prepare(built, [transfer(USDC, CALLER, ROUTER, '1000')]))).not.toThrow()
  })

  it('rejects an extra rogue child, the output token, and an unknown contract', () => {
    expectCode(
      () =>
        check(
          prepare(built, [transfer(USDC, CALLER, ROUTER, '1000'), transfer(WALLET_TOKEN, CALLER, ATTACKER, '9')])
        ),
      'UNEXPECTED_TOKEN'
    )
    expectCode(() => check(prepare(built, [transfer(XLM, CALLER, ROUTER, '1')])), 'UNEXPECTED_TOKEN')

    const elsewhere = buildStellarExecuteStrategyTx(
      { network: 'testnet', caller: CALLER, sourceSequence: '1', routerAddress: DEX_POOL, totalIn: '1000' },
      ROUTE
    ).xdr
    expectCode(() => check(prepare(elsewhere, [])), 'UNSUPPORTED_CONTRACT')
  })
})

describe('assertStellarAuthEntries', () => {
  const policy = {
    caller: CALLER,
    root: { contract: CONTROLLER, fn: 'repay' },
    transfers: [{ token: USDC, to: POOL, maxAmount: 10n }],
  }

  it('rejects an unexpected root and honors address credentials', () => {
    const root = call(CONTROLLER, 'repay', [], [transfer(USDC, CALLER, POOL, '10')])
    expect(() => assertStellarAuthEntries([addressEntry(CALLER, root)], policy, ATTACKER)).not.toThrow()
    expectCode(
      () => assertStellarAuthEntries([addressEntry(CALLER, call(USDC, 'transfer', []))], policy),
      'UNEXPECTED_ROOT'
    )
    // A source-account entry of another source is not the caller's.
    expect(() =>
      assertStellarAuthEntries([sourceEntry(call(USDC, 'burn', []))], policy, ATTACKER)
    ).not.toThrow()
  })
})
