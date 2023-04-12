import { NftData } from '../types/nft';
import { TradingActivityResponse, TradincActivityArgs } from '../types/trading';
import { XOXNOClient } from '../utils/api';
import { getActivity } from '../utils/getActivity';
import { getIdentifierFromColAndNonce } from '../utils/helpers';
import { isValidCollectionTicker, isValidNftIdentifier } from '../utils/regex';

/**
 * NFTModule provides a set of methods to interact with single NFTs.
 * It includes methods for getting single NFT information, and searching NFTs by collection and nonce.
 *
 * @example
 * const xoxno = new XOXNO({ apiURL: 'https://api.xoxno.com', apiKey: 'your-api-key' });
 * const nftModule = xoxno.nft;
 */

export class NFTModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.getClient();
  }

  /**
   * Get the NFT data for the specified identifier.
   * @param identifier The NFT identifier. Must be a valid NFT identifier.
   * @returns {Promise<NftData>} The NFT data.
   */
  public getNFTByIdentifier = async (identifier: string): Promise<NftData> => {
    if (!isValidNftIdentifier(identifier)) {
      throw new Error('Invalid identifier: ' + identifier);
    }
    const response = await this.api.fetchWithTimeout<NftData>(
      `/nfts/${identifier}`
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
      `/nfts/${getIdentifierFromColAndNonce(collection, nonce)}`
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
      `/nfts/${[collection, nonceHex].join('-')}`
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
}
