import { XOXNOClient } from '..';
import { NftData } from '../types/nft';
import { TradingActivityResponse, TradincActivityArgs } from '../types/trading';
import { UserOffers } from '../types/user';
import { getActivity } from '../utils/getActivity';
import { getIdentifierFromColAndNonce } from '../utils/helpers';
import { isValidCollectionTicker, isValidNftIdentifier } from '../utils/regex';

/**
 * NFTModule provides a set of methods to interact with single NFTs.
 * It includes methods for getting single NFT information, and searching NFTs by collection and nonce.
 *
 * @example
 * const nftModule = new NFTModule();
 */

export class NFTModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.getInstance();
  }

  /**
   * @public
   * @async
   * @function getNFTByIdentifier
   * @param {string} identifier - The identifier of the NFT to fetch data for.
   * @returns {Promise<NftData>} A promise that resolves to the fetched NFT data.
   *
   * This function fetches data for a given NFT by its identifier. It takes the following parameter:
   * - identifier (string): The identifier of the NFT to fetch data for.
   *
   * The function first validates the input identifier and checks if it is a valid NFT identifier.
   * If it is valid, the function fetches the NFT data using the API.
   * Finally, it returns a promise that resolves to the fetched NFT data.
   */
  public getNFTByIdentifier = async (
    identifier: string,
    extra?: RequestInit
  ): Promise<NftData> => {
    if (!isValidNftIdentifier(identifier)) {
      throw new Error('Invalid identifier: ' + identifier);
    }
    const response = await this.api.fetchWithTimeout<NftData>(
      `/nft/${identifier}`,
      {
        ...extra,
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getNFTByIdentifier
   * @param {string} identifier - The identifier of the NFT to fetch data for.
   * @returns {Promise<NftData>} A promise that resolves to the fetched NFT data.
   *
   * This function fetches data for a given NFT by its identifier. It takes the following parameter:
   * - identifier (string): The identifier of the NFT to fetch data for.
   *
   * The function first validates the input identifier and checks if it is a valid NFT identifier.
   * If it is valid, the function fetches the NFT data using the API.
   * Finally, it returns a promise that resolves to the fetched NFT data.
   */
  public getNFTsOffers = async (
    identifier: string,
    skip: number = 0,
    top: number = 25
  ): Promise<UserOffers> => {
    if (!isValidNftIdentifier(identifier)) {
      throw new Error('Invalid identifier: ' + identifier);
    }
    const response = await this.api.fetchWithTimeout<UserOffers>(
      `/nft/${identifier}/offers?skip=${skip}&top=${top}`,
      {
        next: {
          tags: ['getNFTsOffers'],
          /* revalidate: 12, */
        },
      }
    );
    return response;
  };

  /**
   * Gets an NFT by collection and nonce.
   * @param collection The collection ticker.
   * @param nonce The nonce of the NFT.
   * @returns {Promise<NftData>} The NFT data.
   * @throws Throws an error when the collection ticker is invalid.
   */
  public getNFTByCollectionAndNonce = async (
    collection: string,
    nonce: number
  ): Promise<NftData> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }

    const response = await this.api.fetchWithTimeout<NftData>(
      `/${getIdentifierFromColAndNonce(collection, nonce)}`
    );
    return response;
  };

  /**
   * Get NFT by collection and nonce hex
   *
   * @param collection - collection ticker
   * @param nonceHex - nonce hex
   * @return {Promise<NftData>} NFT data
   */

  public getNFTByCollectionAndNonceHex = async (
    collection: string,
    nonceHex: string
  ): Promise<NftData> => {
    // check that collection is valid
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    // make sure nonceHex is even
    if (nonceHex.length % 2 !== 0) {
      nonceHex = '0' + nonceHex;
    }
    // fetch the NFT data
    const response = await this.api.fetchWithTimeout<NftData>(
      `/${[collection, nonceHex].join('-')}`
    );
    return response;
  };

  /**
   * Retrieves trading history based on the provided arguments.
   *
   * @param {TradincActivityArgs} args - The arguments for filtering the trading activity.
   * @returns {Promise<TradingActivityResponse>} A promise resolving to a TradingActivityResponse object containing the activity.
   * @throws {Error} Throws an error if the 'top' argument is greater than 100.
   */
  public getTradingActivity = async (
    args: TradincActivityArgs
  ): Promise<TradingActivityResponse> => {
    return await getActivity(args, this.api);
  };
}
