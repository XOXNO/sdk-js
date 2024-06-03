import { ISocials } from './collection';
import { NftData, Owner } from './nft';
import { StakingSummaryPools } from './staking';

export interface BulkAccount {
  address: string;
  nonce: number;
  username?: string;
  balance: string;
  balanceShort: number;
}

export interface IUserProfileSearch {
  address: string;
  isVerified: boolean;
  profile: string;
  herotag: string;
  addressTrimmed: string;
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
  count: number;
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
  Placed = 'placed',
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
  usdValue: number;
  floorPriceMargin: number;
  floorPrice: number;
}

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

export type UserTokenInventory = {
  tokens: EsdtToken[];
  esdts: TokenWorth;
  stables: TokenWorth;
  wallet: TokenWorth;
};

export type TokenWorth = {
  usdValue: number;
  egldValue: number;
  weight: number;
};

export type UserNetworkAccount = {
  address: string;
  nonce: number;
  balance: string;
  balanceShort: number;
  usdValue: number;
  username?: string;
  shard: number;
  guarded: boolean;
  activeGuardian: ActiveGuardian;
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
  usdPrice: number;
  usdValue: number;
  egldValue: number;
  assets: Assets;
  isAshSupported?: boolean;
  weight: number;
};

export type Assets = {
  pngUrl: string;
  svgUrl: string;
};

export type CreatorProfile = {
  name: string;
  profile: string;
  banner: string;
  description?: string;
  isVerified?: boolean;
  socials?: ISocials;
  joinedDate?: number;
  contractAddress: string;
  address: string;
  _ts: number;
};

export interface RewardStakinSummary {
  tokenIdentifier: string;
  tokenNonce: number;
  amount: string;
  amountShort: number;
  usdValue: number;
}

export interface RewardAvaiblePools {
  tokenIdentifier: string;
  tokenNonce: number;
  rewardPerEpochShort: number;
  rewardBalanceShort: number;
  rewardBalance: string;
  rewardPerDayPerNft: number;
  usdValue: number;
}

export interface UserPoolStakingInfo {
  nftDocs: NftData[];
  poolDoc: StakingSummaryPools;
}

export interface UserAnalyticSummary {
  Purchase: Purchase;
  Sale: Purchase;
}

export interface Purchase {
  count: number;
  volume: number;
  min: Max;
  max: Max;
  avg: Avg;
}

export interface Avg {
  price: number;
}

export interface Max {
  price: number;
  txHash: string;
  timestamp: number;
  identifier: string;
}

export interface UserStats {
  wallet: Wallet;
  totalVolume: number;
  totalTrades: number;
  totalCollections: number;
  totalNfts: number;
  totalPartners: number;
  buyerVolume: number;
  buyerTrades: number;
  buyerNfts: number;
  buyerCollections: number;
  buyerPartners: number;
  buyerMaxPriceData: PriceData | null;
  buyerMinPriceData: PriceData | null;
  sellerVolume: number;
  sellerTrades: number;
  sellerNfts: number;
  sellerCollections: number;
  sellerPartners: number;
  sellerMaxPriceData: PriceData;
  sellerMinPriceData: PriceData;
}

export interface PriceData {
  price: number;
  timestamp: number;
  identifier: string;
  txHash: string;
  usdValue: number;
  nftInfo: Pick<
    NftData,
    | 'identifier'
    | 'collection'
    | 'name'
    | 'metadata'
    | 'url'
    | 'wasProcessed'
    | 'media'
  >;
}

export interface Wallet {
  address: string;
  profile: string;
  username: string;
  isVerified: boolean;
  isCreator: boolean;
  owned: number;
  listed: number;
}

export interface StakingCreatorInfo {
  address: string;
  ownedPools: number[];
  ownedCollections: string[];
  cutFee: number;
  _ts: number;
}

export interface UserXOXNODrop {
  wallet: Wallet;
  rank: number;
  tokenAllocation: number;
  totalScore: number;
}

export interface Wallet {
  address: string;
  addressTrimmed: string;
  profile: string;
  username: string;
  isVerified: boolean;
}

export interface IOwnerInfo {
  registered: string[];
  availableForRegister: string[];
}

export type IApiShareholder = { address: string; share: number };
