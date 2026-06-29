/**
 * Stellar lending read surface.
 *
 * Hand-written typed wrappers over the api-v2 `stellar-lending` GET routes
 * (this is intentionally NOT part of the swagger-generated read SDK). Each
 * function takes a `XOXNOClient` plus typed params and resolves to the mirrored
 * response shape from `./lending-read-types`. A `stellarLendingRead(client)`
 * factory binds the client once for ergonomic call sites.
 *
 * HTTP plumbing (base URL, query-string assembly, error mapping, caching) is
 * delegated to `XOXNOClient.fetchWithTimeout`, the same wrapper the generated
 * SDK uses.
 */

import type { OurRequestInit, XOXNOClient } from '../../utils/api'
import type {
  StellarAccountPositions,
  StellarAsset,
  StellarAssetMarket,
  StellarGovernanceProposalsPage,
  StellarHub,
  StellarLendingHoldersSide,
  StellarLendingMarketSide,
  StellarMarketGraph,
  StellarMarketGraphQuery,
  StellarReserve,
  StellarSpoke,
  StellarTopHolders,
} from './lending-read-types'

const BASE = '/stellar-lending'

/** Default governance page size; mirrors the api-v2 controller default. */
const GOVERNANCE_DEFAULT_TOP = 25

const enc = encodeURIComponent

/** Reserve detail: one asset, in one spoke, on one hub. */
export const getStellarReserve = (
  client: XOXNOClient,
  spokeId: number,
  hubId: number,
  asset: string,
  init?: OurRequestInit
): Promise<StellarReserve> =>
  client.fetchWithTimeout<StellarReserve>(
    `${BASE}/reserves/${spokeId}/${hubId}/${enc(asset)}`,
    init
  )

/** Top holders of a reserve, for one side (deposits or borrows). */
export const getStellarReserveHolders = (
  client: XOXNOClient,
  spokeId: number,
  hubId: number,
  asset: string,
  side: StellarLendingHoldersSide,
  init?: OurRequestInit
): Promise<StellarTopHolders> =>
  client.fetchWithTimeout<StellarTopHolders>(
    `${BASE}/reserves/${spokeId}/${hubId}/${enc(asset)}/holders`,
    { ...init, params: { side } }
  )

/** Asset overview: header totals + APY ranges. */
export const getStellarAsset = (
  client: XOXNOClient,
  asset: string,
  init?: OurRequestInit
): Promise<StellarAsset> =>
  client.fetchWithTimeout<StellarAsset>(`${BASE}/assets/${enc(asset)}`, init)

/** Asset markets (per spoke/hub) for one side. */
export const getStellarAssetMarkets = (
  client: XOXNOClient,
  asset: string,
  side: StellarLendingMarketSide,
  init?: OurRequestInit
): Promise<StellarAssetMarket[]> =>
  client.fetchWithTimeout<StellarAssetMarket[]>(
    `${BASE}/assets/${enc(asset)}/markets`,
    { ...init, params: { side } }
  )

/** Hub overview: totals + per-asset opportunities. */
export const getStellarHub = (
  client: XOXNOClient,
  hubId: number,
  init?: OurRequestInit
): Promise<StellarHub> =>
  client.fetchWithTimeout<StellarHub>(`${BASE}/hubs/${hubId}`, init)

/** Spoke overview: totals + connected hubs + per-reserve markets. */
export const getStellarSpoke = (
  client: XOXNOClient,
  spokeId: number,
  init?: OurRequestInit
): Promise<StellarSpoke> =>
  client.fetchWithTimeout<StellarSpoke>(`${BASE}/spokes/${spokeId}`, init)

/** All positions for an owner (cross-partition portfolio). */
export const getStellarUserPositions = (
  client: XOXNOClient,
  owner: string,
  init?: OurRequestInit
): Promise<StellarAccountPositions> =>
  client.fetchWithTimeout<StellarAccountPositions>(
    `${BASE}/users/${enc(owner)}/positions`,
    init
  )

/** All positions for a single account (single-partition). */
export const getStellarAccountPositions = (
  client: XOXNOClient,
  accountId: string,
  init?: OurRequestInit
): Promise<StellarAccountPositions> =>
  client.fetchWithTimeout<StellarAccountPositions>(
    `${BASE}/accounts/${enc(accountId)}/positions`,
    init
  )

/** Governance proposals (cursor-paginated). */
export const getStellarGovernanceProposals = (
  client: XOXNOClient,
  opts: { top?: number; continuationToken?: string } = {},
  init?: OurRequestInit
): Promise<StellarGovernanceProposalsPage> => {
  const { top = GOVERNANCE_DEFAULT_TOP, continuationToken } = opts
  return client.fetchWithTimeout<StellarGovernanceProposalsPage>(
    `${BASE}/governance/proposals`,
    {
      ...init,
      params: { top, ...(continuationToken ? { continuationToken } : {}) },
    }
  )
}

/** Asset market-history graph. */
export const getStellarAssetGraph = (
  client: XOXNOClient,
  asset: string,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<StellarMarketGraph> =>
  client.fetchWithTimeout<StellarMarketGraph>(
    `${BASE}/assets/${enc(asset)}/graph`,
    { ...init, params: { ...query } }
  )

/** Hub market-history graph. */
export const getStellarHubGraph = (
  client: XOXNOClient,
  hubId: number,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<StellarMarketGraph> =>
  client.fetchWithTimeout<StellarMarketGraph>(`${BASE}/hubs/${hubId}/graph`, {
    ...init,
    params: { ...query },
  })

/** Spoke market-history graph. */
export const getStellarSpokeGraph = (
  client: XOXNOClient,
  spokeId: number,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<StellarMarketGraph> =>
  client.fetchWithTimeout<StellarMarketGraph>(
    `${BASE}/spokes/${spokeId}/graph`,
    { ...init, params: { ...query } }
  )

/** Reserve market-history graph (+ fee series). */
export const getStellarReserveGraph = (
  client: XOXNOClient,
  spokeId: number,
  hubId: number,
  asset: string,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<StellarMarketGraph> =>
  client.fetchWithTimeout<StellarMarketGraph>(
    `${BASE}/reserves/${spokeId}/${hubId}/${enc(asset)}/graph`,
    { ...init, params: { ...query } }
  )

/**
 * Client-bound Stellar lending read namespace. Binds `client` once so call
 * sites read `read.reserve(spokeId, hubId, asset)` instead of threading the
 * client through every call.
 */
export const stellarLendingRead = (client: XOXNOClient) => ({
  reserve: (spokeId: number, hubId: number, asset: string, init?: OurRequestInit) =>
    getStellarReserve(client, spokeId, hubId, asset, init),
  reserveHolders: (
    spokeId: number,
    hubId: number,
    asset: string,
    side: StellarLendingHoldersSide,
    init?: OurRequestInit
  ) => getStellarReserveHolders(client, spokeId, hubId, asset, side, init),
  asset: (asset: string, init?: OurRequestInit) =>
    getStellarAsset(client, asset, init),
  assetMarkets: (
    asset: string,
    side: StellarLendingMarketSide,
    init?: OurRequestInit
  ) => getStellarAssetMarkets(client, asset, side, init),
  hub: (hubId: number, init?: OurRequestInit) => getStellarHub(client, hubId, init),
  spoke: (spokeId: number, init?: OurRequestInit) =>
    getStellarSpoke(client, spokeId, init),
  userPositions: (owner: string, init?: OurRequestInit) =>
    getStellarUserPositions(client, owner, init),
  accountPositions: (accountId: string, init?: OurRequestInit) =>
    getStellarAccountPositions(client, accountId, init),
  governanceProposals: (
    opts?: { top?: number; continuationToken?: string },
    init?: OurRequestInit
  ) => getStellarGovernanceProposals(client, opts, init),
  assetGraph: (asset: string, query: StellarMarketGraphQuery, init?: OurRequestInit) =>
    getStellarAssetGraph(client, asset, query, init),
  hubGraph: (hubId: number, query: StellarMarketGraphQuery, init?: OurRequestInit) =>
    getStellarHubGraph(client, hubId, query, init),
  spokeGraph: (
    spokeId: number,
    query: StellarMarketGraphQuery,
    init?: OurRequestInit
  ) => getStellarSpokeGraph(client, spokeId, query, init),
  reserveGraph: (
    spokeId: number,
    hubId: number,
    asset: string,
    query: StellarMarketGraphQuery,
    init?: OurRequestInit
  ) => getStellarReserveGraph(client, spokeId, hubId, asset, query, init),
})

export type StellarLendingRead = ReturnType<typeof stellarLendingRead>

export * from './lending-read-types'
