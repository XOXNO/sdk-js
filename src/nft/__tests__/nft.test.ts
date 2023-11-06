import NFTModule from '../index';
import XOXNOClient from '../../utils/api';
import { OrderByTradingActivity } from '../../types';

describe('NFTModule', () => {
  let nftModule: NFTModule;
  const inputIdentifier = 'BANANA-e955fd-01';
  const collection = 'BANANA-e955fd';
  const nonce = 1;
  const nonceHex = '01';
  beforeAll(() => {
    XOXNOClient.init();
    nftModule = new NFTModule();
  });

  beforeEach(async () => {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it('should return NFT data when given a valid identifier', async () => {
    const nftData = await nftModule.getNFTByIdentifier(inputIdentifier);
    expect(nftData).toBeDefined();
    expect(nftData.identifier).toEqual(inputIdentifier);
  });

  it('should return NFT data when given a valid collection and nonce', async () => {
    const nftData = await nftModule.getNFTByCollectionAndNonce(
      collection,
      nonce
    );
    expect(nftData).toBeDefined();
    expect(nftData.identifier).toEqual(inputIdentifier);
  });

  it('should return NFT data when given a valid collection and nonce as hex', async () => {
    const nftData = await nftModule.getNFTByCollectionAndNonceHex(
      collection,
      nonceHex
    );
    expect(nftData).toBeDefined();
    expect(nftData.identifier).toEqual(inputIdentifier);
  });

  it('should return empty NFT trading activity', async () => {
    const nftTradingActivity = await nftModule.getTradingActivity({
      identifiers: [inputIdentifier],
    });
    expect(nftTradingActivity).toBeDefined();
    expect(nftTradingActivity.empty).toEqual(true);
  });

  it('should return NFT trading activity', async () => {
    const nftTradingActivity = await nftModule.getTradingActivity({
      identifiers: ['BANANA-e955fd-05d9'],
      orderBy: [OrderByTradingActivity.OldestPlaced],
      top: 1,
    });
    expect(nftTradingActivity).toBeDefined();
    expect(nftTradingActivity.empty).toEqual(false);
    expect(nftTradingActivity.resources.length).toEqual(1);
    // expect(nftTradingActivity.resources[0]).toMatchObject({
    //   txHash:
    //     'f2cc0f9abbe6e18855cec144cecee5a6e7e0fdf2249a7e2b487935c4630aec3d',
    //   collection: 'BANANA-e955fd',
    //   identifier: 'BANANA-e955fd-05d9',
    //   timestamp: 1642523586,
    //   action: 'buy',
    //   price: 0.1,
    //   paymentToken: 'EGLD',
    //   buyer: 'erd1ecae8gpcsf5fk9na69my54c4t3dw27pdgk009huaj0ekjcp02u4qtw9e9d',
    //   seller: 'erd1kkp6kcs5qpmfmcs4vj4v07kq750anpdz579mh2962r2suum2hfjsfrdaav',
    //   usdPrice: 17.24,
    //   egldValue: 0.1,
    //   name: 'Banana #1497',
    //   url: 'https://media.elrond.com/nfts/asset/QmZzdYmNtQw5F8WGY4eFmyqcFcziPa73DMSypMJWTxRdqa/1337.png',
    //   avifUrl:
    //     'https://trustmarket.blob.core.windows.net/nftmedia/BANANA-e955fd/BANANA-e955fd-05d9.avif',
    //   webpUrl:
    //     'https://trustmarket.blob.core.windows.net/nftmedia/BANANA-e955fd/BANANA-e955fd-05d9.webp',
    //   rank: 480,
    //   marketplace: 'XO',
    //   id: '4505a7ae-eab9-4591-9f81-81671e63a9a3',
    //   _ts: 1677342781,
    //   sellerUsername: '@denysvicol',
    //   buyerUsername: '@stefanmorar',
    // });
  });
});
