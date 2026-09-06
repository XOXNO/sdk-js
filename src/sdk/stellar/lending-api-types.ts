/** @module Stellar lending API types
 * Generated from src/sdk/swagger.json; do not edit by hand.
 */

import type * as StellarDomain from '@xoxno/types/stellar-lending'

export type StellarAssetListItemDto = {
"asset": string;
"symbol": string;
"name": string;
"decimals": number;
/** Live spot USD price per whole unit. */
"price": number;
/** Total supplied across hubs valued in USD (live). */
"totalDepositsUsd": number;
/** Total supplied across hubs, human-readable token units (live). */
"totalDepositsNative": number;
/** Total borrowed across hubs valued in USD (live). */
"totalBorrowsUsd": number;
/** Total borrowed across hubs, human-readable token units (live). */
"totalBorrowsNative": number;
/** Available liquidity across hubs in USD (live). */
"availableLiquidityUsd": number;
/** [min, max] supply APY across the asset hubs. */
"supplyApyRange": StellarDomain.StellarApyRange;
/** [min, max] borrow APY across the asset hubs. */
"borrowApyRange": StellarDomain.StellarApyRange;
/** Number of hubs listing this asset. */
"hubCount": number;
/** Number of reserves (spoke,hub) for this asset. */
"marketCount": number;
/** The two underlying token SACs when this asset is an AMM LP share, so clients can render the pair instead of the share itself, which has no logo. Present only when both oracle legs are Token price keys — a Ref leg is registry-only and has no SAC — so "present" means "renderable pair", with no partial case to handle. */
"lpUnderlying"?: StellarDomain.StellarLpUnderlying;
}

export type StellarLendingContextDto = {
"assets": Array<StellarAssetListItemDto>;
"hubs": Array<StellarHubListItemDto>;
"spokes": Array<StellarSpokeListItemDto>;
"reserves": Array<StellarReserveListItemDto>;
/** Reserve details keyed as `${spokeId}:${hubId}:${asset}`. */
"reserveDetailsByKey": {
[key: string]: ReserveDto;
};
}

export type StellarLendingLiveStateDto = {
"indexes": Array<StellarMarketIndexByHub>;
/** Raw 18-decimal WAD from get_min_borrow_collateral_usd; null when initial controller read fails. */
"minBorrowCollateralUsdWad": (string) | null;
}

export type StellarDetailedMarketDto = {
"hubId": number;
"asset": string;
/** Raw 27-decimal RAY. */
"supplyIndex": string;
"supplyIndexShort": number;
/** Raw 27-decimal RAY. */
"borrowIndex": string;
"borrowIndexShort": number;
/** Composed final USD price, raw 18-decimal WAD. */
"usdPrice": string;
"usdPriceShort": number;
/** Primary oracle leg, raw 18-decimal WAD. */
"primaryPriceUsd": string;
"primaryPriceUsdShort": number;
/** Anchor oracle leg, raw 18-decimal WAD. */
"anchorPriceUsd": string;
"anchorPriceUsdShort": number;
/** Freshest-leg unix-seconds timestamp of the composed price; 0 if unusable. */
"priceTimestamp": number;
/** A price leg exceeded its staleness limit. */
"stale": boolean;
/** Primary/anchor prices outside the tolerance band. */
"deviation": boolean;
/** Fresh, in-band, and within sanity bounds — the only trustworthy state. */
"valid": boolean;
"chain": import('@xoxno/types/enums').ActivityChain;
}

export type StellarHubListItemDto = {
"hubId": number;
"name": (string) | null;
/** Total value locked (USD); equals deposits. */
"tvlUsd": number;
/** Total supplied valued in USD (live). */
"totalDepositsUsd": number;
/** Total borrowed valued in USD (live). */
"totalBorrowsUsd": number;
/** Number of assets listed on the hub. */
"assetCount": number;
/** Number of spokes connected to the hub. */
"spokeCount": number;
}

export type StellarSpokeListItemDto = {
"spokeId": number;
"name": (string) | null;
/** Primary connected hub (connectedHubIds[0]); spokes may span hubs. */
"hubId": number;
/** Every hub connected to the spoke. */
"connectedHubIds": Array<number>;
/** Total value locked (USD); equals deposits. */
"tvlUsd": number;
/** Total borrowed across reserves in USD (live). */
"totalBorrowsUsd": number;
/** Number of assets configured in the spoke. */
"assetCount": number;
}

export type StellarReserveListItemDto = {
"spokeId": number;
"hubId": number;
"asset": string;
"symbol": string;
"decimals": number;
"supplyApy": number;
"borrowApy": number;
/** Utilization rate in [0,1]. */
"utilizationRate": number;
/** Total supplied valued in USD (live). */
"totalDepositsUsd": number;
/** Total borrowed valued in USD (live). */
"totalBorrowsUsd": number;
/** Available liquidity valued in USD (live). */
"availableLiquidityUsd": number;
/** Supply (deposit) capacity filled, percentage [0,100]. A closed reserve (cap 0) reports 100 — it has no room. There is no uncapped state. */
"capacityFilledPct": number;
/** Remaining supply capacity valued in USD. 0 means no room left (full or closed), never unlimited. */
"remainingCapacityUsd": number;
/** Collateral factor (LTV) in basis points. */
"collateralFactorBps": number;
"liquidationThresholdBps": number;
/** Whether the asset is collateral in this spoke. */
"useAsCollateral": boolean;
/** Interest-rate-model curve (ray-scaled) for APY simulation in supply/borrow modals. */
"irm"?: (ReserveIrmCurveDto);
}

export type ReserveDto = {
"spokeId": number;
"hubId": number;
/** Reserve asset (Stellar token C-address). */
"asset": string;
/** Reserve asset decimals. */
"assetDecimals": number;
/** Hub-scoped supply APY. */
"supplyApy": number;
/** Hub-scoped borrow APY. */
"borrowApy": number;
/** Hub-pool utilization rate in [0,1] — counts every spoke on the hub. */
"utilization": number;
/** This spoke's supplied balance (human-readable units). Spoke-scoped. */
"suppliedShort": number;
/** This spoke's borrowed balance (human-readable units). Spoke-scoped. */
"borrowedShort": number;
/** Available liquidity / cash (human-readable units). */
"availableLiquidityShort": number;
/** Live spot USD price per whole unit. */
"usdPrice": number;
/** Total supplied valued in USD (live). */
"depositsUsd": number;
/** Total borrowed valued in USD (live). */
"borrowsUsd": number;
/** Available liquidity valued in USD (live). */
"availableLiquidityUsd": number;
/** Totals for the shared hub pool this reserve draws on — what the IRM and the utilization guard price. The supplied/borrowed totals above are spoke-scoped. */
"hubPool": (HubPoolDto);
/** Raw asset-native i128 spoke supply cap. Always an enforced ceiling; 0 means the reserve accepts no new supply (there is no unlimited sentinel). */
"supplyCap": string;
/** Raw asset-native i128 spoke borrow cap. Always an enforced ceiling; 0 means the reserve accepts no new borrows (there is no unlimited sentinel). */
"borrowCap": string;
/** Spoke supply cap for this reserve (human-readable units). Always an enforced ceiling; 0 means closed to new supply. */
"supplyCapShort": number;
/** Spoke borrow cap for this reserve (human-readable units). Always an enforced ceiling; 0 means closed to new borrows. */
"borrowCapShort": number;
/** Spoke deposit capacity filled, percentage [0,100]. */
"depositCapFilledPct": number;
/** Spoke borrow capacity filled, percentage [0,100]. */
"borrowCapFilledPct": number;
"isFlashloanable": boolean;
"flashloanFeeBps": number;
/** Live supply index applied to this reserve (ray, 1e27); stored index on fallback. */
"liveSupplyIndexRay": string;
/** Live borrow index applied to this reserve (ray, 1e27); stored index on fallback. */
"liveBorrowIndexRay": string;
/** Collateral factor (LTV) in basis points. */
"collateralFactorBps": number;
"liquidationThresholdBps": number;
/** Liquidation penalty (bonus) in basis points. */
"liquidationPenaltyBps": number;
"liquidationFeesBps": number;
"isCollateralizable": boolean;
"isBorrowable": boolean;
"paused": boolean;
"frozen": boolean;
/** Blocks only the liquidation seizure leg. Unlike paused, supply, borrow, withdraw and repay stay open; a liquidator simply cannot take this asset as collateral, so a quote naming it reverts with SpokeAssetSeizureHalted. */
"noSeize": boolean;
/** Whether the asset can be used as collateral here. */
"useAsCollateral": boolean;
/** Target health factor (wad, 1e18). */
"targetHealthFactorWad": string;
/** Health factor at which max bonus applies (wad). */
"healthFactorForMaxBonusWad": string;
"liquidationBonusFactorBps": number;
"irm": ReserveIrmCurveDto;
/** Assets usable as collateral in this spoke (token addresses). */
"supportedCollateral": Array<string>;
/** Assets borrowable in this spoke (token addresses). */
"borrowable": Array<string>;
}

export type TopHoldersDto = {
"spokeId"?: number;
"hubId"?: number;
"asset"?: string;
"side": "deposits" | "borrows";
/** Total scaled balance for the side (ray). */
"totalScaledRay": string;
"holders": Array<TopHolderDto>;
}

export type AssetDto = {
"asset": string;
"symbol": string;
"name": string;
"decimals": number;
/** Live spot USD price per whole unit. */
"usdPrice": number;
/** Total supplied across hubs valued in USD (live). */
"totalDepositsUsd": number;
/** Total borrowed across hubs valued in USD (live). */
"totalBorrowsUsd": number;
/** Total supplied across every hub listing this asset (human-readable units). Same quantity the assets list serves. */
"totalDepositsNative": number;
/** Total borrowed across every hub listing this asset (human-readable units). Same quantity the assets list serves. */
"totalBorrowsNative": number;
/** Available liquidity across hubs valued in USD (live). */
"availableLiquidityUsd": number;
/** Number of hubs listing this asset. */
"hubCount": number;
/** Number of reserves (spoke,hub) for this asset. */
"reserveCount": number;
/** Lowest supply APY across hubs. */
"minSupplyApy": number;
/** Highest supply APY across hubs. */
"maxSupplyApy": number;
/** Lowest borrow APY across hubs. */
"minBorrowApy": number;
/** Highest borrow APY across hubs. */
"maxBorrowApy": number;
/** Current indexed oracle configuration; null until first configure. */
"oracleProvider": ((AssetOracleConfigDto)) | null;
}

export type AssetPageDto = {
"asset": string;
"symbol": string;
"name": string;
"decimals": number;
/** Live spot USD price per whole unit. */
"usdPrice": number;
/** Total supplied across hubs valued in USD (live). */
"totalDepositsUsd": number;
/** Total borrowed across hubs valued in USD (live). */
"totalBorrowsUsd": number;
/** Total supplied across every hub listing this asset (human-readable units). Same quantity the assets list serves. */
"totalDepositsNative": number;
/** Total borrowed across every hub listing this asset (human-readable units). Same quantity the assets list serves. */
"totalBorrowsNative": number;
/** Available liquidity across hubs valued in USD (live). */
"availableLiquidityUsd": number;
/** Number of hubs listing this asset. */
"hubCount": number;
/** Number of reserves (spoke,hub) for this asset. */
"reserveCount": number;
/** Lowest supply APY across hubs. */
"minSupplyApy": number;
/** Highest supply APY across hubs. */
"maxSupplyApy": number;
/** Lowest borrow APY across hubs. */
"minBorrowApy": number;
/** Highest borrow APY across hubs. */
"maxBorrowApy": number;
/** Current indexed oracle configuration; null until first configure. */
"oracleProvider": ((AssetOracleConfigDto)) | null;
"depositMarkets": Array<AssetMarketDto>;
"borrowMarkets": Array<AssetMarketDto>;
"graphSeries": Array<AssetPageGraphSeriesDto>;
}

export type AssetMarketDto = {
"spokeId": number;
"hubId": number;
"asset": string;
"spokeName": (string) | null;
"hubName": (string) | null;
"supplyApy": number;
"borrowApy": number;
"utilization": number;
/** Total supplied on the hub (human-readable). */
"suppliedShort": number;
/** Total borrowed on the hub (human-readable). */
"borrowedShort": number;
/** Available liquidity / cash (human-readable). */
"availableLiquidityShort": number;
/** Live spot USD price per whole unit. */
"usdPrice": number;
/** Total supplied valued in USD (live). */
"depositsUsd": number;
/** Total borrowed valued in USD (live). */
"borrowsUsd": number;
/** Available liquidity valued in USD (live). */
"availableLiquidityUsd": number;
/** Totals for the shared hub pool this reserve draws on — what the IRM and the utilization guard price. The supplied/borrowed totals above are spoke-scoped. */
"hubPool": (HubPoolDto);
/** Collateral factor (LTV) in basis points. */
"collateralFactorBps": number;
"liquidationThresholdBps": number;
"isCollateralizable": boolean;
"isBorrowable": boolean;
"paused": boolean;
"frozen": boolean;
/** Blocks only the liquidation seizure leg; all user verbs stay open. */
"noSeize": boolean;
"supplyCapShort": number;
"borrowCapShort": number;
"depositCapFilledPct": number;
"borrowCapFilledPct": number;
"remainingSupplyCapacityUsd": number;
"remainingBorrowCapacityUsd": number;
"supportedCollateral": Array<string>;
"borrowableAssets": Array<string>;
"userSuppliedNative": number;
"userBorrowedNative": number;
"userSuppliedUsd": number;
"userBorrowedUsd": number;
/** Live supply index applied (ray, 1e27). */
"liveSupplyIndexRay": string;
/** Live borrow index applied (ray, 1e27). */
"liveBorrowIndexRay": string;
}

export type HubDto = {
"hubId": number;
"isActive": boolean;
"name": (string) | null;
/** Total supplied valued in USD (live). */
"totalDepositsUsd": number;
/** Total borrowed valued in USD (live). */
"totalBorrowsUsd": number;
/** Available liquidity valued in USD (live). */
"availableLiquidityUsd": number;
/** USD utilization (borrows/deposits); 0 when no deposits. */
"utilization": number;
"assetCount": number;
"assets": Array<HubAssetDto>;
}

export type SpokeDto = {
"spokeId": number;
"isDeprecated": boolean;
"name": (string) | null;
/** Total supplied across reserves valued in USD (live). */
"totalDepositsUsd": number;
/** Total borrowed across reserves valued in USD (live). */
"totalBorrowsUsd": number;
"assetCount": number;
/** Hub IDs this spoke connects to. */
"connectedHubIds": Array<number>;
/** Count of connected hubs. */
"connectedHubCount": number;
/** Target health factor (wad, 1e18). */
"liquidationTargetHfWad": string;
/** Health factor at which max liquidation bonus applies (wad). */
"healthFactorForMaxBonusWad": string;
"liquidationBonusFactorBps": number;
"connectedHubs": Array<SpokeConnectedHubDto>;
"markets": Array<SpokeMarketDto>;
}

export type AccountPositionsDto = {
"positions": Array<AccountPositionDto>;
}

export type StellarUserActivityItemDto = {
/** Event time (ISO-8601). */
"timestamp": string;
/** Monotonic event ordinal; feed sort key. */
"seq": number;
/** Action kind (supply/borrow/withdraw/repay/liqRepay/...). */
"action": string;
/** Position side this leg mutated; null for non-position rows. */
"side": ("supply" | "borrow") | null;
/** Asset (token) contract address. */
"token": string;
"symbol": string;
"decimals": number;
"hubId": number;
"spokeId": (number) | null;
"reserveKey": (string) | null;
/** Action delta this tx, human-readable token units. */
"amountShort": number;
/** Action delta valued in USD at event-time price. */
"usd": number;
/** Liquidator (caller) address on liquidation legs. */
"liquidator": (string) | null;
}

export type GovernanceProposalsPageDto = {
"resources": Array<GovernanceProposalDto>;
"hasMoreResults": boolean;
/** Opaque continuation token. */
"continuationToken": (string) | null;
}

export type MarketGraphDto = {
"points": Array<MarketGraphPointDto>;
"fees"?: Array<FeeGraphPointDto>;
}

export type SpokeGraphDto = {
"spokeId": number;
"points": Array<SpokeGraphPointDto>;
}

export type StellarStatsHistoryDto = {
/** Bin timestamps (ISO-8601). */
"timestamps": Array<string>;
/** Total supplied USD per bin. */
"supplied": Array<number>;
/** Total borrowed USD per bin. */
"borrowed": Array<number>;
/** Total protocol revenue USD per bin. */
"revenue": Array<number>;
}

export type StellarPositionsPnlDto = {
"positions": Array<StellarPositionPnlDto>;
}

export type StellarCampaignLeaderboardDto = {
"rows": Array<StellarCampaignRowDto>;
"campaignStart": string;
"campaignEnd": string;
"prizePool": number;
}

export type StellarCampaignMeDto = {
/** 1-based rank among all scorers. */
"rank": number;
/** Wallet (Owner). Empty Owner falls back to AccountId. */
"owner": string;
/** Campaign points (USD-days + quests). */
"score": number;
/** Haircut equity USD-days (max(supply-borrow, 0)). */
"twEquity": number;
/** Borrow USD-days, capped at 3x equity. */
"twBorrow": number;
/** Estimated prize-pool share (1e6 units proportional to score). */
"allocation": number;
"questsCompleted": number;
"questsTotal": number;
"quests": StellarCampaignQuestsDto;
"firstMigrateAt"?: (string) | null;
"accounts": number;
"campaignStart": string;
"campaignEnd": string;
"prizePool": number;
}

export type StellarPositionsRankDto = {
"positions": Array<StellarPositionRankDto>;
}

export type UserHistoryDto = {
"accountId": string;
"points": Array<UserHistoryPointDto>;
}

export type PnlByScopeDto = {
"rows": Array<PnlScopeRowDto>;
}

export type RevenueSeriesDto = {
"points": Array<RevenuePointDto>;
}

export type FeeRevenueSeriesDto = {
"points": Array<FeeRevenuePointDto>;
}

export type ParticipantCountsDto = {
"suppliers": number;
"borrowers": number;
"total": number;
}

export type LiquidationsSeriesDto = {
"points": Array<LiquidationPointDto>;
}

export type LiquidationsLeaderboardDto = {
"liquidators": Array<LiquidationLeaderRowDto>;
}

export type VolumeSeriesDto = {
"points": Array<VolumePointDto>;
}

export type ActiveUsersSeriesDto = {
"points": Array<ActiveUsersPointDto>;
}

export type HolderDistributionDto = {
"side": "supply" | "borrow";
"holders": number;
"totalUsd": number;
"avgUsd": number;
"medianUsd": number;
"p90Usd": number;
"top1Usd": number;
"top10Usd": number;
/** Top-1 holder share of the total, percent. */
"top1SharePct": number;
/** Top-10 holders share of the total, percent. */
"top10SharePct": number;
}

export type RateSpreadSeriesDto = {
"points": Array<RateSpreadPointDto>;
}

export type DefiLlamaDimensionsDto = {
"points": Array<DefiLlamaPointDto>;
}

export type StellarWalletBalanceDto = {
"owner": string;
/** Deployment-selected Stellar network: mainnet or testnet */
"network": string;
"asset": string;
/** Exact nonnegative i128 token base units. Raw holdings, not guaranteed spendable funds. */
"amount": string;
"decimals": number;
}

export type StellarActivityPageDto = {
"resources": Array<StellarActivityEntryDto>;
"hasMoreResults": boolean;
"continuationToken"?: string;
}

export type StellarMarketIndexByHub = {
"hubId": number;
"asset": string;
/** Raw 27-decimal RAY. */
"supplyIndex": string;
"supplyIndexShort": number;
/** Raw 27-decimal RAY. */
"borrowIndex": string;
"borrowIndexShort": number;
/** Raw 18-decimal WAD. */
"usdPrice": string;
"usdPriceShort": number;
/** Raw 18-decimal WAD. */
"primaryPriceUsd": string;
"primaryPriceUsdShort": number;
/** Raw 18-decimal WAD. */
"anchorPriceUsd": string;
"anchorPriceUsdShort": number;
"chain": import('@xoxno/types/enums').ActivityChain;
}

export type ReserveIrmCurveDto = {
/** Base borrow rate (ray, 1e27). */
"baseRateRay": string;
/** Slope below the optimal utilization (ray). */
"slope1Ray": string;
/** Slope between optimal and mid utilization (ray). */
"slope2Ray": string;
/** Slope above the mid utilization (ray). */
"slope3Ray": string;
/** Optimal utilization kink (ray). */
"optimalUtilizationRay": string;
/** Mid utilization kink (ray). */
"midUtilizationRay": string;
/** Maximum utilization (ray). */
"maxUtilizationRay": string;
/** Maximum borrow rate at full utilization (ray). */
"maxBorrowRateRay": string;
/** Protocol reserve factor in basis points. */
"reserveFactorBps": number;
}

export type HubPoolDto = {
/** Hub-wide supplied (human-readable units). */
"suppliedShort": number;
/** Hub-wide borrowed (human-readable units). */
"borrowedShort": number;
/** Hub-wide supplied valued in USD (live). */
"depositsUsd": number;
/** Hub-wide borrowed valued in USD (live). */
"borrowsUsd": number;
}

export type TopHolderDto = {
"owner": string;
"accountId": string;
/** Scaled balance (ray, 1e27). */
"scaledRay": string;
/** Balance in human-readable units. */
"amountShort": number;
/** Share of the side total, percentage [0,100]. */
"sharePct": number;
}

export type AssetOracleConfigDto = StellarDomain.StellarAssetOracle

export type AssetPageGraphSeriesDto = {
"spokeId": number;
"hubId": number;
"spokeName": (string) | null;
"hubName": (string) | null;
"points": Array<AssetPageGraphPointDto>;
}

export type HubAssetDto = {
"hubId": number;
"asset": string;
"supplyApy": number;
"borrowApy": number;
"utilization": number;
"suppliedShort": number;
"borrowedShort": number;
/** Available liquidity / cash (human-readable). */
"availableLiquidityShort": number;
/** Live spot USD price per whole unit. */
"usdPrice": number;
/** Total supplied valued in USD (live). */
"depositsUsd": number;
/** Total borrowed valued in USD (live). */
"borrowsUsd": number;
/** Available liquidity valued in USD (live). */
"availableLiquidityUsd": number;
"isFlashloanable": boolean;
/** Live supply index applied (ray, 1e27). */
"liveSupplyIndexRay": string;
/** Live borrow index applied (ray, 1e27). */
"liveBorrowIndexRay": string;
}

export type SpokeConnectedHubDto = {
"hubId": number;
"name": (string) | null;
/** Total supplied on this hub through this spoke, USD. */
"depositsUsd": number;
/** Total borrowed on this hub through this spoke, USD. */
"borrowsUsd": number;
/** Borrowing capacity from collateral on this hub (sum of depositsUsd × LTV). */
"creditLineUsd": number;
/** borrowsUsd / creditLineUsd as a percentage (0 when no line). */
"creditUsedPct": number;
"assetCount": number;
/** Asset addresses on this hub. */
"assets": Array<string>;
}

export type SpokeMarketDto = {
"spokeId": number;
"hubId": number;
"asset": string;
"supplyApy": number;
"borrowApy": number;
"utilization": number;
/** Available liquidity / cash (human-readable). */
"availableLiquidityShort": number;
/** Live spot USD price per whole unit. */
"usdPrice": number;
/** This spoke's supplied balance for the asset (human-readable units). Spoke-scoped, not the hub-wide total — the hub pool this market draws on is larger. */
"suppliedShort": number;
/** This spoke's borrowed balance for the asset (human-readable units). Spoke-scoped; `utilization` above is hub-scoped, so this will not divide into it. */
"borrowedShort": number;
/** This spoke's supplied balance valued in USD (live). Spoke-scoped. */
"depositsUsd": number;
/** This spoke's borrowed balance valued in USD (live). Spoke-scoped. */
"borrowsUsd": number;
/** Available liquidity valued in USD (live). */
"availableLiquidityUsd": number;
/** Collateral factor (LTV) in basis points. */
"collateralFactorBps": number;
"liquidationThresholdBps": number;
"isCollateralizable": boolean;
"isBorrowable": boolean;
"paused": boolean;
"frozen": boolean;
/** Live supply index applied (ray, 1e27). */
"liveSupplyIndexRay": string;
/** Live borrow index applied (ray, 1e27). */
"liveBorrowIndexRay": string;
}

export type AccountPositionDto = {
"accountId": string;
"owner": string;
"spokeId": number;
"hubId": number;
"asset": string;
/** Stellar position mode: 0 normal, 1 multiply, 2 long, 3 short. */
"positionMode": number;
/** Scaled supply balance (ray, 1e27). */
"supplyScaledRay": string;
/** Scaled borrow balance (ray, 1e27). */
"borrowScaledRay": string;
"supplyIndexRay": (string) | null;
"borrowIndexRay": (string) | null;
/** Actual token quantity in RAY (1e27), not token base units: floor(scaledBalanceRay * appliedIndexRay / 1e27). */
"supplyAmount": string;
/** Actual token quantity in RAY (1e27), not token base units: floor(scaledBalanceRay * appliedIndexRay / 1e27). */
"borrowAmount": string;
/** Live supply index applied (ray, 1e27); stored index on fallback. */
"liveSupplyIndexRay": (string) | null;
/** Live borrow index applied (ray, 1e27); stored index on fallback. */
"liveBorrowIndexRay": (string) | null;
/** LTV snapshotted at open time, basis points. */
"entryLtvBps": number;
"entryLiquidationThresholdBps": number;
"entryLiquidationBonusBps": number;
"entryLiquidationFeesBps": number;
"initialPaymentMultiplier": (StellarDomain.StellarInitialPaymentMultiplier) | null;
"updatedAt": number;
"ledger": number;
}

export type GovernanceProposalDto = {
"operationId": string;
"kind": StellarDomain.StellarGovernanceProposalKind;
"status": StellarDomain.StellarGovernanceProposalStatus;
"target": StellarDomain.StellarGovernanceProposalTarget;
"targetAddress": string;
"functionName": string;
"summary": string;
"fields": Array<StellarDomain.StellarGovernanceProposalField>;
"assetAddress"?: string;
"assetSymbol"?: string;
"proposer": string;
"scheduledLedger": number;
"readyLedger": number;
"delayLedgers": number;
"expiresLedger": number;
"executedLedger"?: number;
"cancelledLedger"?: number;
"scheduledAt": number;
"executedAt"?: number;
"cancelledAt"?: number;
"scheduledTxHash": string;
"executedTxHash"?: string;
"cancelledTxHash"?: string;
}

export type MarketGraphPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"hubId": number;
"spokeId": (number) | null;
"token": string;
"supplyApy": number;
"borrowApy": number;
"utilization": number;
"totalDepositsUsd": number;
"totalBorrowsUsd": number;
"availableLiquidityUsd": number;
"usdPrice": number;
}

export type FeeGraphPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
/** Summed fee in human-readable units. */
"feeShort": number;
/** Summed USD value. */
"usd": number;
}

export type SpokeGraphPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
/** Spoke-attributed supplied USD. */
"suppliedUsd": number;
/** Spoke-attributed borrowed USD. */
"borrowedUsd": number;
/** Spoke-attributed supplied, native units. */
"suppliedNative": number;
/** Spoke-attributed borrowed, native units. */
"borrowedNative": number;
/** USD-weighted blended supply APY. */
"supplyApy": number;
/** USD-weighted blended borrow APY. */
"borrowApy": number;
}

export type StellarPositionPnlDto = {
"accountId": string;
"token": string;
/** Net PnL in USD (interest earned − interest owed). */
"pnlUsd": number;
/** Net PnL in token units. */
"pnlToken": number;
/** Supply-side interest earned, USD. */
"interestUsd": number;
/** Supply-side interest earned, token units. */
"interest": number;
/** Borrow-side interest owed, USD (negative). */
"debtUsd": number;
/** Borrow-side interest owed, token units (negative). */
"debt": number;
}

export type StellarCampaignRowDto = {
/** 1-based rank among all scorers. */
"rank": number;
/** Wallet (Owner). Empty Owner falls back to AccountId. */
"owner": string;
/** Campaign points (USD-days + quests). */
"score": number;
/** Haircut equity USD-days (max(supply-borrow, 0)). */
"twEquity": number;
/** Borrow USD-days, capped at 3x equity. */
"twBorrow": number;
/** Estimated prize-pool share (1e6 units proportional to score). */
"allocation": number;
"questsCompleted": number;
"questsTotal": number;
"quests": StellarCampaignQuestsDto;
"firstMigrateAt"?: (string) | null;
"accounts": number;
}

export type StellarCampaignQuestsDto = {
"supply": boolean;
"borrow": boolean;
"multiply": boolean;
"swapCollateral": boolean;
"swapDebt": boolean;
"repayCollateral": boolean;
"migrate": boolean;
}

export type StellarPositionRankDto = {
/** 1-based rank within the ordered result. */
"position": number;
"accountId": string;
"owner"?: string;
/** Total supplied USD (or for `token` when filtered). */
"supplied": number;
/** Total borrowed USD (or for `token` when filtered). */
"borrowed": number;
/** Health factor from StellarGetLendingPositions: debt / liquidation-weighted collateral × 100 (higher = riskier). Debt with zero collateral uses a large sentinel. Liquidatable when >= 100 under that definition — do not invert to Aave-style collateral/debt. */
"healthFactor": number;
}

export type UserHistoryPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"token": string;
"side": "supply" | "borrow";
/** Balance in native units. */
"native": number;
/** Balance in USD. */
"usd": number;
}

export type PnlScopeRowDto = {
"scope": "asset" | "hub" | "protocol";
/** Token, hubId, or "protocol" depending on scope. */
"groupKey": string;
"interestToken": number;
"debtToken": number;
"pnlToken": number;
"interestUsd": number;
"debtUsd": number;
"pnlUsd": number;
}

export type RevenuePointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"scope": "asset" | "hub" | "protocol";
"groupKey": string;
/** Cumulative revenue USD as of the bin. */
"cumulativeUsd": number;
/** Per-bin revenue USD delta (>= 0). */
"deltaUsd": number;
/** Cumulative native revenue (asset scope only). */
"cumulativeNative": number;
}

export type FeeRevenuePointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"action": "flashLoan" | "strategyFee";
"token": string;
/** Fee in native units. */
"feeNative": number;
/** Fee in USD (fee x oracle price). */
"feeUsd": number;
}

export type LiquidationPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"repaidUsd": number;
/** GROSS collateral removed from liquidatees, protocol liquidation fee still inside. This is liquidation volume, NOT liquidator payout — the payout is lower by that fee under both seize modes. Do not add creditedNetUsd to it: they are two views of the same collateral. */
"seizedUsd": number;
/** NET collateral actually credited to liquidators, fee removed. Only SeizeMode::Credit liquidations expose it; under SeizeMode::Transfer the fee is withheld inside the pool and never reaches the event stream, so this reads 0 there. Not a substitute for seizedUsd. */
"creditedNetUsd": number;
"repaidNative": number;
"seizedNative": number;
/** NET collateral credited to liquidators, in native units — the counterpart of seizedNative. 0 under SeizeMode::Transfer. */
"creditedNetNative": number;
/** Distinct liquidation events in the bin. Excludes the share-credit receiver leg, which is a second position batch for the same liquidation. */
"liquidations": number;
}

export type LiquidationLeaderRowDto = {
/** Liquidator (caller) address. */
"liquidator": string;
/** Distinct liquidation events executed. */
"liquidations": number;
/** Distinct liquidatee accounts touched. */
"accountsLiquidated": number;
"repaidUsd": number;
/** GROSS collateral removed from liquidatees, protocol liquidation fee still inside. This is liquidation volume, NOT liquidator payout — the payout is lower by that fee under both seize modes. Do not add creditedNetUsd to it: they are two views of the same collateral. */
"seizedUsd": number;
/** NET collateral actually credited to liquidators, fee removed. Only SeizeMode::Credit liquidations expose it; under SeizeMode::Transfer the fee is withheld inside the pool and never reaches the event stream, so this reads 0 there. Not a substitute for seizedUsd. */
"creditedNetUsd": number;
}

export type VolumePointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"supplyUsd": number;
"borrowUsd": number;
"withdrawUsd": number;
"repayUsd": number;
"supplyNative": number;
"borrowNative": number;
"withdrawNative": number;
"repayNative": number;
/** (supply + repay) - (withdraw + borrow), USD. */
"netFlowUsd": number;
}

export type ActiveUsersPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"activeAccounts": number;
"activeOwners": number;
/** Accounts first seen in this bin. */
"newUsers": number;
}

export type RateSpreadPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"hubId": number;
"token": string;
"supplyApy": number;
"borrowApy": number;
/** borrowApy - supplyApy. */
"spread": number;
}

export type DefiLlamaPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"tvl": number;
"borrowed": number;
/** Borrow interest accrued in the bin. */
"fees": number;
/** Reserve revenue accrued in the bin. */
"revenue": number;
}

export type StellarActivityEntryDto = {
"id": string;
"network": string;
"owner": string;
"transactionHash": string;
"timestamp": string;
"action": string;
"side": string;
"token": string;
"seq": number;
/** Exact signed token base-unit delta. */
"amount": string;
"tokenDecimals": (number) | null;
"symbol": (string) | null;
"name": (string) | null;
}

export type AssetPageGraphPointDto = {
/** Bin timestamp (ISO-8601). */
"timestamp": string;
"supplyApy": number;
"borrowApy": number;
"totalDepositsUsd": number;
"totalBorrowsUsd": number;
"suppliedNative": number;
"borrowedNative": number;
}
