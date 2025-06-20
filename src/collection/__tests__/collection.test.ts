import { CollectionModule, XOXNOClient } from '../../index'
import type { SearchNFTsResponse } from '../../types'
import { AuctionTypes, FieldsToSelect } from '../../types'

describe('CollectionModule', () => {
  let collectionModule: CollectionModule
  const inputCollection = 'BANANA-e955fd'
  const suiCollection =
    '0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins'
  beforeAll(() => {
    XOXNOClient.init()
    collectionModule = new CollectionModule()
  })

  beforeEach(async () => {
    return new Promise((resolve) => setTimeout(resolve, 1000))
  })

  test('getCollectionProfile should return the correct result', async () => {
    const collectionModule = new CollectionModule()
    const result = await collectionModule.getCollectionProfile(inputCollection)
    expect(result.collection).toEqual(inputCollection)
  })

  test('getCollectionProfiles should return the correct results', async () => {
    const collectionModule = new CollectionModule()
    const result = await collectionModule.getCollections()
    expect(result).toBeDefined()
    expect(result.results).toHaveLength(25)
  })

  it('should get the floor price of a collection', async () => {
    const floorPrice =
      await collectionModule.getCollectionFloorPrice(inputCollection)
    expect(floorPrice).toBeLessThan(1)
  })

  it('should get the collection attributes', async () => {
    const attributesInfo =
      await collectionModule.getCollectionAttributes(inputCollection)
    expect(attributesInfo).toMatchObject({
      Accessorie: {
        Dollars: {
          attributeOccurrence: 260,
        },
      },
    })
  })

  it('should get the collection trading activity', async () => {
    const tradingActivity = await collectionModule.getTradingActivity({
      collections: [inputCollection],
      top: 1,
    })
    expect(tradingActivity).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 1,
        collections: [inputCollection],
      },
    })

    const tradingActivitySecondPage = await collectionModule.getTradingActivity(
      tradingActivity.getNextPagePayload
    )
    expect(tradingActivitySecondPage).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 2,
        collections: [inputCollection],
      },
    })
  })

  it('should get fetch and filter NFTs from a collection', async () => {
    const nfts: SearchNFTsResponse = await collectionModule.getNFTs({
      collections: [inputCollection],
      onlyOnSale: true,
      auctionType: AuctionTypes.FixedPrice,
      top: 1,
      onlySelectFields: [
        FieldsToSelect.Attributes,
        FieldsToSelect.Name,
        FieldsToSelect.SaleInfo,
        FieldsToSelect.Rank,
        FieldsToSelect.Description,
        FieldsToSelect.Royalties,
        FieldsToSelect.Collection,
      ],
    })
    expect(nfts).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 1,
      },
    })

    const nftsSecondPage = await collectionModule.getNFTs(
      nfts.getNextPagePayload
    )
    expect(nftsSecondPage).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 2,
      },
    })
  })

  describe('SUI Collections', () => {
    it('should fetch SUI collection profile', async () => {
      const result = await collectionModule.getCollectionProfile(suiCollection)
      console.log(result)
      expect(result).toBeDefined()
      expect(result.collection).toEqual(suiCollection)
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('description')
    })

    it('should fetch SUI collection attributes', async () => {
      const attributesInfo =
        await collectionModule.getCollectionAttributes(suiCollection)
      console.log(attributesInfo)
      expect(attributesInfo).toBeDefined()
      expect(typeof attributesInfo).toBe('object')
    })

    it('should fetch SUI collection floor price', async () => {
      const floorPrice =
        await collectionModule.getCollectionFloorPrice(suiCollection)
      expect(floorPrice).toBeDefined()
      expect(floorPrice).toHaveProperty('price')
      expect(floorPrice).toHaveProperty('usdPrice')
      expect(typeof floorPrice.price).toBe('number')
      expect(typeof floorPrice.usdPrice).toBe('number')
    })

    it('should fetch NFTs from SUI collection', async () => {
      const nfts: SearchNFTsResponse = await collectionModule.getNFTs({
        collections: [suiCollection],
        auctionType: AuctionTypes.FixedPrice,
        top: 1,
        onlySelectFields: [
          FieldsToSelect.Name,
          FieldsToSelect.Collection,
          FieldsToSelect.Identifier,
        ],
      })
      expect(nfts).toBeDefined()
      expect(nfts.resources).toBeDefined()
      expect(nfts).toHaveProperty('getNextPagePayload')
      expect(nfts.getNextPagePayload.collections).toContain(suiCollection)
    })

    it('should validate SUI collection ticker before API calls', async () => {
      const invalidSuiCollection = '0xinvalid::module::Type'

      await expect(
        collectionModule.getCollectionProfile(invalidSuiCollection)
      ).rejects.toThrow('Invalid collection ticker')

      await expect(
        collectionModule.getCollectionAttributes(invalidSuiCollection)
      ).rejects.toThrow('Invalid collection ticker')

      await expect(
        collectionModule.getCollectionFloorPrice(invalidSuiCollection)
      ).rejects.toThrow('Invalid collection ticker')
    })

    it('should handle SUI collection trading activity', async () => {
      const tradingActivity = await collectionModule.getTradingActivity({
        collections: [suiCollection],
        top: 1,
      })
      expect(tradingActivity).toBeDefined()
      expect(tradingActivity).toHaveProperty('getNextPagePayload')
      expect(tradingActivity.getNextPagePayload.collections).toContain(
        suiCollection
      )
    })
  })
})
