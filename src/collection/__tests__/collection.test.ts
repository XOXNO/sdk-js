import { CollectionModule } from './../index';
import { APIClient } from '../../utils/api';
import { CollectionsFieldsToSelect, FieldsToSelect } from '../../types';

describe('CollectionModule', () => {
  let collectionModule: CollectionModule;
  const inputCollection = 'BANANA-e955fd';
  beforeAll(() => {
    APIClient.init('https://proxy-api.xoxno.com', '');
    collectionModule = new CollectionModule();
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
    const floorPrice = await collectionModule.getCollectionFloorPrice(
      inputCollection
    );
    expect(floorPrice).toBeLessThan(1);
  });

  it('should get the collection attributes', async () => {
    const attributesInfo = await collectionModule.getCollectionAttributes(
      inputCollection
    );
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
    const nfts = await collectionModule.searchNFTs({
      collection: inputCollection,
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
        collection: inputCollection,
        onlyOnSale: true,
      },
    });

    const nftsSecondPage = await collectionModule.searchNFTs(
      nfts.getNextPagePayload
    );
    expect(nftsSecondPage).toMatchObject({
      getNextPagePayload: {
        top: 1,
        skip: 2,
        collection: inputCollection,
        onlyOnSale: true,
      },
    });
  });
});
