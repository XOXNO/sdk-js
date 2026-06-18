import { TransactionBuilder } from '@stellar/stellar-sdk'
import type { FeeBumpTransaction, Transaction } from '@stellar/stellar-sdk'

import type { BuiltStellarTx } from './lending'

/**
 * The single `rpc.Server` capability the prepare helpers need. Declared
 * structurally instead of `Pick<rpc.Server, 'prepareTransaction'>` so the
 * published `.d.ts` references stellar-sdk's concrete `Transaction` exports
 * rather than its `rpc` namespace — the namespaced form trips
 * `dts-bundle-generator`'s external-type resolution under stellar-sdk v16. A
 * real `rpc.Server` satisfies this structurally, so call sites are unchanged.
 */
export interface StellarTxPreparer {
  prepareTransaction(tx: Transaction | FeeBumpTransaction): Promise<Transaction>
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
 */
export async function prepareStellarTxXdr(
  server: StellarTxPreparer,
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
  server: StellarTxPreparer,
  built: BuiltStellarTx,
  opts?: { invokedContractId?: string }
): Promise<string> {
  return prepareStellarTxXdr(server, built.xdr, opts)
}