import { UserModule } from '..';
import { XOXNOClient } from '../..';
import { OfferType } from '../../types/user';

describe('UserModule', () => {
  let userModule: UserModule;
  const inputAddress =
    'erd1fmd662htrgt07xxd8me09newa9s0euzvpz3wp0c4pz78f83grt9qm6pn57';

  beforeAll(() => {
    XOXNOClient.init();
    userModule = new UserModule();
  });

  it('should return the User Profile of the required wallet', async () => {
    const user = await userModule.getUserProfile(inputAddress);
    expect(user).toBeDefined();
    expect(user.address).toEqual(inputAddress);
  });

  it('should return the wallet NFTs not listed', async () => {
    const inventory = await userModule.getUserNFTs({
      ownedBy: [inputAddress],
      onlyOnSale: false,
      top: 25,
    });
    expect(inventory).toBeDefined();
  });

  it('should return the wallet NFTs listed', async () => {
    const inventory = await userModule.getUserNFTs({
      listedBy: [inputAddress], // or only ownedBy: [inputAddress]
      onlyOnSale: true,
      top: 25,
    });
    expect(inventory).toBeDefined();
    expect(inventory.resources.length).toBeGreaterThanOrEqual(1);
  });

  it('should return the wallet NFTs trading activity', async () => {
    const inventory = await userModule.getTradingActivity({
      wallets: [inputAddress],
    });
    expect(inventory).toBeDefined();
    expect(inventory.resources.length).toBeGreaterThanOrEqual(1);
  });

  it('should return the wallet NFTs listed or unlisted from the specific collection', async () => {
    const inventory = await userModule.getUserNFTs({
      ownedBy: [inputAddress],
      collections: ['BANANA-e955fd'],
      top: 1,
    });
    expect(inventory).toBeDefined();
    expect(inventory.resources.length).toBeGreaterThanOrEqual(1);
  });

  it('should return all the Staking Pools where the wallet is a delegator', async () => {
    const stakingInfo = await userModule.getUserStakingInfo(
      'erd16ldp9t8g9xaeteyupgqmuwqus00rkdzkf7sn0td25krk3j4luq2s5mn6cd'
    );
    expect(stakingInfo).toBeDefined();
    expect(stakingInfo.length).toBeGreaterThanOrEqual(1);
  });

  it('should return all the offers of a user Global or Custom / send or received', async () => {
    const offers = await userModule.getUserOffers({
      address: inputAddress,
      type: OfferType.Sent,
      skip: 0,
      top: 10,
    });
    expect(offers).toBeDefined();
  });
});
