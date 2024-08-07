import { Address } from '@multiversx/sdk-core/out/address'
import { SmartContract } from '@multiversx/sdk-core/out/smartcontracts/smartContract'
import type { AbiRegistry } from '@multiversx/sdk-core/out/smartcontracts/typesystem/abiRegistry'

export const getSmartContract = (abiRegistry: AbiRegistry, address: string) => {
  return new SmartContract({
    address: new Address(address),
    abi: abiRegistry,
  })
}
