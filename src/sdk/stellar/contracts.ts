/** Stellar network identifiers understood by the Soroban transaction builders. */
export type StellarNetwork = 'mainnet' | 'testnet'

/** Stable keys for the Stellar network deployment manifest. */
export type StellarNetworkId = 'stellarMainnet' | 'stellarTestnet'

/**
 * Public XOXNO Stellar deployment metadata.
 *
 * The API URL is deliberately absent: it belongs to `XOXNOClientOptions` and
 * may use a different host from the chain infrastructure. Consumers choose a
 * manifest entry by network and may pass its addresses/URLs to their own
 * transaction and RPC clients.
 */
export interface StellarDeployment {
  readonly name: StellarNetwork
  readonly passphrase: string
  readonly horizonUrl: string
  readonly sorobanRpcUrl: string
  readonly quoteUrl: string
  readonly explorerNetwork: 'public' | 'testnet'
  readonly aquariusApiUrl: string
  readonly aquariusRouter: string
  readonly lendingController: string
  /** The controller's single liquidity pool: the recipient of supply, repay and liquidation transfers. */
  readonly lendingPool: string
  readonly aggregatorRouter: string
  readonly governance: string
  readonly priceAggregator: string
  readonly positionNftContract: string
}

/**
 * XOXNO's supported Stellar deployments. Keep this table in the SDK so UI
 * and integrators use the same network, RPC, quote-server, and contract IDs.
 * It contains no environment or runtime discovery logic.
 */
export const STELLAR_NETWORKS = {
  stellarMainnet: {
    name: 'mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://stellar-gateway.xoxno.com',
    quoteUrl: 'https://stellar-swap.xoxno.com',
    explorerNetwork: 'public',
    aquariusApiUrl: 'https://amm-api.aqua.network',
    aquariusRouter: 'CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK',
    lendingController:
      'CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX',
    lendingPool: 'CBXRNDQMAJFG4VUKMKFEMFS75UUXE2SPSNV4LEEFCSNBCN66PYRWBKXO',
    aggregatorRouter:
      'CCVENFSVCBYDHVOACFZXMNNYVOZ3LKXPZYU5LUI4N7KTXOKRVYD7F3TR',
    governance: 'CC44PEQW7HSEPKAZ5ZRPH2JS5M5KVJXCUBLJ2ZX4E3WCDKMNFILHC2AD',
    priceAggregator: 'CBGUF2G2Q7HCVCWYISDXBHPVBGMYNXA7PG2VET66YBZX6IKOOV27NSMV',
    positionNftContract:
      'CAWCSG77AY2W24QZ6ZXLHZU4UXEFHZBM6EI4A4IF7JB5CTY4XND3TI6C',
  },
  stellarTestnet: {
    name: 'testnet',
    passphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://stellar-testnet-gateway.xoxno.com',
    quoteUrl: 'https://testnet-stellar-swap.xoxno.com',
    explorerNetwork: 'testnet',
    aquariusApiUrl: 'https://amm-api-testnet.aqua.network',
    aquariusRouter: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
    lendingController:
      'CCXRWJ6SIU2WPFEGLFGJVITPL57QAYIMIO6OAM2NBGNDQSSCK2FFV3F3',
    lendingPool: 'CBSGF6QOQAMPFBEVSYPEQHSZRIHJ6RCGUPCRDMUX36DEKRWFAO2PZB5A',
    aggregatorRouter:
      'CDNTWMWW2WGYTKIZTJYNGNVQQZI4KTC5BQRZ3275KESRX5T4O3AYECL5',
    governance: 'CDS33JDOYH3F3FL4QUQ6DV4WKHML2AKHF4LADTZ57FRUAEBTE7NMY5FQ',
    priceAggregator: 'CAALOOTIDXCX7D7FMQIBSSAJLPKOM3GMXS4UUSTDIG42JCRRJHOPUHOP',
    positionNftContract:
      'CDVN5JU675MEDPVRPCYC45AHFC275UH57WEU5OTFE4WFGZBNN7HTLPSY',
  },
} as const satisfies Record<StellarNetworkId, StellarDeployment>

/** Lowercase alias for consumers that prefer the UI's existing naming. */
export const stellarNetworks = STELLAR_NETWORKS

/** Resolve a deployment from the network name used by transaction builders. */
export function getStellarDeployment(
  network: StellarNetwork
): StellarDeployment {
  return STELLAR_NETWORKS[
    network === 'testnet' ? 'stellarTestnet' : 'stellarMainnet'
  ]
}

/**
 * Stellar network passphrases (Soroban tx signing domain separator).
 * These are fixed by the Stellar network itself and must not be overridden.
 */
export const STELLAR_NETWORK_PASSPHRASE = {
  mainnet: STELLAR_NETWORKS.stellarMainnet.passphrase,
  testnet: STELLAR_NETWORKS.stellarTestnet.passphrase,
} as const satisfies Record<StellarNetwork, string>
