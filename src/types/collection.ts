import { NftData } from './nft';
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
  RarityHighToLow = 'metadata.rarity.rank desc',
  RarityLowToHigh = 'metadata.rarity.rank asc',
  NonceHighToLow = 'nonce desc',
  NonceLowToHigh = 'nonce asc',
  RecentListed = 'saleInfo.timestamp desc',
  OldestListed = 'saleInfo.timestamp asc',
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
  FM_Trades: number;
  FM_Volume: number;
  KG_Trades: number;
  KG_Volume: number;
  Total_Trades: number;
  Total_Volume: number;
  XO_Trades: number;
  XO_Volume: number;
}

export interface FloorPriceHistory {
  Day: string;
  FloorPrice: number;
  AveragePrice: number;
}

export interface CollectionHoldersInfo {
  totalSupply: number;
  onMarketInfo: OnMarketInfo;
  stakingInfo: StakingInfo;
  otherHolders: OtherHolders;
  hodlersInfo: HodlersInfo;
}

export interface HodlersInfo {
  hodlCount: number;
  hodlWeight: number;
  uniqueHodlWeight: number;
  uniqueHodlers: number;
  avgPerHodler: number;
  hodlersSummary: HodlersSummary;
  hodlers: OtherSc[];
}

export interface OtherSc {
  address: string;
  count: number;
  weight: number;
}

export interface HodlersSummary {
  one: number;
  twoToFive: number;
  six20ToFour: number;
  twenty5ToFifthy: number;
  fifthy1ToHoundred: number;
  overHoundred: number;
}

export interface OnMarketInfo {
  tradingCount: number;
  tradingWeight: number;
  holders: OnMarketInfoHolders;
}

export interface OnMarketInfoHolders {
  listedOnXO: OtherSc;
  listedOnFM: OtherSc;
  listedOnKG: OtherSc;
  listedOnIG: OtherSc;
  listedOnET: OtherSc;
  lotteryFM: OtherSc;
}

export interface OtherHolders {
  otherSC: OtherSc;
}

export interface StakingInfo {
  stakingCount: number;
  stakingWeight: number;
  holders: StakingInfoHolders;
}

export interface StakingInfoHolders {
  stakingOnXO: OtherSc;
}
