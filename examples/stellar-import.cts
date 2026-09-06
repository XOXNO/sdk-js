// CommonJS consumer resolution must reach the declarations shipped for require().
import { XOXNOClient, stellarLendingRead, buildStellarSupplyTx } from '@xoxno/sdk-js/stellar-lending'
export const read = stellarLendingRead(new XOXNOClient({ apiUrl: 'https://api.example.com' }))
export const buildSupply = buildStellarSupplyTx
