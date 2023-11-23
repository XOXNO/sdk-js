import { MetadataAttribute } from './collection';
import { NftData, Owner } from './nft';

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

export interface ISocials {
  twitter?: string;
  instagram?: string;
  website?: string;
  telegram?: string;
  discord?: string;
  facebook?: string;
  youtube?: string;
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

export interface GlobalOffer {
  dataType: string;
  offer_id: number;
  collection: string;
  quantity: number;
  payment_token: string;
  payment_nonce: number;
  price: string;
  short_price: number;
  owner: string;
  marketplace: string;
  timestamp: number;
  attributes: MetadataAttribute[];
  id: string;
  uniqueKey: string;
  _ts: number;
  isActive: boolean;
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

export type UnClaimedReward = {
  reward_token: string;
  reward_token_nonce: string;
  amount: number;
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
