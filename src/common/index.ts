import {
  AssetCategory,
  FungibleAssetsMap,
  SuggestNFTsArgs,
  SuggestResults,
} from '../types/collection';
import {
  AnalyticsGraphs,
  AshSwapPaymentData,
  StakingExplore,
  StatisticsSummary,
  TokenUSDPrices,
} from '../types/common';
import { XOXNOClient } from '../utils/api';

export class CommonModule {
  private api: XOXNOClient;
  constructor() {
    this.api = XOXNOClient.init();
  }
  /** Gets all tokens usd price
   * @returns {TokenUSDPrices} User's creator info
   *  */
  public getTokensUsdPrice = async (): Promise<TokenUSDPrices> => {
    const response =
      await this.api.fetchWithTimeout<TokenUSDPrices>(`/tokens/usd-price`);
    return response;
  };

  /** Gets all tokens usd price
   * @returns {TokenUSDPrices} User's creator info
   *  */
  public getAshSwapAmount = async ({
    originalToken,
    originalTokenValue,
    paymentToken,
  }: {
    originalToken: string;
    originalTokenValue: string;
    paymentToken: string;
  }): Promise<AshSwapPaymentData> => {
    const response = await this.api.fetchWithTimeout<AshSwapPaymentData>(
      `/ash/min-token-quantity`,
      {
        params: {
          originalToken: originalToken,
          originalTokenValue: originalTokenValue,
          paymentToken: paymentToken,
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getFungibleTokens
   * @param category - The ticker of the collection.
   * @returns {Promise<FungibleAssetsMap>} A promise that resolves a map of ESDT tokens and their info
   * This function fetches all branded fungible assets and their info
   */
  public getFungibleTokens = async (
    categories: AssetCategory[] = [AssetCategory.ALL],
    identifiers?: string[]
  ): Promise<FungibleAssetsMap> => {
    let params = {};

    if (identifiers) {
      params = {
        identifier: identifiers.join(','),
      };
    }

    if (categories) {
      params = {
        ...params,
        category: categories.join(','),
      };
    }
    const response = await this.api.fetchWithTimeout<FungibleAssetsMap>(
      `/tokens`,
      {
        params,
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getGlobalGraphData
   * @param category - The ticker of the collection.
   * @returns {Promise<AnalyticsGraphs>} A promise the required analytics data
   * This function gets the global graph data
   */
  public getGlobalGraphData = async (
    startTime: string,
    endTime: string,
    bin: string
  ): Promise<AnalyticsGraphs> => {
    const response = await this.api.fetchWithTimeout<AnalyticsGraphs>(
      `/analytics/volume`,
      {
        params: {
          startTime: startTime,
          endTime: endTime,
          bin: bin,
        },
        next: {
          tags: ['/analytics/volume'],
          revalidate: 60,
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getAnalyticsOverview
   * @returns {Promise<StatisticsSummary>} A promise the required analytics data
   * This function gets the global graph data
   */
  public getAnalyticsOverview = async (): Promise<StatisticsSummary> => {
    const response = await this.api.fetchWithTimeout<StatisticsSummary>(
      `/analytics/overview`,
      {
        next: {
          tags: ['/analytics/overview'],
          revalidate: 60,
        },
      }
    );
    return response;
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
      top: args.top || 35,
      skip: args.skip || 0,
    };

    return await this.api.fetchWithTimeout<SuggestResults>(`/search`, {
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
   * @public
   * @async
   * @function getExploreStaking
   * @returns {Promise<StakingExplore[]>} A promise that resolves to the fetched staking explore data.
   * This function fetches the staking explore data.
   */
  public getExploreStaking = async (): Promise<StakingExplore[]> => {
    const response = await this.api.fetchWithTimeout<StakingExplore[]>(
      `/collection/staking/explore`,
      {
        next: {
          tags: ['/collection/staking/explore'],
          revalidate: 60,
        },
      }
    );
    return response;
  };
}
