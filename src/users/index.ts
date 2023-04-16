import {
  NftData,
  TradincActivityArgs,
  TradingActivityResponse,
} from '../types';
import {
  IUserProfile,
  UserInventory,
  UserOffers,
  UserStakingInfo,
} from '../types/user';
import XOXNOClient from '../utils/api';
import { getActivity } from '../utils/getActivity';
import { isAddressValid } from '../utils/helpers';
import { isValidCollectionTicker } from '../utils/regex';

export default class UserModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.init();
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
   * Gets user's inventory
   *
   * @param {String} address - User's address
   * @returns {UserInventory} User's inventory
   */

  public getUserInventory = async (address: string): Promise<UserInventory> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserInventory>(
      `/accounts/${address}/inventory`
    );
    return response;
  };

  /**
   * Fetches the user's NFTs listed on the marketplaces
   * @param address - The user's address
   * @returns {UserInventory} - A list of token ids and the price
   */
  public getUserListedInventory = async (
    address: string
  ): Promise<UserInventory> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserInventory>(
      `/accounts/${address}/listings`
    );
    return response;
  };

  /**
   * @name getUserOffers
   * @description Fetches all offers sent or received associated with a user address
   * @param {String} address - The user's wallet address
   * @returns {UserOffers} - The user's listings
   */
  public getUserOffers = async (address: string): Promise<UserOffers> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserOffers>(
      `/accounts/${address}/listings`
    );
    return response;
  };

  /**
   * Gets all NFTs from a collection by a specific user address
   *
   * @param {String} address - Address of the user
   * @param {String} collection - Collection ticker
   * @returns {NftData[]} A list of NFTs
   */

  public getUserNFTsByCollection = async (
    address: string,
    collection: string
  ): Promise<NftData[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<NftData[]>(
      `/getAccountInventory/${address}/${collection}`
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
}
