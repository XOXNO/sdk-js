// Compile-time consumer checks against the package's built public declarations.
import { buildSdk, XOXNOClient } from '@xoxno/sdk-js'
import {
  stellarLendingRead,
  buildStellarBorrowTx,
  type StellarLendingBuilderOptions,
  type StellarAccountPositions,
  type StellarLendingContext,
  type StellarGovernanceProposal,
} from '@xoxno/sdk-js/stellar-lending'
import type {
  StellarLendingContext as DomainContext,
  StellarGovernanceProposalKind,
} from '@xoxno/types/stellar-lending'

export async function checkReadContracts(apiUrl: string) {
  const client = new XOXNOClient({ apiUrl })
  const read = stellarLendingRead(client)
  const sdk = buildSdk(client)
  const holders = await sdk.stellarLending.hubs.hubId('1').holders({ side: 'deposits' })
  const owner: string | undefined = holders.holders[0]?.owner
  const ranks = await sdk.stellarLending.positions({ orderBy: 'Supplied' })
  const positions: typeof ranks.positions = ranks.positions
  const graph = await read.spokeGraph(1, { from: '2026-09-01', to: '2026-09-02', bin: '1d' })
  const usd: number | undefined = graph.points[0]?.suppliedUsd
  const hub = await read.hub(1)
  const deposits: number = hub.totalDepositsUsd
  const context: StellarLendingContext = await read.context()
  const compatible: DomainContext = context
  // @ts-expect-error holders requires deposits/borrows, not deposit/borrow.
  await read.hubHolders(1, 'deposit')
  // @ts-expect-error distribution shares the holders selector.
  await read.distribution({ side: 'supply' })
  return { owner, positions, usd, deposits, compatible }
}

export function checkPositionContracts(opts: StellarLendingBuilderOptions, response: StellarAccountPositions) {
  const position = response.positions[0]
  const ray: string = position.supplyAmount
  const index: string | null = position.liveBorrowIndexRay
  const built = buildStellarBorrowTx(opts, {
    accountNonce: position.accountId, hubId: position.hubId, asset: position.asset, amount: '1',
  })
  return { ray, index, built }
}

export function checkGovernanceContract(proposal: StellarGovernanceProposal): StellarGovernanceProposalKind {
  return proposal.kind
}
