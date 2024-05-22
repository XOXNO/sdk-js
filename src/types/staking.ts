import { RewardAvaiblePools } from './user';

export type Reward = {
  value: number;
  ticker: string;
};

export enum IssuingType {
  Dynamic = 'Dynamic',
  Fixed = 'Fixed',
}

export enum PoolType {
  Duo = 'Duo',
  Single = 'Single',
  Perk = 'Perk',
}

export type Collection = {
  ticker: string;
  name: string;
};

export type GetGroupedStakingPools = {
  ticker: string;
  pools: number;
  name: string;
  profile: string;
  isVerified: boolean;
};

export interface StakingSummaryPools {
  poolId: number;
  starEpoch: number;
  endEpoch: number;
  currentEpoch: number;
  poolType: string;
  issuingType: string;
  name: string;
  profile: string;
  collection: string[];
  poolStakedCount: number;
  userStakedCount: number;
  poolReward: RewardAvaiblePools[];
  userReward: RewardAvaiblePools[];
  rewardDuration: number;
  isActive: boolean;
  daysLeft: number;
  maxPoolLimit: number;
  hasMaxWalletLimit: boolean;
  maxWalletLimit: number;
  percentageFilled: number;
  hasUnboundPeriod: boolean;
  unBoundPeriod: number;
}

export interface PoolDetails {
  poolId: number;
  starEpoch: number;
  endEpoch: number;
  currentEpoch: number;
  poolType: string;
  issuingType: string;
  name: string;
  profile: string;
  collection: string[];
  poolStakedCount: number;
  reward: RewardAvaiblePools[];
  rewardDuration: number;
  isActive: boolean;
  daysLeft: number;
  maxPoolLimit: number;
  maxWalletLimit: number;
  hasMaxWalletLimit: boolean;
  percentageFilled: number;
  unBoundPeriod: boolean;
  hasUnboundPeriod: boolean;
  owner: string;
  delegatorCount: number;
}
