import { Account, Contract, TransactionBuilder, xdr } from '@stellar/stellar-sdk'

import { STELLAR_NETWORK_PASSPHRASE, type StellarNetwork } from './contracts'
import type { BuiltStellarTx, StellarBuilderOptions } from './lending'

const hexToBuffer = (hex: string): Buffer => {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  if (normalized.length % 2 !== 0) {
    throw new Error('buildStellarCctpForwardTx: hex input must have even length')
  }
  return Buffer.from(normalized, 'hex')
}

export interface BuildStellarCctpForwardTxArgs extends StellarBuilderOptions {
  forwarderAddress: string
  message: string
  attestation: string
  /** Default 10_000_000 stroops — CCTP mint_and_forward is resource-heavy. */
  fee?: string
  /** Default 120 seconds. */
  timeoutSeconds?: number
}

/**
 * Build an unsigned XDR for the Stellar CCTP forwarder `mint_and_forward`.
 */
export function buildStellarCctpForwardTx(
  opts: BuildStellarCctpForwardTxArgs
): BuiltStellarTx {
  const source = new Account(opts.caller, opts.sourceSequence)
  const operation = new Contract(opts.forwarderAddress).call(
    'mint_and_forward',
    xdr.ScVal.scvBytes(hexToBuffer(opts.message)),
    xdr.ScVal.scvBytes(hexToBuffer(opts.attestation))
  )

  const tx = new TransactionBuilder(source, {
    fee: opts.fee ?? '10000000',
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE[opts.network],
  })
    .addOperation(operation)
    .setTimeout(opts.timeoutSeconds ?? 120)
    .build()

  return { xdr: tx.toXDR() }
}

export type { StellarNetwork }