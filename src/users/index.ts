import { CollectionModule, XOXNOClient } from '../index';
import {
  GetNFTsArgs,
  SearchNFTsResponse,
  TradincActivityArgs,
  TradingActivityResponse,
} from '../types';
import { GroupStakingInfo } from '../types/staking';
import {
  ArgsUserOffers,
  BulkAccount,
  IUserProfile,
  UserAccountInfo,
  UserInventory,
  UserOffers,
  UserStakingInfo,
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
      `/getUserProfile/${address}`
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
      `/address/bulk`,
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
      `/accounts/${address}`
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
      `/user/${address}/inventory`
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
      `/user/${args.address}/offers?type=${args.type}&skip=${args.skip}&top=${args.top}`
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

  /** Gets user's staking info
   * @param {String} address - User's address
   * @returns {UserStakingInfo} User's staking info
   * @throws {Error} Throws an error if the address is invalid
   * @example const userStakingInfo = await new UserModule().getUserStakingInfo('erd11...');
   *  */
  public getUserStakingInfo = async (
    address: string
  ): Promise<UserStakingInfo[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<UserStakingInfo[]>(
      `/getUserStakingInfo/${address}`
    );
    return response;
  };

  /** Gets user's staking info
   * @param {String} address - User's address
   * @returns {GroupStakingInfo[]} User's staking info
   * @throws {Error} Throws an error if the address is invalid
   * @example const userStakingInfo = await new UserModule().getUserStakingInfo('erd11...');
   *  */
  public getUserStakingInfoGrouped = async (
    address: string
  ): Promise<GroupStakingInfo[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<GroupStakingInfo[]>(
      `/getUserStakingInfo/${address}?groupByTicker=true`
    );
    return response;
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
      `/getUserStakingInfo/${address}?groupByTicker=true&ticker=${ticker}`
    );
    return response;
  };
}
