import { NftData, Owner } from './nft';
import { IUserProfile } from './user';

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
    tradeData: TradeData;
    mintData: MintStatistics;
    other: OtherStatistics;
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
  XO = 'xoxno',
  FM = 'frameit',
  DR = 'deadrare',
  KG = 'krogan',
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
  Rank = 'metadata.rarity.rank',
  Attributes = 'metadata.attributes',
  Description = 'metadata.description',
  Name = 'name',
  OnSale = 'onSale',
  SaleInfo = 'saleInfo',
  Royalties = 'royalties',
  Identifier = 'identifier',
  Collection = 'collection',
  OriginalURL = 'url',
  Nonce = 'nonce',
  ContentType = 'originalMedia.contentType',
  WasProcessed = 'wasProcessed',
  AvifURL = 'avifUrl',
  WebpURL = 'webpUrl',
  Type = 'type',
}

export enum SearchOrderBy {
  PriceHighToLow = 'saleInfo.minBidShort desc',
  PriceLowToHigh = 'saleInfo.minBidShort asc',
  MaxPriceHighToLow = 'saleInfo.maxBidShort desc',
  MaxPriceLowToHigh = 'saleInfo.maxBidShort asc',
  BidPriceHighToLow = 'saleInfo.currentBidShort desc',
  BidPriceLowToHigh = 'saleInfo.currentBidShort asc',
  RarityHighToLow = 'metadata.rarity.rank desc',
  RarityLowToHigh = 'metadata.rarity.rank asc',
  NonceHighToLow = 'nonce desc',
  NonceLowToHigh = 'nonce asc',
  RecentListed = 'saleInfo.timestamp desc',
  OldestListed = 'saleInfo.timestamp asc',
  EndingLate = 'saleInfo.deadline desc',
  EndingSoon = 'saleInfo.deadline asc',
}

export enum SuggestOrderBy {
  TotalVolumeHighToLow = 'statistics/tradeData/totalEgldVolume desc',
  FollowersHighToLow = 'statistics/other/followCount desc',
  IsVerifiedTrueToFalse = 'isVerified desc',
  HasImageTrueToFalse = 'profile desc',
  HasBannerTrueToFalse = 'banner desc',
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

export enum GlobalOfferOrderBy {
  PriceHighToLow = 'priceShort desc',
  PriceLowToHigh = 'priceShort asc',
  OfferIdHighToLow = 'offerIddesc',
  OfferIdLowToHigh = 'offerId asc',
  RecentListed = 'timestamp desc',
  OldestListed = 'timestamp asc',
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
export enum GlobalOfferFieldsToSelect {
  Attributes = 'attributes',
  Collection = 'collection',
  Marketplace = 'marketplace',
  PaymentToken = 'paymentToken',
  LongPrice = 'price',
  ShortPrice = 'priceShort',
}

export interface Filter {
  dataType?: string[];
  onSale?: boolean;
  seller?: string[];
  collection?: string[];
  identifier?: string[];
  type?: string[];
  owner?: string[];
  paymentToken?: string[];
  marketplace?: string[];
  auctionType?: string[];
  activeAuction?: boolean;
  priceRange?: {
    min: number;
    max: number;
    type: string;
  };
  rankRange?: {
    min?: number;
    max?: number;
  };
  gameLevelRange?: {
    min?: number;
    max?: number;
  };
  customFilter?: string;
  attributes?: NftMetadataAttributes[];
  wasProcessed?: boolean;
  verifiedOnly?: boolean;
  isStaked?: boolean;
}

export interface NftMetadataAttributes {
  trait_type: string;
  value: string;
}

export interface SearchNFTs {
  filters: Filter;
  select?: string[];
  strictSelect?: boolean;
  orderBy?: string[];
  top?: number;
  skip?: number;
  includeCount?: boolean;
}

export interface GetNFTsArgs {
  /** Listed by different users */
  listedBy?: string[];
  /** Owned by different users */
  ownedBy?: string[];
  /** If set, will return only NFTs from the specified collections */
  collections?: string[];
  /** If set, will return only NFTs from verified collections */
  onlyVerified?: boolean;
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
  /** If set, will return the total count of the NFTs, recommended to be set true only for the first call, then false for the next pages */
  includeCount?: boolean;
  /** If set, will apply the extra manual filters on top of the main payload */
  extraSearch?: string[];
  /** If set, will return only NFTs with a name that contains the specified string */
  searchName?: string;
  /** The number of results to return */
  top?: number;
  /** The order by to use */
  skip?: number;
  /** Document type */
  dataType?: string[];
  /** The order of the results based on a field */
  orderBy?: SearchOrderBy[];
  /** If set, will return only the specified fields */
  onlySelectFields?: FieldsToSelect[];
  /** If set, will return only NFTs listed in the specified marketplaces */
  listedOnlyOn?: Marketplace[];
  /** If set, will return only NFTs with the specified attributes */
  attributes?: MetadataAttribute[];
}

export interface SuggestNFTsArgs {
  /** If set, will return only collections or users with a name that contains the specified string */
  name: string;
  /** The number of results to return */
  top?: number;
  /** The order by to use */
  skip?: number;
  /** The order of the results based on a field */
  orderBy?: SuggestOrderBy[];
}

export interface SearchNFTsResponse {
  /** The total count of the results for the specific query */
  count?: number;
  /** The results for the current page */
  resources: NftData[];
  /** The payload to use to get the next page */
  getNextPagePayload: GetNFTsArgs;
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

export interface GetGlobalOffersArgs {
  /**  The collections to fetch the profile */
  collections?: string[];
  /** The number of results to return */
  top?: number;
  /** The order by to use */
  skip?: number;
  /** The order of the results based on a field */
  orderBy?: GlobalOfferOrderBy[];
  /** If set, will return only the offers with required attributes */
  withAttributes?: boolean;
  /** If set, will return only the specified fields */
  onlySelectFields?: GlobalOfferFieldsToSelect[];
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

export interface SuggestResults {
  count: number;
  results: ResultsBody;
}

export interface ResultsBody {
  collections: ICollectionProfile[];
  users: IUserProfile[];
  nft: NftData[];
}

export interface OtherStatistics {
  nftCount: number;
  followCount: number;
  holdersCount?: number;
}

export interface TradeData {
  dayEgldVolume: number;
  weekEgldVolume: number;
  totalEgldVolume: number;
  averageEgldPrice: number;
  athEgldPrice: number;
  athTxHash: string;
  totalTrades: number;
}

export interface MintStatistics {
  totalMintEgldVolume: number;
  weekMintEgldVolume: number;
  dayMintEgldVolume: number;
}

export interface CollectionVolume {
  Day: string;
  DR_Trades: number;
  DR_Volume: number;
  DR_VolumeUSD: number;
  DR_Buyers: number;
  DR_Sellers: number;
  DR_FeesPaid: number;
  DR_FeesPaidUSD: number;
  DR_RoyaltiesPaid: number;
  DR_RoyaltiesPaidUSD: number;
  FM_Trades: number;
  FM_Volume: number;
  FM_VolumeUSD: number;
  FM_Buyers: number;
  FM_Sellers: number;
  FM_FeesPaid: number;
  FM_FeesPaidUSD: number;
  FM_RoyaltiesPaid: number;
  FM_RoyaltiesPaidUSD: number;
  KG_Trades: number;
  KG_Volume: number;
  KG_VolumeUSD: number;
  KG_Buyers: number;
  KG_Sellers: number;
  KG_FeesPaid: number;
  KG_FeesPaidUSD: number;
  KG_RoyaltiesPaid: number;
  KG_RoyaltiesPaidUSD: number;
  Total_Trades: number;
  Total_Volume: number;
  Total_VolumeUSD: number;
  Total_Buyers: number;
  Total_Sellers: number;
  Total_FeesPaid: number;
  Total_FeesPaidUSD: number;
  Total_RoyaltiesPaid: number;
  Total_RoyaltiesPaidUSD: number;
  XO_Trades: number;
  XO_Volume: number;
  XO_VolumeUSD: number;
  XO_Buyers: number;
  XO_Sellers: number;
  XO_FeesPaid: number;
  XO_FeesPaidUSD: number;
  XO_RoyaltiesPaid: number;
  XO_RoyaltiesPaidUSD: number;
}

export interface FloorPriceHistory {
  Day: string;
  FloorPrice: number;
  AveragePrice: number;
}

export type FungibleAssets = {
  id?: string;
  identifier?: string;
  collection?: string;
  dataType?: string;
  decimals?: number;
  name: string;
  type?: string;
  category?: string[];
  svgUrl: string;
  pngUrl: string;
  ticker: string;
  _ts?: number;
};

export type FungibleAssetsMap = {
  [key: string]: FungibleAssets;
};

export enum AssetCategory {
  ALL = 'all',
  Trade = 'trade',
  P2P = 'p2p',
  Staking = 'staking',
  Minting = 'minting',
}

export type ISingleHolder = {
  address: string;
  count: number;
  weight: number;
};

export type IOwners = {
  totalSupply: number;
  onMarket: HoldedDetails;
  staked: HoldedDetails;
  otherSCs: HoldedDetails;
  burnWallet: HoldedDetails;
  uniqueHolders: HoldedDetails;
  holded: AvgHolder;
  walletDetails: ISingleHolder[];
};

export type HoldedDetails = {
  count: number;
  weight: number;
};

export interface AvgHolder extends HoldedDetails {
  avgPerHodler: number;
}

export type CollectionsSummary = {
  data: CollectionsSummaryItem[];
  count: number;
};

export type CollectionsSummaryItem = {
  Collection: string;
  TotalVolume: number;
  TotalTrades: number;
  DailyVolume: number | null;
  Last2DaysVolume: number | null;
  DailyTrades: number | null;
  Last2DaysTrades: number | null;
  WeekTrades: number;
  LastWeekTrades: number | null;
  WeekVolume: number;
  LastWeekVolume: number | null;
  WeeklyTradesMargin: number | null;
  DailyTradesMargin: number | null;
  WeeklyVolumeMargin: number | null;
  DailyVolumeEgldMargin: number | null;
  CollectionAthTrade: number;
  CollectionAthTxHash: string;
  Name: string;
  AthHash: string;
  Profile: string;
  Banner: string;
  isVerified: boolean;
  FloorPrice: number;
};

export enum CollectionsSummaryFilter {
  TotalVolume = 'TotalVolume',
  TotalTrades = 'TotalTrades',
  DailyVolume = 'DailyVolume',
  Last2DaysVolume = 'Last2DaysVolume',
  DailyTrades = 'DailyTrades',
  Last2DaysTrades = 'Last2DaysTrades',
  WeekTrades = 'WeekTrades',
  LastWeekTrades = 'LastWeekTrades',
  WeekVolume = 'WeekVolume',
  LastWeekVolume = 'LastWeekVolume',
  WeeklyTradesMargin = 'WeeklyTradesMargin',
  DailyTradesMargin = 'DailyTradesMargin',
  WeeklyVolumeMargin = 'WeeklyVolumeMargin',
  DailyVolumeEgldMargin = 'DailyVolumeEgldMargin',
  CollectionAthTrade = 'CollectionAthTrade',
}

export type GlobalOffersResult = {
  resources: GlobalOffers[];
  hasMoreResults: boolean;
  lastSkip: number;
  getNextPagePayload?: GetGlobalOffersArgs;
};

export type GlobalOffers = {
  offerId: number;
  collection: string;
  quantity: number;
  paymentToken: string;
  price: string;
  priceShort: number;
  owner: Owner;
  usd: string;
  marketplace: string;
  timestamp: number;
  attributes: MetadataAttribute[];
  isActive: boolean;
};

export type GlobalOfferOwner = {
  address: string;
  userName: string;
  profile: string;
};
