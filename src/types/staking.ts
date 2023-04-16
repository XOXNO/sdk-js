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

export enum IssuingType {
  Dynamic = 'Dynamic',
  Fixed = 'Fixed',
}

export enum PoolType {
  Duo = 'Duo',
  Single = 'Single',
}

export type Reward = {
  value: number;
  ticker: string;
};
