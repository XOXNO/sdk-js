import {
  CollectionsNFTsResponse,
  GetCollectionsArgs,
  ICollectionAttributes,
  ICollectionProfile,
  SearchNFTs,
  SearchNFTsArgs,
  SearchNFTsResponse,
} from '../types/collection';
import { TradincActivityArgs, TradingActivityResponse } from '../types/trading';
import { APIClient } from '../utils/api';
import { getActivity } from '../utils/getActivity';
import { isValidCollectionTicker } from '../utils/regex';

/**
 * CollectionModule provides a set of methods to interact with NFT collections.
 * It includes methods for getting collection profile information, floor price,
 * collection attributes, and searching NFTs within a collection.
 *
 * @example
 * const xoxno = new XOXNO({ apiURL: 'https://api.xoxno.com', apiKey: 'your-api-key' });
 * const collectionModule = xoxno.collection;
 */
export class CollectionModule {
  private api: APIClient;
  constructor() {
    this.api = APIClient.getClient();
  }

  /**
   * Fetches the profile of a collection.
   * @param collection - The ticker of the collection.
   * @returns A Promise that resolves to the ICollectionProfile object.
   * @throws An error if the provided collection ticker is invalid.
   */
  public getCollectionProfile = async (
    collection: string
  ): Promise<ICollectionProfile> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<ICollectionProfile>(
      `/getCollectionProfile/${collection}`
    );
    return response;
  };

  /**
   * Fetches the floor price of a collection.
   * @param collection - The ticker of the collection.
   * @param token - The token for the floor price calculation (default: 'EGLD').
   * @returns A Promise that resolves to the collection's floor price as a number.
   * @throws An error if the provided collection ticker is invalid.
   */
  public getCollectionFloorPrice = async (
    collection: string,
    token = 'EGLD'
  ): Promise<number> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<number>(
      `/getFloorPrice/${collection}/${token}`
    );
    return response;
  };

  /**
   * Fetches the attributes of a collection.
   * @param collection - The ticker of the collection.
   * @returns A Promise that resolves to the ICollectionAttributes object.
   * @throws An error if the provided collection ticker is invalid.
   */
  public getCollectionAttributes = async (
    collection: string
  ): Promise<ICollectionAttributes> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<ICollectionAttributes>(
      `/getCollectionAttributes/${collection}`
    );
    return response;
  };

  /**
   * Searches for NFTs in a collection based on the provided arguments.
   * @param {SearchNFTsArgs} args - The SearchNFTsArgs object containing the search parameters.
   * @returns {Promise<SearchNFTsResponse>} A Promise that resolves to the SearchNFTsResponse object.
   * @throws An error if the provided collection ticker is invalid or if the 'top' value is greater than 35.
   */
  public searchNFTs = async (
    args: SearchNFTsArgs
  ): Promise<SearchNFTsResponse> => {
    if (!isValidCollectionTicker(args.collection)) {
      throw new Error('Invalid collection ticker: ' + args.collection);
    }

    if (args.top && args.top > 35) {
      throw new Error('Top cannot be greater than 35');
    }

    const payloadBody: SearchNFTs = {
      filters: {
        onSale: args.onlyOnSale || false,
        marketplace: args.listedOnlyOn || undefined,
        auctionTypes: args.onlyOnSale
          ? args.onlyAuctions
            ? ['NftBid', 'SftAll']
            : ['Nft', 'SftOnePerPayment']
          : undefined,
        tokens: args.listedInToken || undefined,
        attributes: args.attributes || undefined,
        range: args.priceRange
          ? {
              ...args.priceRange,
              type: args.onlyAuctions
                ? 'saleInfoNft/current_bid_short'
                : 'saleInfoNft/min_bid_short',
            }
          : undefined,
        rankRange: args.rankRange || undefined,
        levelRange: args.cantinaLevelRange || undefined,
      },
      name: args.searchName || '',
      orderBy: args.orderBy || undefined,
      collection: args.collection,
      select: args.onlySelectFields || undefined,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
    const response = await this.api.fetchWithTimeout<SearchNFTsResponse>(
      `/searchNFTs/${buffer}`
    );
    return {
      ...response,
      getNextPagePayload: {
        ...args,
        skip: (args.skip ?? 0) + (args.top ?? 35),
      },
      hasMoreResults:
        response.resultsCount > (args.skip ?? 0) + (args.top ?? 35),
    };
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

  /**
   * Fetch collections profiles based on the provided arguments.
   * @param {GetCollectionsArgs} args - The GetCollectionsArgs object containing the search parameters.
   * @returns {Promise<CollectionsNFTsResponse>} A Promise that resolves to the CollectionsNFTsResponse object.
   * @throws An error if the 'top' value is greater than 35.
   */
  public getCollections = async (
    args?: GetCollectionsArgs
  ): Promise<CollectionsNFTsResponse> => {
    if (args?.top && args.top > 25) {
      throw new Error('Top cannot be greater than 25');
    }

    const payloadBody = {
      skip: args?.skip || 0,
      top: args?.top || 25,
      select: args?.onlySelectFields || [],
      filters: {
        dataType: 'collectionProfile',
        isMintable: args?.onlyMintable || undefined,
        ...(args?.collections &&
          args.collections.length > 0 && {
            collection: args.collections,
          }),
      },
      orderBy: [args?.orderBy || 'statistics.tradeData.weekEgldVolume desc'],
    };

    const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
    const response = await this.api.fetchWithTimeout<ICollectionProfile[]>(
      `/collections/${buffer}`
    );
    return {
      results: response,
      resultsCount: response.length,
      empty: response.length === 0,
      getNextPagePayload: {
        ...args,
        skip: (args?.skip || 0) + (args?.top || 25),
      },
      hasMoreResults: response.length < (args?.top || 25),
    };
  };
}
