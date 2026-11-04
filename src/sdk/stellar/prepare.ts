import { Address, Operation, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk'
import type { FeeBumpTransaction, Transaction } from '@stellar/stellar-sdk'

import type { BuiltStellarTx } from './lending'
import { STELLAR_NETWORK_PASSPHRASE, type StellarNetwork } from './contracts'
import { assertStellarPreparedTxAuth, type StellarPreparedTxAuthOptions } from './auth-policy'
import { xdrField, xdrType } from './xdr-compat'

export interface StellarAuthorizationContext {
  readonly networkPassphrase: string
  readonly latestLedger: number
}

export interface StellarAuthorizationOptions
  extends Pick<StellarPreparedTxAuthOptions, 'caller' | 'policy' | 'deployment'> {
  /**
   * Authorize one base64 SorobanAuthorizationEntry using the account's policy.
   * Return base64 with only signature and signatureExpirationLedger changed.
   * XDR strings keep wallet SDK instances outside this SDK's bundle boundary.
   */
  authorizeEntry(entryXdr: string, context: StellarAuthorizationContext): Promise<string>
}

/** Options for preparing unsigned XDR. The wallet must sign on this network. */
export interface StellarPrepareOptions {
  /** Selected Stellar network. Omission preserves the legacy unsigned-XDR API. */
  network?: StellarNetwork
  /** Contract used to qualify errors before mapping controller/pool error codes. */
  invokedContractId?: string
  /**
   * Extra CPU instructions requested from simulation (default 20,000,000).
   * Covers the measured ~11.84M instruction increase across a ledger boundary
   * for a ten-position accrual flow, with headroom.
   * Must be an integer from 0 to 4294967295. Increase for measured execution
   * variance; this margin does not guarantee coverage of later state changes
   * or maximum-position flows. The resulting resources must fit network limits.
   */
  instructionLeeway?: number
  /** Custom/address authorization. Requires network; validates policy before callbacks. */
  authorization?: StellarAuthorizationOptions
}

/** Custom adapters must forward authMode when address authorization is requested. */
export interface StellarTxPreparer {
  simulateTransaction(
    tx: Transaction | FeeBumpTransaction,
    resources?: { cpuInstructions?: number },
    authMode?: 'record' | 'enforce'
  ): Promise<rpc.Api.SimulateTransactionResponse>
}

export function tagStellarInvokedContractError(
  contractId: string,
  error: unknown
): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`[xoxno-invoked:${contractId}] ${message}`)
}

/**
 * Simulate a built Soroban envelope (footprint, auth, resource fee) and return
 * prepared base64 XDR. Optionally tag failures with the invoked contract id so
 * UIs can map `Error(Contract, #N)` codes to the right ABI.
 * @param server - Host application's RPC server on the selected network.
 * @param xdr - Unsigned builder output, not a signed transaction.
 * @param opts - Pass `network` explicitly; it must match the RPC and wallet.
 * @returns Prepared, unsigned base64 XDR for source signing. With authorization,
 * address signatures are attached and checked by a second, enforced simulation.
 * @remarks This helper does not sign, submit, or wait for confirmation. Existing
 * calls without `network` retain a neutral hash domain because XDR contains no
 * passphrase; always select the actual network when the wallet signs.
 * @category Transaction preparation
 */
export async function prepareStellarTxXdr(
  server: StellarTxPreparer,
  xdr: string,
  opts?: StellarPrepareOptions
): Promise<string> {
  const instructionLeeway = opts?.instructionLeeway ?? 20_000_000
  if (!Number.isInteger(instructionLeeway) || instructionLeeway < 0 || instructionLeeway > 0xffffffff) {
    throw new Error('instructionLeeway must be an integer from 0 to 4294967295')
  }
  const tx = TransactionBuilder.fromXDR(xdr, opts?.network
    ? STELLAR_NETWORK_PASSPHRASE[opts.network]
    : '')
  try {
    if (opts?.authorization) {
      if (!opts.network) throw new Error('network is required for address authorization')
      return await prepareAuthorizedTx(server, tx, opts.network, instructionLeeway, opts.authorization)
    }
    const simulation = await server.simulateTransaction(tx, { cpuInstructions: instructionLeeway })
    if (rpc.Api.isSimulationError(simulation)) throw new Error(simulation.error)
    return rpc.assembleTransaction(tx, simulation).build().toXDR()
  } catch (error) {
    if (opts?.invokedContractId) {
      throw tagStellarInvokedContractError(opts.invokedContractId, error)
    }
    throw error
  }
}

async function prepareAuthorizedTx(
  server: StellarTxPreparer,
  tx: Transaction | FeeBumpTransaction,
  network: StellarNetwork,
  instructionLeeway: number,
  authorization: StellarAuthorizationOptions
): Promise<string> {
  if ('innerTransaction' in tx || tx.signatures.length !== 0 || tx.operations.length !== 1) {
    throw new Error('address authorization requires an unsigned single-operation transaction')
  }
  const op = tx.operations[0]
  if (op.type !== 'invokeHostFunction') {
    throw new Error('address authorization requires a contract invocation')
  }
  // Always record fresh entries; quote envelopes may contain old placeholder nonces.
  const recording = TransactionBuilder.cloneFrom(tx)
    .clearOperations()
    .addOperation(Operation.invokeHostFunction({ ...op, auth: [] }))
    .build()
  const resources = { cpuInstructions: instructionLeeway }
  const simulation = await server.simulateTransaction(recording, resources, 'record')
  if (rpc.Api.isSimulationError(simulation)) throw new Error(simulation.error)
  const recorded = rpc.assembleTransaction(recording, simulation).build()
  assertStellarPreparedTxAuth(recorded.toXDR(), {
    ...authorization, network, builtXdr: tx.toXDR(),
  })
  const recordedOp = recorded.operations[0]
  if (recordedOp.type !== 'invokeHostFunction') {
    throw new Error('simulation changed the operation type')
  }
  const entries = recordedOp.auth ?? []
  // Check every signer before invoking any signing callback.
  for (const entry of entries) {
    const root = xdrField(xdrField(entry, 'rootInvocation'), 'function')
    if (xdrType(root) !== 'sorobanAuthorizedFunctionTypeContractFn' ||
      xdrField(root, 'contractFn').toXDR('base64') !==
        xdrField(recordedOp.func, 'invokeContract').toXDR('base64')) {
      throw new Error('recorded authorization root differs from the built invocation')
    }
    const credentials = xdrField(entry, 'credentials')
    const kind = xdrType(credentials)
    if (kind === 'sorobanCredentialsSourceAccount') continue
    if (kind !== 'sorobanCredentialsAddress' ||
      Address.fromScAddress(xdrField(xdrField(credentials, 'address'), 'address')).toString() !== authorization.caller) {
      throw new Error('unexpected signer in recorded address authorization')
    }
  }
  const signed: xdr.SorobanAuthorizationEntry[] = []
  const context = Object.freeze({
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE[network], latestLedger: simulation.latestLedger,
  })
  for (const entry of entries) {
    const credentials = xdrField(entry, 'credentials')
    if (xdrType(credentials) === 'sorobanCredentialsSourceAccount') {
      signed.push(entry)
      continue
    }
    const result = xdr.SorobanAuthorizationEntry.fromXDR(
      await authorization.authorizeEntry(entry.toXDR('base64'), context), 'base64'
    )
    const resultCredentials = xdrField(result, 'credentials')
    if (xdrType(resultCredentials) !== 'sorobanCredentialsAddress') {
      throw new Error('authorization callback changed the credentials type')
    }
    const before = xdrField(credentials, 'address')
    const after = xdrField(resultCredentials, 'address')
    if (xdrField(before, 'address').toXDR('base64') !== xdrField(after, 'address').toXDR('base64') ||
      xdrField(before, 'nonce').toString() !== xdrField(after, 'nonce').toString() ||
      xdrField(entry, 'rootInvocation').toXDR('base64') !== xdrField(result, 'rootInvocation').toXDR('base64')) {
      throw new Error('authorization callback changed the signer, nonce or invocation')
    }
    signed.push(result)
  }
  const authorized = TransactionBuilder.cloneFrom(recorded)
    .clearOperations()
    .addOperation(Operation.invokeHostFunction({ ...recordedOp, auth: signed }))
    .build()
  // Enforce, rather than record again: check signatures and include __check_auth resources.
  const enforced = await server.simulateTransaction(authorized, resources, 'enforce')
  if (rpc.Api.isSimulationError(enforced)) throw new Error(enforced.error)
  return rpc.assembleTransaction(authorized, enforced).build().toXDR()
}

/**
 * Prepare {@link BuiltStellarTx} before wallet signing.
 * @param server - Host RPC server for the selected deployment.
 * @param built - Unsigned output of any Stellar transaction builder.
 * @param opts - Network and optional contract context for error mapping.
 * @returns Prepared unsigned base64 XDR; sign this result, then submit it.
 * @category Transaction preparation
 */
export async function prepareStellarBuiltTx(
  server: StellarTxPreparer,
  built: BuiltStellarTx,
  opts?: StellarPrepareOptions
): Promise<string> {
  return prepareStellarTxXdr(server, built.xdr, opts)
}
