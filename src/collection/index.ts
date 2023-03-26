import {
  ICollectionAttributes,
  ICollectionProfile,
  SearchNFTs,
  SearchNFTsArgs,
  SearchNFTsResponse,
} from '../types/collection';
import {
  TradincActivityArgs,
  TradingActivityQueryFilter,
  TradingActivityResponse,
} from '../types/trading';
import { APIClient } from '../utils/api';
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
    const response = await this.api.fetchWithTimeout(
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
    const response = await this.api.fetchWithTimeout(
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
    const response = await this.api.fetchWithTimeout(
      `/getCollectionAttributes/${collection}`
    );
    return response;
  };

  /**
   * Searches for NFTs in a collection based on the provided arguments.
   * @param args - The SearchNFTsArgs object containing the search parameters.
   * @returns A Promise that resolves to the SearchNFTsResponse object.
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
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
    const response: SearchNFTsResponse = await this.api.fetchWithTimeout(
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
   * Retrieves global offers based on the provided arguments.
   *
   * @param {TradincActivityArgs} args - The arguments for filtering global offers.
   * @returns {Promise<TradingActivityResponse>} A promise resolving to a TradingActivityResponse object containing the global offers.
   * @throws {Error} Throws an error if the 'top' argument is greater than 35.
   */
  public getGlobalOffers = async (
    args: TradincActivityArgs
  ): Promise<TradingActivityResponse> => {
    if (args.top && args.top > 35) {
      throw new Error('Top cannot be greater than 35');
    }

    const payloadBody: TradingActivityQueryFilter = {
      filters: {
        collection: args.collections,
        identifier: args.identifier || undefined,
        address: args.owners || undefined,
        tokens: args.placedInToken || undefined,
        marketplace: args.marketplaces || undefined,
        action: args.actions || undefined,
        range: args.priceRange,
        rankRange: args.rankRange,
        timestampRange: args.timestampRange,
        attributes: args.attributes,
      },
      orderBy: args.orderBy,
      select: args.select,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
    const response: TradingActivityResponse = await this.api.fetchWithTimeout(
      `/getGlobalOffers/${buffer}`
    );
    return {
      ...response,
      getNextPagePayload: {
        ...args,
        skip: response.lastSkip,
      },
      empty: response.resources.length === 0,
    };
  };
}
