import { AnalyticsGraphs, NftData, StakingSummaryPools } from '../types';
import {
  CollectionsNFTsResponse,
  GetCollectionsArgs,
  ICollectionAttributes,
  ICollectionProfile,
  SearchNFTs,
  GetNFTsArgs,
  SearchNFTsResponse,
  SuggestNFTsArgs,
  SuggestResults,
  CollectionVolume,
  IOwners,
  ISingleHolder,
  GetGlobalOffersArgs,
  GlobalOffersResult,
  GlobalOfferOrderBy,
  GetCollectionMintInfo,
  GetCollectionStatsArgs,
  CollectionStatsResults,
  CollectionRanksExport,
  CollectionStatsDoc,
  AuctionTypes,
  GETDropsArgs,
  GetDropsResponse,
  CollectionListings,
} from '../types/collection';
import { TradincActivityArgs, TradingActivityResponse } from '../types/trading';
import { XOXNOClient } from '..';
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
export class CollectionModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.getInstance();
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
      `/collection/${collection}/profile`,
      {
        next: {
          tags: ['getCollectionProfile'],
          /* revalidate: 30, */
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getDailyTrending
   * @returns {Promise<NftData[]>} A promise that resolves to the array of trending NFTs.
   * This function fetches the top NFTs that are trending today based on their floor and volumes
   */
  public getDailyTrending = async (): Promise<NftData[]> => {
    const response = await this.api.fetchWithTimeout<NftData[]>(
      '/nfts/getDailyTrending',
      {
        next: {
          tags: ['getDailyTrending'],
          /* revalidate: 180, */
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
    const response = await this.api.fetchWithTimeout<{
      price: number;
    }>(`/collection/${collection}/floor-price`, {
      next: {
        tags: ['getCollectionFloorPrice'],
      },
      params: {
        token,
      },
    });
    return response?.price ? response.price : 0;
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
      `/collection/${collection}/attributes`,
      {
        next: {
          tags: ['getCollectionAttributes'],
          /* revalidate: 180, */
        },
      }
    );
    return response;
  };

  /**
   * Searches for NFTs based on the provided arguments.
   * @param {SearchNFTsArgs} args - The SearchNFTsArgs object containing the search parameters.
   * @returns {Promise<SearchNFTsResponse>} A Promise that resolves to the SearchNFTsResponse object.
   * @throws An error if the provided collection ticker is invalid or if the 'top' value is greater than 100.
   */
  public getNFTs = async (args: GetNFTsArgs): Promise<SearchNFTsResponse> => {
    args?.collections?.forEach((element) => {
      if (!isValidCollectionTicker(element)) {
        throw new Error('Invalid collection ticker: ' + element);
      }
    });

    if (args.top && args.top > 100) {
      throw new Error('Top cannot be greater than 100');
    }
    const ranges = [];
    if (args.priceRange) {
      ranges.push({
        ...args.priceRange,
        field:
          args.auctionType == AuctionTypes.Auctions
            ? 'saleInfo.currentBidShort'
            : 'saleInfo.minBidShort',
      });
    }
    if (args.rankRange) {
      ranges.push({
        ...args.rankRange,
        field: 'metadata.rarity.rank',
      });
    }
    const payloadBody: SearchNFTs = {
      filters: {
        name: args.name,
        dataType: args.dataType ?? ['nft'],
        // @borispoehland Has to be false only if we want to show the expired auctions, undefined to show all, and true only actives
        activeAuction: args.activeAuctions,
        collection: args.collections ?? [],
        onSale: args.onlyOnSale,
        saleInfo: {
          seller: args.listedBy || [],
          marketplace: args.listedOnlyOn || undefined,
          paymentToken: args.listedInToken || [],
          auctionType:
            args.auctionType == AuctionTypes.Auctions
              ? ['NftBid', 'SftAll']
              : args.auctionType == AuctionTypes.FixedPrice
                ? ['Nft', 'SftOnePerPayment']
                : args.auctionType == AuctionTypes.AllListed
                  ? ['NftBid', 'SftAll', 'Nft', 'SftOnePerPayment']
                  : undefined,
        },
        owner: args.ownedBy || [],
        verifiedOnly: args.onlyVerified || false,
        metadata: {
          attributes: args.attributes || undefined,
        },
        range: ranges,
        nonce: args.nonces || undefined,
        cp_staked: args.isStaked ?? undefined,
      },
      applyNftExtraDetails: args.applyNftExtraDetails,
      orderBy: args.orderBy || [],
      select: args.onlySelectFields || [],
      strictSelect: args.strictSelect || false,
      includeCount: args.includeCount || false,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const response = await this.api.fetchWithTimeout<SearchNFTsResponse>(
      `/nft/search/query`,
      {
        params: {
          filter: JSON.stringify(payloadBody),
        },
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
   * @function suggestCollections
   * @param {SuggestNFTsArgs} args - An object containing the necessary parameters to fetch suggested collections results.
   * @returns {Promise<SuggestResults>} A promise that resolves to the fetched collections results.
   *
   * This function fetches suggested collections results based on the provided arguments. It takes an object with the following properties:
   * - name (string): The name to search for (required).
   * - top (number, optional): The maximum number of results to return (default is 35, cannot be greater than 100).
   * - skip (number, optional): The number of results to skip (default is 0).
   *
   * Finally, it returns a promise that resolves to the fetched collections results.
   */
  public suggestCollections = async (
    args: SuggestNFTsArgs
  ): Promise<SuggestResults> => {
    if (args.top && args.top > 100) {
      throw new Error('Top cannot be greater than 100');
    }

    const payloadBody: SuggestNFTsArgs = {
      name: args.name,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    return await this.api.fetchWithTimeout<SuggestResults>(
      `/collection/search`,
      {
        params: {
          filter: JSON.stringify(payloadBody),
        },
        next: {
          tags: ['/collection/search'],
          /* revalidate: 180, */
        },
      }
    );
  };

  /**
   * @public
   * @async
   * @function collectionListingsAnalytics
   * @param {string} ticker - The unique collection identifier called ticker
   * @returns {Promise<CollectionListings>} A promise that resolves to the distribution of listings
   */
  public collectionListingsAnalytics = async (
    ticker: string
  ): Promise<CollectionListings> => {
    return await this.api.fetchWithTimeout<CollectionListings>(
      `/collection/${ticker}/listings`,
      {
        next: {
          tags: ['collection/${ticker}/listings'],
          /* revalidate: 500, */
        },
      }
    );
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

  /**
   * Fetch collections profiles based on the provided arguments.
   * @param {GetCollectionsArgs} args - The GetCollectionsArgs object containing the search parameters.
   * @returns {Promise<CollectionsNFTsResponse>} A Promise that resolves to the CollectionsNFTsResponse object.
   * @throws An error if the 'top' value is greater than 100.
   */
  public getCollections = async (
    args?: GetCollectionsArgs
  ): Promise<CollectionsNFTsResponse> => {
    if (args?.top && args.top > 100) {
      throw new Error('Top cannot be greater than 100');
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

    const response = await this.api.fetchWithTimeout<ICollectionProfile[]>(
      `/collection/query`,
      {
        params: {
          filter: JSON.stringify(payloadBody),
        },
        next: {
          tags: ['getCollections'],
          /* revalidate: 180, */
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
   * Fetch global offers based on the provided arguments.
   * @param {GetGlobalOffersArgs} args - The GetCollectionsArgs object containing the search parameters.
   * @returns {Promise<GlobalOffersResult>} A Promise that resolves to the GlobalOffersResult object.
   * @throws An error if the 'top' value is greater than 100.
   */
  public getGlobalOffers = async (
    args?: GetGlobalOffersArgs
  ): Promise<GlobalOffersResult> => {
    if (args?.top && args.top > 100) {
      throw new Error('Top cannot be greater than 100');
    }

    const payloadBody = {
      skip: args?.skip || 0,
      top: args?.top || 25,
      select: args?.onlySelectFields || [],
      filters: {
        collection: args?.collections || [],
        withAttributes: args?.withAttributes,
        isActive: args?.onlyActive,
        offerId: args?.offerIds,
        owner: args?.ownedBy,
        marketplace: args?.listedOnlyOn,
        range: args?.priceRange
          ? { ...args.priceRange, type: 'priceShort' }
          : undefined,
        attributes: args?.attributes,
      },
      orderBy: args?.orderBy || [GlobalOfferOrderBy.PriceHighToLow],
    };

    const response = await this.api.fetchWithTimeout<GlobalOffersResult>(
      `/collection/global-offer/query`,
      {
        params: {
          filter: JSON.stringify(payloadBody),
        },
        next: {
          tags: ['getGlobalOffers'],
          /* revalidate: 12, */
        },
      }
    );
    return {
      ...response,
      getNextPagePayload: {
        ...args,
        skip: (args?.top || 25) + response.lastSkip,
      },
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
      `/collection/${collection}/analytics/volume?startTime=${after}&endTime=${before}&bin=${bin}`,
      {
        next: {
          tags: ['getCollectionVolume'],
          /* revalidate: 180, */
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getMarketplaceVolume
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
  public getMarketplaceVolume = async (
    after: string,
    before: string,
    bin: string
  ): Promise<CollectionVolume[]> => {
    const response = await this.api.fetchWithTimeout<CollectionVolume[]>(
      `/analytics/volume?startTime=${after}&endTime=${before}&bin=${bin}`,
      {
        next: {
          tags: ['getMarketplaceVolume'],
          /* revalidate: 180, */
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
   * @returns {Promise<IOwners>} A promise that resolves a struct of collection information about holders
   *
   * This function fetches owner information for a given collection. It takes the following parameter:
   * - collection (string): The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   *
   * The function first validates the input collection ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection owner information using the API.
   * Finally, it returns a promise that resolves a struct of collection information about holders
   */
  public getCollectionOwners = async (collection: string): Promise<IOwners> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<IOwners>(
      `/collection/${collection}/holders`,

      {
        next: {
          tags: ['getCollectionOwners'],
          /* revalidate: 500, */
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getExportOwners
   * @param {string} collection - The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   * @returns {Promise<ISingleHolder[]>} A promise that resolves an array of holders part of the collection.
   *
   * This function fetches owners information for a given collection. It takes the following parameter:
   * - collection (string): The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   *
   * The function first validates the input collection ticker and checks if it is a valid collection ticker.
   * If it is valid, the function fetches the collection owner information using the API.
   * Finally, it returns a promise that resolves to an array of collection owner information.
   */
  public getExportOwners = async (
    collection: string
  ): Promise<ISingleHolder[]> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<ISingleHolder[]>(
      `/collection/${collection}/holders?exportHolders=true`,

      {
        next: {
          tags: ['getExportOwners'],
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionsStatistics
   * @param {GetCollectionStatsArgs} args - The filter payload for the collection statsitics
   * @returns {Promise<CollectionStatsResults>} A promise that resolves to a struct with information
   * Finally, it returns a promise that resolves a struct with information
   */
  public getCollectionsStatistics = async (
    args: GetCollectionStatsArgs
  ): Promise<CollectionStatsResults> => {
    if (args?.top && args.top > 100) {
      throw new Error('Top cannot be greater than 100');
    }

    const response = await this.api.fetchWithTimeout<CollectionStatsResults>(
      `/collection/stats/query`,
      {
        params: {
          filter: JSON.stringify(args),
        },
        next: {
          tags: ['collectionStatistics'],
          /* revalidate: 12, */
        },
      }
    );
    return {
      ...response,
      getNextPagePayload: {
        ...args,
        skip: args.skip + args.top,
      },
    };
  };

  /**
   * @public
   * @async
   * @function getCollectionStats
   * @param {GetCollectionStatsArgs} args - The filter payload for the collection statsitics
   * @returns {Promise<CollectionStatsDoc>} A promise that resolves to a struct with information
   * Finally, it returns a promise that resolves a struct with information
   */
  public getCollectionStats = async (
    ticker: string
  ): Promise<CollectionStatsDoc> => {
    if (!isValidCollectionTicker(ticker)) {
      throw new Error('Invalid collection ticker: ' + ticker);
    }

    return await this.api.fetchWithTimeout<CollectionStatsDoc>(
      `/collection/${ticker}/stats`,
      {
        next: {
          tags: ['collectionStatistics'],
          /* revalidate: 12, */
        },
      }
    );
  };

  public getAwaitEmpty = async (delay: number): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, delay);
    });
  };

  /**
   * @public
   * @async
   * @function getCollectionMintInfo
   * @param {string} ticker - The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   * @returns {Promise<GetCollectionMintInfo>} A promise that resolves to a struct with information
   * Finally, it returns a promise that resolves a struct with information
   */
  public getCollectionMintInfo = async ({
    ticker,
    extra,
  }: {
    ticker: string;
    extra?: RequestInit;
  }): Promise<GetCollectionMintInfo> => {
    if (!isValidCollectionTicker(ticker)) {
      throw new Error('Invalid collection ticker: ' + ticker);
    }
    const response = await this.api.fetchWithTimeout<GetCollectionMintInfo>(
      `/collection/${ticker}/drop-info`,
      {
        next: {
          tags: [`/collection/${ticker}/drop-info`],
          /* revalidate: 12, */
        },
        ...extra,
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionRanks
   * @param {string} ticker - The ticker of the collection to fetch the owner information for (e.g., 'EAPES-8f3c1f').
   * @returns {Promise<CollectionRanksExport[]>} A promise that resolves to a struct with information
   * Finally, it returns a promise that resolves a struct with information
   */
  public getCollectionRanks = async ({
    ticker,
    extra,
  }: {
    ticker: string;
    extra?: RequestInit;
  }): Promise<CollectionRanksExport[]> => {
    if (!isValidCollectionTicker(ticker)) {
      throw new Error('Invalid collection ticker: ' + ticker);
    }
    const response = await this.api.fetchWithTimeout<CollectionRanksExport[]>(
      `/collection/${ticker}/ranks`,
      {
        next: {
          tags: [`/collection/${ticker}/ranks`],
          /* revalidate: 60, */
        },
        ...extra,
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getDropInfo
   * @param {string} collectionTag - The unique ID of the collection part of the launchpad smart contract
   * @param {string} creatorTag - The unique ID of the creator part of the launchpad smart contract
   * @returns {Promise<GetCollectionMintInfo>} A promise that resolves to a struct with information
   * Finally, it returns a promise that resolves a struct with information
   */
  public getDropInfo = async ({
    collectionTag,
    creatorTag,
    extra,
  }: {
    collectionTag: string;
    creatorTag: string;
    extra?: RequestInit;
  }): Promise<GetCollectionMintInfo> => {
    const response = await this.api.fetchWithTimeout<GetCollectionMintInfo>(
      `/collection/${creatorTag}/${collectionTag}/drop-info`,
      {
        next: {
          tags: [`/collection/${creatorTag}/${collectionTag}/drop-info`],
          /* revalidate: 12, */
        },
        ...extra,
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionGraphData
   * @param category - The ticker of the collection.
   * @returns {Promise<AnalyticsGraphs>} A promise the required analytics data
   * This function gets the global graph data
   */
  public getCollectionGraphData = async (
    collection: string,
    startTime: string,
    endTime: string,
    bin: string
  ): Promise<AnalyticsGraphs> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }
    const response = await this.api.fetchWithTimeout<AnalyticsGraphs>(
      `/collection/${collection}/analytics/volume`,
      {
        params: {
          startTime: startTime,
          endTime: endTime,
          bin: bin,
        },
        next: {
          tags: [`/collection/${collection}/analytics/volume`],
          /* revalidate: 60, */
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getPinnedCollections
   * @returns {Promise<ICollectionProfile[]>} A promise that resolves to the fetched pinned collections.
   */
  public getPinnedCollections = async (): Promise<ICollectionProfile[]> => {
    const response = await this.api.fetchWithTimeout<ICollectionProfile[]>(
      `/collection/pinned`,
      {
        next: {
          tags: [`/collection/pinned`],
          /* revalidate: 60, */
        },
      }
    );
    return response;
  };

  /**
   * Get drops based on the provided arguments.
   * @param {SearchNFTsArgs} args - The SearchNFTsArgs object containing the search parameters.
   * @returns {Promise<SearchNFTsResponse>} A Promise that resolves to the SearchNFTsResponse object.
   * @throws An error if the provided collection ticker is invalid or if the 'top' value is greater than 100.
   */
  public getDrops = async (args: GETDropsArgs): Promise<GetDropsResponse> => {
    args?.collections?.forEach((element) => {
      if (!isValidCollectionTicker(element)) {
        throw new Error('Invalid collection ticker: ' + element);
      }
    });

    if (args.top && args.top > 100) {
      throw new Error('Top cannot be greater than 100');
    }
    const ranges = [];

    if (args.timeRange) {
      ranges.push({
        ...args.timeRange,
        field: 'startTime',
      });
    }
    const payloadBody = {
      filters: {
        collection: args.collections ?? [],
        verifiedOnly: args.onlyVerified || false,
        mintToken: args.listedInToken || undefined,
        range: ranges,
      },
      orderBy: args.orderBy || [],
      select: args.onlySelectFields || [],
      includeCount: args.includeCount || false,
      top: args.top || 35,
      skip: args.skip || 0,
    };

    const response = await this.api.fetchWithTimeout<GetDropsResponse>(
      `/collection/drops/query`,
      {
        params: {
          filter: JSON.stringify(payloadBody),
        },
        next: {
          tags: ['/collection/drops/query'],
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

  /** Gets collection staking info
   * @param {String} collection - User's address
   * @returns {StakingSummaryPools[]} Collection's staking info
   * @throws {Error} Throws an error if the collection is invalid
   *  */
  public getCollectionStakingSummary = async ({
    collection,
    extra,
  }: {
    collection: string;
    extra?: RequestInit;
  }): Promise<StakingSummaryPools[]> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection);
    }

    const response = await this.api.fetchWithTimeout<StakingSummaryPools[]>(
      `/collection/${collection}/staking/summary`,
      {
        ...extra,
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getCollectionsFloor
   * @param collections - The tickers of the collection.
   * @returns {Promise<Record<string, number>>} Floor price of the collections
   * This function gets the floor price of the collections
   */
  public getCollectionsFloor = async (
    collections: string[]
  ): Promise<Record<string, number>> => {
    collections?.forEach((element) => {
      if (!isValidCollectionTicker(element)) {
        throw new Error('Invalid collection ticker: ' + element);
      }
    });
    const response = await this.api.fetchWithTimeout<Record<string, number>>(
      `/collection/floor-price`,
      {
        params: {
          collection: collections.join(','),
        },
      }
    );
    return response;
  };
}
