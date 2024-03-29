import { MetadataAttribute } from './collection';

export interface NFTAttribute extends MetadataAttribute {
  occurance: number;
  frequency: number;
  onSaleCount?: number;
  floorPrice?: number;
  usdValue?: number;
}

export interface NFTMetadata {
  description?: string;
  attributes?: NFTAttribute[];
  rarity?: {
    rank: number;
  };
}

export interface Media {
  originalMedia?: OriginalMedia;
  avifUrl?: string;
  webpUrl?: string;
  retries?: number;
}

export interface OriginalMedia {
  contentType?: string;
  contentLength?: number;
}

export interface SaleInfo {
  auctionId: number;
  seller: string;
  currentWinner?: Owner;
  minBid: string;
  maxBid?: string;
  currentBid?: string;
  startTime: number;
  deadline: number;
  paymentToken: string;
  paymentTokenNonce: number;
  auctionType: string;
  timestamp: number;
  minBidShort: number;
  maxBidShort: number;
  currentBidShort?: number;
  currentBidUsd?: number;
  quantity: number;
  marketplace: string;
  minBidUsdValue: string;
  maxBidUsdValue?: string;
}

export interface NftValue {
  floorValue: number;
  avgValue: number;
  maxValue: number;
  collectionFp: number;
}

export interface GameData {
  name: string;
  value: number;
}

export interface OffersInfo {
  EgldValue: number;
  UsdValue: number;
  deadline: number;
  isActive: boolean;
  offer_id: number;
  owner: string;
  ownerUsername: string;
  payment_nonce: number;
  payment_token: string;
  price: string;
  price_short: number;
  quantity: number;
  timestamp: number;
}

export interface NftData {
  id: string;
  name: string;
  identifier: string;
  nonce: number;
  collection: string;
  type: string;
  supply?: number;
  url: string;
  wasProcessed: boolean;
  royalties: number;
  onSale: boolean;
  metadata: NFTMetadata;
  media: Media;
  attributes?: string;
  creator?: Owner;
  hasOffers?: boolean;
  collectionName: string;
  saleInfo?: SaleInfo;
  tags?: string[];
  gameData?: GameData[]; // Only for Cantina Rolaye
  owner?: Owner;
  currentOwner?: Owner;
  balance?: number; // Only for non listed NFTs
  collectionInfo?: CollectionInfo;
  isStaked?: boolean;
  hasUboundPeriod?: boolean;
  unboundEpoch?: number;
  currentEpoch?: number;
  poolId?: number;
}

export interface CollectionInfo {
  name: string;
  isVerified: boolean;
  profile: string;
  collectionSize: number;
  description?: string;
  followCount?: number;
  holdersCount?: number;
}

export interface Owner {
  username: string;
  address: string;
  profile: string;
}
