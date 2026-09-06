/** Typed Stellar lending reads. Configure the API deployment with XOXNOClient.apiUrl.
 * These cached HTTP reads do not simulate transactions or authorize spending.
 */
import type { OurRequestInit, XOXNOClient } from '../../utils/api'
import type * as Api from './lending-api-types'
import type { StellarLendingMarketSide, StellarLendingHoldersSide, StellarMarketGraphQuery, StellarReservesParams, StellarActivityQuery, StellarActivityPageQuery, StellarGovernanceQuery, StellarPositionsQuery, StellarRevenueQuery, StellarFeeRevenueQuery, StellarParticipantsQuery, StellarLiquidationsQuery, StellarLiquidationsLeaderboardQuery, StellarVolumeQuery, StellarDistributionQuery, StellarRateSpreadQuery } from './lending-read-types'

const BASE = '/stellar-lending'
const enc = encodeURIComponent

/** Load assets, hubs, spokes, reserves and keyed reserve details in one response.
 * @category Stellar lending reads
 */
export const getStellarLendingContext = (
  client: XOXNOClient,
  init?: OurRequestInit
): Promise<Api.StellarLendingContextDto> =>
  client.fetchWithTimeout<Api.StellarLendingContextDto>(`${BASE}/context`, init)

/** Read live indexes and the controller collateral floor. Cached data is not transaction simulation.
 * @category Stellar lending reads
 */
export const getStellarLendingLiveState = (
  client: XOXNOClient,
  init?: OurRequestInit
): Promise<Api.StellarLendingLiveStateDto> =>
  client.fetchWithTimeout<Api.StellarLendingLiveStateDto>(`${BASE}/live-state`, init)

/** Read detailed live market state for every hub and asset.
 * @category Stellar lending reads
 */
export const getStellarDetailedMarkets = (
  client: XOXNOClient,
  init?: OurRequestInit
): Promise<Api.StellarDetailedMarketDto[]> =>
  client.fetchWithTimeout<Api.StellarDetailedMarketDto[]>(`${BASE}/markets/detailed`, init)

/** List lending assets aggregated across hubs.
 * @category Stellar lending reads
 */
export const getStellarAssets = (
  client: XOXNOClient,
  init?: OurRequestInit
): Promise<Api.StellarAssetListItemDto[]> =>
  client.fetchWithTimeout<Api.StellarAssetListItemDto[]>(`${BASE}/assets`, init)

/** List liquidity hubs and their aggregate balances.
 * @category Stellar lending reads
 */
export const getStellarHubs = (
  client: XOXNOClient,
  init?: OurRequestInit
): Promise<Api.StellarHubListItemDto[]> =>
  client.fetchWithTimeout<Api.StellarHubListItemDto[]>(`${BASE}/hubs`, init)

/** List risk spokes for market selection.
 * @category Stellar lending reads
 */
export const getStellarSpokes = (
  client: XOXNOClient,
  init?: OurRequestInit
): Promise<Api.StellarSpokeListItemDto[]> =>
  client.fetchWithTimeout<Api.StellarSpokeListItemDto[]>(`${BASE}/spokes`, init)

/** List reserves, optionally filtered by hub, spoke and asset. A reserve is one (spokeId, hubId, asset) coordinate.
 * @category Stellar lending reads
 */
export const getStellarReserves = (
  client: XOXNOClient,
  params: StellarReservesParams = {},
  init?: OurRequestInit
): Promise<Api.StellarReserveListItemDto[]> =>
  client.fetchWithTimeout<Api.StellarReserveListItemDto[]>(`${BASE}/reserves`, { ...init, params: { ...params } })

/** Read one reserve with risk flags, capacity, rates and liquidity.
 * @category Stellar lending reads
 */
export const getStellarReserve = (
  client: XOXNOClient,
  spokeId: number,
  hubId: number,
  asset: string,
  init?: OurRequestInit
): Promise<Api.ReserveDto> =>
  client.fetchWithTimeout<Api.ReserveDto>(`${BASE}/reserves/${spokeId}/${hubId}/${enc(asset)}`, init)

/** Read the aggregate overview for one lending token contract.
 * @category Stellar lending reads
 */
export const getStellarAsset = (
  client: XOXNOClient,
  asset: string,
  init?: OurRequestInit
): Promise<Api.AssetDto> =>
  client.fetchWithTimeout<Api.AssetDto>(`${BASE}/assets/${enc(asset)}`, init)

/** Read hub totals and typed per-asset opportunities. USD totals are numbers.
 * @category Stellar lending reads
 */
export const getStellarHub = (
  client: XOXNOClient,
  hubId: number,
  init?: OurRequestInit
): Promise<Api.HubDto> =>
  client.fetchWithTimeout<Api.HubDto>(`${BASE}/hubs/${hubId}`, init)

/** Read spoke totals, connected hubs and risk-configured markets.
 * @category Stellar lending reads
 */
export const getStellarSpoke = (
  client: XOXNOClient,
  spokeId: number,
  init?: OurRequestInit
): Promise<Api.SpokeDto> =>
  client.fetchWithTimeout<Api.SpokeDto>(`${BASE}/spokes/${spokeId}`, init)

/** Read all positions for a wallet. supplyAmount and borrowAmount are RAY token quantities, not transaction base units.
 * @category Stellar lending reads
 */
export const getStellarUserPositions = (
  client: XOXNOClient,
  owner: string,
  init?: OurRequestInit
): Promise<Api.AccountPositionsDto> =>
  client.fetchWithTimeout<Api.AccountPositionsDto>(`${BASE}/users/${enc(owner)}/positions`, init)

/** Read a single lending account, identified by its decimal ID; balances use RAY token quantities.
 * @category Stellar lending reads
 */
export const getStellarAccountPositions = (
  client: XOXNOClient,
  accountId: string,
  init?: OurRequestInit
): Promise<Api.AccountPositionsDto> =>
  client.fetchWithTimeout<Api.AccountPositionsDto>(`${BASE}/accounts/${enc(accountId)}/positions`, init)

/** Read exact token base-unit holdings for a G or C wallet. Holdings may exceed spendable funds. Requires the API release exposing this route; older deployments return 404.
 * @category Stellar lending reads
 */
export const getStellarWalletBalance = (
  client: XOXNOClient,
  owner: string,
  asset: string,
  init?: OurRequestInit
): Promise<Api.StellarWalletBalanceDto> =>
  client.fetchWithTimeout<Api.StellarWalletBalanceDto>(`${BASE}/users/${enc(owner)}/assets/${enc(asset)}/balance`, init)

/** Load overview, deposit/borrow markets and chart series for an asset page.
 * @category Stellar lending reads
 */
export const getStellarAssetPage = (
  client: XOXNOClient,
  asset: string,
  query: StellarMarketGraphQuery & { owner?: string },
  init?: OurRequestInit
): Promise<Api.AssetPageDto> =>
  client.fetchWithTimeout<Api.AssetPageDto>(`${BASE}/assets/${enc(asset)}/page`, { ...init, params: { ...query } })

/** List an asset’s markets, including pause/freeze flags and remaining capacity. side is deposit or borrow.
 * @category Stellar lending reads
 */
export const getStellarAssetMarkets = (
  client: XOXNOClient,
  asset: string,
  side: StellarLendingMarketSide,
  init?: OurRequestInit
): Promise<Api.AssetMarketDto[]> =>
  client.fetchWithTimeout<Api.AssetMarketDto[]>(`${BASE}/assets/${enc(asset)}/markets`, { ...init, params: { side } })

/** List holders and their shares; side is deposits or borrows.
 * @category Stellar lending reads
 */
export const getStellarReserveHolders = (
  client: XOXNOClient,
  spokeId: number,
  hubId: number,
  asset: string,
  side: StellarLendingHoldersSide,
  init?: OurRequestInit
): Promise<Api.TopHoldersDto> =>
  client.fetchWithTimeout<Api.TopHoldersDto>(`${BASE}/reserves/${spokeId}/${hubId}/${enc(asset)}/holders`, { ...init, params: { side } })

/** List holders and their shares; side is deposits or borrows.
 * @category Stellar lending reads
 */
export const getStellarHubHolders = (
  client: XOXNOClient,
  hubId: number,
  side: StellarLendingHoldersSide,
  init?: OurRequestInit
): Promise<Api.TopHoldersDto> =>
  client.fetchWithTimeout<Api.TopHoldersDto>(`${BASE}/hubs/${hubId}/holders`, { ...init, params: { side } })

/** List holders and their shares; side is deposits or borrows.
 * @category Stellar lending reads
 */
export const getStellarSpokeHolders = (
  client: XOXNOClient,
  spokeId: number,
  side: StellarLendingHoldersSide,
  init?: OurRequestInit
): Promise<Api.TopHoldersDto> =>
  client.fetchWithTimeout<Api.TopHoldersDto>(`${BASE}/spokes/${spokeId}/holders`, { ...init, params: { side } })

/** Read binned market-history points.
 * @category Stellar lending reads
 */
export const getStellarAssetGraph = (
  client: XOXNOClient,
  asset: string,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.MarketGraphDto> =>
  client.fetchWithTimeout<Api.MarketGraphDto>(`${BASE}/assets/${enc(asset)}/graph`, { ...init, params: { ...query } })

/** Read binned market-history points.
 * @category Stellar lending reads
 */
export const getStellarHubGraph = (
  client: XOXNOClient,
  hubId: number,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.MarketGraphDto> =>
  client.fetchWithTimeout<Api.MarketGraphDto>(`${BASE}/hubs/${hubId}/graph`, { ...init, params: { ...query } })

/** Read spoke-attributed suppliedUsd/borrowedUsd and blended APYs.
 * @category Stellar lending reads
 */
export const getStellarSpokeGraph = (
  client: XOXNOClient,
  spokeId: number,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.SpokeGraphDto> =>
  client.fetchWithTimeout<Api.SpokeGraphDto>(`${BASE}/spokes/${spokeId}/graph`, { ...init, params: { ...query } })

/** Read binned market-history points.
 * @category Stellar lending reads
 */
export const getStellarReserveGraph = (
  client: XOXNOClient,
  spokeId: number,
  hubId: number,
  asset: string,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.MarketGraphDto> =>
  client.fetchWithTimeout<Api.MarketGraphDto>(`${BASE}/reserves/${spokeId}/${hubId}/${enc(asset)}/graph`, { ...init, params: { ...query } })

/** Read the legacy paged action feed. Display amounts are floating point; use userActivityPage for exact amounts and transaction hashes when available.
 * @category Stellar lending reads
 */
export const getStellarUserActivity = (
  client: XOXNOClient,
  owner: string,
  params: StellarActivityQuery = {},
  init?: OurRequestInit
): Promise<Api.StellarUserActivityItemDto[]> =>
  client.fetchWithTimeout<Api.StellarUserActivityItemDto[]>(`${BASE}/users/${enc(owner)}/activity`, { ...init, params: { ...params } })

/** Read exact owner-attributed activity. Pass the opaque continuationToken unchanged for the next page. Requires the API release exposing this route; older deployments return 404.
 * @category Stellar lending reads
 */
export const getStellarUserActivityPage = (
  client: XOXNOClient,
  owner: string,
  params: StellarActivityPageQuery = {},
  init?: OurRequestInit
): Promise<Api.StellarActivityPageDto> =>
  client.fetchWithTimeout<Api.StellarActivityPageDto>(`${BASE}/users/${enc(owner)}/activity/page`, { ...init, params: { ...params } })

/** Read governance proposals; pass the opaque continuationToken unchanged.
 * @category Stellar lending reads
 */
export const getStellarGovernanceProposals = (
  client: XOXNOClient,
  params: StellarGovernanceQuery = {},
  init?: OurRequestInit
): Promise<Api.GovernanceProposalsPageDto> =>
  client.fetchWithTimeout<Api.GovernanceProposalsPageDto>(`${BASE}/governance/proposals`, { ...init, params: { ...params } })

/** Read a paged wallet leaderboard under positions. Its healthFactor is debt / liquidation-weighted collateral × 100; higher is riskier.
 * @category Stellar lending reads
 */
export const getStellarPositionsLeaderboard = (
  client: XOXNOClient,
  params: StellarPositionsQuery = {},
  init?: OurRequestInit
): Promise<Api.StellarPositionsRankDto> =>
  client.fetchWithTimeout<Api.StellarPositionsRankDto>(`${BASE}/positions`, { ...init, params: { ...params } })

/** Read distinct supplier, borrower and total account counts.
 * @category Stellar lending reads
 */
export const getStellarParticipantCounts = (
  client: XOXNOClient,
  params: StellarParticipantsQuery = {},
  init?: OurRequestInit
): Promise<Api.ParticipantCountsDto> =>
  client.fetchWithTimeout<Api.ParticipantCountsDto>(`${BASE}/participants`, { ...init, params: { ...params } })

/** Read liquidators ranked by gross seized USD.
 * @category Stellar lending reads
 */
export const getStellarLiquidationsLeaderboard = (
  client: XOXNOClient,
  params: StellarLiquidationsLeaderboardQuery = {},
  init?: OurRequestInit
): Promise<Api.LiquidationsLeaderboardDto> =>
  client.fetchWithTimeout<Api.LiquidationsLeaderboardDto>(`${BASE}/liquidations/leaderboard`, { ...init, params: { ...params } })

/** Read position-size distribution; side is deposits or borrows.
 * @category Stellar lending reads
 */
export const getStellarHolderDistribution = (
  client: XOXNOClient,
  params: StellarDistributionQuery = {},
  init?: OurRequestInit
): Promise<Api.HolderDistributionDto> =>
  client.fetchWithTimeout<Api.HolderDistributionDto>(`${BASE}/distribution`, { ...init, params: { ...params } })

/** Read the paged Stellar campaign leaderboard.
 * @category Stellar lending reads
 */
export const getStellarCampaignLeaderboard = (
  client: XOXNOClient,
  params: { skip?: number; top?: number } = {},
  init?: OurRequestInit
): Promise<Api.StellarCampaignLeaderboardDto> =>
  client.fetchWithTimeout<Api.StellarCampaignLeaderboardDto>(`${BASE}/campaign/leaderboard`, { ...init, params: { ...params } })

/** Read protocol USD history as parallel arrays sharing timestamps.
 * @category Stellar lending reads
 */
export const getStellarStatsHistory = (
  client: XOXNOClient,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.StellarStatsHistoryDto> =>
  client.fetchWithTimeout<Api.StellarStatsHistoryDto>(`${BASE}/stats/history`, { ...init, params: { ...query } })

/** Read reserve interest revenue for the selected scope.
 * @category Stellar lending reads
 */
export const getStellarRevenueSeries = (
  client: XOXNOClient,
  query: StellarRevenueQuery,
  init?: OurRequestInit
): Promise<Api.RevenueSeriesDto> =>
  client.fetchWithTimeout<Api.RevenueSeriesDto>(`${BASE}/revenue`, { ...init, params: { ...query } })

/** Read flash-loan and strategy-fee revenue.
 * @category Stellar lending reads
 */
export const getStellarFeeRevenueSeries = (
  client: XOXNOClient,
  query: StellarFeeRevenueQuery,
  init?: OurRequestInit
): Promise<Api.FeeRevenueSeriesDto> =>
  client.fetchWithTimeout<Api.FeeRevenueSeriesDto>(`${BASE}/revenue/fees`, { ...init, params: { ...query } })

/** Read liquidation history. Gross seized collateral differs from net liquidator credit.
 * @category Stellar lending reads
 */
export const getStellarLiquidationsSeries = (
  client: XOXNOClient,
  query: StellarLiquidationsQuery,
  init?: OurRequestInit
): Promise<Api.LiquidationsSeriesDto> =>
  client.fetchWithTimeout<Api.LiquidationsSeriesDto>(`${BASE}/liquidations`, { ...init, params: { ...query } })

/** Read supply, borrow, withdrawal and repayment volume.
 * @category Stellar lending reads
 */
export const getStellarVolumeSeries = (
  client: XOXNOClient,
  query: StellarVolumeQuery,
  init?: OurRequestInit
): Promise<Api.VolumeSeriesDto> =>
  client.fetchWithTimeout<Api.VolumeSeriesDto>(`${BASE}/volume`, { ...init, params: { ...query } })

/** Read active owners/accounts and new-user history.
 * @category Stellar lending reads
 */
export const getStellarActiveUsersSeries = (
  client: XOXNOClient,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.ActiveUsersSeriesDto> =>
  client.fetchWithTimeout<Api.ActiveUsersSeriesDto>(`${BASE}/active-users`, { ...init, params: { ...query } })

/** Read per-market borrow-minus-supply APY spreads.
 * @category Stellar lending reads
 */
export const getStellarRateSpreadSeries = (
  client: XOXNOClient,
  query: StellarRateSpreadQuery,
  init?: OurRequestInit
): Promise<Api.RateSpreadSeriesDto> =>
  client.fetchWithTimeout<Api.RateSpreadSeriesDto>(`${BASE}/rate-spread`, { ...init, params: { ...query } })

/** Read protocol TVL, borrowing, fees and revenue dimensions.
 * @category Stellar lending reads
 */
export const getStellarDefiLlamaDimensions = (
  client: XOXNOClient,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.DefiLlamaDimensionsDto> =>
  client.fetchWithTimeout<Api.DefiLlamaDimensionsDto>(`${BASE}/defillama`, { ...init, params: { ...query } })

/** Read supplied/borrowed history for a lending account, not a wallet address.
 * @category Stellar lending reads
 */
export const getStellarUserHistory = (
  client: XOXNOClient,
  accountId: string,
  query: StellarMarketGraphQuery,
  init?: OurRequestInit
): Promise<Api.UserHistoryDto> =>
  client.fetchWithTimeout<Api.UserHistoryDto>(`${BASE}/users/${enc(accountId)}/history`, { ...init, params: { ...query } })

/** Read realized and unrealized interest PnL by asset for one account.
 * @category Stellar lending reads
 */
export const getStellarPositionsPnl = (
  client: XOXNOClient,
  accountId: string,
  init?: OurRequestInit
): Promise<Api.StellarPositionsPnlDto> =>
  client.fetchWithTimeout<Api.StellarPositionsPnlDto>(`${BASE}/pnl`, { ...init, params: { accountId } })

/** Read cross-account PnL grouped by scope.
 * @category Stellar lending reads
 */
export const getStellarPnlByScope = (
  client: XOXNOClient,
  scope: 'asset' | 'hub' | 'protocol',
  init?: OurRequestInit
): Promise<Api.PnlByScopeDto> =>
  client.fetchWithTimeout<Api.PnlByScopeDto>(`${BASE}/pnl/scope`, { ...init, params: { scope } })

/** Read one wallet’s Stellar campaign row.
 * @category Stellar lending reads
 */
export const getStellarCampaignMe = (
  client: XOXNOClient,
  owner: string,
  init?: OurRequestInit
): Promise<Api.StellarCampaignMeDto> =>
  client.fetchWithTimeout<Api.StellarCampaignMeDto>(`${BASE}/campaign/me`, { ...init, params: { owner } })

/** Bind a client once for typed market and portfolio reads.
 * @param client - API client configured for the same Stellar deployment as your RPC/controller.
 * @example
 * ```ts
 * const read = stellarLendingRead(new XOXNOClient({ apiUrl }))
 * const markets = await read.reserves({ spokeId: 1 })
 * const positions = await read.userPositions(walletAddress)
 * ```
 * @category Stellar lending reads
 */
export const stellarLendingRead = (client: XOXNOClient) => ({
  /** {@inheritDoc getStellarLendingContext} */
  context: (init?: OurRequestInit) => getStellarLendingContext(client, init),
  /** {@inheritDoc getStellarLendingLiveState} */
  liveState: (init?: OurRequestInit) => getStellarLendingLiveState(client, init),
  /** {@inheritDoc getStellarDetailedMarkets} */
  marketsDetailed: (init?: OurRequestInit) => getStellarDetailedMarkets(client, init),
  /** {@inheritDoc getStellarAssets} */
  assets: (init?: OurRequestInit) => getStellarAssets(client, init),
  /** {@inheritDoc getStellarHubs} */
  hubs: (init?: OurRequestInit) => getStellarHubs(client, init),
  /** {@inheritDoc getStellarSpokes} */
  spokes: (init?: OurRequestInit) => getStellarSpokes(client, init),
  /** List reserves. The one-argument request-init form is retained for compatibility. */
  reserves: (paramsOrInit: StellarReservesParams | OurRequestInit = {}, init?: OurRequestInit) => {
    const filters = init !== undefined || 'hubId' in paramsOrInit || 'spokeId' in paramsOrInit || 'asset' in paramsOrInit
    return filters
      ? getStellarReserves(client, paramsOrInit as StellarReservesParams, init)
      : getStellarReserves(client, {}, paramsOrInit as OurRequestInit)
  },
  /** {@inheritDoc getStellarReserve} */
  reserve: (spokeId: number, hubId: number, asset: string, init?: OurRequestInit) => getStellarReserve(client, spokeId, hubId, asset, init),
  /** {@inheritDoc getStellarAsset} */
  asset: (asset: string, init?: OurRequestInit) => getStellarAsset(client, asset, init),
  /** {@inheritDoc getStellarHub} */
  hub: (hubId: number, init?: OurRequestInit) => getStellarHub(client, hubId, init),
  /** {@inheritDoc getStellarSpoke} */
  spoke: (spokeId: number, init?: OurRequestInit) => getStellarSpoke(client, spokeId, init),
  /** {@inheritDoc getStellarUserPositions} */
  userPositions: (owner: string, init?: OurRequestInit) => getStellarUserPositions(client, owner, init),
  /** {@inheritDoc getStellarAccountPositions} */
  accountPositions: (accountId: string, init?: OurRequestInit) => getStellarAccountPositions(client, accountId, init),
  /** {@inheritDoc getStellarWalletBalance} */
  walletBalance: (owner: string, asset: string, init?: OurRequestInit) => getStellarWalletBalance(client, owner, asset, init),
  /** {@inheritDoc getStellarAssetPage} */
  assetPage: (asset: string, query: StellarMarketGraphQuery & { owner?: string }, init?: OurRequestInit) => getStellarAssetPage(client, asset, query, init),
  /** {@inheritDoc getStellarAssetMarkets} */
  assetMarkets: (asset: string, side: StellarLendingMarketSide, init?: OurRequestInit) => getStellarAssetMarkets(client, asset, side, init),
  /** {@inheritDoc getStellarReserveHolders} */
  reserveHolders: (spokeId: number, hubId: number, asset: string, side: StellarLendingHoldersSide, init?: OurRequestInit) => getStellarReserveHolders(client, spokeId, hubId, asset, side, init),
  /** {@inheritDoc getStellarHubHolders} */
  hubHolders: (hubId: number, side: StellarLendingHoldersSide, init?: OurRequestInit) => getStellarHubHolders(client, hubId, side, init),
  /** {@inheritDoc getStellarSpokeHolders} */
  spokeHolders: (spokeId: number, side: StellarLendingHoldersSide, init?: OurRequestInit) => getStellarSpokeHolders(client, spokeId, side, init),
  /** {@inheritDoc getStellarAssetGraph} */
  assetGraph: (asset: string, query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarAssetGraph(client, asset, query, init),
  /** {@inheritDoc getStellarHubGraph} */
  hubGraph: (hubId: number, query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarHubGraph(client, hubId, query, init),
  /** {@inheritDoc getStellarSpokeGraph} */
  spokeGraph: (spokeId: number, query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarSpokeGraph(client, spokeId, query, init),
  /** {@inheritDoc getStellarReserveGraph} */
  reserveGraph: (spokeId: number, hubId: number, asset: string, query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarReserveGraph(client, spokeId, hubId, asset, query, init),
  /** {@inheritDoc getStellarUserActivity} */
  userActivity: (owner: string, params: StellarActivityQuery = {}, init?: OurRequestInit) => getStellarUserActivity(client, owner, params, init),
  /** {@inheritDoc getStellarUserActivityPage} */
  userActivityPage: (owner: string, params: StellarActivityPageQuery = {}, init?: OurRequestInit) => getStellarUserActivityPage(client, owner, params, init),
  /** {@inheritDoc getStellarGovernanceProposals} */
  governanceProposals: (params: StellarGovernanceQuery = {}, init?: OurRequestInit) => getStellarGovernanceProposals(client, params, init),
  /** {@inheritDoc getStellarPositionsLeaderboard} */
  positionsLeaderboard: (params: StellarPositionsQuery = {}, init?: OurRequestInit) => getStellarPositionsLeaderboard(client, params, init),
  /** {@inheritDoc getStellarParticipantCounts} */
  participants: (params: StellarParticipantsQuery = {}, init?: OurRequestInit) => getStellarParticipantCounts(client, params, init),
  /** {@inheritDoc getStellarLiquidationsLeaderboard} */
  liquidationsLeaderboard: (params: StellarLiquidationsLeaderboardQuery = {}, init?: OurRequestInit) => getStellarLiquidationsLeaderboard(client, params, init),
  /** {@inheritDoc getStellarHolderDistribution} */
  distribution: (params: StellarDistributionQuery = {}, init?: OurRequestInit) => getStellarHolderDistribution(client, params, init),
  /** {@inheritDoc getStellarCampaignLeaderboard} */
  campaignLeaderboard: (params: { skip?: number; top?: number } = {}, init?: OurRequestInit) => getStellarCampaignLeaderboard(client, params, init),
  /** {@inheritDoc getStellarStatsHistory} */
  statsHistory: (query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarStatsHistory(client, query, init),
  /** {@inheritDoc getStellarRevenueSeries} */
  revenue: (query: StellarRevenueQuery, init?: OurRequestInit) => getStellarRevenueSeries(client, query, init),
  /** {@inheritDoc getStellarFeeRevenueSeries} */
  feeRevenue: (query: StellarFeeRevenueQuery, init?: OurRequestInit) => getStellarFeeRevenueSeries(client, query, init),
  /** {@inheritDoc getStellarLiquidationsSeries} */
  liquidations: (query: StellarLiquidationsQuery, init?: OurRequestInit) => getStellarLiquidationsSeries(client, query, init),
  /** {@inheritDoc getStellarVolumeSeries} */
  volume: (query: StellarVolumeQuery, init?: OurRequestInit) => getStellarVolumeSeries(client, query, init),
  /** {@inheritDoc getStellarActiveUsersSeries} */
  activeUsers: (query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarActiveUsersSeries(client, query, init),
  /** {@inheritDoc getStellarRateSpreadSeries} */
  rateSpread: (query: StellarRateSpreadQuery, init?: OurRequestInit) => getStellarRateSpreadSeries(client, query, init),
  /** {@inheritDoc getStellarDefiLlamaDimensions} */
  defillama: (query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarDefiLlamaDimensions(client, query, init),
  /** {@inheritDoc getStellarUserHistory} */
  userHistory: (accountId: string, query: StellarMarketGraphQuery, init?: OurRequestInit) => getStellarUserHistory(client, accountId, query, init),
  /** {@inheritDoc getStellarPositionsPnl} */
  positionsPnl: (accountId: string, init?: OurRequestInit) => getStellarPositionsPnl(client, accountId, init),
  /** {@inheritDoc getStellarPnlByScope} */
  pnlByScope: (scope: 'asset' | 'hub' | 'protocol', init?: OurRequestInit) => getStellarPnlByScope(client, scope, init),
  /** {@inheritDoc getStellarCampaignMe} */
  campaignMe: (owner: string, init?: OurRequestInit) => getStellarCampaignMe(client, owner, init),
})

export type StellarLendingRead = ReturnType<typeof stellarLendingRead>
export * from './lending-read-types'
