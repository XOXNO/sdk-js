import type { GetSingleNftOfferResponseDto, NftDoc } from '@xoxno/types'

import type { ArgsQueryTop } from '../types'
import type { ActivityChain } from '../types/nft'
import { XOXNOClient } from '../utils/api'
import { nftGuard, paginatedGuard } from '../utils/guards'
import { getIdentifierFromColAndNonce } from '../utils/helpers'
import { isValidCollectionTicker, isValidNftIdentifier } from '../utils/regex'

/**
 * NFTModule provides a set of methods to interact with single NFTs.
 * It includes methods for getting single NFT information, and searching NFTs by collection and nonce.
 *
 * @example
 * const nftModule = new NFTModule();
 */

export class NFTModule {
  private api: XOXNOClient
  constructor() {
    this.api = XOXNOClient.getInstance()
  }

  /**
   * @public
   * @async
   * @function getNFTByIdentifier
   * @param {string} identifier - The identifier of the NFT to fetch data for.
   * @returns {Promise<NftDoc>} A promise that resolves to the fetched NFT data.
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
  ): Promise<NftDoc> => {
    if (!isValidNftIdentifier(identifier)) {
      throw new Error('Invalid identifier: ' + identifier)
    }
    const response = await this.api.fetchWithTimeout<NftDoc>(
      `/nft/${identifier}`,
      {
        ...extra,
      }
    )
    return response
  }

  /**
   * @public
   * @async
   * @function getNFTByIdentifier
   * @param {string} identifier - The identifier of the NFT to fetch data for.
   * @returns {Promise<NftDoc>} A promise that resolves to the fetched NFT data.
   *
   * This function fetches data for a given NFT by its identifier. It takes the following parameter:
   * - identifier (string): The identifier of the NFT to fetch data for.
   *
   * The function first validates the input identifier and checks if it is a valid NFT identifier.
   * If it is valid, the function fetches the NFT data using the API.
   * Finally, it returns a promise that resolves to the fetched NFT data.
   */
  public getNFTsOffers = async ({ identifier, ...args }: ArgsQueryTop) => {
    return nftGuard(
      identifier,
      paginatedGuard(args, () => {
        return this.api.fetchWithTimeout<GetSingleNftOfferResponseDto>(
          `/nft/${identifier}/offers`,
          {
            params: args,
          }
        )
      })
    )
  }

  /**
   * Gets an NFT by collection and nonce.
   * @param collection The collection ticker.
   * @param nonce The nonce of the NFT.
   * @returns {Promise<NftDoc>} The NFT data.
   * @throws Throws an error when the collection ticker is invalid.
   */
  public getNFTByCollectionAndNonce = async (
    collection: string,
    nonce: number
  ): Promise<NftDoc> => {
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection)
    }

    const response = await this.api.fetchWithTimeout<NftDoc>(
      `/${getIdentifierFromColAndNonce(collection, nonce)}`
    )
    return response
  }

  /**
   * @public
   * @async
   * @function getDailyTrending
   * @returns {Promise<NftDoc[]>} A promise that resolves to the array of trending NFTs.
   * This function fetches the top NFTs that are trending today based on their floor and volumes
   */
  public getDailyTrending = async (): Promise<NftDoc[]> => {
    const response = await this.api.fetchWithTimeout<NftDoc[]>(
      '/nfts/getDailyTrending'
    )
    return response
  }

  /**
   * @public
   * @async
   * @function getPinnedNFTs
   * @returns {Promise<NftDoc[]>} A promise that resolves to the fetched pinned collections.
   */
  public getPinnedNFTs = async (chain?: ActivityChain): Promise<NftDoc[]> => {
    const response = await this.api.fetchWithTimeout<NftDoc[]>(
      `/nft/pinned${chain ? `?chain=${chain}` : ''}`
    )
    return response
  }

  /**
   * Get NFT by collection and nonce hex
   *
   * @param collection - collection ticker
   * @param nonceHex - nonce hex
   * @return {Promise<NftDoc>} NFT data
   */

  public getNFTByCollectionAndNonceHex = async (
    collection: string,
    nonceHex: string
  ): Promise<NftDoc> => {
    // check that collection is valid
    if (!isValidCollectionTicker(collection)) {
      throw new Error('Invalid collection ticker: ' + collection)
    }
    // make sure nonceHex is even
    if (nonceHex.length % 2 !== 0) {
      nonceHex = '0' + nonceHex
    }
    // fetch the NFT data
    const response = await this.api.fetchWithTimeout<NftDoc>(
      `/${[collection, nonceHex].join('-')}`
    )
    return response
  }
}
