/**
 * Stellar lending controller contract addresses + Soroban RPC config per network.
 *
 * Addresses are env-sourced so ops can rotate mainnet/testnet deployments without
 * a code change. Defaults fall back to empty string so a missing env surfaces as a
 * clear "controller address not configured" error at builder call time rather than
 * silently pointing at the wrong contract.
 */

export type StellarNetwork = 'mainnet' | 'testnet'

/**
 * Stellar controller contract addresses per network.
 * Env vars:
 *   - STELLAR_LENDING_CONTROLLER_MAINNET
 *   - STELLAR_LENDING_CONTROLLER_TESTNET
 */
export const STELLAR_LENDING_CONTROLLER: Record<StellarNetwork, string> = {
  mainnet: process.env.STELLAR_LENDING_CONTROLLER_MAINNET ?? '',
  testnet: process.env.STELLAR_LENDING_CONTROLLER_TESTNET ?? '',
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
 * Stellar network passphrases (Soroban tx signing domain separator).
 * These are fixed by the Stellar network itself and must not be overridden.
 */
export const STELLAR_NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
}

/**
 * Assert a controller address is configured for the target network.
 * Throws early with a clear message rather than building an XDR that points at `""`.
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
