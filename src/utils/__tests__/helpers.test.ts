import { isAddressValid } from '../helpers'

const MVX = 'erd1ehn327d7ff56jnn8gdm050f5s68rp32tvj5r4k5du728rnz2c55s4xz9m5'
const EVM = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const SOL = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const STELLAR_ACCOUNT =
  'GB6UDJGEBWFPN3OSL5SVXNKP4277ROCGTISGGVL5SORG5ZXT2GWNLIDC'
const STELLAR_CONTRACT =
  'CBDH4YFFZGFNFC7MK7HFTOVPKZWJ5HZESA5TPQINP2UOSJ2BU3KG5S53'

describe('isAddressValid', () => {
  it('accepts an MVX bech32 address', () => {
    expect(isAddressValid(MVX)).toBe(true)
  })

  it('accepts an EVM address', () => {
    expect(isAddressValid(EVM)).toBe(true)
  })

  it('accepts a Solana address', () => {
    expect(isAddressValid(SOL)).toBe(true)
  })

  it('accepts a Stellar ed25519 account (G-strkey)', () => {
    expect(isAddressValid(STELLAR_ACCOUNT)).toBe(true)
  })

  // Regression: the Stellar branch was `^G[A-Z2-7]{55}$`, so every Soroban
  // contract strkey was rejected before the request was made. Because the
  // route builder validates any `:address` param through this helper, that
  // turned every contract-account endpoint (`/user/:address/profile`, ...)
  // into a thrown `InvalidAddressError`, even though the API serves them.
  it('accepts a Stellar contract account (C-strkey)', () => {
    expect(isAddressValid(STELLAR_CONTRACT)).toBe(true)
  })

  it('rejects a Stellar strkey of the wrong length', () => {
    expect(isAddressValid(STELLAR_CONTRACT.slice(0, -1))).toBe(false)
    expect(isAddressValid(`${STELLAR_ACCOUNT}A`)).toBe(false)
  })

  it('rejects other strkey prefixes (muxed, seed, signed payload)', () => {
    for (const prefix of ['M', 'S', 'P']) {
      expect(isAddressValid(`${prefix}${STELLAR_ACCOUNT.slice(1)}`)).toBe(false)
    }
  })

  it('rejects an empty or malformed address', () => {
    expect(isAddressValid('')).toBe(false)
    expect(isAddressValid('not-an-address')).toBe(false)
  })
})
