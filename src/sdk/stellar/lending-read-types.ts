/**
 * Stellar lending read-API response shapes.
 *
 * These interfaces mirror the api-v2 `stellar-lending` response DTOs 1:1. The
 * SDK never imports from api-v2, so the shapes are duplicated here by hand. Doc
 * field types that already live in `@xoxno/types/stellar-lending` (governance
 * enums + proposal fields, the initial-payment multiplier) are imported rather
 * than re-declared.
 *
 * Numeric `*Wad`/`*Ray`/`*ScaledRay` fields cross the wire as decimal strings
 * (1e18 / 1e27 fixed-point); `*Short` fields are already human-readable numbers.
 */

import type {
  StellarAssetPage,
  StellarAssetPageGraphPoint,
  StellarAssetPageGraphSeries,
  StellarAssetPageMarket,
  StellarGovernanceProposalField,
  StellarGovernanceProposalKind,
  StellarGovernanceProposalStatus,
  StellarGovernanceProposalTarget,
  StellarInitialPaymentMultiplier,
} from '@xoxno/types/stellar-lending'

export type {
  StellarLendingContext,
  StellarAssetPage,
  StellarAssetPageGraphPoint,
  StellarAssetPageGraphSeries,
  StellarAssetPageMarket,
} from '@xoxno/types/stellar-lending'

// -----------------------------------------------------------------------------
// Query selectors
// -----------------------------------------------------------------------------

/** Side selector for an asset's markets table. */
export type StellarLendingMarketSide = 'deposit' | 'borrow'

/** Side selector for a reserve's top-holders list. */
export type StellarLendingHoldersSide = 'deposits' | 'borrows'

// -----------------------------------------------------------------------------
// Asset
// -----------------------------------------------------------------------------

/** One (spoke, hub) market row for an asset's markets table. */
export interface StellarAssetMarket {
  spokeId: number
  hubId: number
  asset: string
  supplyApy: number
  borrowApy: number
  utilization: number
  suppliedShort: number
  borrowedShort: number
  availableLiquidityShort: number
  collateralFactorBps: number
  liquidationThresholdBps: number
  isCollateralizable: boolean
  isBorrowable: boolean
}

/** Asset overview header: identity + protocol-wide aggregates + APY ranges. */
export interface StellarAsset {
  asset: string
  symbol: string
  name: string
  decimals: number
  usdPriceWad: string
  usdPriceShort: number
  totalDepositsUsd: string
  totalBorrowsUsd: string
  availableLiquidityUsd: string
  hubCount: number
  reserveCount: number
  minSupplyApy: number
  maxSupplyApy: number
  minBorrowApy: number
  maxBorrowApy: number
}

// -----------------------------------------------------------------------------
// Hub
// -----------------------------------------------------------------------------

/** One asset's liquidity on a hub, rendered as a hub opportunity row. */
export interface StellarHubAssetRow {
  hubId: number
  asset: string
  supplyApy: number
  borrowApy: number
  utilization: number
  suppliedShort: number
  borrowedShort: number
  availableLiquidityShort: number
  isFlashloanable: boolean
}

/** Hub overview: header totals + per-asset liquidity opportunities. */
export interface StellarHub {
  hubId: number
  isActive: boolean
  name: string | null
  totalDepositsUsd: string
  totalBorrowsUsd: string
  availableLiquidityUsd: string
  utilization: number
  assetCount: number
  assets: StellarHubAssetRow[]
}

// -----------------------------------------------------------------------------
// Spoke
// -----------------------------------------------------------------------------

/** One reserve row within a spoke (risk truth joined with hub liquidity). */
export interface StellarSpokeMarket {
  spokeId: number
  hubId: number
  asset: string
  supplyApy: number
  borrowApy: number
  utilization: number
  availableLiquidityShort: number
  collateralFactorBps: number
  liquidationThresholdBps: number
  isCollateralizable: boolean
  isBorrowable: boolean
  paused: boolean
  frozen: boolean
}

/** Spoke overview: header totals, connected hubs, and per-reserve market table. */
export interface StellarSpoke {
  spokeId: number
  isDeprecated: boolean
  name: string | null
  totalDepositsUsd: string
  totalBorrowsUsd: string
  assetCount: number
  connectedHubIds: number[]
  connectedHubCount: number
  liquidationTargetHfWad: string
  liquidationBonusFactorBps: number
  markets: StellarSpokeMarket[]
}

// -----------------------------------------------------------------------------
// Reserve
// -----------------------------------------------------------------------------

/** Interest-rate-model curve (ray-scaled), sourced from the HubAsset doc. */
export interface StellarReserveIrmCurve {
  baseRateRay: string
  slope1Ray: string
  slope2Ray: string
  slope3Ray: string
  optimalUtilizationRay: string
  midUtilizationRay: string
  maxUtilizationRay: string
  maxBorrowRateRay: string
  reserveFactorBps: number
}

/**
 * Reserve detail page: one asset, in one spoke, on one hub. Merges liquidity
 * truth (HubAsset), risk truth (SpokeAsset) and the spoke's liquidation curve.
 */
export interface StellarReserve {
  spokeId: number
  hubId: number
  asset: string

  // Liquidity (HubAsset)
  supplyApy: number
  borrowApy: number
  utilization: number
  suppliedShort: number
  borrowedShort: number
  availableLiquidityShort: number
  supplyCapShort: number
  borrowCapShort: number
  depositCapFilledPct: number
  borrowCapFilledPct: number
  isFlashloanable: boolean
  flashloanFeeBps: number

  // Risk (SpokeAsset)
  collateralFactorBps: number
  liquidationThresholdBps: number
  liquidationPenaltyBps: number
  liquidationFeesBps: number
  isCollateralizable: boolean
  isBorrowable: boolean
  paused: boolean
  frozen: boolean
  useAsCollateral: boolean

  // Spoke liquidation curve
  targetHealthFactorWad: string
  healthFactorForMaxBonusWad: string
  liquidationBonusFactorBps: number

  irm: StellarReserveIrmCurve
  supportedCollateral: string[]
  borrowable: string[]
}

// -----------------------------------------------------------------------------
// Top holders
// -----------------------------------------------------------------------------

export interface StellarTopHolder {
  owner: string
  accountId: string
  scaledRay: string
  amountShort: number
  sharePct: number
}

/** Top holders of a reserve, for one side (deposits or borrows). */
export interface StellarTopHolders {
  spokeId: number
  hubId: number
  asset: string
  side: StellarLendingHoldersSide
  totalScaledRay: string
  holders: StellarTopHolder[]
}

// -----------------------------------------------------------------------------
// Positions
// -----------------------------------------------------------------------------

/** One account's position in one reserve. */
export interface StellarAccountPosition {
  accountId: string
  owner: string
  spokeId: number
  hubId: number
  asset: string
  positionMode: number
  supplyScaledRay: string
  borrowScaledRay: string
  supplyIndexRay: string | null
  borrowIndexRay: string | null
  entryLtvBps: number
  entryLiquidationThresholdBps: number
  entryLiquidationBonusBps: number
  entryLiquidationFeesBps: number
  initialPaymentMultiplier: StellarInitialPaymentMultiplier | null
  updatedAt: number
  ledger: number
}

/** All positions for an owner (cross-spoke/hub portfolio) or one account. */
export interface StellarAccountPositions {
  positions: StellarAccountPosition[]
}

// -----------------------------------------------------------------------------
// Governance
// -----------------------------------------------------------------------------

/** A timelock governance proposal on the Stellar lending governance contract. */
export interface StellarGovernanceProposal {
  operationId: string
  kind: StellarGovernanceProposalKind
  status: StellarGovernanceProposalStatus
  target: StellarGovernanceProposalTarget
  targetAddress: string
  functionName: string
  summary: string
  fields: StellarGovernanceProposalField[]
  assetAddress?: string
  assetSymbol?: string
  proposer: string
  scheduledLedger: number
  readyLedger: number
  delayLedgers: number
  expiresLedger: number
  executedLedger?: number
  cancelledLedger?: number
  scheduledAt: number
  executedAt?: number
  cancelledAt?: number
  scheduledTxHash: string
  executedTxHash?: string
  cancelledTxHash?: string
}

/** Cursor-paginated page of governance proposals. */
export interface StellarGovernanceProposalsPage {
  resources: StellarGovernanceProposal[]
  hasMoreResults: boolean
  continuationToken: string
}

// -----------------------------------------------------------------------------
// Graphs
// -----------------------------------------------------------------------------

/** One binned market-snapshot point for a graph series. */
export interface StellarMarketGraphPoint {
  timestamp: string
  hubId: number
  spokeId: number | null
  token: string
  supplyApy: number
  borrowApy: number
  utilization: number
  totalDepositsUsd: number
  totalBorrowsUsd: number
  availableLiquidityUsd: number
  usdPrice: number
}

/** One binned activity-derived fee/flash point. */
export interface StellarFeeGraphPoint {
  timestamp: string
  feeShort: number
  usd: number
}

/** A market-history graph: binned snapshot points (+ optional fee series). */
export interface StellarMarketGraph {
  points: StellarMarketGraphPoint[]
  fees?: StellarFeeGraphPoint[]
}

/** Time-window + bin selector shared by every graph read. */
export interface StellarMarketGraphQuery {
  /** Inclusive window start (ISO-8601). */
  from: string
  /** Exclusive window end (ISO-8601). */
  to: string
  /** Bin width as a timespan string (e.g. `1h`, `1d`). */
  bin: string
}
