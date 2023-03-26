import { Marketplace, MetadataAttribute, GlobalOffer } from './collection';

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
  collections: string[];
  identifier?: string[];
  owners?: string[];
  marketplaces?: Marketplace[];
  placedInToken?: string[];
  priceRange?: {
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
  top?: number;
  skip?: number;
  actions?: string[];
  select?: SelectFieldsTradingActivity[];
  orderBy?: OrderByTradingActivity[];
  attributes?: MetadataAttribute[];
}

export enum OrderByTradingActivity {
  PriceHighToLow = 'short_price desc',
  PriceLowToHigh = 'short_price asc',
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
  hasMoreResults: boolean;
  lastSkip: number;
  resources: GlobalOffer[];
  getNextPagePayload: TradincActivityArgs;
  empty: boolean;
}
