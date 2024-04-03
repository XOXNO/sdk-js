import { NftData, Owner } from './nft';
import { NftActivityType } from './trading';
import { IUserProfileSearch } from './user';

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
  dataType: string;
  collection: string;
  contractAddress: string;
  collectionTag: string;
  cid: string;
  mediaType: string;
  baseNftName: string;
  hasAttributes: boolean;
  ownerTransferred: boolean;
  collectionSize: number;
  totalNftMinted: number;
  globalWalletLimit: number;
  royalties: number;
  oldVersion: boolean;
  nameShuffle: boolean;
  nftTransferLimited: boolean;
  allowsPublicBurn: boolean;
  kycRequired: boolean;
  allowsRefund: boolean;
  hasBotProtection: boolean;
  hasReveal: boolean;
  tags: string[];
  id: string;
  _ts: number;
}

export interface IMintInfoExtended extends IMintInfo {
  collectionInfo: {
    name: string;
    isVerified: boolean;
    profile: string;
    banner: string;
    volume: number;
  };
}

export interface CreatorInfo {
  name: string;
  contractAddress: string;
  listing: IMintInfoExtended[];
}

export interface CollectionStatisticsProfile {
  tradeData: TradeData;
  mintData: MintStatistics;
  other: OtherStatistics;
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
  statistics: CollectionStatisticsProfile;
  owner: string;
  creator: string;
  isMintable: boolean;
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
  floorPrice: number;
  onSaleCount: number;
  usdValue: number;
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
  identifier?: string[];
  collection?: string[];
  type?: string[];
  onSale?: boolean;
  owner?: string[];
  currentOwner?: string[];
  saleInfo?: {
    seller?: string[];
    paymentToken?: string[];
    marketplace?: string[];
    auctionType?: string[];
  };
  range?: RangeFilter[];
  metadata?: {
    attributes?: NftMetadataAttributes[];
  };
  wasProcessed?: boolean;
  cp_staked?: boolean;
  activeAuction?: boolean;
  customFilter?: string;
  verifiedOnly?: boolean;
}

export interface NftMetadataAttributes {
  trait_type: string;
  value: string;
}

export interface SearchNFTs {
  filters: Filter;
  applyNftExtraDetails?: boolean;
  select?: string[];
  strictSelect?: boolean;
  orderBy?: string[];
  top?: number;
  skip?: number;
  includeCount?: boolean;
}

export enum AuctionTypes {
  FixedPrice = 'FixedPrice',
  Auctions = 'Auctions',
  All = 'All',
}

export interface GetNFTsArgs {
  /** Listed by different users */
  listedBy?: string[];
  /** Owned by different users */
  ownedBy?: string[];

  auctionType: AuctionTypes;
  /** If set, will return only NFTs from the specified collections */
  collections?: string[];
  /** If set, will return only NFTs from verified collections */
  onlyVerified?: boolean;
  /** If true, will return only NFTs that are on sale */
  onlyOnSale?: boolean;
  /** If true, will return only NFTs that are active, deadline not expired */
  activeAuctions?: boolean;
  /** If true the extra details of an NFT will be appended to each NFT, such as collection size and owners name */
  applyNftExtraDetails?: boolean;
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
  /** If set, will return only NFTs that are staked */
  isStaked?: boolean;
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

export type ActivityData = {
  collection: string;
  identifier: string;
  price: number;
  paymentToken: string;
  scId: number;
  usdValue: number;
  egldValue: number;
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
  collectionInfo: Pick<
    ICollectionProfile,
    'name' | 'isVerified' | 'isVisible' | 'profile' | 'description'
  > & { collectionSize: number; holderCount: number; followCount: number };
};

export type TradingActivity = {
  txHash: string;
  eventIdentifier: string;
  timestamp: number;
  activityType: NftActivityType;
  source: string;
  from: Owner;
  to: Owner;
  activityData: ActivityData;
};

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
  //** If set, will return only the offers that have deposit balance*/
  onlyActive?: boolean;
  offerIds?: number[];
  ownedBy?: string[];
  listedOnlyOn?: Marketplace[];
  priceRange?: RangeFilter;
  attributes?: MetadataAttribute[];
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
  hasMoreResults: boolean;
  resources: ResultsBody;
}

export interface ListingDistribution {
  identifier: string;
  name: string;
  url: string;
  wasProcessed: boolean;
  rank: number;
  price: number;
  marketplace: string;
}

export interface ResultsBody {
  collections: ICollectionProfile[];
  users: IUserProfileSearch[];
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
  identifier: string;
  collection?: string;
  dataType?: string;
  decimals: number;
  name: string;
  type: string;
  category: string[];
  svgUrl: string;
  pngUrl: string;
  ticker: string;
  usd?: number;
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
  usdValue: string;
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

export type CollectionRanksExport = Partial<
  Pick<NftData, 'identifier' | 'name'>
> & {
  rank: number;
};

export type GetCollectionMintInfo = {
  collection: string;
  contractAddress: string;
  collectionTag: string;
  nftTransferLimited: boolean;
  hasBotProtection: boolean;
  kycRequired: boolean;
  totalNftMinted: number;
  collectionSize: number;
  cid: string;
  mediaType: string;
  mintStages: MintStage[];
  collectionInfo: {
    name: string;
    isVerified: boolean;
    description?: string;
    socials?: ISocials;
    profile: string;
    banner: string;
    owner: string;
    isVisible: boolean;
  };
};

export type MintStage = {
  name: string;
  startTime: number;
  endTime: number;
  mintCount: number;
  mintLimit: number;
  mintEnabled: boolean;
  isWhitelist: boolean;
  walletLimit: number;
  maxBuyable?: number;
  walletLimitReached?: boolean;
  prices: StagePrice[];
  isSoldOut: boolean;
};

export type StagePrice = {
  tokenIdentifier: string;
  tokenNonce: string;
  amount: string;
  amountShort: number;
  usdValue: number;
  decimals: number;
};

export type CollectionStatsResults = {
  resources: CollectionStatsDoc[];
  hasMoreResults: boolean;
  getNextPagePayload?: GetCollectionStatsArgs;
};

export type GetCollectionStatsArgs = {
  filters?: {
    collection?: string[];
    isVerified?: boolean;
    range?: RangeFilter[];
  };
  orderBy?: CollectionStatsOrderBy[];
  select?: CollectionStatsSelectFields[];
  top: number;
  skip: number;
};

export enum CollectionStatsSelectFields {
  TradingStats = 'tradingStats',
}

export interface RangeFilter {
  min?: number;
  max?: number;
  field?: string;
}

export enum CollectionStatsOrderBy {
  ListedCountDesc = 'tradingStats.listedCount DESC',
  ListedCountAsc = 'tradingStats.listedCount ASC',
  FloorPriceDesc = 'tradingStats.floorPrice DESC',
  FloorPriceAsc = 'tradingStats.floorPrice ASC',

  TotalVolumeDesc = 'tradingStats.totalVolume DESC',
  TotalVolumeAsc = 'tradingStats.totalVolume ASC',

  TotalTradesDesc = 'tradingStats.totalTrades DESC',
  TotalTradesAsc = 'tradingStats.totalTrades ASC',

  AllTimeHighDesc = 'tradingStats.allTimeHigh.price DESC',
  AllTimeHighAsc = 'tradingStats.allTimeHigh.price ASC',

  DayVolumeDesc = 'tradingStats.day.volume DESC',
  DayVolumeAsc = 'tradingStats.day.volume ASC',
  DayVolumeMarginDesc = 'tradingStats.day.volumeMargin DESC',
  DayVolumeMarginAsc = 'tradingStats.day.volumeMargin ASC',
  DayTradesDesc = 'tradingStats.day.trades DESC',
  DayTradesAsc = 'tradingStats.day.trades ASC',
  DayTradesMarginDesc = 'tradingStats.day.tradesMargin DESC',
  DayTradesMarginAsc = 'tradingStats.day.tradesMargin ASC',

  WeekVolumeDesc = 'tradingStats.week.volume DESC',
  WeekVolumeAsc = 'tradingStats.week.volume ASC',
  WeekVolumeMarginDesc = 'tradingStats.week.volumeMargin DESC',
  WeekVolumeMarginAsc = 'tradingStats.week.volumeMargin ASC',
  WeekTradesDesc = 'tradingStats.week.trades DESC',
  WeekTradesAsc = 'tradingStats.week.trades ASC',
  WeekTradesMarginDesc = 'tradingStats.week.tradesMargin DESC',
  WeekTradesMarginAsc = 'tradingStats.week.tradesMargin ASC',

  MonthVolumeDesc = 'tradingStats.month.volume DESC',
  MonthVolumeAsc = 'tradingStats.month.volume ASC',
  MonthVolumeMarginDesc = 'tradingStats.month.volumeMargin DESC',
  MonthVolumeMarginAsc = 'tradingStats.month.volumeMargin ASC',
  MonthTradesDesc = 'tradingStats.month.trades DESC',
  MonthTradesAsc = 'tradingStats.month.trades ASC',
  MonthTradesMarginDesc = 'tradingStats.month.tradesMargin DESC',
  MonthTradesMarginAsc = 'tradingStats.month.tradesMargin ASC',

  YearVolumeDesc = 'tradingStats.year.volume DESC',
  YearVolumeAsc = 'tradingStats.year.volume ASC',
  YearVolumeMarginDesc = 'tradingStats.year.volumeMargin DESC',
  YearVolumeMarginAsc = 'tradingStats.year.volumeMargin ASC',
  YearTradesDesc = 'tradingStats.year.trades DESC',
  YearTradesAsc = 'tradingStats.year.trades ASC',
  YearTradesMarginDesc = 'tradingStats.year.tradesMargin DESC',
  YearTradesMarginAsc = 'tradingStats.year.tradesMargin ASC',
}

export type CollectionStatsDoc = {
  collection: string;
  isVerified: boolean;
  tradingStats: {
    listedCount?: number;
    floorPrice?: number;
    totalVolume: number;
    totalTrades: number;
    allTimeHigh: {
      price: number;
      timestamp: number;
      txHash: string;
      identifier: string;
    };
    day: TradingDataSummary;
    week: TradingDataSummary;
    month: TradingDataSummary;
    quarter: TradingDataSummary;
    halfYear: TradingDataSummary;
    year: TradingDataSummary;
  };
  // applied after db call
  collectionInfo?: {
    name?: string;
    description?: string;
    profile?: string;
    holdersCount?: number;
    collectionSize?: number;
    followCount?: number;
  };
  id: string;
};

export type TradingDataSummary = {
  volume: number;
  volumeMargin: number;
  trades: number;
  tradesMargin: number;
  minPrice?: number;
  maxPrice?: number;
  averagePrice?: number;
};
