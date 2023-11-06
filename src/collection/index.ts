import {
  CollectionsNFTsResponse,
  GetCollectionsArgs,
  ICollectionAttributes,
  ICollectionProfile,
  SearchNFTs,
  GetNFTsArgs,
  SearchNFTsResponse,
  SuggestNFTsArgs,
  SuggestOrderBy,
  SuggestResults,
  CollectionVolume,
  FloorPriceHistory,
  CollectionHoldersInfo,
} from '../types/collection';
import { TradincActivityArgs, TradingActivityResponse } from '../types/trading';
import XOXNOClient from '../utils/api';
import { getActivity } from '../utils/getActivity';
import { isValidCollectionTicker } from '../utils/regex';

/**
 * CollectionModule provides a set of methods to interact with NFT collections.
 * It includes methods for getting collection profile information, floor price,
 * collection attributes, and searching NFTs within a collection.
 *
 * @example
 * const collectionModule = new CollectionModule();
 */
export default class CollectionModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.init();
  }

  /**
   * @public
   * @async
   * @function getCollectionProfile
   * @param {string} collection - The ticker of the collection to fetch the profile for.
   * @returns {Promise<ICollectionProfile>} A promise that resolves to the fetched collection profile.
   *
   * This function fetches the profile of a given collection. It takes the following parameter:
   * - collection (string): The ticker of the collection to fetch the profile for.
   *
   * The function first validates the input ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection profile using the API.
   * Finally, it returns a promise that resolves to the fetched collection profile.
   */
  public getCollectionProfile = async (
    collection: string
  ): Promise<ICollectionProfile> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<ICollectionProfile>(
      `/getCollectionProfile/${collection}`,
      {
        next: {
          tags: ['getCollectionProfile'],
        },
      }
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
      `/getFloorPrice/${collection}/${token}`,
      {
        next: {
          tags: ['getCollectionFloorPrice'],
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionAttributes
   * @param {string} collection - The ticker of the collection to fetch the attributes for.
   * @returns {Promise<ICollectionAttributes>} A promise that resolves to the fetched collection attributes.
   *
   * This function fetches the attributes of a given collection. It takes the following parameter:
   * - collection (string): The ticker of the collection to fetch the attributes for.
   *
   * The function first validates the input ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection attributes using the API.
   * Finally, it returns a promise that resolves to the fetched collection attributes.
   */
  public getCollectionAttributes = async (
    collection: string
  ): Promise<ICollectionAttributes> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<ICollectionAttributes>(
      `/getCollectionAttributes/${collection}`,
      {
        next: {
          tags: ['getCollectionAttributes'],
        },
      }
    );
    return response;
  };

  /**
   * Searches for NFTs based on the provided arguments.
   * @param {SearchNFTsArgs} args - The SearchNFTsArgs object containing the search parameters.
   * @returns {Promise<SearchNFTsResponse>} A Promise that resolves to the SearchNFTsResponse object.
   * @throws An error if the provided collection ticker is invalid or if the 'top' value is greater than 35.
   */
  public getNFTs = async (args: GetNFTsArgs): Promise<SearchNFTsResponse> => {
    args?.collections?.forEach((element) => {
      if (!isValidCollectionTicker(element)) {
        throw new Error('Invalid collection ticker: ' + element);
      }
    });

    if (args.top && args.top > 35) {
      throw new Error('Top cannot be greater than 35');
    }

    const payloadBody: SearchNFTs = {
      filters: {
        dataType: args.dataType ?? ['nft'],
        activeAuction: args.onlyAuctions || false,
        collection: args.collections ?? [],
        onSale: args.onlyOnSale || false,
        seller: args.listedBy || [],
        owner: args.ownedBy || [],
        marketplace: args.listedOnlyOn || undefined,
        auctionType: args.onlyOnSale
          ? args.onlyAuctions
            ? ['NftBid', 'SftAll']
            : ['Nft', 'SftOnePerPayment']
          : undefined,
        verifiedOnly: args.onlyVerified || false,
        paymentToken: args.listedInToken || [],
        attributes: args.attributes || undefined,
        priceRange: args.priceRange
          ? {
              ...args.priceRange,
              type: args.onlyAuctions
                ? 'saleInfo.currentBidShort'
                : 'saleInfo.minBidShort',
            }
          : undefined,
        rankRange: args.rankRange || undefined,
        gameLevelRange: args.cantinaLevelRange || undefined,
      },
      orderBy: args.orderBy || [],
      select: args.onlySelectFields || [],
      includeCount: args.includeCount || false,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
    console.log(buffer);
    const response = await this.api.fetchWithTimeout<SearchNFTsResponse>(
      `/getNfts/${buffer}`,
      {
        next: {
          tags: ['getCollectionNFTs'],
        },
      }
    );
    return {
      ...response,
      getNextPagePayload: {
        ...args,
        skip: (args.skip ?? 0) + (args.top ?? 35),
      },
    };
  };

  /**
   * @public
   * @async
   * @function suggestResults
   * @param {SuggestNFTsArgs} args - An object containing the necessary parameters to fetch suggested NFT results.
   * @returns {Promise<SuggestResults>} A promise that resolves to the fetched NFT results.
   *
   * This function fetches suggested NFT results based on the provided arguments. It takes an object with the following properties:
   * - name (string): The name to search for (required).
   * - orderBy (SuggestOrderBy[], optional): An array of ordering preferences for the results.
   * - top (number, optional): The maximum number of results to return (default is 35, cannot be greater than 35).
   * - skip (number, optional): The number of results to skip (default is 0).
   *
   * The function first validates the input arguments and constructs a payload body with the provided parameters.
   * Then, it converts the payload body into a base64 string and fetches the suggested results using the API.
   * Finally, it returns a promise that resolves to the fetched NFT results.
   */
  public suggestResults = async (
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
      orderBy: args.orderBy || [
        SuggestOrderBy.TotalVolumeHighToLow,
        SuggestOrderBy.FollowersHighToLow,
        SuggestOrderBy.IsVerifiedTrueToFalse,
        SuggestOrderBy.HasImageTrueToFalse,
      ],
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const buffer = Buffer.from(JSON.stringify(payloadBody)).toString('base64');
    return await this.api.fetchWithTimeout<SuggestResults>(
      `/search/${buffer}`,
      {
        next: {
          tags: ['suggestResults'],
        },
      }
    );
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
      `/collections/${buffer}`,
      {
        next: {
          tags: ['getCollections'],
        },
      }
    );
    return {
      results: response,
      resultsCount: response.length,
      empty: response.length === 0,
      getNextPagePayload: {
        ...args,
        skip: (args?.skip || 0) + (args?.top || 25),
      },
      hasMoreResults: response.length >= (args?.top || 25),
    };
  };

  /**
   * @public
   * @async
   * @function getCollectionVolume
   * @param {string} collection - The ticker of the collection to fetch the volume for (e.g., 'EAPES-8f3c1f').
   * @param {string} after - The start date (inclusive) of the date range for the volume data (e.g., '2023-04-17').
   * @param {string} before - The end date (inclusive) of the date range for the volume data (e.g., '2023-04-25').
   * @param {string} bin - The binning period for the volume data (e.g., '1d' for 1 day).
   * @returns {Promise<CollectionVolume[]>} A promise that resolves to an array of collection volume data.
   *
   * This function fetches volume data for a given collection within a specified date range and binning period. It takes the following parameters:
   * - collection (string): The ticker of the collection to fetch the volume for (e.g., 'EAPES-8f3c1f').
   * - after (string): The start date (inclusive) of the date range for the volume data (e.g., '2023-04-17').
   * - before (string): The end date (inclusive) of the date range for the volume data (e.g., '2023-04-25').
   * - bin (string): The binning period for the volume data (e.g., '1d' for 1 day).
   *
   * The function first validates the input collection ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection volume data using the API with the specified query parameters.
   * Finally, it returns a promise that resolves to an array of collection volume data.
   */
  public getCollectionVolume = async (
    collection: string,
    after: string,
    before: string,
    bin: string
  ): Promise<CollectionVolume[]> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<CollectionVolume[]>(
      `/getCollectionVolume/${collection}?after=${after}&before=${before}&bin=${bin}`,
      {
        next: {
          tags: ['getCollectionVolume'],
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionFloor
   * @param {string} collection - The ticker of the collection to fetch the volume for (e.g., 'EAPES-8f3c1f').
   * @param {string} after - The start date (inclusive) of the date range for the volume data (e.g., '2023-04-17').
   * @param {string} before - The end date (inclusive) of the date range for the volume data (e.g., '2023-04-25').
   * @param {string} bin - The binning period for the volume data (e.g., '1d' for 1 day).
   * @returns {Promise<FloorPriceHistory[]>} A promise that resolves to an array of floor price history data.
   *
   * This function fetches floor data for a given collection within a specified date range and binning period. It takes the following parameters:
   * - collection (string): The ticker of the collection to fetch the volume for (e.g., 'EAPES-8f3c1f').
   * - after (string): The start date (inclusive) of the date range for the volume data (e.g., '2023-04-17').
   * - before (string): The end date (inclusive) of the date range for the volume data (e.g., '2023-04-25').
   * - bin (string): The binning period for the volume data (e.g., '1d' for 1 day).
   *
   * The function first validates the input collection ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection volume data using the API with the specified query parameters.
   * Finally, it returns a promise that resolves to an array of floor price history data.
   */
  public getCollectionFloor = async (
    collection: string,
    after: string,
    before: string,
    bin: string
  ): Promise<FloorPriceHistory[]> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<FloorPriceHistory[]>(
      `/getCollectionFloor/${collection}?after=${after}&before=${before}&bin=${bin}`,
      {
        next: {
          tags: ['getCollectionFloor'],
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionOwners
   * @param {string} collection - The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   * @returns {Promise<CollectionHoldersInfo[]>} A promise that resolves to an array of collection owner information.
   *
   * This function fetches owner information for a given collection. It takes the following parameter:
   * - collection (string): The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   *
   * The function first validates the input collection ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection owner information using the API.
   * Finally, it returns a promise that resolves to an array of collection owner information.
   */
  public getCollectionOwners = async (
    collection: string
  ): Promise<CollectionHoldersInfo> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<CollectionHoldersInfo>(
      `/getCollectionOwners/${collection}`,

      {
        next: {
          tags: ['getCollectionOwners'],
        },
      }
    );
    return response;
  };
}
