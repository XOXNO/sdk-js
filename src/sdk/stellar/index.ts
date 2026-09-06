/**
 * Typed Stellar lending reads and unsigned Soroban transaction builders.
 * Start with {@link stellarLendingRead}, then {@link buildStellarSupplyTx}
 * and {@link prepareStellarBuiltTx}. The host wallet signs prepared XDR.
 * @module Stellar lending
 */
export { XOXNOClient } from '../../utils/api'
export type { OurRequestInit, XOXNOClientOptions } from '../../utils/api'
export * from './contracts'
export * from './lending'
export * from './lending-read'
export * from './admin'
export * from './governance'
export * from './events'
export * from './quote'
export * from './swap'
export * from './prepare'
export * from './position-mode'
export * from './repay-swap'
export * from './cctp'
// Aggregator swap-input types live in scval-encode; re-export at the root so
// consumers (xoxno-ui) can import them from '@xoxno/sdk-js'. Targeted to avoid
// the duplicate `StellarSwapStepsInput` that a full `export *` would clash on.
export type {
  StellarStrategySwapInput,
  StellarStrategySwapPathInput,
  StellarStrategySwapHopInput,
} from './scval-encode'

// Soroban error mapper; re-export at the stellar subpath so consumers can
// import from '@xoxno/sdk-js/stellar-lending' when decoding contract errors.
export { mapSorobanError } from '../../utils/soroban-errors'
