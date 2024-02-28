import { CollectionModule, XOXNOClient } from '../index';
import {
  CreatorInfo,
  GetNFTsArgs,
  IMintInfo,
  NftData,
  SearchNFTsResponse,
  TradincActivityArgs,
  TradingActivityResponse,
} from '../types';
import { GroupStakingInfo } from '../types/staking';
import {
  ArgsUserOffers,
  BulkAccount,
  CreatorProfile,
  IUserProfile,
  PoolDetails,
  UserAccountInfo,
  UserCollectionStaking,
  UserInventory,
  UserOffers,
  UserPoolStakingInfo,
  UserStakingSummary,
} from '../types/user';
import { getActivity } from '../utils/getActivity';
import { isAddressValid } from '../utils/helpers';
import { isValidCollectionTicker } from '../utils/regex';

export class UserModule {
  private api: XOXNOClient;
  private collection: CollectionModule;
  constructor() {
    this.api = XOXNOClient.init();
    this.collection = new CollectionModule();
  }

  /**
   * Returns the user profile
   *
   * @param {String} address - Address of the user
   * @returns {IUserProfile}
   */
  public getUserProfile = async (address: string): Promise<IUserProfile> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<IUserProfile>(
      `/user/${address}/profile`
    );
    return response;
  };

  /**
   * Returns the wallet accounts
   *
   * @param {String[]} addresses - Addresses of the user
   * @returns {BulkAccount[]}
   */
  public getBulkAccounts = async (
    addresses: string[]
  ): Promise<BulkAccount[]> => {
    const response = await this.api.fetchWithTimeout<BulkAccount[]>(
      `https://proxy-api.xoxno.com/address/bulk`,
      {
        method: 'POST',
        body: JSON.stringify(addresses),
      }
    );
    return response;
  };

  /**
   * Returns the user account info that inclues nonce, guardian data, esdtTokens
   *
   * @param {String} address - Address of the user
   * @returns {UserAccountInfo}
   */
  public getUserAccount = async (address: string): Promise<UserAccountInfo> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserAccountInfo>(
      `https://proxy-api.xoxno.com/accounts/${address}`
    );
    return response;
  };

  /**
   * Gets user's inventory
   *
   * @param {String} address - User's address
   * @returns {UserInventory} User's inventory
   */

  public getUserSummaryInventory = async (
    address: string
  ): Promise<UserInventory[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserInventory[]>(
      `/user/${address}/inventory-summary`
    );
    return response;
  };

  /**
   * Fetches the user's NFTs listed on the marketplaces
   * @param address - The user's address
   * @returns {UserInventory} - A list of token ids and the price
   */
  public getUserNFTs = async (
    args: GetNFTsArgs
  ): Promise<SearchNFTsResponse> => {
    return await this.collection.getNFTs(args);
  };

  /**
   * @name getUserOffers
   * @description Fetches all offers sent or received associated with a user address
   * @param {String} address - The user's wallet address
   * @returns {UserOffers} - The user's listings
   */
  public getUserOffers = async (args: ArgsUserOffers): Promise<UserOffers> => {
    if (!isAddressValid(args.address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserOffers>(
      `https://proxy-api.xoxno.com/user/${args.address}/offers?type=${args.type}&skip=${args.skip}&top=${args.top}`
    );
    return response;
  };

  /**
   * Retrieves trading history based on the provided arguments.
   *
   * @param {TradincActivityArgs} args - The arguments for filtering the trading activity.
   * @returns {Promise<TradingActivityResponse>} A promise resolving to a TradingActivityResponse object containing the activity.
   * @throws {Error} Throws an error if the 'top' argument is greater than 35.
   */
  public getTradingActivity = async (
    args: TradincActivityArgs
  ): Promise<TradingActivityResponse> => {
    return await getActivity(args, this.api);
  };

  /** Gets user's staking info by ticker
   * @param {String} address - User's address
   * @param {String} ticker - Collection's ticker
   * @returns {GroupStakingInfo[]} User's staking info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserStakingTickerInfoGrouped = async (
    address: string,
    ticker: string
  ): Promise<GroupStakingInfo[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    if (!isValidCollectionTicker(ticker)) throw new Error('Invalid ticker');

    const response = await this.api.fetchWithTimeout<GroupStakingInfo[]>(
      `https://proxy-api.xoxno.com/getUserStakingInfo/${address}?groupByTicker=true&ticker=${ticker}`
    );
    return response;
  };

  /** Gets user's creator profile
   * @param {String} address - User's address
   * @returns {CreatorProfile} User's creator profile struct
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserCreatorProfile = async (
    address: string
  ): Promise<CreatorProfile> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<CreatorProfile>(
      `/user/${address}/creator/profile`
    );
    return response;
  };

  /** Gets user's creator profile
   * @param {String} address - User's address
   * @returns {IMintInfo[]} User's creator profile struct
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getCreatorListings = async (address: string): Promise<IMintInfo[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<IMintInfo[]>(
      `/user/${address}/creator/listing`
    );
    return response;
  };

  /** Gets user's staking info
   * @param {String} address - User's address
   * @returns {UserStakingSummary[]} User's staking info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserStakingSummary = async (
    address: string
  ): Promise<UserStakingSummary[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<UserStakingSummary[]>(
      `/user/${address}/staking/summary`
    );
    return response;
  };

  /** Gets user's staking info
   * @param {String} address - User's address
   * @returns {UserStakingAvaiblePools[]} User's staking info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserStakingAailable = async (
    address: string
  ): Promise<PoolDetails[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<PoolDetails[]>(
      `/user/${address}/staking/available-pools`
    );
    return response;
  };

  /** Gets user's creator info
   * @param {String} address - User's address
   * @returns {CreatorInfo} User's creator info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserCreatorInfo = async (address: string): Promise<CreatorInfo> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<CreatorInfo>(
      `/user/${address}/creator/details`
    );
    return response;
  };

  /** Gets pool details
   * @param {String} address - User's address
   * @param {String} collection - Collection ticker
   * @returns {UserCollectionStaking} User's creator info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserCollectionStaking = async (
    address: string,
    collection: string
  ): Promise<UserCollectionStaking[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<UserCollectionStaking[]>(
      `/user/${address}/staking/collection/${collection}`
    );
    return response;
  };

  /** Gets pool details
   * @param {number} poolId - User's address
   * @returns {CreatoPoolDetailsrInfo} User's creator info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserPoolStaking = async (
    address: string,
    poolId: number
  ): Promise<UserPoolStakingInfo> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserPoolStakingInfo>(
      `/user/${address}/staking/pool/${poolId}`
    );
    return response;
  };

  /** Gets pool details
   * @param {number} poolId - User's address
   * @returns {CreatoPoolDetailsrInfo} User's creator info
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getAvailableNFTsForStakingPool = async (
    address: string,
    poolId: number
  ): Promise<NftData[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<NftData[]>(
      `/user/${address}/staking/pool/${poolId}/nfts`
    );
    return response;
  };

  /** Gets owned pools by address
   * @param {string} address - User's address
   * @returns {PoolDetails[]} User pools
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getOwnedPoolsByAddress = async (
    address: string
  ): Promise<PoolDetails[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<PoolDetails[]>(
      `/user/${address}/staking/owned-pools`
    );
    return response;
  };
}
