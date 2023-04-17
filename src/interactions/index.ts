import type { Interaction } from '@multiversx/sdk-core/out/smartcontracts/interaction';
import { GlobalOffer } from '../types/collection';
import XOXNOClient from '../utils/api';
import { ContractQueryRunner } from '../utils/scCalls';
import { SmartContractAbis } from '../utils/SmartContractAbis';
import { getSmartContract } from '../utils/SmartContractService';
import type { SmartContract } from '@multiversx/sdk-core/out/smartcontracts/smartContract';
import { BigUIntValue } from '@multiversx/sdk-core/out/smartcontracts/typesystem/numerical';

export default class SCInteraction {
  private xo: SmartContract;
  private call: ContractQueryRunner;
  constructor(marketAbiXOXNO: SmartContract) {
    this.xo = marketAbiXOXNO;
    this.call = new ContractQueryRunner();
  }

  static async create() {
    const config = XOXNOClient.init().config;
    const marketAbiXOXNO = await SmartContractAbis.getMarket();
    const xo_abi = getSmartContract(marketAbiXOXNO, config.XO_SC);

    return new SCInteraction(xo_abi);
  }

  private async getResult(interaction: Interaction) {
    return await this.call.runQuery(this.xo, interaction);
  }

  /**
   * Gets the percentage of each transaction that will be paid to the marketplace.
   *
   * @returns The percentage of each transaction that will be paid to the marketplace.
   */
  public getMarketplaceFees = async (): Promise<number> => {
    const interaction = this.xo.methods.getMarketplaceCutPercentage();
    const result = await this.getResult(interaction);
    return parseInt(result.firstValue?.valueOf());
  };

  /**
   * Retrieves the list of accepted payment tokens.
   * @returns {string[]} A list of accepted payment tokens.
   */
  public getAcceptedPaymentTokens = async (): Promise<string[]> => {
    const interaction = this.xo.methods.getAcceptedTokens();
    const result = await this.getResult(interaction);
    return result.firstValue?.valueOf();
  };

  /**
   * This function returns a list of IDs of global offers.
   * @returns {number[]} a list of IDs of global offers.
   */

  public getGlobalOfferIDs = async (): Promise<number[]> => {
    const interaction = this.xo.methods.getGlobalOffers();
    const result = await this.getResult(interaction);
    return result.firstValue?.valueOf().map((id: string) => parseInt(id));
  };

  /**
   * Gets the balance of a user in a token of a specific pool.
   * @param address The address of the user.
   * @param token The token address.
   * @param nonce The nonce of the pool.
   * @returns {number} The balance of the user in the token of the pool.
   */
  async getUserPoolBalance(
    address: string,
    token: string,
    nonce: number
  ): Promise<number> {
    const result = await this.getResult(
      this.xo.methods.userDeposit([address, token, nonce])
    );

    if (!result?.firstValue) {
      return 0;
    }
    return new BigUIntValue(result.firstValue.valueOf().amount)
      .valueOf()
      .shiftedBy(-18)
      .toNumber();
  }

  // function to determine if the offer is active
  // based on the offer price and user balance
  private isOfferActive(offer_price: number, user_balance: number): boolean {
    return offer_price <= user_balance;
  }

  /**
   * Returns the global offer data for the offer with the given id.
   *
   * @param global_offer_id The id of the global offer for which to return the data.
   *
   * @returns An object containing the global offer data for the offer with the given id. If the global offer id is invalid, the return value will be null.
   */

  public getGlobalOfferData = async (
    global_offer_id: number
  ): Promise<GlobalOffer> => {
    const interaction = this.xo.methods.getGlobalOffer([global_offer_id]);
    const result = await this.getResult(interaction);
    const body = result.firstValue?.valueOf();
    body.offer_id = parseInt(body.offer_id.valueOf());
    body.marketplace = 'XO';
    body.short_price = parseFloat(
      new BigUIntValue(body.price).valueOf().shiftedBy(-18).toString()
    );
    body.new_version = Boolean(body.new_version);
    if (!body.new_version) {
      body.isActive = this.isOfferActive(
        body.short_price,
        await this.getUserPoolBalance(
          body.owner,
          body.payment_token,
          body.payment_nonce
        )
      );
    } else {
      body.isActive = true;
    }
    body.quantity = parseInt(body.quantity.valueOf());
    body.payment_nonce = parseInt(body.payment_nonce.valueOf());
    body.price = body.price.valueOf();

    body.timestamp = parseInt(body.timestamp.valueOf());
    body.owner = body.owner.valueOf().toString();
    if (body.attributes) {
      body.attributes = JSON.parse(
        Buffer.from(body.attributes.valueOf().toString(), 'base64').toString(
          'ascii'
        )
      );
    }
    return body as GlobalOffer;
  };

  /** Gets the number of listings.
   * @returns {number} The number of listings.
   * */
  public async getListingsCount(): Promise<number> {
    const result = await this.getResult(this.xo.methods.getListingsCount());
    const count = parseInt(result.firstValue?.valueOf());
    return count;
  }

  /** Gets the number of custom offers.
   * @returns {number} The number of custom offers.
   * */
  public async getOffersCount(): Promise<number> {
    const result = await this.getResult(this.xo.methods.getOffersCount());
    const count = parseInt(result.firstValue?.valueOf());
    return count;
  }

  /** Gets the number of global offers.
   * @returns {number} The number of global offers.
   * */
  public async getGlobalOffersCount(): Promise<number> {
    const result = await this.getResult(this.xo.methods.getGlobalOffersCount());
    const count = parseInt(result.firstValue?.valueOf());
    return count;
  }

  /** Gets the number of collections listed.
   * @returns {number} The number of collections listed.
   * */
  public async getCollectionsCount(): Promise<number> {
    const result = await this.getResult(this.xo.methods.getCollectionsCount());
    const count = parseInt(result.firstValue?.valueOf());
    return count;
  }

  /**
   * Checks whether a collection is listed with at least 1 NFT.
   *
   * @param collection name of the collection
   * @return true if the collection is listed, false otherwise
   */
  public async isCollectionListed(collection: string): Promise<boolean> {
    const result = await this.getResult(
      this.xo.methods.isCollectionListed([collection])
    );
    return Boolean(result.firstValue?.valueOf());
  }

  /** Gets the on sale NFT count of the collection.
   *
   * @param collection The collection identifier for which one wants to get the on sale NFT count.
   *
   * @returns {number} The on sale NFT count of the collection.
   * */
  public async getCollectionNFTsOnSaleCount(
    collection: string
  ): Promise<number> {
    const result = await this.getResult(
      this.xo.methods.getTokenItemsForSaleCount([collection])
    );
    return parseInt(result.firstValue?.valueOf());
  }

  /** Gets the active unique auction IDs of collection.
   *
   * @param collection The collection identifier for which one wants to get the active unique auction IDs.
   *
   * @returns {number[]} The active unique auction IDs of collection.
   * */

  public async getAuctionIDsForCollection(
    collection: string
  ): Promise<number[]> {
    const result = await this.getResult(
      this.xo.methods.getAuctionsForTicker([collection])
    );
    const ids = result.firstValue?.valueOf().map((id: string) => parseInt(id));
    return ids;
  }
}
