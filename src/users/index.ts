import { CollectionModule, XOXNOClient } from '../index';
import {
  CreatorInfo,
  GetNFTsArgs,
  IMintInfo,
  NftData,
  SearchNFTsResponse,
  StatusResponse,
  SuggestNFTsArgs,
  SuggestResults,
  TradincActivityArgs,
  TradingActivityResponse,
} from '../types';
import {
  ArgsUserOffers,
  BulkAccount,
  CreatorProfile,
  IUserProfile,
  PoolDetails,
  UserAnalyticSummary,
  UserCollectionStaking,
  UserInventory,
  UserNetworkAccount,
  UserOffers,
  UserPoolStakingInfo,
  UserStakingSummary,
  UserTokenInventory,
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
      `/user/network-account`,
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
  public getUserAccount = async (
    address: string
  ): Promise<UserNetworkAccount> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserNetworkAccount>(
      `/user/${address}/network-account`
    );
    return response;
  };

  /**
   * Returns the user account info that inclues nonce, guardian data, esdtTokens
   *
   * @param {String} address - Address of the user
   * @returns {UserAccountInfo}
   */
  public getUserTokenInventory = async (
    address: string
  ): Promise<UserTokenInventory> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserTokenInventory>(
      `/user/${address}/token-inventory`
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
      `/user/${args.address}/offers`,
      {
        params: {
          type: args.type,
          skip: args.skip,
          top: args.top,
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function suggestUsers
   * @param {SuggestNFTsArgs} args - An object containing the necessary parameters to fetch suggested users results.
   * @returns {Promise<SuggestResults>} A promise that resolves to the fetched users results.
   *
   * This function fetches suggested users results based on the provided arguments. It takes an object with the following properties:
   * - name (string): The name to search for (required).
   * - top (number, optional): The maximum number of results to return (default is 35, cannot be greater than 35).
   * - skip (number, optional): The number of results to skip (default is 0).
   *
   * Finally, it returns a promise that resolves to the fetched users results.
   */
  public suggestUsers = async (
    args: SuggestNFTsArgs
  ): Promise<SuggestResults> => {
    if (args.top && args.top > 35) {
      throw new Error('Top cannot be greater than 35');
    }
    if (!args.name) {
      throw new Error('Name is required');
    }

    const payloadBody: SuggestNFTsArgs = {
      name: args.name,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    return await this.api.fetchWithTimeout<SuggestResults>(`/user/search`, {
      params: {
        filter: JSON.stringify(payloadBody),
      },
      next: {
        tags: ['/search/global'],
        revalidate: 180,
      },
    });
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

  /**
   * Gets user's analytics summary
   *
   * @param {String} address - User's address
   * @returns {UserAnalyticSummary} User's analytics summary
   */

  public getUserAnalyticsSummary = async (
    address: string
  ): Promise<UserAnalyticSummary> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');
    const response = await this.api.fetchWithTimeout<UserAnalyticSummary>(
      `/user/${address}/analytics/volume`
    );
    return response;
  };

  /** Gets user's favorite NFTs
   * @param {String} address - User's address
   * @param {number} top - Top
   * @param {number} skip - Skip
   * @returns {NftData[]} Array of NFTs
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserFavoriteNFTs = async (
    address: string,
    top: number,
    skip: number
  ): Promise<NftData[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<NftData[]>(
      `/user/${address}/favorite/nfts`,
      {
        params: {
          top,
          skip,
        },
      }
    );
    return response;
  };

  /** Gets user's favorite collection tickers
   * @param {String} address - User's address
   * @returns {String[]} Array of tickers
   * @throws {Error} Throws an error if the address is invalid
   *  */
  public getUserFavoriteCollectionTickers = async (
    address: string
  ): Promise<string[]> => {
    if (!isAddressValid(address)) throw new Error('Invalid address');

    const response = await this.api.fetchWithTimeout<string[]>(
      `/user/${address}/favorite/collections`
    );
    return response;
  };

  /** Get if the creator tag is registered already
   * @param {String} creatorTag - The creator tag that needs to be checked
   * @returns {StatusResponse} True or false
   *  */
  public getIsCreatorRegistered = async (
    creatorTag: string
  ): Promise<StatusResponse> => {
    const response = await this.api.fetchWithTimeout<StatusResponse>(
      `/user/${creatorTag}/creator/is-registered`
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getUsersStats
   * @param {SuggestNFTsArgs} args - An object containing the necessary parameters to fetch suggested users results.
   * @returns {Promise<SuggestResults>} A promise that resolves to the fetched users results.
   */
  public getUsersStats = async (
    args: SuggestNFTsArgs
  ): Promise<SuggestResults> => {
    if (args.top && args.top > 35) {
      throw new Error('Top cannot be greater than 35');
    }
    if (!args.name) {
      throw new Error('Name is required');
    }

    return await this.api.fetchWithTimeout<SuggestResults>(`/user/stats`, {
      params: {
        top: args.top,
        skip: args.skip,
        orderBy: args.orderBy,
      },
      next: {
        tags: ['/search/global'],
        revalidate: 180,
      },
    });
  };
}
