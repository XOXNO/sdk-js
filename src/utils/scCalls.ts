import type { Interaction } from '@multiversx/sdk-core/out/smartcontracts/interaction'
import type { TypedOutcomeBundle } from '@multiversx/sdk-core/out/smartcontracts/interface'
import type { ResultsParser } from '@multiversx/sdk-core/out/smartcontracts/resultsParser'
import type { SmartContract } from '@multiversx/sdk-core/out/smartcontracts/smartContract'
import type { ContractQueryResponse } from '@multiversx/sdk-network-providers/out/contractQueryResponse'
import type { INetworkProvider } from '@multiversx/sdk-network-providers/out/interface'

import { XOXNOClient } from './api'

export class ContractQueryRunner {
  private readonly proxy: INetworkProvider
  private readonly parser: ResultsParser

  private constructor(proxy: INetworkProvider, parser: ResultsParser) {
    this.proxy = proxy
    this.parser = parser
  }

  static async init() {
    const { ProxyNetworkProvider } = await import(
      /*webpackIgnore: true*/ '@multiversx/sdk-network-providers/out/proxyNetworkProvider'
    )
    const { ResultsParser } = await import(
      /*webpackIgnore: true*/ '@multiversx/sdk-core/out/smartcontracts/resultsParser'
    )
    const api = new XOXNOClient().config.gatewayUrl
    const proxy = new ProxyNetworkProvider(api, {
      timeout: 10000,
    })

    return new ContractQueryRunner(proxy, new ResultsParser())
  }

  async runQuery(
    contract: SmartContract,
    interaction: Interaction
  ): Promise<TypedOutcomeBundle> {
    try {
      const queryResponse: ContractQueryResponse =
        await this.proxy.queryContract(interaction.buildQuery())

      return this.parser.parseQueryResponse(
        queryResponse,
        interaction.getEndpoint()
      )
    } catch (error) {
      console.log(
        `Unexpected error when running query '${
          interaction.buildQuery().func
        }' to sc '${contract.getAddress().bech32()}' `
      )
      console.error(error)

      throw error
    }
  }
}
