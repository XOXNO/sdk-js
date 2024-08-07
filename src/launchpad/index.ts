import type { Interaction } from '@multiversx/sdk-core/out/smartcontracts/interaction'
import type { SmartContract } from '@multiversx/sdk-core/out/smartcontracts/smartContract'

import { ContractQueryRunner } from '../utils/scCalls'
import { SmartContractAbis } from '../utils/SmartContractAbis'
import { getSmartContract } from '../utils/SmartContractService'

/**
 * LaunchpadModule provides methods to interact with the minter smart contract.
 * @class
 */
export class LaunchpadModule {
  private minter: SmartContract
  private call: ContractQueryRunner
  /**
   * @constructor
   * @param {SmartContract} minterAbiXOXNO - The minter smart contract instance.
   */
  constructor(minterAbiXOXNO: SmartContract) {
    this.minter = minterAbiXOXNO
    this.call = new ContractQueryRunner()
  }

  /**
   * Executes the provided interaction and returns the result.
   * @private
   * @param {Interaction} interaction - The smart contract interaction.
   * @returns {Promise<any>} The result of the interaction.
   */
  private async getResult(interaction: Interaction) {
    return await this.call.runQuery(this.minter, interaction)
  }

  /**
   * Initializes the LaunchpadModule with a minter smart contract instance.
   * @static
   * @param {string} minterSC - The minter smart contract address.
   * @returns {Promise<LaunchpadModule>} A new instance of LaunchpadModule.
   */
  static async init(minterSC: string) {
    const minterAbiXOXNO = await SmartContractAbis.getMinter()
    const minter_abi = getSmartContract(minterAbiXOXNO, minterSC)
    return new LaunchpadModule(minter_abi)
  }

  /**
   * Fetches all unique tags from the minter smart contract.
   * @public
   * @returns {Promise<string[]>} An array of unique tags.
   */
  public getAllUniqueTags = async (): Promise<string[]> => {
    const interaction = this.minter.methods.collections()
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf().map((x: any) => x.toString())
  }

  /**
   * Fetches the global buy count for a user and tag.
   * @public
   * @param {string} user - The user's address.
   * @param {string} tag - The tag.
   * @returns {Promise<number>} The global buy count.
   */
  public getWalletGlobalBuyCount = async (
    user: string,
    tag: string
  ): Promise<number> => {
    const interaction = this.minter.methods.buysPerWallet([user, tag])
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf()
  }

  /**
   * Fetches the stage buy count for a user, tag, and stage.
   * @public
   * @param {string} user - The user's address.
   * @param {string} tag - The tag.
   * @param {string} stage - The stage.
   * @returns {Promise<number>} The stage buy count.
   */
  public getWalletStageBuyCount = async (
    user: string,
    tag: string,
    stage: string
  ): Promise<number> => {
    const interaction = this.minter.methods.buysStagePerWallet([
      user,
      tag,
      stage,
    ])
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf()
  }

  /**
   * Fetches the local owner's address from the minter smart contract.
   * @public
   * @returns {Promise<string>} The local owner's address.
   */
  public getLocalOwner = async (): Promise<string> => {
    const interaction = this.minter.methods.localOwner()
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf()
  }

  /**
   * Fetches the launchpad cut fee percentage from the minter smart contract.
   * @public
   * @returns {Promise<number>} The launchpad cut fee percentage.
   */

  public getLaunchpadCutFee = async (): Promise<number> => {
    const interaction = this.minter.methods.cutPercentage()
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf()
  }

  /**
   * Fetches the stage whitelist of wallets for a tag and stage.
   * @public
   * @param {string} tag - The tag.
   * @param {string} stage - The stage.
   * @returns {Promise<string[]>} An array of whitelisted wallet addresses.
   */
  public getStageWhitelist = async (
    tag: string,
    stage: string
  ): Promise<string[]> => {
    const interaction = this.minter.methods.getWhitelistedWallets([tag, stage])
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf().map((x: any) => x.toString())
  }

  /**
   * Fetches the list of stages for a tag.
   * @public
   * @param {string} tag - The tag.
   * @returns {Promise<string[]>} An array of stages.
   */
  public getStages = async (tag: string): Promise<string[]> => {
    const interaction = this.minter.methods.mintStage([tag])
    const result = await this.getResult(interaction)
    return result.firstValue?.valueOf().map((x: any) => {
      const body = x[1].valueOf()
      body.name = body.name.toString()
      body.tag = body.name.toString()
      body.start_time = parseInt(body.start_time.toString())
      body.end_time = parseInt(body.end_time.toString())
      body.mint_limit = parseInt(body.mint_limit.toString())
      body.mint_count = parseInt(body.mint_count.toString())
      body.max_per_wallet = parseInt(body.max_per_wallet.toString())
      body.prices = body.prices.map((x: any) => {
        const pr = x.valueOf()
        return {
          ...pr,
          token_nonce: parseInt(pr.token_nonce.toString()),
          amount: pr.amount.toString(),
        }
      })

      return body
    })
  }
}
