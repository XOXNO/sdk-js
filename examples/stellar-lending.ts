/** Host-application example. Importing this file performs no requests or transactions. */
import {
  XOXNOClient,
  stellarLendingRead,
  buildStellarSupplyTx,
  prepareStellarBuiltTx,
  STELLAR_NETWORK_PASSPHRASE,
  type StellarNetwork,
  type StellarSupplyArgs,
} from '@xoxno/sdk-js/stellar-lending'
import { rpc, TransactionBuilder } from '@stellar/stellar-sdk'

/** List market choices and positions for a wallet on an explicit API deployment. */
export async function listLending(apiUrl: string, owner: string, signal?: AbortSignal) {
  const read = stellarLendingRead(new XOXNOClient({ apiUrl }))
  const [context, portfolio] = await Promise.all([
    read.context({ signal }),
    read.userPositions(owner, { signal }),
  ])
  // Render all choices. Let the user select the asset, liquidity hub and risk spoke.
  return { context, positions: portfolio.positions }
}

/** Build and prepare a user-selected supply. The source account must already exist. */
export async function prepareSupply(input: {
  apiUrl: string
  rpcUrl: string
  network: StellarNetwork
  controllerAddress: string
  caller: string
  supply: StellarSupplyArgs
}) {
  const { apiUrl, rpcUrl, network, controllerAddress, caller, supply } = input
  const read = stellarLendingRead(new XOXNOClient({ apiUrl }))
  // Coordinates come from a selected reserve. Always pass that spoke on top-ups too.
  const reserve = await read.reserve(supply.spokeId, supply.hubId, supply.asset)
  if (reserve.paused || reserve.frozen || reserve.supplyCap === '0' || reserve.depositCapFilledPct >= 100) {
    throw new Error('This reserve is not accepting new supply')
  }
  const server = new rpc.Server(rpcUrl)
  const source = await server.getAccount(caller)
  const built = buildStellarSupplyTx({
    network, controllerAddress, caller, sourceSequence: source.sequenceNumber(),
  }, supply)
  // Simulates and adds footprint, authorization entries and Soroban resource fees.
  // Success is still provisional: chain state can change before submission.
  return prepareStellarBuiltTx(server, built, {
    network, invokedContractId: controllerAddress,
  })
}

/**
 * Call only after explicit user confirmation. Adapt signXdr to your wallet SDK.
 * The application owns key custody, wallet authorization and transaction recovery.
 */
export async function signSubmitAndConfirm(input: {
  rpcUrl: string
  network: StellarNetwork
  preparedXdr: string
  signXdr: (xdr: string, networkPassphrase: string) => Promise<string>
}) {
  const passphrase = STELLAR_NETWORK_PASSPHRASE[input.network]
  const signedXdr = await input.signXdr(input.preparedXdr, passphrase)
  const signed = TransactionBuilder.fromXDR(signedXdr, passphrase)
  const hash = signed.hash().toString('hex')
  const server = new rpc.Server(input.rpcUrl)
  // Persist hash before sending. Network errors can leave submission status unknown.
  let submitted: Awaited<ReturnType<typeof server.sendTransaction>>
  try {
    submitted = await server.sendTransaction(signed)
  } catch (cause) {
    throw new Error(`Submission status unknown; check transaction ${hash}`, { cause })
  }
  if (submitted.status === 'ERROR') {
    throw new Error(`Submission rejected for ${hash}: ${submitted.errorResult?.toXDR('base64') ?? submitted.status}`)
  }
  if (submitted.status === 'TRY_AGAIN_LATER') {
    throw new Error(`RPC busy; check ${hash} before retrying the same signed envelope`)
  }
  // PENDING and DUPLICATE require confirmation. Never treat acceptance as success.
  for (let attempt = 0; attempt < 30; attempt++) {
    let result: Awaited<ReturnType<typeof server.getTransaction>>
    try {
      result = await server.getTransaction(hash)
    } catch (cause) {
      throw new Error(`Confirmation interrupted; resume checking ${hash}`, { cause })
    }
    if (result.status === 'SUCCESS') return result
    if (result.status === 'FAILED') {
      throw new Error(`Transaction failed: ${hash}; ${result.resultXdr.toXDR('base64')}`)
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error(`Confirmation timed out; resume checking ${hash} before creating another transaction`)
}
