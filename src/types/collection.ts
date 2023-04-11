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
  isActive: boolean;
  marketplace: string;
  offer_id: number;
  owner: string;
  ownerProfile?: string;
  ownerUsername?: string;
  payment_nonce: number;
  payment_token: string;
  price: string;
  quantity: number;
  short_price: number;
  timestamp: number;
}

export enum FieldsToSelect {
  Rank = 'metadata/rarity/rank',
  Attributes = 'metadata/attributes',
  Description = 'metadata/description',
  Name = 'name',
  OnSale = 'onSale',
  SaleInfo = 'saleInfoNft',
  Royalties = 'royalties',
  Identifier = 'identifier',
  Collection = 'collection',
  OriginalURL = 'url',
  Nonce = 'nonce',
  ContentType = 'originalMedia/contentType',
  WasProcessed = 'wasProcessed',
  AvifURL = 'avifUrl',
  WebpURL = 'webpUrl',
  Type = 'type',
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

export enum CollectionsOrderBy {
  WeekVolumeHighToLow = 'statistics.tradeData.weekEgldVolume desc',
  WeekVolumeLowToHigh = 'statistics.tradeData.weekEgldVolume asc',
  DailyVolumeHighToLow = 'statistics.tradeData.dayEgldVolume desc',
  DailyVolumeLowToHigh = 'statistics.tradeData.dayEgldVolume asc',
  TotalVolumeHighToLow = 'statistics.tradeData.totalEgldVolume desc',
  TotalVolumeLowToHigh = 'statistics.tradeData.totalEgldVolume asc',
  AvgVolumePriceHighToLow = 'statistics.tradeData.averageEgldPrice desc',
  AvgVolumePriceLowToHigh = 'statistics.tradeData.averageEgldPrice asc',
  ATHHighToLow = 'statistics.tradeData.athEgldPrice desc',
  ATHLowToHigh = 'statistics.tradeData.athEgldPrice asc',
  TotalTradesHighToLow = 'statistics.tradeData.totalTrades desc',
  TotalTradesLowToHigh = 'statistics.tradeData.totalTrades asc',
  SupplyHighToLow = 'statistics.other.nftCount desc',
  SupplyLowToHigh = 'statistics.other.nftCount asc',
  FollowersHighToLow = 'statistics.other.followCount desc',
  FollowersLowToHigh = 'statistics.other.followCount asc',
}

export enum CollectionsFieldsToSelect {
  Profile = 'profile',
  Description = 'description',
  Creator = 'creator',
  Owner = 'owner',
  Socials = 'socials',
  Type = 'type',
  HasStaking = 'hasStaking',
  MintInfo = 'mintInfo',
  MintStages = 'mintStages',
  Name = 'name',
  Banner = 'banner',
  IsVerified = 'isVerified',
  IsMintable = 'isMintable',
  Statistics = 'statistics',
  Collection = 'collection',
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
  /**  The collection to search in */
  collection: string;
  /** If true, will return only NFTs that are on sale */
  onlyOnSale?: boolean;
  /** If true, will return only NFTs that are on auction */
  onlyAuctions?: boolean;
  /** If set, will return only NFTs with a price in the specified range */
  priceRange?: {
    min: number;
    max: number;
  };
  /** If set, will return only NFTs listed in the specified tokens */
  listedInToken?: string[];
  /** If set, will return only NFTs with a rank in the specified range */
  rankRange?: {
    min: number;
    max: number;
  };
  /** If set, will return only NFTs with a cantina level in the specified range */
  cantinaLevelRange?: {
    min: number;
    max: number;
  };
  /** If set, will return only NFTs with a name that contains the specified string */
  searchName?: string;
  /** The number of results to return */
  top?: number;
  /** The order by to use */
  skip?: number;
  /** The order of the results based on a field */
  orderBy?: SearchOrderBy[];
  /** If set, will return only the specified fields */
  onlySelectFields?: FieldsToSelect[];
  /** If set, will return only NFTs listed in the specified marketplaces */
  listedOnlyOn?: Marketplace[];
  /** If set, will return only NFTs with the specified attributes */
  attributes?: MetadataAttribute[];
}

export interface SearchNFTsResponse {
  /** The total count of the results for the specific query */
  count: number;
  /** The results count for the current page */
  resultsCount: number;
  /** The results for the current page */
  results: NftData[];
  /** If the results are empty */
  empty: boolean;
  /** The payload to use to get the next page */
  getNextPagePayload: SearchNFTsArgs;
  /** If there are more results to fetch */
  hasMoreResults: boolean;
}

export interface TradingActivity {
  action: string;
  attributes: MetadataAttribute[];
  avifUrl: string;
  buyer: string;
  buyerUsername: string;
  collection: string;
  egldValue: number;
  id: string;
  identifier: string;
  marketplace: Marketplace;
  name: string;
  paymentToken: string;
  price: number;
  rank: number;
  seller: string;
  sellerUsername: string;
  timestamp: number;
  txHash: string;
  url: string;
  usdPrice: number;
  webpUrl: string;
  _ts: number;
}

export interface GetCollectionsArgs {
  /**  The collections to fetch the profile */
  collections?: string[];
  /** If true, will return only NFTs that are mintable */
  onlyMintable?: boolean;
  /** The number of results to return */
  top?: number;
  /** The order by to use */
  skip?: number;
  /** The order of the results based on a field */
  orderBy?: CollectionsOrderBy;
  /** If set, will return only the specified fields */
  onlySelectFields?: CollectionsFieldsToSelect[];
}

export interface CollectionsNFTsResponse {
  /** The results count for the current page */
  resultsCount: number;
  /** The results for the current page */
  results: ICollectionProfile[];
  /** If the results are empty */
  empty: boolean;
  /** The payload to use to get the next page */
  getNextPagePayload: GetCollectionsArgs;
  /** If there are more results to fetch */
  hasMoreResults: boolean;
}
