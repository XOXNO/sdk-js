import type {
  Marketplace,
  MetadataAttribute,
  RangeFilter,
  TradingActivity,
} from './collection'

export enum NftActivityType {
  // MVX Built-in
  NFT_CREATE = 'nftCreate',
  NFT_BURN = 'nftBurn',
  NFT_UPDATE = 'nftUpdate',
  NFT_TRANSFER = 'nftTransfer',
  // Marketplace
  LISTING_CREATE = 'listingCreate',
  LISTING_WITHDRAW = 'listingWithdraw',
  LISTING_UPDATE = 'listingUpdate',
  AUCTION_BID = 'auctionBid',
  AUCTION_OUT_BID = 'auctionOutBid',
  OFFER_CREATE = 'offerCreate',
  OFFER_WITHDRAW = 'offerWithdraw',
  OFFER_REJECT = 'offerReject',
  GLOBAL_OFFER_CREATE = 'globalOfferCreate',
  GLOBAL_OFFER_WITHDRAW = 'globalOfferWithdraw',
  TRADE = 'trade',
  BULK_TRADE = 'bulkTrade',
  AUCTION_TRADE = 'auctionTrade',
  OTHER_TRADE = 'otherTrade', // fiat or binance buy
  OFFER_TRADE = 'offerTrade',
  GLOBAL_OFFER_TRADE = 'globalOfferTrade',
  // Staking
  STAKE = 'stake',
  UN_STAKE = 'unStake',
}

export interface TradingActivityQueryFilter {
  filters: {
    txHash?: string[]
    activityAddress?: string[]
    source?: Marketplace[]
    activityType?: NftActivityType[]
    from?: string[]
    to?: string[]
    activityData?: {
      collection?: string[]
      identifier?: string[]
    }
    range?: RangeFilter[]
  }
  strictSelect?: boolean
  includeCount?: boolean
  top: number
  skip: number
  select?: SelectFieldsTradingActivity[]
  orderBy?: OrderByTradingActivity[]
}
export interface TradincActivityArgs {
  /** The collections to fetch the trading activity from */
  collections?: string[]
  /** The identifier of the NFTs to fetch the trading activity from */
  identifiers?: string[]
  /** The wallets for which to fetch the trading activity */
  wallets?: string[]
  from?: string[]
  to?: string[]
  /** The marketplaces to fetch the trading activity from */
  source?: Marketplace[]
  activityType?: NftActivityType[]
  /** The tokens to fetch the trading activity from */
  placedInToken?: string[]
  /** The price range to fetch the trading activity from */
  priceRange?: {
    min: number
    max: number
  }
  /** The rank range to fetch the trading activity from */
  rankRange?: {
    min: number
    max: number
  }
  /** The timestamp range to fetch the trading activity from */
  timestampRange?: {
    min: number
    max: number
  }
  /** The number of results to return */
  top?: number
  /** The number of results to skip */
  skip?: number
  /** The fields to select from the trading activity */
  select?: SelectFieldsTradingActivity[]
  includeCount?: boolean
  strictSelect?: boolean
  /** The fields to order the trading activity by */
  orderBy?: OrderByTradingActivity[]
  /** The attributes to fetch the trading activity from */
  attributes?: MetadataAttribute[]
}

export enum OrderByTradingActivity {
  PriceHighToLow = 'activityData.egldValue desc',
  PriceLowToHigh = 'activityData.egldValue asc',
  RecentPlaced = 'timestamp desc',
  OldestPlaced = 'timestamp asc',
}

export enum SelectFieldsTradingActivity {
  'attributes',
  'collection',
  'offer_id',
  'owner',
  'short_price',
  'price',
  'id',
  'dataType',
  'marketplace',
  'payment_token',
}

export interface TradingActivityResponse {
  hasMoreResults: boolean
  /** The total count of the results for the specific query */
  count?: number
  resources: TradingActivity[]
  getNextPagePayload: TradincActivityArgs
  empty: boolean
}
