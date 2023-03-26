import { NftData } from './nft';

export interface ISocials {
  twitter: string;
  instagram: string;
  website: string;
  telegram: string;
  discord: string;
  facebook: string;
  youtube: string;
}

export interface IMintInfo {
  contractAddress: string;
  totalNftMinted: number;
  collectionTag: string;
  cid: string;
  mediaType: string;
  collectionSize: number;
  nftTransferLimited: string;
  allowsPublicBurn: string;
  kycRequired: string;
  allowsRefund: string;
  hasReveal: string;
}

export interface ICollectionProfile {
  dataType: 'collectionProfile';
  collection: string;
  name: string;
  description: string;
  isVisible: boolean;
  isVerified: boolean;
  profile: string;
  banner: string;
  statistics: {
    tradeData: {
      dayEgldVolume: number;
      weekEgldVolume: number;
      totalEgldVolume: number;
      averageEgldPrice: number;
      athEgldPrice: number;
      athTxHash: string;
      totalTrades: number;
    };
    mintData: {
      totalMintEgldVolume: number;
      weekMintEgldVolume: number;
      dayMintEgldVolume: number;
    };
    other: {
      nftCount: number;
      followCount: number;
      holdersCount?: number;
    };
  };
  owner: string;
  creator: string;
  isMintable: boolean;
  mintInfo: IMintInfo;
  mintStages: {
    name: string;
    collectionTag: string;
    mintEnabled: boolean;
    isWhitelist: boolean;
    startTime: number;
    endTime: number;
    mintLimit: number;
    mintCount: number;
    prices: {
      tokenIdentifier: string;
      tokenNonce: string;
      amount: string;
    }[];
    walletLimit: number;
  }[];
  hasStaking: boolean;
  id: string;
  socials: ISocials;
  type: string;
  lastVerifiedTimestamp: number;
  lastVerifiedBy: string;
  _ts: number;
}

export interface AttributeData {
  attributeOccurrence: number;
  FloorPrice: number;
  OnSale: number;
}

export interface MetadataAttribute {
  trait_type: string;
  value: string;
}

export interface TraitValues {
  [traitValue: string]: AttributeData;
}

export interface ICollectionAttributes {
  [traitType: string]: TraitValues;
}
export enum Marketplace {
  XO = 'XO',
  FM = 'FM',
  DR = 'DR',
  KG = 'KG',
}

export interface GlobalOffer {
  attributes: MetadataAttribute[];
  collection: string;
  dataType: string;
  id: string;
  isActive: boolean;
  marketplace: string;
  offer_id: number;
  owner: string;
  ownerProfile: string;
  ownerUsername: string;
  payment_nonce: number;
  payment_token: string;
  price: string;
  quantity: number;
  short_price: number;
  timestamp: number;
  uniqueKey: string;
  _ts: number;
}

export enum FieldsToSelect {
  'metadata/rarity/rank',
  'metadata/attributes',
  'metadata/description',
  'name',
  'onSale',
  'saleInfoNft',
  'royalties',
  'identifier',
  'collection',
  'url',
  'nonce',
  'originalMedia/contentType',
  'wasProcessed',
  'avifUrl',
  'webpUrl',
  'type',
}

export enum SearchOrderBy {
  PriceHighToLow = 'saleInfoNft/min_bid_short desc',
  PriceLowToHigh = 'saleInfoNft/min_bid_short asc',
  RarityHighToLow = 'metadata/rarity/rank desc',
  RarityLowToHigh = 'metadata/rarity/rank asc',
  NonceHighToLow = 'nonce desc',
  NonceLowToHigh = 'nonce asc',
  RecentListed = 'saleInfoNft/timestamp desc',
  OldestListed = 'saleInfoNft/timestamp asc',
}

export interface Filter {
  marketplace?: Marketplace[];
  onSale?: boolean;
  auctionTypes?: string[];
  tokens?: string[];
  attributes?: MetadataAttribute[];
  range?: {
    min: number;
    max: number;
    type: string;
  };
  rankRange?: {
    min?: number;
    max?: number;
  };
  levelRange?: {
    min?: number;
    max?: number;
  };
}

export interface SearchNFTs {
  filters: Filter;
  name?: string;
  orderBy?: SearchOrderBy[];
  collection: string;
  top: number;
  skip: number;
  select?: FieldsToSelect[];
}

export interface SearchNFTsArgs {
  collection: string;
  onlyOnSale?: boolean;
  onlyAuctions?: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
  listedInToken?: string[];
  rankRange?: {
    min: number;
    max: number;
  };
  cantinaLevelRange?: {
    min: number;
    max: number;
  };
  searchName?: string;
  top?: number;
  skip?: number;
  orderBy?: SearchOrderBy[];
  onlySelectFields?: FieldsToSelect[];
  listedOnlyOn?: Marketplace[];
  attributes?: MetadataAttribute[];
}

export interface SearchNFTsResponse {
  count: number;
  resultsCount: number;
  results: NftData[];
  empty: boolean;
  getNextPagePayload: SearchNFTsArgs;
  hasMoreResults: boolean;
}
