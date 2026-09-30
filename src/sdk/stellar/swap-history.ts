import { Address, scValToBigInt, StrKey, TransactionBuilder } from '@stellar/stellar-sdk'

import { decodeStellarRouteBytes } from './route-verify'
import { xdrBytes, xdrField, xdrType } from './xdr-compat'

export interface StellarSwapEnvelopeOptions {
  envelopeXdr: string
  networkPassphrase: string
  /** Router pinned by the application for this network. */
  routerAddress: string
  /** Only swaps whose encoded sender equals this address are returned. */
  viewer: string
  /** Zero-based operation index in the inner transaction. */
  operationIndex?: number
}

export interface DecodedStellarSwapEnvelope {
  tokenIn: string
  tokenOut: string
  /** Exact positive input in base units; never converted to a JS number. */
  amountInAtoms: string
  operationIndex: number
}

/**
 * Synchronously decode direct XOXNO router swaps, including fee-bump envelopes.
 * Returns null for malformed, unrelated or ambiguous envelopes. Without an
 * operation index exactly one matching swap is required. No RPC or output
 * amount inference: the route minimum is not the amount actually received.
 * The network passphrase parses the envelope; it cannot prove its network.
 */
export function decodeStellarSwapEnvelope(
  options: StellarSwapEnvelopeOptions
): DecodedStellarSwapEnvelope | null {
  try {
    const { envelopeXdr, networkPassphrase, routerAddress, viewer, operationIndex } = options
    if (
      !networkPassphrase || !StrKey.isValidContract(routerAddress) ||
      new Address(viewer).toString() !== viewer ||
      typeof envelopeXdr !== 'string' || envelopeXdr.length > 1024 * 1024 ||
      envelopeXdr.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelopeXdr) ||
      (operationIndex !== undefined && (!Number.isSafeInteger(operationIndex) || operationIndex < 0))
    ) return null

    const parsed = TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase)
    const tx = 'innerTransaction' in parsed ? parsed.innerTransaction : parsed
    if (operationIndex !== undefined && operationIndex >= tx.operations.length) return null
    let found: DecodedStellarSwapEnvelope | null = null
    for (const [index, operation] of tx.operations.entries()) {
      if (operationIndex !== undefined && index !== operationIndex) continue
      if (operation.type !== 'invokeHostFunction') continue
      const host = operation.func
      if (xdrType(host) !== 'hostFunctionTypeInvokeContract') continue
      const call = xdrField(host, 'invokeContract')
      if (
        Address.fromScAddress(xdrField(call, 'contractAddress')).toString() !== routerAddress ||
        xdrField(call, 'functionName').toString() !== 'execute_strategy'
      ) continue
      const args = xdrField(call, 'args')
      const [sender, amount, routeBytes] = args
      if (
        args.length !== 3 || !sender || !amount || !routeBytes ||
        xdrType(sender) !== 'scvAddress' || xdrType(amount) !== 'scvI128' ||
        xdrType(routeBytes) !== 'scvBytes'
      ) return null
      if (Address.fromScAddress(xdrField(sender, 'address')).toString() !== viewer) continue
      // Read i128 with the SDK's own conversion, preserving values above 2^53.
      const amountIn = scValToBigInt(amount)
      if (amountIn <= 0n) return null
      const route = decodeStellarRouteBytes(xdrBytes(routeBytes))
      if (route.tokenIn === route.tokenOut || !StrKey.isValidContract(route.tokenIn) || !StrKey.isValidContract(route.tokenOut)) return null
      if (found) return null
      found = { tokenIn: route.tokenIn, tokenOut: route.tokenOut, amountInAtoms: amountIn.toString(), operationIndex: index }
    }
    return found
  } catch {
    return null
  }
}
