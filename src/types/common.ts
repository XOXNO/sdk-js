import { ShortCollectionInfo } from './collection';

export interface TokenUSDPrices {
  [traitType: string]: number;
}

export type AshSwapPaymentData = {
  paymentToken: string;
  swapAmount: number;
  argument: string;
  limits: string[];
  bigUintAmount: string;
  extraGasLimit: number;
};

export interface AnalyticsGraphs {
  marketplace: string;
  timestamp: Date[];
  totalEgldVolume: number[];
  totalUsdVolume: number[];
  totalTrades: number[];
  floorPrice: number[];
  athPrice: number[];
  avgPrice: number[];
}

export interface StatusResponse {
  status: boolean;
}

export interface StatisticsSummary {
  userCount: number;
  listingsCount: number;
  tradingStats: TradingStats;
}

export interface TradingStats {
  totalVolume: number;
  totalTrades: number;
  averagePrice: number;
  allTimeHigh: AllTimeHigh;
  day: Day;
  week: HalfYear;
  month: HalfYear;
  quarter: HalfYear;
  halfYear: HalfYear;
  year: HalfYear;
}

export interface AllTimeHigh {
  price: number;
  timestamp: number;
  txHash: string;
  identifier: string;
}

export interface Day {
  volume: number;
  volumeMargin: number;
  trades: number;
  tradesMargin: number;
}

export interface HalfYear {
  volume: number;
  volumeMargin: number;
  trades: number;
  tradesMargin: number;
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
}

export interface StakingExplore {
  collection: string;
  activePools: number;
  totalPoolStakedCount: number;
  totalDelegatorCount: number;
  rewardTickers: string[];
  collectionInfo: ShortCollectionInfo;
}
