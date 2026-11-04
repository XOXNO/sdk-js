import { rpc } from '@stellar/stellar-sdk'
import {
  buildStellarSupplyTx,
  prepareStellarBuiltTx,
  type StellarAuthorizationOptions,
  type StellarLendingBuilderOptions,
  type StellarSupplyArgs,
} from '@xoxno/sdk-js/stellar-lending'

/** Prepare only. The host then signs with sourceAccount and submits on this network. */
export async function prepareSmartAccountSupply(
  server: rpc.Server,
  options: Omit<StellarLendingBuilderOptions, 'sourceSequence'> & { sourceAccount: string },
  payment: StellarSupplyArgs,
  authorizeEntry: StellarAuthorizationOptions['authorizeEntry']
): Promise<string> {
  const source = await server.getAccount(options.sourceAccount)
  const built = buildStellarSupplyTx({
    ...options, sourceSequence: source.sequenceNumber(),
  }, payment)
  return prepareStellarBuiltTx(server, built, {
    network: options.network,
    authorization: { caller: options.caller, authorizeEntry },
  })
}
