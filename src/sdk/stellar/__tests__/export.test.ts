/**
 * The `./stellar-lending` subpath barrel (`src/sdk/stellar/index.ts`) must
 * re-export the transaction builders so consumers can
 * `import { buildStellarSupplyTx } from '@xoxno/sdk-js/stellar-lending'`.
 */

import {
  buildStellarSupplyTx,
  buildStellarBorrowTx,
  buildStellarMultiplyTx,
  getStellarDeployment,
  STELLAR_NETWORKS,
} from '../index'

describe('stellar-lending subpath barrel', () => {
  it('re-exports the lending builders', () => {
    expect(typeof buildStellarSupplyTx).toBe('function')
    expect(typeof buildStellarBorrowTx).toBe('function')
    expect(typeof buildStellarMultiplyTx).toBe('function')
  })

  it('re-exports the canonical Stellar deployment manifest', () => {
    expect(STELLAR_NETWORKS.stellarMainnet.name).toBe('mainnet')
    expect(STELLAR_NETWORKS.stellarTestnet.name).toBe('testnet')
    expect(STELLAR_NETWORKS.stellarMainnet.lendingController).toMatch(/^C[A-Z2-7]{55}$/)
    expect(getStellarDeployment('testnet')).toBe(STELLAR_NETWORKS.stellarTestnet)
  })
})
