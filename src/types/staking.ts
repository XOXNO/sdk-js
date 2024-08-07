import type { RewardAvaiblePools, RewardStakinSummary } from './user'

export type Reward = {
  value: number
  ticker: string
}

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
  ticker: string
  name: string
}

export type GetGroupedStakingPools = {
  ticker: string
  pools: number
  name: string
  profile: string
  isVerified: boolean
}

export interface StakingSummaryPoolsSlim {
  collection: string
  stakedCount: number
  name: string
  isVerified: boolean
  profile: string
  banner: string
  userReward: RewardStakinSummary[]
  poolIds: number[]
}

export interface StakingSummaryPools {
  poolId: number
  starEpoch: number
  endEpoch: number
  currentEpoch: number
  poolType: string
  issuingType: string
  name: string
  profile: string
  cutFee: number
  collection: string[]
  poolStakedCount: number
  userStakedCount: number
  poolReward: RewardAvaiblePools[]
  userReward: RewardStakinSummary[]
  rewardDuration: number
  isActive: boolean
  daysLeft: number
  maxPoolLimit: number
  hasMaxWalletLimit: boolean
  maxWalletLimit: number
  percentageFilled: number
  hasUnboundPeriod: boolean
  unBoundPeriod: number
  stakingEnabled: boolean
}

export enum StakingStatus {
  Staked = 'staked',
  Unbounding = 'unstaked',
  Available = 'available',
}
