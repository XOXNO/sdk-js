export interface NFTAttribute {
  trait_type: string;
  value: string;
  occurance: number;
  rarity: number;
  frequency: number;
}

export interface NFTMetadata {
  attributes: NFTAttribute[];
  rarity: {
    rank: number;
  };
}

export interface OriginalMedia {
  contentType: string;
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

export interface NftData {
  identifier: string;
  collection: string;
  nonce: number;
  type: string;
  name: string;
  royalties: number;
  url: string;
  avifUrl: string;
  webpUrl: string;
  wasProcessed: boolean;
  onSale: boolean;
  metadata: Metadata;
  originalMedia: OriginalMedia;
  saleInfoNft: SaleInfoNft;
  isVerified: boolean;
  isVisible: boolean;
}
