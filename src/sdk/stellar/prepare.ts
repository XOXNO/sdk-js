import { TransactionBuilder } from '@stellar/stellar-sdk'
import type { FeeBumpTransaction, Transaction } from '@stellar/stellar-sdk'

import type { BuiltStellarTx } from './lending'
import { STELLAR_NETWORK_PASSPHRASE, type StellarNetwork } from './contracts'

/** Options for preparing unsigned XDR. The wallet must sign on this network. */
export interface StellarPrepareOptions {
  /** Selected Stellar network. Omission preserves the legacy unsigned-XDR API. */
  network?: StellarNetwork
  /** Contract used to qualify errors before mapping controller/pool error codes. */
  invokedContractId?: string
}

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
 * @param server - Host application's RPC server on the selected network.
 * @param xdr - Unsigned builder output, not a signed transaction.
 * @param opts - Pass `network` explicitly; it must match the RPC and wallet.
 * @returns Prepared, unsigned base64 XDR for wallet signing.
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
  const tx = TransactionBuilder.fromXDR(xdr, opts?.network
    ? STELLAR_NETWORK_PASSPHRASE[opts.network]
    : '')
  try {
    return (await server.prepareTransaction(tx)).toXDR()
  } catch (error) {
    if (opts?.invokedContractId) {
      throw tagStellarInvokedContractError(opts.invokedContractId, error)
    }
    throw error
  }
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
