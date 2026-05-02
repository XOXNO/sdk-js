/**
 * Stellar Soroban contract addresses + Soroban RPC + quote-server config
 * per network.
 *
 * Addresses are env-sourced so ops can rotate mainnet/testnet deployments
 * without a code change. Defaults fall back to empty strings so a missing
 * env surfaces as a clear "not configured" error at call time rather than
 * silently pointing at the wrong contract.
 */

export type StellarNetwork = 'mainnet' | 'testnet'

/**
 * Stellar lending controller contract addresses per network.
 * Env vars:
 *   - STELLAR_LENDING_CONTROLLER_MAINNET
 *   - STELLAR_LENDING_CONTROLLER_TESTNET
 */
export const STELLAR_LENDING_CONTROLLER: Record<StellarNetwork, string> = {
  mainnet: process.env.STELLAR_LENDING_CONTROLLER_MAINNET ?? '',
  testnet: process.env.STELLAR_LENDING_CONTROLLER_TESTNET ?? '',
}

/**
 * Stellar aggregator router contract addresses per network.
 * Targets `batch_execute(BatchSwap)` for direct (non-lending) swaps.
 * Env vars:
 *   - STELLAR_AGGREGATOR_ROUTER_MAINNET
 *   - STELLAR_AGGREGATOR_ROUTER_TESTNET
 */
export const STELLAR_AGGREGATOR_ROUTER: Record<StellarNetwork, string> = {
  mainnet: process.env.STELLAR_AGGREGATOR_ROUTER_MAINNET ?? '',
  testnet:
    process.env.STELLAR_AGGREGATOR_ROUTER_TESTNET ??
    'CDH6RRN5P6KUAMMTR3TKSX36PZTHMOIG3M3WWEGU2G5GSSSEAYTRU4OK',
}

/**
 * Default Soroban RPC URLs per network.
 * Overridable at runtime via the `sorobanRpcUrl` option on each builder.
 */
export const STELLAR_SOROBAN_RPC_URL: Record<StellarNetwork, string> = {
  mainnet: 'https://soroban-rpc.stellar.org',
  testnet: 'https://soroban-testnet.stellar.org',
}

/**
 * Stellar aggregator quote-server base URLs per network. The quote server
 * exposes `GET /api/v1/tokens` and `GET /api/v1/quote`.
 *
 * Env vars:
 *   - STELLAR_QUOTE_URL_MAINNET
 *   - STELLAR_QUOTE_URL_TESTNET
 */
export const STELLAR_QUOTE_URL: Record<StellarNetwork, string> = {
  mainnet:
    process.env.STELLAR_QUOTE_URL_MAINNET ??
    'https://stellar-swap.xoxno.com',
  testnet:
    process.env.STELLAR_QUOTE_URL_TESTNET ??
    'https://testnet-stellar-swap.xoxno.com',
}

/**
 * Stellar network passphrases (Soroban tx signing domain separator).
 * These are fixed by the Stellar network itself and must not be overridden.
 */
export const STELLAR_NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
}

/**
 * Assert a controller address is configured for the target network.
 * Throws early with a clear message rather than building an XDR that
 * points at `""`.
 */
export function getStellarLendingController(network: StellarNetwork): string {
  const addr = STELLAR_LENDING_CONTROLLER[network]
  if (!addr) {
    throw new Error(
      `Stellar lending controller address not configured for network "${network}". ` +
        `Set STELLAR_LENDING_CONTROLLER_${network.toUpperCase()} env var.`
    )
  }
  return addr
}

/**
 * Assert an aggregator router address is configured for the target network.
 * Used by `buildStellarBatchSwapTx` for direct user→router swaps.
 */
export function getStellarAggregatorRouter(network: StellarNetwork): string {
  const addr = STELLAR_AGGREGATOR_ROUTER[network]
  if (!addr) {
    throw new Error(
      `Stellar aggregator router address not configured for network "${network}". ` +
        `Set STELLAR_AGGREGATOR_ROUTER_${network.toUpperCase()} env var.`
    )
  }
  return addr
}
