import { GetGroupedStakingPools, StakingPool } from '../types/staking';
import { Nfts } from '../types/user';
import { XOXNOClient } from '../utils/api';
import { isAddressValid } from '../utils/helpers';
import { isValidCollectionTicker } from '../utils/regex';

export class StakingModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.init();
  }

  /**
   * Returns all staking pools
   *
   * @returns {StakingPool[]}
   */
  public getAllStakingPools = async (): Promise<StakingPool[]> => {
    const response =
      await this.api.fetchWithTimeout<StakingPool[]>('/getStakingPools');
    return response;
  };

  /**
   * Returns all staking pools by collection
   *
   * @returns {StakingPool[]}
   */
  public getPoolsByTicker = async (
    collection: string
  ): Promise<StakingPool[]> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<StakingPool[]>(
      `/getPoolsByTicker/${collection}`
    );
    return response;
  };

  /**
   * Returns the staking pool by id
   *
   * @returns {StakingPool}
   */
  public getStakingPoolInfo = async (poolId: number): Promise<StakingPool> => {
    if (typeof poolId !== 'number') throw new Error('Invalid pool id');
    const response = await this.api.fetchWithTimeout<StakingPool>(
      `/getPoolDetails/${poolId}`
    );
    return response;
  };

  /**
   * Returns the staking pools grouped by collection
   *
   * @returns {GetGroupedStakingPools[]}
   */
  public getGroupedStakingPools = async (): Promise<
    GetGroupedStakingPools[]
  > => {
    const response = await this.api.fetchWithTimeout<GetGroupedStakingPools[]>(
      `/getGroupedStakingPools`
    );
    return response;
  };

  /**
   * Returns the staking pool by id
   * @param poolId - The pool id
   * @param address - The user's address
   * @param tickers - The collection tickers
   * @returns {Nfts} - A list of token ids and the price
   * @example
   * const nfts = await new StakingModule().getStakableNFTsByWallet(1, 'erd111', ['EGIRL-absd123']);
   * @throws an error if the pool id is not a number
   * @throws an error if the address is not valid
   * @throws an error if the tickers are not valid
   **/
  public getStakableNFTsByWallet = async (
    poolId: number,
    address: string,
    tickers: string[]
  ): Promise<Nfts> => {
    if (typeof poolId !== 'number') throw new Error('Invalid pool id');
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<Nfts>('/getNftsForStake', {
      method: 'POST',
      body: JSON.stringify({
        poolId,
        address,
        tickers,
      }),
    });
    return response;
  };

  /**
   * Returns the a list of NFTs which can be used for the specified pool id
   * @param poolId - The pool id
   * @param address - The user's address
   * @param tickers - The collection tickers
   * @returns {Nfts} - A list of token ids and the price
   * @example
   * const nfts = await new StakingModule().getPerkNFTsByWallet(1, 'erd111', ['EGIRL-absd123']);
   * @throws an error if the pool id is not a number
   * @throws an error if the address is not valid
   * @throws an error if the tickers are not valid
   **/
  public getPerkNFTsByWallet = async (
    poolId: number,
    address: string,
    tickers: string[]
  ): Promise<Nfts> => {
    if (typeof poolId !== 'number') throw new Error('Invalid pool id');
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<Nfts>('/getNftsForPerk', {
      method: 'POST',
      body: JSON.stringify({
        poolId,
        address,
        tickers,
      }),
    });
    return response;
  };
}
