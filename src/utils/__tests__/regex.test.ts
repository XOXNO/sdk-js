import { isValidCollectionTicker } from '../regex'

describe('isValidCollectionTicker', () => {
  describe('SUI Collections', () => {
    test('should return true for valid SUI collection ticker', () => {
      const ticker = '0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return true for SUI collection with generics', () => {
      const ticker = '0x123::module::Type<u64>'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return true for SUI collection with minimal hex', () => {
      const ticker = '0xa::module::Type'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return true for SUI collection with max length hex', () => {
      const ticker = '0x' + 'a'.repeat(64) + '::module::Type'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return false for SUI collection with invalid hex (too long)', () => {
      const ticker = '0x' + 'a'.repeat(65) + '::module::Type'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for SUI collection missing 0x prefix', () => {
      const ticker = 'b908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for SUI collection with invalid characters in hex', () => {
      const ticker = '0xg908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for SUI collection with missing module', () => {
      const ticker = '0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::Popkins'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for SUI collection with invalid module characters', () => {
      const ticker = '0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins-nft::Popkins'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })
  })

  describe('XOXNO Collections', () => {
    test('should return true for valid XOXNO collection ticker', () => {
      const ticker = 'EAPES-8f3c1f'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return true for XOXNO collection with minimum length', () => {
      const ticker = 'ABC-123abc'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return true for XOXNO collection with maximum length', () => {
      const ticker = 'ABCD123456-123abc'
      expect(isValidCollectionTicker(ticker)).toBe(true)
    })

    test('should return false for XOXNO collection with too short prefix', () => {
      const ticker = 'AB-123abc'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with too long prefix', () => {
      const ticker = 'ABCD1234567-123abc'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with invalid suffix length', () => {
      const ticker = 'EAPES-8f3c1'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with invalid suffix length (too long)', () => {
      const ticker = 'EAPES-8f3c1f7'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with lowercase prefix', () => {
      const ticker = 'eapes-8f3c1f'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with uppercase suffix', () => {
      const ticker = 'EAPES-8F3C1F'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with invalid characters in prefix', () => {
      const ticker = 'EA-PES-8f3c1f'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })

    test('should return false for XOXNO collection with invalid characters in suffix', () => {
      const ticker = 'EAPES-8f3c1!'
      expect(isValidCollectionTicker(ticker)).toBe(false)
    })
  })

  describe('Invalid formats', () => {
    test('should return false for empty string', () => {
      expect(isValidCollectionTicker('')).toBe(false)
    })

    test('should return false for random string', () => {
      expect(isValidCollectionTicker('random-string')).toBe(false)
    })

    test('should return false for partial SUI format', () => {
      expect(isValidCollectionTicker('0x123::')).toBe(false)
    })

    test('should return false for partial XOXNO format', () => {
      expect(isValidCollectionTicker('EAPES-')).toBe(false)
    })
  })
})