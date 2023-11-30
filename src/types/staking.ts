import { TickerElement } from './user';

export type StakingPool = {
  name: string;
  collections: TickerElement[];
  pool_type: PoolType;
  issuing_type: IssuingType;
  pool_id: number;
  pool_total_staked?: number;
  whitelist_pool: boolean;
  is_active: boolean;
  is_stake_enabled: boolean;
  daily_reward_in_egld?: number;
  daily_reward_in_usd?: number;
  expiration_in_days: number;
  profile: string;
  unbound_period: number;
  reward_per_epoch: Reward[];
  reward_balance: Reward[];
  start_issuing: number;
  start_issuing_timestamp: number;
  deadline_issuing: number;
  deadline_issuing_timestamp: number;
  cut_fees: number;
  max_stake_per_pool: number;
  reward_tokens: string[];
  reward_per_epoch_per_nft: Reward[];
  max_stake_per_wallet: number;
  is_verified: boolean;
  percent_filled: number | null;
  currentEpoch: number;
  owner: string;
};

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

export type GroupStakingInfo = {
  ticker: string;
  name: string;
  isVerified: boolean;
  profile: string;
  banner: string;
  totalStakedNfts: number;
  pools: Pool[];
  rewards: UnClaimedReward[];
};

export type Pool = {
  pool_id: number;
  total_staked: number;
  name: string;
  collections: Collection[];
  pool_type: string;
  issuing_type: string;
  pool_total_staked: number;
  whitelist_pool: boolean;
  is_active: boolean;
  is_stake_enabled: boolean;
  expiration_in_days: number;
  profile: string;
  unbound_period: number;
  reward_per_epoch: Reward[];
  reward_balance: any[];
  start_issuing: number;
  start_issuing_timestamp: number;
  deadline_issuing: number;
  deadline_issuing_timestamp: number;
  cut_fees: number;
  max_stake_per_pool: number;
  reward_tokens: string[];
  reward_per_epoch_per_nft: Reward[];
  max_stake_per_wallet: number;
  is_premium: boolean;
  is_verified: boolean;
  percent_filled: number;
  currentEpoch: number;
  owner: string;
  unClaimedReward: UnClaimedReward[];
  dailyRewardPerNFT: Reward[];
  reward_token: string[];
  ticker: string[];
  totalStakedNfts: number;
};

export type Collection = {
  ticker: string;
  name: string;
};

export type UnClaimedReward = {
  reward_token: string;
  reward_token_nonce: string;
  amount: number;
  pool_id?: number;
};

export type GetGroupedStakingPools = {
  ticker: string;
  pools: number;
  name: string;
  profile: string;
  isVerified: boolean;
};
