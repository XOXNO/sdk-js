/** Pins the identifier shapes the SDK accepts, per chain. */

import { isValidCollectionTicker, isValidNftIdentifier } from '../regex'

const STELLAR_NFT = 'CDVN5JU675MEDPVRPCYC45AHFC275UH57WEU5OTFE4WFGZBNN7HTLPSY'

describe('isValidCollectionTicker', () => {
  it('accepts MVX tickers', () => {
    expect(isValidCollectionTicker('XLEND-18dc6f')).toBe(true)
  })

  it('accepts Stellar contract strkeys (collection == NFT contract)', () => {
    expect(isValidCollectionTicker(STELLAR_NFT)).toBe(true)
  })

  it('rejects G-account strkeys and junk', () => {
    expect(
      isValidCollectionTicker(
        'GDBBOILYIJBSUQKC3Z3USAW3DGPFHIGVKYA5T4ZUZBO56HBUPHJEN3FV'
      )
    ).toBe(false)
    expect(isValidCollectionTicker('not-a-ticker!')).toBe(false)
  })
})

describe('isValidNftIdentifier', () => {
  it('accepts MVX identifiers', () => {
    expect(isValidNftIdentifier('XLEND-18dc6f-2a')).toBe(true)
  })

  it('accepts Stellar `{contract}-{decimal id}` identifiers', () => {
    expect(isValidNftIdentifier(`${STELLAR_NFT}-1`)).toBe(true)
    expect(isValidNftIdentifier(`${STELLAR_NFT}-4294967295`)).toBe(true)
  })

  it('rejects Stellar ids with hex or missing token id', () => {
    expect(isValidNftIdentifier(`${STELLAR_NFT}-2a`)).toBe(false)
    expect(isValidNftIdentifier(STELLAR_NFT)).toBe(false)
  })
})
