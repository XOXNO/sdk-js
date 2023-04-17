import { MetadataAttribute } from './collection';
import { NftData } from './nft';

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
  nftsWorth: number;
  groupedByCollection: GroupedByCollection[];
}

export interface GroupedByCollection {
  name: string;
  type: string;
  image: string;
  ticker: string;
  isVerified: boolean;
  isVisible: boolean;
  nftsCount: number;
  nfts: NftData[];
  bids: NftData[];
  floorWorth: number;
  maxWorth: number;
  floorPrice: number;
  totalWorth: number;
}

export interface UserOffers {
  nftsWorth: number;
  groupedByCollection: OffersGroupedByCollection[];
}

export interface OffersGroupedByCollection {
  name: string;
  type: string;
  image: string;
  ticker: string;
  isVerified: boolean;
  isVisible: boolean;
  offers: Offer[];
  globalOffers: GlobalOffer[];
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
  Received = 'Received',
  Sent = 'Sent',
}

export interface Offer {
  offerType: OfferType;
  identifier: string;
  webpUrl: string;
  avifUrl: string;
  onSale: boolean;
  url: string;
  collection: string;
  onDR: boolean;
  onFM: boolean;
  onKG: boolean;
  name: string;
  nonce: number;
  offer_id: number;
  payment_token: string;
  payment_nonce: number;
  price: string;
  price_short: number;
  deadline: number;
  timestamp: number;
  owner: string;
  quantity: number;
  EgldValue: number;
  UsdValue: number;
  isActive: boolean;
  ownerUsername: string;
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
