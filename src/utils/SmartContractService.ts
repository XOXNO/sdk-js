import {
  AbiRegistry,
  Address,
  SmartContract,
  SmartContractAbi,
} from '@multiversx/sdk-core/out';

export const getSmartContract = (
  abiRegistry: AbiRegistry,
  address: Address,
  implementedInterface: string
) => {
  return new SmartContract({
    address: address,
    abi: new SmartContractAbi(abiRegistry, [implementedInterface]),
  });
};
