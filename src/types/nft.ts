import { MetadataAttribute } from './collection';

export interface NFTAttribute extends MetadataAttribute {
  occurance: number;
  rarity: number;
  frequency: number;
  OnSale?: number;
  FloorPrice?: number;
}

export interface NFTMetadata {
  description?: string;
  attributes?: NFTAttribute[];
  rarity?: {
    rank: number;
  };
}

export interface OriginalMedia {
  contentType: string;
  contentLength: number;
}

export interface SaleInfoNft {
  auction_id: number;
  seller: string;
  current_winner: string;
  min_bid: string;
  max_bid: string;
  current_bid: string;
  start_time: number;
  deadline: number;
  accepted_payment_token: string;
  accepted_payment_token_nonce: number;
  auction_type: string;
  timestamp: number;
  min_bid_short: number;
  max_bid_short: number;
  current_bid_short: number;
  quantity: null | number;
  marketplace: string;
  usd: string;
  usd_max_bid: string;
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
  identifier: string;
  collection: string;
  attributes?: string;
  nonce: number;
  type: string;
  name: string;
  creator?: string;
  royalties: number;
  url: string;
  avifUrl: string;
  webpUrl: string;
  wasProcessed: boolean;
  onSale: boolean;
  hasOffers?: boolean;
  collectionName: string;
  metadata: NFTMetadata;
  originalMedia: OriginalMedia;
  saleInfoNft: SaleInfoNft;
  offersInfo: OffersInfo[];
  gameData: GameData[]; // Only for Cantina Rolaye
  owner?: string; // Only for inventory and single NFT
  ownerCount?: number; // Only for SFTs with over 1 owner
  ownerUsername?: string;
  isVerified: boolean;
  isVisible: boolean;
  nftValue?: NftValue;
  pool_id?: number; // Only for Staked NFTs
  isStaked?: boolean; // Only for Staked NFTs
  currentEpoch?: number; // Only for Staked NFTs
  hasUboundPeriod?: boolean; // Only for Staked NFTs
  unboundEpoch?: number; // Only for Staked NFTs
  balance?: number; // Only for non listed NFTs
}
