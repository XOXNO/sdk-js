import { AbiRegistry } from '@multiversx/sdk-core/out/smartcontracts/typesystem/abiRegistry';

export class SmartContractAbis {
  private static manager: AbiRegistry;
  private static exchange: AbiRegistry;
  private static minter: AbiRegistry;
  private static market: AbiRegistry;
  private static staking: AbiRegistry;
  private static p2p: AbiRegistry;

  public static async getMarket(): Promise<AbiRegistry> {
    if (!SmartContractAbis.market) {
      const data = await fetch(
        `${'https://media.xoxno.com/'}smartcontractabi/esdt-nft-marketplace.abi.json`
      );
      const abiRegistry = AbiRegistry.create(await data.json());
      SmartContractAbis.market = abiRegistry;
    }

    return SmartContractAbis.market;
  }
  public static async getManager(): Promise<AbiRegistry> {
    if (!SmartContractAbis.manager) {
      const data = await fetch(
        `${'https://media.xoxno.com/'}smartcontractabi/manage.json`
      );
      const abiRegistry = AbiRegistry.create(await data.json());
      SmartContractAbis.manager = abiRegistry;
    }

    return SmartContractAbis.manager;
  }

  public static async getMinter(): Promise<AbiRegistry> {
    if (!SmartContractAbis.minter) {
      const data = await fetch(
        `${'https://media.xoxno.com/'}smartcontractabi/minter.json`
      );
      const abiRegistry = AbiRegistry.create(await data.json());
      SmartContractAbis.minter = abiRegistry;
    }

    return SmartContractAbis.minter;
  }

  public static async getStaking(): Promise<AbiRegistry> {
    if (!SmartContractAbis.staking) {
      const data = await fetch(
        'https://media.xoxno.com/smartcontractabi/staking-nfts.abi.json'
      );
      const abiRegistry = AbiRegistry.create(await data.json());
      SmartContractAbis.staking = abiRegistry;
    }

    return SmartContractAbis.staking;
  }

  public static async getExchange(): Promise<AbiRegistry> {
    if (!SmartContractAbis.exchange) {
      const data = await fetch(
        `${'https://media.xoxno.com/'}smartcontractabi/rs-exchange.abi.json`
      );
      const abiRegistry = AbiRegistry.create(await data.json());
      SmartContractAbis.exchange = abiRegistry;
    }

    return SmartContractAbis.exchange;
  }

  public static async getP2P(): Promise<AbiRegistry> {
    if (!SmartContractAbis.p2p) {
      const data = await fetch(
        `${'https://media.xoxno.com/'}smartcontractabi/p2p.abi.json`
      );
      const abiRegistry = AbiRegistry.create(await data.json());
      SmartContractAbis.p2p = abiRegistry;
    }

    return SmartContractAbis.p2p;
  }
}
