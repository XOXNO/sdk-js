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
