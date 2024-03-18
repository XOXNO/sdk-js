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
}

export interface StatusResponse {
  status: boolean;
}
