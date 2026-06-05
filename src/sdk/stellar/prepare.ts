import { TransactionBuilder } from '@stellar/stellar-sdk'
import type { rpc } from '@stellar/stellar-sdk'

import type { BuiltStellarTx } from './lending'

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
 */
export async function prepareStellarTxXdr(
  server: Pick<rpc.Server, 'prepareTransaction'>,
  xdr: string,
  opts?: { invokedContractId?: string }
): Promise<string> {
  const tx = TransactionBuilder.fromXDR(xdr, 'base64')
  try {
    return (await server.prepareTransaction(tx)).toXDR()
  } catch (error) {
    if (opts?.invokedContractId) {
      throw tagStellarInvokedContractError(opts.invokedContractId, error)
    }
    throw error
  }
}

export async function prepareStellarBuiltTx(
  server: Pick<rpc.Server, 'prepareTransaction'>,
  built: BuiltStellarTx,
  opts?: { invokedContractId?: string }
): Promise<string> {
  return prepareStellarTxXdr(server, built.xdr, opts)
}