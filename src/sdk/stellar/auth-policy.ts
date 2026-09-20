/**
 * Pre-signing allowlist for the Soroban authorization tree of a PREPARED
 * transaction.
 *
 * Simulation records every `require_auth` that code on the call stack makes
 * for the caller — including one made by a rogue pool or token inside a swap
 * hop, e.g. `any_token.transfer(caller, attacker, x)`. The wallet signature
 * covers the whole tree, so whatever `prepareTransaction` returns is what the
 * user authorizes. Each policy below is the set of sub-invocations the
 * contracts legitimately request from the caller, with the source that proves
 * it (paths are in the `rs-lending-xlm` repository):
 *
 * | Entrypoint | Caller sub-invocations | Source |
 * |---|---|---|
 * | controller `supply` | `asset.transfer(caller, pool, <= amount)` per asset | `contracts/controller/src/positions/supply.rs:118` |
 * | controller `repay` | `asset.transfer(caller, pool, <= amount)` per asset | `contracts/controller/src/positions/debt.rs:144` |
 * | controller `liquidate` | `asset.transfer(liquidator, pool, <= payment)` per asset | `contracts/controller/src/positions/liquidation/apply.rs:50` |
 * | controller `multiply` | `asset.transfer(caller, controller, <= initial_payment)` when present | `contracts/controller/src/strategies/multiply.rs:169` |
 * | controller `migrate_from_blend` | `blend_pool.submit(caller, controller, controller, [withdraw / withdraw_collateral / repay])`, at most twice | `contracts/controller/src/external/blend.rs:46-97` |
 * | controller `borrow`, `withdraw`, `swap_debt`, `swap_collateral`, `repay_debt_with_collateral`, `flash_loan`, `flash_position`, any other | none | the controller funds these from its own custody (`strategies/legs.rs:50`, `strategies/flash_position.rs:285`) |
 * | governance, any | none | proposer auth only |
 * | router `execute_strategy` | `token_in.transfer(sender, router, <= total_in)` | `contracts/swap-aggregator/src/execute/mod.rs:81` |
 */

import { Address, scValToBigInt, StrKey, xdr } from '@stellar/stellar-sdk'

import { getStellarDeployment, type StellarNetwork } from './contracts'
import { decodeStellarRouteBytes } from './route-verify'

export type StellarAuthPolicyErrorCode =
  | 'MALFORMED_TRANSACTION'
  | 'INVOCATION_CHANGED'
  | 'UNSUPPORTED_CONTRACT'
  | 'CALLER_MISMATCH'
  | 'DUPLICATE_ENTRY'
  | 'UNEXPECTED_ROOT'
  | 'UNEXPECTED_CALL'
  | 'NESTED_INVOCATION'
  | 'UNEXPECTED_TOKEN'
  | 'UNEXPECTED_SENDER'
  | 'UNEXPECTED_RECIPIENT'
  | 'AMOUNT_EXCEEDED'

/** The invocation that broke the policy, in readable form. */
export interface StellarAuthOffender {
  contract: string
  fn: string
  args: string[]
}

/** Thrown when the authorization tree holds anything the policy does not allow. */
export class StellarAuthPolicyError extends Error {
  readonly code: StellarAuthPolicyErrorCode
  readonly offender?: StellarAuthOffender

  constructor(code: StellarAuthPolicyErrorCode, message: string, offender?: StellarAuthOffender) {
    const where = offender
      ? ` — ${offender.contract}.${offender.fn}(${offender.args.join(', ')})`
      : ''
    super(`Stellar authorization check failed [${code}]: ${message}${where}`)
    this.name = 'StellarAuthPolicyError'
    this.code = code
    this.offender = offender
  }
}

/** Total the caller may send to `to` in `token` across all sub-invocations. */
export interface StellarAuthTransferAllowance {
  token: string
  to: string
  maxAmount: bigint
}

/** A non-transfer sub-invocation the caller legitimately authorizes. */
export interface StellarAuthCallAllowance {
  contract: string
  fn: string
  maxCount: number
  /** Returns why `args` are not acceptable, or `undefined` when they are. */
  reject: (args: xdr.ScVal[]) => string | undefined
}

export interface StellarAuthPolicy {
  caller: string
  root: { contract: string; fn: string }
  transfers: StellarAuthTransferAllowance[]
  calls?: StellarAuthCallAllowance[]
}

const addressOf = (value: xdr.ScVal | undefined): string | undefined =>
  value?.switch().name === 'scvAddress'
    ? Address.fromScAddress(value.address()).toString()
    : undefined

const i128Of = (value: xdr.ScVal | undefined): bigint | undefined =>
  value?.switch().name === 'scvI128' ? scValToBigInt(value) : undefined

const vecOf = (value: xdr.ScVal | undefined): xdr.ScVal[] | undefined =>
  value?.switch().name === 'scvVec' ? (value.vec() ?? []) : undefined

const fieldOf = (value: xdr.ScVal | undefined, name: string): xdr.ScVal | undefined =>
  value?.switch().name === 'scvMap'
    ? (value.map() ?? [])
        .find((e) => e.key().switch().name === 'scvSymbol' && e.key().sym().toString() === name)
        ?.val()
    : undefined

const describeArg = (value: xdr.ScVal): string =>
  addressOf(value) ?? i128Of(value)?.toString() ?? value.toXDR('base64')

const describe = (args: xdr.InvokeContractArgs): StellarAuthOffender => ({
  contract: Address.fromScAddress(args.contractAddress()).toString(),
  fn: args.functionName().toString(),
  args: args.args().map(describeArg),
})

const contractFnOf = (
  invocation: xdr.SorobanAuthorizedInvocation
): xdr.InvokeContractArgs | undefined => {
  const fn = invocation.function()
  return fn.switch().name === 'sorobanAuthorizedFunctionTypeContractFn'
    ? fn.contractFn()
    : undefined
}

/**
 * Enforce `policy` on the authorization entries of a prepared transaction.
 * Entries that belong to other addresses are ignored. For the caller: at most
 * one entry, the expected root, and only allowlisted leaf sub-invocations.
 * @param sourceAccount - Account that source-account credentials stand for
 * (the operation source, else the transaction source). When omitted, such
 * entries are treated as the caller's.
 * @throws StellarAuthPolicyError
 */
export function assertStellarAuthEntries(
  entries: readonly xdr.SorobanAuthorizationEntry[],
  policy: StellarAuthPolicy,
  sourceAccount?: string
): void {
  const mine = entries.filter((entry) => {
    const credentials = entry.credentials()
    const signer =
      credentials.switch().name === 'sorobanCredentialsAddress'
        ? Address.fromScAddress(credentials.address().address()).toString()
        : (sourceAccount ?? policy.caller)
    return signer === policy.caller
  })
  if (mine.length > 1) {
    throw new StellarAuthPolicyError(
      'DUPLICATE_ENTRY',
      `${mine.length} authorization entries for ${policy.caller}, expected one`
    )
  }
  const entry = mine[0]
  if (!entry) return

  const root = contractFnOf(entry.rootInvocation())
  if (!root) {
    throw new StellarAuthPolicyError('UNEXPECTED_ROOT', 'root is not a contract call')
  }
  const rootInfo = describe(root)
  if (rootInfo.contract !== policy.root.contract || rootInfo.fn !== policy.root.fn) {
    throw new StellarAuthPolicyError(
      'UNEXPECTED_ROOT',
      `expected ${policy.root.contract}.${policy.root.fn}`,
      rootInfo
    )
  }

  const spent = policy.transfers.map(() => 0n)
  const called = (policy.calls ?? []).map(() => 0)
  for (const child of entry.rootInvocation().subInvocations()) {
    const call = contractFnOf(child)
    if (!call) {
      throw new StellarAuthPolicyError('UNEXPECTED_CALL', 'sub-invocation is not a contract call')
    }
    const info = describe(call)
    if (child.subInvocations().length > 0) {
      throw new StellarAuthPolicyError(
        'NESTED_INVOCATION',
        'sub-invocation carries its own sub-invocations',
        info
      )
    }

    const allowedCall = (policy.calls ?? []).findIndex(
      (c) => c.contract === info.contract && c.fn === info.fn
    )
    if (allowedCall !== -1) {
      const allowance = (policy.calls ?? [])[allowedCall] as StellarAuthCallAllowance
      const reason = allowance.reject(call.args())
      if (reason) throw new StellarAuthPolicyError('UNEXPECTED_CALL', reason, info)
      called[allowedCall] = (called[allowedCall] ?? 0) + 1
      if ((called[allowedCall] ?? 0) > allowance.maxCount) {
        throw new StellarAuthPolicyError(
          'UNEXPECTED_CALL',
          `more than ${allowance.maxCount} calls`,
          info
        )
      }
      continue
    }

    if (info.fn !== 'transfer' || call.args().length !== 3) {
      throw new StellarAuthPolicyError('UNEXPECTED_CALL', 'only `transfer` is allowed', info)
    }
    if (!policy.transfers.some((t) => t.token === info.contract)) {
      throw new StellarAuthPolicyError('UNEXPECTED_TOKEN', 'transfer on an unexpected token', info)
    }
    const [from, to, amount] = call.args()
    if (addressOf(from) !== policy.caller) {
      throw new StellarAuthPolicyError('UNEXPECTED_SENDER', 'transfer is not from the caller', info)
    }
    const recipient = addressOf(to)
    const slot = policy.transfers.findIndex(
      (t) => t.token === info.contract && t.to === recipient
    )
    if (slot === -1) {
      throw new StellarAuthPolicyError(
        'UNEXPECTED_RECIPIENT',
        'transfer to an unexpected recipient',
        info
      )
    }
    const value = i128Of(amount)
    const allowance = policy.transfers[slot] as StellarAuthTransferAllowance
    const total = (spent[slot] ?? 0n) + (value ?? 0n)
    if (value === undefined || value <= 0n || total > allowance.maxAmount) {
      throw new StellarAuthPolicyError(
        'AMOUNT_EXCEEDED',
        `transfers total ${total}, above the expected ${allowance.maxAmount}`,
        info
      )
    }
    spent[slot] = total
  }
}

/** Contract addresses a policy is derived against. */
export interface StellarAuthDeployment {
  lendingController: string
  lendingPool: string
  aggregatorRouter: string
  governance: string
}

const malformed = (message: string): never => {
  throw new StellarAuthPolicyError('MALFORMED_TRANSACTION', message)
}

/** Sum `Vec<(HubAssetKey, i128)>` per token into transfer allowances to `to`. */
const hubPaymentAllowances = (
  value: xdr.ScVal | undefined,
  to: string
): StellarAuthTransferAllowance[] => {
  const totals = new Map<string, bigint>()
  for (const tuple of vecOf(value) ?? malformed('payments argument is not a vector')) {
    const [key, amount] = vecOf(tuple) ?? []
    const token = addressOf(fieldOf(key, 'asset'))
    const parsed = i128Of(amount)
    if (token === undefined || parsed === undefined || parsed < 0n) {
      return malformed('payment is not a (HubAssetKey, i128) tuple')
    }
    totals.set(token, (totals.get(token) ?? 0n) + parsed)
  }
  return [...totals].map(([token, maxAmount]) => ({ token, to, maxAmount }))
}

// Blend `submit` request types the controller sends (external/blend.rs:7-9).
const BLEND_MIGRATION_REQUEST_TYPES = new Set([1, 3, 5])

const blendSubmitAllowance = (
  blendPool: string,
  caller: string,
  controller: string
): StellarAuthCallAllowance => ({
  contract: blendPool,
  fn: 'submit',
  // One repay submit and one withdraw-all submit.
  maxCount: 2,
  reject: (args) => {
    if (args.length !== 4) return 'submit must have four arguments'
    if (addressOf(args[0]) !== caller) return '`from` is not the caller'
    if (addressOf(args[1]) !== controller || addressOf(args[2]) !== controller) {
      return '`spender` and `to` must be the lending controller'
    }
    const requests = vecOf(args[3])
    if (!requests) return 'requests is not a vector'
    for (const request of requests) {
      const type = fieldOf(request, 'request_type')
      if (
        type?.switch().name !== 'scvU32' ||
        !BLEND_MIGRATION_REQUEST_TYPES.has(type.u32())
      ) {
        return 'request is not a withdraw, withdraw-collateral, or repay'
      }
    }
    return undefined
  },
})

/**
 * Derive the policy for one contract invocation from its own arguments. The
 * arguments are what the application built from the user's intent, so the
 * allowed transfers are bounded by exactly what the user asked to pay.
 * @throws StellarAuthPolicyError for a contract outside `deployment`.
 */
export function stellarAuthPolicyForInvocation(
  caller: string,
  invocation: xdr.InvokeContractArgs,
  deployment: StellarAuthDeployment
): StellarAuthPolicy {
  const { contract, fn } = describe(invocation)
  const args = invocation.args()
  const policy: StellarAuthPolicy = { caller, root: { contract, fn }, transfers: [] }

  if (contract === deployment.governance) return policy

  if (contract === deployment.aggregatorRouter) {
    if (fn !== 'execute_strategy') return policy
    const totalIn = i128Of(args[1])
    if (addressOf(args[0]) !== caller || totalIn === undefined || args[2]?.switch().name !== 'scvBytes') {
      return malformed('execute_strategy arguments must be (caller, total_in, swap_xdr)')
    }
    const route = decodeStellarRouteBytes(args[2].bytes())
    policy.transfers = [{ token: route.tokenIn, to: contract, maxAmount: totalIn }]
    return policy
  }

  if (contract !== deployment.lendingController) {
    throw new StellarAuthPolicyError(
      'UNSUPPORTED_CONTRACT',
      `no authorization policy for contract ${contract}; pass an explicit policy`
    )
  }
  if (addressOf(args[0]) !== caller) {
    throw new StellarAuthPolicyError('CALLER_MISMATCH', `${fn} is not invoked for ${caller}`)
  }
  switch (fn) {
    case 'supply':
      policy.transfers = hubPaymentAllowances(args[3], deployment.lendingPool)
      break
    case 'repay':
    case 'liquidate':
      policy.transfers = hubPaymentAllowances(args[2], deployment.lendingPool)
      break
    case 'multiply': {
      // initial_payment: Option<(HubAssetKey, i128)> pays the controller.
      const payment = args[8]
      if (payment && payment.switch().name !== 'scvVoid') {
        policy.transfers = hubPaymentAllowances(xdr.ScVal.scvVec([payment]), contract)
      }
      break
    }
    case 'migrate_from_blend': {
      const blendPool = addressOf(args[4]) ?? malformed('blend_pool is not an address')
      policy.calls = [blendSubmitAllowance(blendPool, caller, contract)]
      break
    }
    default:
      break
  }
  return policy
}

const accountOf = (muxed: xdr.MuxedAccount): string =>
  StrKey.encodeEd25519PublicKey(
    muxed.switch().name === 'keyTypeMuxedEd25519' ? muxed.med25519().ed25519() : muxed.ed25519()
  )

const singleInvocation = (
  envelopeXdr: string
): { source: string; op: xdr.InvokeHostFunctionOp; call: xdr.InvokeContractArgs } => {
  let envelope: xdr.TransactionEnvelope
  try {
    envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, 'base64')
  } catch {
    return malformed('not a transaction envelope')
  }
  if (envelope.switch().name !== 'envelopeTypeTx') {
    return malformed('expected a regular (v1) transaction')
  }
  const tx = envelope.v1().tx()
  const operation = tx.operations()[0]
  if (!operation || tx.operations().length !== 1) {
    return malformed('expected exactly one operation')
  }
  const body = operation.body()
  if (body.switch().name !== 'invokeHostFunction') {
    return malformed('operation is not a contract invocation')
  }
  const op = body.invokeHostFunctionOp()
  if (op.hostFunction().switch().name !== 'hostFunctionTypeInvokeContract') {
    return malformed('host function is not a contract call')
  }
  return {
    source: accountOf(operation.sourceAccount() ?? tx.sourceAccount()),
    op,
    call: op.hostFunction().invokeContract(),
  }
}

export interface StellarPreparedTxAuthOptions {
  network: StellarNetwork
  /** The wallet address that will sign. */
  caller: string
  /**
   * The unsigned builder output that was sent to `prepareTransaction`. When
   * given, the prepared invocation must be byte-identical to it.
   */
  builtXdr?: string
  /** Replaces the derived policy (other contracts, custom flash receivers). */
  policy?: StellarAuthPolicy
  /** Overrides manifest addresses for a non-standard deployment. */
  deployment?: Partial<StellarAuthDeployment>
}

/**
 * Check a prepared transaction (base64 XDR, as `prepareTransaction` returns
 * it) before it is passed to a wallet. Takes XDR strings so no live SDK object
 * crosses the consumer's bundle boundary. Never sign when this throws.
 * @throws StellarAuthPolicyError | StellarRouteVerificationError
 */
export function assertStellarPreparedTxAuth(
  preparedXdr: string,
  opts: StellarPreparedTxAuthOptions
): void {
  const prepared = singleInvocation(preparedXdr)
  if (
    opts.builtXdr !== undefined &&
    singleInvocation(opts.builtXdr).op.hostFunction().toXDR('base64') !==
      prepared.op.hostFunction().toXDR('base64')
  ) {
    throw new StellarAuthPolicyError(
      'INVOCATION_CHANGED',
      'the prepared transaction does not invoke what was built',
      describe(prepared.call)
    )
  }
  const policy =
    opts.policy ??
    stellarAuthPolicyForInvocation(opts.caller, prepared.call, {
      ...getStellarDeployment(opts.network),
      ...opts.deployment,
    })
  assertStellarAuthEntries(prepared.op.auth(), policy, prepared.source)
}
