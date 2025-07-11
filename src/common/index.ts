import type {
  ActivityChain,
  ActivityHistoryDto,
  FilterQueryDto,
  GlobalSearchResponseDto,
  NftActivityFilter,
  PublicOnly,
  StakingExploreDto,
} from '@xoxno/types'
import { TokenCategory } from '@xoxno/types'

import type { FungibleAssetsMap } from '../types/collection'
import type {
  AshSwapPaymentData,
  StatisticsSummary,
  TokenUSDPrices,
} from '../types/common'
import { XOXNOClient } from '../utils/api'
import { paginatedGuard } from '../utils/guards'

export class CommonModule {
  private api: XOXNOClient
  constructor() {
    this.api = XOXNOClient.getInstance()
  }
  /** Gets all tokens usd price
   * @returns {TokenUSDPrices} User's creator info
   *  */
  public getTokensUsdPrice = async (): Promise<TokenUSDPrices> => {
    const response =
      await this.api.fetchWithTimeout<TokenUSDPrices>(`/tokens/usd-price`)
    return response
  }

  /** Gets all tokens usd price
   * @returns {TokenUSDPrices} User's creator info
   *  */
  public getAshSwapAmount = async ({
    originalToken,
    originalTokenValue,
    paymentToken,
  }: {
    originalToken: string
    originalTokenValue: string
    paymentToken: string
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
    )
    return response
  }

  /**
   * @public
   * @async
   * @function getFungibleTokens
   * @param category - The ticker of the collection.
   * @returns {Promise<FungibleAssetsMap>} A promise that resolves a map of ESDT tokens and their info
   * This function fetches all branded fungible assets and their info
   */
  public getFungibleTokens = async (
    categories: TokenCategory[] = [TokenCategory.ALL],
    identifiers?: string[],
    chain?: ActivityChain[]
  ): Promise<FungibleAssetsMap> => {
    let params = {}

    if (identifiers) {
      params = {
        identifier: identifiers.join(','),
      }
    }

    if (categories) {
      params = {
        ...params,
        category: categories.join(','),
      }
    }
    if (chain) {
      params = {
        ...params,
        chain: chain.join(','),
      }
    }

    const response = await this.api.fetchWithTimeout<FungibleAssetsMap>(
      `/tokens`,
      {
        params,
      }
    )
    return response
  }

  /**
   * @public
   * @async
   * @function getAnalyticsOverview
   * @returns {Promise<StatisticsSummary>} A promise the required analytics data
   * This function gets the global graph data
   */
  public getAnalyticsOverview = async (
    chain?: ActivityChain[]
  ): Promise<StatisticsSummary> => {
    const response = await this.api.fetchWithTimeout<StatisticsSummary>(
      `/analytics/overview${
        chain?.length
          ? chain
              .map((item, index) => {
                return `${index ? '&' : '?'}chain=${item}`
              })
              .join('')
          : ''
      }`
    )
    return response
  }

  /**
   * @public
   * @async
   * @function suggestResults
   * @param {FilterQueryDto} args - An object containing the necessary parameters to fetch suggested NFT results.
   * @returns {Promise<GlobalSearchResponseDto>} A promise that resolves to the fetched NFT results.
   *
   * This function fetches suggested NFT results based on the provided arguments. It takes an object with the following properties:
   * - name (string): The name to search for (required).
   * - orderBy (SuggestOrderBy[], optional): An array of ordering preferences for the results.
   * - top (number, optional): The maximum number of results to return (default is 35, cannot be greater than 100).
   * - skip (number, optional): The number of results to skip (default is 0).
   *
   * The function first validates the input arguments and constructs a payload body with the provided parameters.
   * Then, it converts the payload body into a base64 string and fetches the suggested results using the API.
   * Finally, it returns a promise that resolves to the fetched NFT results.
   */
  public suggestResults = async (args: PublicOnly<FilterQueryDto>) => {
    return paginatedGuard(args, (filter) => {
      return this.api.fetchWithTimeout<GlobalSearchResponseDto>('/search', {
        params: {
          filter,
        },
      })
    })
  }

  /**
   * @public
   * @async
   * @function getExploreStaking
   * @returns {Promise<StakingExploreDto[]>} A promise that resolves to the fetched staking explore data.
   * This function fetches the staking explore data.
   */
  public getExploreStaking = async () => {
    return this.api.fetchWithTimeout<StakingExploreDto[]>(
      `/collection/staking/explore`
    )
  }

  /**
   * Retrieves trading history based on the provided arguments.
   *
   * @param {NftActivityFilter} args - The arguments for filtering the trading activity.
   * @returns {Promise<ActivityHistoryDto>} A promise resolving to a TradingActivityResponse object containing the activity.
   * @throws {Error} Throws an error if the 'top' argument is greater than 100.
   */
  public getTradingActivity = async (args: PublicOnly<NftActivityFilter>) => {
    return paginatedGuard(args, (filter) => {
      return this.api.fetchWithTimeout<ActivityHistoryDto>('/activity/query', {
        params: {
          filter,
        },
      })
    })
  }
}
