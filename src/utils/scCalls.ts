import {
  ContractQueryResponse,
  ProxyNetworkProvider,
} from '@multiversx/sdk-network-providers';
import { INetworkProvider } from '@multiversx/sdk-network-providers/out/interface';
import {
  ResultsParser,
  SmartContract,
  Interaction,
  TypedOutcomeBundle,
} from '@multiversx/sdk-core';
import { APIClient } from './api';

export class ContractQueryRunner {
  private readonly proxy: INetworkProvider;
  private readonly parser: ResultsParser = new ResultsParser();

  constructor() {
    const api = APIClient.getClient().apiUrl;
    this.proxy = new ProxyNetworkProvider(api, {
      timeout: 10000,
    });
  }

  async runQuery(
    contract: SmartContract,
    interaction: Interaction
  ): Promise<TypedOutcomeBundle> {
    try {
      const queryResponse: ContractQueryResponse =
        await this.proxy.queryContract(interaction.buildQuery());

      return this.parser.parseQueryResponse(
        queryResponse,
        interaction.getEndpoint()
      );
    } catch (error) {
      console.log(
        `Unexpected error when running query '${
          interaction.buildQuery().func
        }' to sc '${contract.getAddress().bech32()}' `
      );
      console.error(error);

      throw error;
    }
  }
}
