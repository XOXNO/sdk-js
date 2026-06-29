/**
 * The `./stellar-lending` subpath barrel (`src/sdk/stellar/index.ts`) must
 * re-export the transaction builders so consumers can
 * `import { buildStellarSupplyTx } from '@xoxno/sdk-js/stellar-lending'`.
 */

import {
  buildStellarSupplyTx,
  buildStellarBorrowTx,
  buildStellarMultiplyTx,
} from '../index'

describe('stellar-lending subpath barrel', () => {
  it('re-exports the lending builders', () => {
    expect(typeof buildStellarSupplyTx).toBe('function')
    expect(typeof buildStellarBorrowTx).toBe('function')
    expect(typeof buildStellarMultiplyTx).toBe('function')
  })
})
