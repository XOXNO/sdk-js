import SCInteraction from '../index';
import XOXNOClient from '../../utils/api';

describe('SCInteraction', () => {
  let sc: SCInteraction;
  beforeAll(async () => {
    XOXNOClient.init();
    sc = await SCInteraction.create();
  });

  beforeEach(async () => {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it('should return the XOXNO marketplace cut fees from SC', async () => {
    const fees = await sc.getMarketplaceFees();
    expect(fees).toBeDefined();
    expect(fees).toEqual(100);
  });

  it('should return the XOXNO marketplace accepted payment tokens', async () => {
    const tokens = await sc.getAcceptedPaymentTokens();
    expect(tokens).toBeDefined();
    expect(tokens).toContain('EGLD');
  });

  it('should return the XOXNO marketplace global offers unique IDs', async () => {
    const global_offer_ids = await sc.getGlobalOfferIDs();
    expect(global_offer_ids).toBeDefined();
    expect(global_offer_ids.length).toBeGreaterThan(1);
  });

  it('should return the XOXNO global offer body for an ID', async () => {
    const global_offer_ids = await sc.getGlobalOfferIDs();
    expect(global_offer_ids).toBeDefined();
    expect(global_offer_ids.length).toBeGreaterThan(1);
    const offer = await sc.getGlobalOfferData(global_offer_ids[0]);
    expect(offer).toBeDefined();
    const lastOffer = await sc.getGlobalOfferData(
      global_offer_ids[global_offer_ids.length - 1]
    );
    expect(lastOffer).toBeDefined();
  });

  it('should return the XOXNO listings count', async () => {
    const listings = await sc.getListingsCount();
    expect(listings).toBeDefined();
    expect(listings).toBeGreaterThan(1);
  });

  it('should return the XOXNO custom offers count', async () => {
    const listings = await sc.getOffersCount();
    expect(listings).toBeDefined();
    expect(listings).toBeGreaterThan(1);
  });

  it('should return the XOXNO global offers count', async () => {
    const listings = await sc.getGlobalOffersCount();
    expect(listings).toBeDefined();
    expect(listings).toBeGreaterThan(1);
  });

  it('should return the XOXNO user deposit balance', async () => {
    const balance = await sc.getUserPoolBalance(
      'erd1fmd662htrgt07xxd8me09newa9s0euzvpz3wp0c4pz78f83grt9qm6pn57',
      'EGLD',
      0
    );
    expect(balance).toBeDefined();
    expect(balance).toBeGreaterThan(0);
  });

  it('should return the XOXNO unique listed collections', async () => {
    const listings = await sc.getCollectionsCount();
    expect(listings).toBeDefined();
    expect(listings).toBeGreaterThan(1);
  });

  it('should return the XOXNO unique auction IDs of a collection', async () => {
    const IDs = await sc.getAuctionIDsForCollection('COW-cd463d');
    expect(IDs).toBeDefined();
    expect(IDs.length).toBeGreaterThan(1);
  });

  it('should return the XOXNO on sale NFT count of a collection', async () => {
    const count = await sc.getCollectionNFTsOnSaleCount('COW-cd463d');
    expect(count).toBeDefined();
    expect(count).toBeGreaterThan(10);
  });

  it('should return if the collection is listed on XOXNO', async () => {
    const isListed = await sc.isCollectionListed('COW-cd463d');
    expect(isListed).toBeDefined();
    expect(isListed).toEqual(true);
  });
});
