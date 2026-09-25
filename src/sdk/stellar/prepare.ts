import { TransactionBuilder, rpc } from '@stellar/stellar-sdk'
import type { FeeBumpTransaction, Transaction } from '@stellar/stellar-sdk'

import type { BuiltStellarTx } from './lending'
import { STELLAR_NETWORK_PASSPHRASE, type StellarNetwork } from './contracts'

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
}

/** The simulation capability the prepare helpers need from `rpc.Server`. */
export interface StellarTxPreparer {
  simulateTransaction(
    tx: Transaction | FeeBumpTransaction,
    resources?: { cpuInstructions?: number }
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
  const instructionLeeway = opts?.instructionLeeway ?? 20_000_000
  if (!Number.isInteger(instructionLeeway) || instructionLeeway < 0 || instructionLeeway > 0xffffffff) {
    throw new Error('instructionLeeway must be an integer from 0 to 4294967295')
  }
  const tx = TransactionBuilder.fromXDR(xdr, opts?.network
    ? STELLAR_NETWORK_PASSPHRASE[opts.network]
    : '')
  try {
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
