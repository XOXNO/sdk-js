/** Public reader aliases. All response fields come from the generated API contract. */
import type * as Api from './lending-api-types'
import type { endpoints } from '../swagger'

export * from './lending-api-types'
export type { StellarApyRange } from '@xoxno/types/stellar-lending'
export type { StellarAssetOracle as StellarAssetOracleConfig } from '@xoxno/types/stellar-lending'

export type StellarLendingContext = Api.StellarLendingContextDto
export type StellarAsset = Api.AssetDto
export type StellarAssetMarket = Api.AssetMarketDto
export type StellarHubAssetRow = Api.HubAssetDto
export type StellarHub = Api.HubDto
export type StellarSpokeMarket = Api.SpokeMarketDto
export type StellarSpoke = Api.SpokeDto
export type StellarReserveIrmCurve = Api.ReserveIrmCurveDto
export type StellarReserve = Api.ReserveDto
export type StellarTopHolder = Api.TopHolderDto
export type StellarTopHolders = Api.TopHoldersDto
export type StellarAccountPosition = Api.AccountPositionDto
export type StellarAccountPositions = Api.AccountPositionsDto
export type StellarGovernanceProposal = Api.GovernanceProposalDto
export type StellarGovernanceProposalsPage = Api.GovernanceProposalsPageDto
export type StellarMarketGraphPoint = Api.MarketGraphPointDto
export type StellarFeeGraphPoint = Api.FeeGraphPointDto
export type StellarMarketGraph = Api.MarketGraphDto
export type StellarSpokeGraph = Api.SpokeGraphDto
export type StellarSpokeGraphPoint = Api.SpokeGraphPointDto
export type StellarAssetPage = Api.AssetPageDto
export type StellarAssetPageMarket = Api.AssetMarketDto
export type StellarAssetPageGraphPoint = Api.AssetPageGraphPointDto
export type StellarAssetPageGraphSeries = Api.AssetPageGraphSeriesDto
export type StellarAssetListItem = Api.StellarAssetListItemDto
export type StellarHubListItem = Api.StellarHubListItemDto
export type StellarSpokeListItem = Api.StellarSpokeListItemDto
export type StellarReserveListItem = Api.StellarReserveListItemDto
export type StellarUserActivityItem = Api.StellarUserActivityItemDto

/** Asset-market action selector. */
export type StellarLendingMarketSide = 'deposit' | 'borrow'
/** Holder-list balance selector. Also used by holder distribution. */
export type StellarLendingHoldersSide = 'deposits' | 'borrows'
/** Time window for API charts. Dates are ISO-8601; bin examples: 1h, 1d. */
export interface StellarMarketGraphQuery {
  /** Window start. */
  from: string
  /** Window end. */
  to: string
  /** Kusto timespan, for example 1h or 1d. */
  bin: string
}
export type StellarReservesParams = (typeof endpoints)['/stellar-lending/reserves']['input']
export type StellarActivityQuery = (typeof endpoints)['/stellar-lending/users/:owner/activity']['input']
export type StellarActivityPageQuery = (typeof endpoints)['/stellar-lending/users/:owner/activity/page']['input']
export type StellarGovernanceQuery = (typeof endpoints)['/stellar-lending/governance/proposals']['input']
export type StellarPositionsQuery = (typeof endpoints)['/stellar-lending/positions']['input']
export type StellarRevenueQuery = (typeof endpoints)['/stellar-lending/revenue']['input']
export type StellarFeeRevenueQuery = (typeof endpoints)['/stellar-lending/revenue/fees']['input']
export type StellarParticipantsQuery = (typeof endpoints)['/stellar-lending/participants']['input']
export type StellarLiquidationsQuery = (typeof endpoints)['/stellar-lending/liquidations']['input']
export type StellarLiquidationsLeaderboardQuery = (typeof endpoints)['/stellar-lending/liquidations/leaderboard']['input']
export type StellarVolumeQuery = (typeof endpoints)['/stellar-lending/volume']['input']
export type StellarDistributionQuery = (typeof endpoints)['/stellar-lending/distribution']['input']
export type StellarRateSpreadQuery = (typeof endpoints)['/stellar-lending/rate-spread']['input']
