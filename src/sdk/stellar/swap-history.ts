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

const ROUTERS = {
  'Public Global Stellar Network ; September 2015': {
    xoxno: 'CCVENFSVCBYDHVOACFZXMNNYVOZ3LKXPZYU5LUI4N7KTXOKRVYD7F3TR',
    lifi: 'CDCNXZHYWRDHNAQEY5EX3WCF7BCWVJBS64ZBVUGRTQBFTHUKG6NAXFTR',
  },
  'Test SDF Network ; September 2015': {
    xoxno: 'CDNTWMWW2WGYTKIZTJYNGNVQQZI4KTC5BQRZ3275KESRX5T4O3AYECL5',
  },
}

export type SwapProvider = 'xoxno' | 'lifi'
export const getSwapRouter = (networkPassphrase: string, provider: SwapProvider): string | undefined =>
  (ROUTERS as Record<string, Partial<Record<SwapProvider, string>>>)[networkPassphrase]?.[provider]

export type SwapEnvelopeOptions = Omit<StellarSwapEnvelopeOptions, 'routerAddress'>
export type DecodedSwapEnvelope = DecodedStellarSwapEnvelope & { provider: SwapProvider }

/** Display identity only; signing policy belongs to the backend. Pinned deployments only. */
export function decodeSwapEnvelope(options: SwapEnvelopeOptions): DecodedSwapEnvelope | null {
  if (typeof options.envelopeXdr !== 'string' || options.envelopeXdr.length > 1024 * 1024 || options.envelopeXdr.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(options.envelopeXdr)) return null
  const routerAddress = getSwapRouter(options.networkPassphrase, 'xoxno')
  if (!routerAddress || !StrKey.isValidEd25519PublicKey(options.viewer)) return null
  if (options.operationIndex === undefined) {
    try {
      const parsed = TransactionBuilder.fromXDR(options.envelopeXdr, options.networkPassphrase)
      const tx = 'innerTransaction' in parsed ? parsed.innerTransaction : parsed
      let found: DecodedSwapEnvelope | null = null
      for (let index = 0; index < tx.operations.length; index++) {
        const match = decodeSwapEnvelope({ ...options, operationIndex: index })
        if (!match) continue
        if (found) return null
        found = match
      }
      return found
    } catch { return null }
  }
  const xoxno = decodeStellarSwapEnvelope({ ...options, routerAddress })
  if (xoxno) return { ...xoxno, provider: 'xoxno' }
  const lifiRouter = getSwapRouter(options.networkPassphrase, 'lifi')
  if (!lifiRouter) return null
  try {
    const parsed = TransactionBuilder.fromXDR(options.envelopeXdr, options.networkPassphrase)
    const tx = 'innerTransaction' in parsed ? parsed.innerTransaction : parsed
    const index = options.operationIndex
    if (index !== undefined && (!Number.isSafeInteger(index) || index < 0 || index >= tx.operations.length)) return null
    let found: DecodedSwapEnvelope | null = null
    for (const [operationIndex, op] of tx.operations.entries()) {
      if (index !== undefined && index !== operationIndex) continue
      if (op.type !== 'invokeHostFunction' || xdrType(op.func) !== 'hostFunctionTypeInvokeContract') continue
      const call = xdrField(op.func, 'invokeContract')
      if (Address.fromScAddress(xdrField(call, 'contractAddress')).toString() !== lifiRouter || xdrField(call, 'functionName').toString() !== 'swap') continue
      const args = xdrField(call, 'args')
      if (args.length !== 2 || xdrType(args[1]) !== 'scvAddress' || Address.fromScAddress(xdrField(args[1], 'address')).toString() !== options.viewer || xdrType(args[0]) !== 'scvMap') return null
      const entries = xdrField(args[0], 'map')
      const names = ['args', 'fees', 'interface', 'min_amount_out', 'token_in', 'token_out', 'tracking_id']
      if (!entries || entries.length !== names.length) return null
      const values = entries.map((entry, i) => {
        const key = xdrField(entry, 'key')
        if (xdrType(key) !== 'scvSymbol' || xdrField(key, 'sym').toString() !== names[i]) throw new Error('Invalid LI.FI fields')
        return xdrField(entry, 'val')
      })
      if (xdrType(values[2]) !== 'scvSymbol' || xdrField(values[2], 'sym').toString() !== 'soroswap_aggregator' || xdrType(values[0]) !== 'scvVec') return null
      const trade = xdrField(values[0], 'vec')
      if (!trade || trade.length !== 7 || xdrType(trade[2]) !== 'scvI128') return null
      const addr = (value: typeof args[number]) => {
        if (xdrType(value) !== 'scvAddress') throw new Error('Invalid address')
        return Address.fromScAddress(xdrField(value, 'address')).toString()
      }
      const tokenIn = addr(values[4]), tokenOut = addr(values[5])
      const amountIn = scValToBigInt(trade[2])
      if (!StrKey.isValidContract(tokenIn) || !StrKey.isValidContract(tokenOut) || tokenIn === tokenOut || addr(trade[0]) !== tokenIn || addr(trade[1]) !== tokenOut || addr(trade[5]) !== options.viewer || amountIn <= 0n || found) return null
      found = { tokenIn, tokenOut, amountInAtoms: amountIn.toString(), operationIndex, provider: 'lifi' }
    }
    return found
  } catch { return null }
}
