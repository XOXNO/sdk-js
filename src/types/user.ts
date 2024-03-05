import { ISocials } from './collection';
import { NftData, Owner } from './nft';
import { UnClaimedReward } from './staking';

export interface BulkAccount {
  address: string;
  nonce: number;
  username?: string;
  balance: string;
  balanceShort: number;
}

export interface IUserProfile {
  dataType: 'userProfile';
  hasKYC?: boolean;
  address: string;
  isBanned: boolean;
  isVerified: boolean;
  socials: ISocials;
  favorites: string[]; // Favorited NFTs
  joinedDate: number;
  id: string;
  profile: string;
  banner: string;
  description: string;
  herotag: string;
  isCreator: boolean;
  creatorInfo: {
    contractAddress?: string;
    name?: string;
  };
  isPoolOwner: boolean;
  followedCollections: string[]; // Followed collections
  userDeposit: UserDeposit[];
  _ts: number;
  shard: number;
}

export interface UserDeposit {
  balanceShort: number;
  balance: string;
  paymentToken: string;
  paymentTokenNonce: number;
}

export interface UserInventory {
  collection: string;
  inventoryCount: number;
  listedCount: number;
  stakedCount: number;
  floorPrice: number;
  name: string;
  isVerified: boolean;
  profile: string;
  banner: string;
  value: number;
}

export interface UserOffers {
  hasMoreResults: boolean;
  resources: OfferBody[];
}

export interface ArgsUserOffers {
  address: string;
  type: OfferType;
  skip: number;
  top: number;
}

export enum OfferType {
  Received = 'received',
  Sent = 'sent',
}

export interface OfferBody {
  dataType: string;
  identifier: string;
  collection: string;
  offerId: number;
  paymentToken: string;
  paymentTokenNonce: number;
  price: string;
  priceShort: number;
  deadline: number;
  timestamp: number;
  owner: Owner;
  quantity: number;
  marketplace: string;
  id: string;
  _ts: number;
  nftInfo: NftData;
  isActive: boolean;
  priceUsd: number;
  floorPriceMargin: number;
  floorPrice: number;
}

export type UserStakingInfo = {
  pool_id: number;
  pool_type: string;
  unClaimedReward: UnClaimedReward[];
  reward_token: string[];
  name: string;
  profile: string;
  ticker: TickerElement[];
  nfts: Nfts;
};

export type Nfts = {
  count: number;
  resultsCount: number;
  results: NftData[];
  empty: boolean;
};

export enum Type {
  NonFungibleESDT = 'NonFungibleESDT',
}
export type TickerElement = {
  ticker: string;
  name: string;
};

export type UserAccountInfo = {
  address: string;
  nonce: number;
  totalEsdtUsd: number;
  totalStables: number;
  totalEgldStables: number;
  totalEgldEsdt: number;
  totalUsdBalance: number;
  totalEGLDBalance: number;
  balance: string;
  balanceShort: number;
  balanceUsd: number;
  balanceWalletWeight: number;
  stablesWalletWeight: number;
  esdtWalletWeight: number;
  username?: string;
  ownerAddress?: string;
  esdtTokens: EsdtToken[];
  shard: number;
  guarded: boolean;
  activeGuardian: ActiveGuardian;
  isUpgradeable: boolean;
  isReadable: boolean;
  isPayable: boolean;
  isPayableBySmartContract: boolean;
};

export type ActiveGuardian = {
  activationEpoch: number;
  address: string;
  serviceUID: string;
};

export type EsdtToken = {
  nonce: number;
  identifier: string;
  decimals: number;
  balance: string;
  ticker: string;
  name: string;
  shortBalance: number;
  assets: Assets;
  isAshSupported?: boolean;
  usdValue: number;
  walletWeight: number;
};

export type Assets = {
  pngUrl: string;
  svgUrl: string;
};

export type CreatorProfile = {
  name: string;
  contractAddress: string;
  address: string;
  _ts: number;
};

export interface UserStakingSummary {
  collection: string;
  stakedCount: number;
  name: string;
  isVerified: boolean;
  profile: string;
  banner: string;
  reward: RewardStakinSummary[];
}

export interface UserCollectionStaking {
  poolId: number;
  name: string;
  profile: string;
  stakedCount: number;
  reward: RewardStakinSummary[];
  isActive: boolean;
  daysLeft: number;
}

export interface RewardStakinSummary {
  tokenIdentifier: string;
  tokenNonce: number;
  amount: string;
  amountShort: number;
  usdValue: number;
}

export interface PoolDetails {
  poolId: number;
  name: string;
  profile: string;
  collection: string[];
  poolStakedCount: number;
  delegatorCount: number;
  rewardDuration: number;
  reward: RewardAvaiblePools[];
  poolType: string;
  issuingType: string;
  isActive: boolean;
  currentEpoch: number;
  unBoundPeriod: boolean;
  hasUnboundPeriod: boolean;
  maxPoolLimit: number;
  maxWalletLimit: number;
  hasMaxWalletLimit: boolean;
  endDate: number;
  startDate: number;
  owner: string;
  daysLeft: number;
  percentFilled: number;
}

export interface RewardAvaiblePools {
  tokenIdentifier: string;
  tokenNonce: number;
  rewardPerEpochShort: number;
  rewardBalance: number;
  rewardPerDayPerNft: number;
  usdValue: number;
}

export interface UserPoolStakingInfo {
  nftDocs: NftData[];
  poolDoc: PoolDetails;
}
