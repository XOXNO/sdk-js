import { AbiRegistry } from '@multiversx/sdk-core/out/smartcontracts/typesystem/abiRegistry';
import { XOXNOClient } from './api';

export class SmartContractAbis {
  private static manager: AbiRegistry;
  private static exchange: AbiRegistry;
  private static minter: AbiRegistry;
  private static market: AbiRegistry;
  private static staking: AbiRegistry;
  private static p2p: AbiRegistry;

  public static async getMarket(): Promise<AbiRegistry> {
    if (!SmartContractAbis.market) {
      const data = await XOXNOClient.getInstance().fetchWithTimeout<any>(
        `${XOXNOClient.getInstance().config.mediaUrl}/smartcontractabi/marketplace-xoxno.json`,
        {
          next: {
            tags: ['getMarket'],
          },
        }
      );
      const abiRegistry = AbiRegistry.create(data);
      SmartContractAbis.market = abiRegistry;
    }

    return SmartContractAbis.market;
  }

  public static async getManager(): Promise<AbiRegistry> {
    if (!SmartContractAbis.manager) {
      const data = await XOXNOClient.getInstance().fetchWithTimeout<any>(
        `${XOXNOClient.getInstance().config.mediaUrl}/smartcontractabi/manage.json`,
        {
          next: {
            tags: ['getManager'],
          },
        }
      );
      const abiRegistry = AbiRegistry.create(data);
      SmartContractAbis.manager = abiRegistry;
    }

    return SmartContractAbis.manager;
  }

  public static async getMinter(): Promise<AbiRegistry> {
    if (!SmartContractAbis.minter) {
      const data = await XOXNOClient.getInstance().fetchWithTimeout<any>(
        `${XOXNOClient.getInstance().config.mediaUrl}/smartcontractabi/minter.json`,
        {
          next: {
            tags: ['getMinter'],
          },
        }
      );
      const abiRegistry = AbiRegistry.create(data);
      SmartContractAbis.minter = abiRegistry;
    }

    return SmartContractAbis.minter;
  }

  public static async getStaking(): Promise<AbiRegistry> {
    if (!SmartContractAbis.staking) {
      const data = await XOXNOClient.getInstance().fetchWithTimeout<any>(
        `${XOXNOClient.getInstance().config.mediaUrl}/smartcontractabi/staking-nfts.abi.json`,
        {
          next: {
            tags: ['getStaking'],
          },
        }
      );
      const abiRegistry = AbiRegistry.create(data);
      SmartContractAbis.staking = abiRegistry;
    }

    return SmartContractAbis.staking;
  }

  public static async getExchange(): Promise<AbiRegistry> {
    if (!SmartContractAbis.exchange) {
      const data = await XOXNOClient.getInstance().fetchWithTimeout<any>(
        `${XOXNOClient.getInstance().config.mediaUrl}/smartcontractabi/rs-exchange.abi.json`,
        {
          next: {
            tags: ['getExchange'],
          },
        }
      );
      const abiRegistry = AbiRegistry.create(data);
      SmartContractAbis.exchange = abiRegistry;
    }

    return SmartContractAbis.exchange;
  }

  public static async getP2P(): Promise<AbiRegistry> {
    if (!SmartContractAbis.p2p) {
      const data = await XOXNOClient.getInstance().fetchWithTimeout<any>(
        `${XOXNOClient.getInstance().config.mediaUrl}/smartcontractabi/p2p.abi.json`,
        {
          next: {
            tags: ['getP2P'],
            revalidate: 500,
          },
        }
      );
      const abiRegistry = AbiRegistry.create(data);
      SmartContractAbis.p2p = abiRegistry;
    }

    return SmartContractAbis.p2p;
  }
}
