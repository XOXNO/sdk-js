import { SCInteraction } from '../../interactor';
import { XOXNOClient } from '../../utils/api';

describe('SCInteraction', () => {
  let sc: SCInteraction;
  beforeAll(async () => {
    XOXNOClient.init();
    sc = await SCInteraction.init();
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

  it('should create the transaction to withdraw auctions', async () => {
    const interaction = await sc.withdrawAuctions(
      [1],
      {
        address:
          'erd1qqqqqqqqqqqqqpgq6wegs2xkypfpync8mn2sa5cmpqjlvrhwz5nqgepyg8',
        nonce: 1,
      },
      'xoxno'
    );
    expect(interaction).toBeDefined();
    expect(interaction.buildTransaction().toSendable()).toEqual({
      nonce: 1,
      value: '0',
      receiver:
        'erd1qqqqqqqqqqqqqpgq6wegs2xkypfpync8mn2sa5cmpqjlvrhwz5nqgepyg8',
      sender: 'erd1qqqqqqqqqqqqqpgq6wegs2xkypfpync8mn2sa5cmpqjlvrhwz5nqgepyg8',
      gasPrice: 1000000000,
      gasLimit: 20000000,
      data: 'd2l0aGRyYXdAMDE=',
      chainID: '1',
      version: 1,
      options: undefined,
      guardian: undefined,
      signature: undefined,
      guardianSignature: undefined,
    });
  });
});
