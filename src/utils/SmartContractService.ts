import type { AbiRegistry } from '@multiversx/sdk-core/out/smartcontracts/typesystem/abiRegistry'

export const getSmartContract = async (
  abiRegistry: AbiRegistry,
  address: string
) => {
  const { SmartContract } = await import(
    /*webpackIgnore: true*/
    '@multiversx/sdk-core/out/smartcontracts/smartContract'
  )
  const { Address } = await import(
    /*webpackIgnore: true*/
    '@multiversx/sdk-core/out/address'
  )
  return new SmartContract({
    address: new Address(address),
    abi: abiRegistry,
  })
}
