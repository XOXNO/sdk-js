import { CollectionModule, XOXNOClient } from '../../index';
import { AssetCategory, FieldsToSelect, SearchNFTsResponse } from '../../types';

describe('CollectionModule', () => {
  let collectionModule: CollectionModule;
  const inputCollection = 'BANANA-e955fd';
  beforeAll(() => {
    XOXNOClient.init();
    collectionModule = new CollectionModule();
  });

  beforeEach(async () => {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  });

  test('getCollectionProfile should return the correct result', async () => {
    const collectionModule = new CollectionModule();
    const result = await collectionModule.getCollectionProfile(inputCollection);
    expect(result.collection).toEqual(inputCollection);
  });

  test('getCollectionProfiles should return the correct results', async () => {
    const collectionModule = new CollectionModule();
    const result = await collectionModule.getCollections();
    expect(result).toBeDefined();
    expect(result.results).toHaveLength(25);
  });

  it('should get the floor price of a collection', async () => {
    const floorPrice =
      await collectionModule.getCollectionFloorPrice(inputCollection);
    expect(floorPrice).toBeLessThan(1);
  });

  it('should get the collection attributes', async () => {
    const attributesInfo =
      await collectionModule.getCollectionAttributes(inputCollection);
    expect(attributesInfo).toMatchObject({
      Accessorie: {
        Dollars: {
          attributeOccurrence: 260,
        },
      },
    });
  });

  it('should get the collection trading activity', async () => {
    const tradingActivity = await collectionModule.getTradingActivity({
      collections: [inputCollection],
      top: 1,
    });
    expect(tradingActivity).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 1,
        collections: [inputCollection],
      },
    });

    const tradingActivitySecondPage = await collectionModule.getTradingActivity(
      tradingActivity.getNextPagePayload
    );
    expect(tradingActivitySecondPage).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 2,
        collections: [inputCollection],
      },
    });
  });

  it('should get fetch and filter NFTs from a collection', async () => {
    const nfts: SearchNFTsResponse = await collectionModule.getNFTs({
      collections: [inputCollection],
      onlyOnSale: true,
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
    });
    expect(nfts).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 1,
      },
    });

    const nftsSecondPage = await collectionModule.getNFTs(
      nfts.getNextPagePayload
    );
    expect(nftsSecondPage).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 2,
      },
    });
  });

  it('should get all tokens', async () => {
    const tokens = await collectionModule.getFungibleTokens();

    expect(tokens['EUR']).toBeDefined();
  });

  it('should get all tokens only for minting and staking', async () => {
    const tokens = await collectionModule.getFungibleTokens([
      AssetCategory.Minting,
      AssetCategory.Staking,
    ]);
    expect(tokens).toBeDefined();
  });

  it('should get only RIDE asset info', async () => {
    const token = await collectionModule.getFungibleToken('RIDE-7d18e9');

    expect(token).toBeDefined();
  });
});
