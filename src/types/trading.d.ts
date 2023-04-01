import { Marketplace, MetadataAttribute } from './collection';

export interface TradingActivityQueryFilter {
  filters: {
    collection?: string[];
    identifier?: string[];
    address?: string[];
    tokens?: string[];
    marketplace?: Marketplace[];
    action?: string[];
    range?: {
      min: number;
      max: number;
    };
    rankRange?: {
      min: number;
      max: number;
    };
    timestampRange?: {
      min: number;
      max: number;
    };
    attributes?: MetadataAttribute[];
  };
  top: number;
  skip: number;
  select?: SelectFieldsTradingActivity[];
  orderBy?: OrderByTradingActivity[];
}
export interface TradincActivityArgs {
  /** The collections to fetch the trading activity from */
  collections?: string[];
  /** The identifier of the NFTs to fetch the trading activity from */
  identifiers?: string[];
  /** The owners of the NFTs to fetch the trading activity from */
  owners?: string[];
  /** The marketplaces to fetch the trading activity from */
  marketplaces?: Marketplace[];
  /** The tokens to fetch the trading activity from */
  placedInToken?: string[];
  /** The price range to fetch the trading activity from */
  priceRange?: {
    min: number;
    max: number;
  };
  /** The rank range to fetch the trading activity from */
  rankRange?: {
    min: number;
    max: number;
  };
  /** The timestamp range to fetch the trading activity from */
  timestampRange?: {
    min: number;
    max: number;
  };
  /** The number of results to return */
  top?: number;
  /** The number of results to skip */
  skip?: number;
  /** The actions to fetch the trading activity from */
  actions?: string[];
  /** The fields to select from the trading activity */
  select?: SelectFieldsTradingActivity[];
  /** The fields to order the trading activity by */
  orderBy?: OrderByTradingActivity[];
  /** The attributes to fetch the trading activity from */
  attributes?: MetadataAttribute[];
}

export const enum OrderByTradingActivity {
  PriceHighToLow = 'short_price desc',
  PriceLowToHigh = 'short_price asc',
  RecentPlaced = 'timestamp desc',
  OldestPlaced = 'timestamp asc',
}

export const enum SelectFieldsTradingActivity {
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
  hasMoreResults: boolean;
  resources: TradingActivity[];
  getNextPagePayload: TradincActivityArgs;
  empty: boolean;
}
