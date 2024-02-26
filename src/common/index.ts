import {
  AssetCategory,
  FungibleAssets,
  FungibleAssetsMap,
} from '../types/collection';
import { AshSwapPaymentData, TokenUSDPrices } from '../types/common';
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
    const response = await this.api.fetchWithTimeout<TokenUSDPrices>(
      `/tokens/usd-price`
    );
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
    const response = await this.api.fetchWithTimeout<FungibleAssetsMap>(
      `/tokens`,
      {
        params: {
          identifiers: identifiers ? identifiers.join(',') : undefined,
          category: categories ? categories.join(',') : undefined,
        },
        next: {
          tags: ['getFungibleTokens'],
          revalidate: 500,
        },
      }
    );
    return response;
  };

  /**
   * @public
   * @async
   * @function getFungibleToken
   * @returns {Promise<FungibleAssets>} A promise that resolves the ESDT token info
   * This function fetches the branded fungible asset info
   */
  public getFungibleToken = async (
    identifier: string
  ): Promise<FungibleAssets> => {
    const response = await this.api.fetchWithTimeout<FungibleAssets>(
      `https://proxy-api.xoxno.com/getFungibleTokens/${identifier}`,
      {
        next: {
          tags: ['getFungibleToken'],
          revalidate: 500,
        },
      }
    );
    return response;
  };
}
