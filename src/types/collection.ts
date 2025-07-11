import type { ActivityChain, NftActivityType } from '@xoxno/types'

import type {
  CollectionInfo,
  Media,
  NftData,
  NFTMetadata,
  Owner,
  SaleInfo,
} from './nft'
import type { CreatorProfile, IUserProfileSearch, OfferBody } from './user'

export interface ISocials {
  twitter: string
  instagram: string
  website: string
  telegram: string
  discord: string
  facebook: string
  youtube: string
}

export interface IMintInfo {
  dataType: string
  collection: string
  contractAddress: string
  collectionTag: string
  cid: string
  mediaType: string
  baseNftName: string
  hasAttributes: boolean
  ownerTransferred: boolean
  collectionSize: number
  totalNftMinted: number
  globalWalletLimit: number
  royalties: number
  oldVersion: boolean
  nameShuffle: boolean
  nftTransferLimited: boolean
  allowsPublicBurn: boolean
  kycRequired: boolean
  allowsRefund: boolean
  hasBotProtection: boolean
  hasReveal: boolean
  tags: string[]
  id: string
  _ts: number
}

export interface IMintInfoExtended extends IMintInfo {
  collectionInfo: CollectionInfo
}

export interface Rule {
  type: 'kiosk_lock_rule' | 'royalty_rule'
  amount_bp?: number
  min_amount?: string
}

export interface TransferPolicy {
  id: string
  type: string
  rules: Rule[]
  is_origin_byte: boolean
}

export interface AttributeData {
  attributeOccurrence: number
  floorPrice: number
  onSaleCount: number
  usdValue: number
}

export interface MetadataAttribute {
  trait_type: string
  value: string
}

export interface TraitValues {
  [traitValue: string]: AttributeData
}

export interface ICollectionAttributes {
  [traitType: string]: TraitValues
}

export interface GlobalOffer {
  attributes: MetadataAttribute[]
  collection: string
  isActive: boolean
  marketplace: string
  offer_id: number
  owner: string
  ownerProfile?: string
  ownerUsername?: string
  payment_nonce: number
  payment_token: string
  price: string
  quantity: number
  short_price: number
  timestamp: number
}

export interface Filter {
  dataType?: string[]
  identifier?: string[]
  chain?: ActivityChain[]
  collection?: string[]
  mintToken?: string[]
  type?: string[]
  nonce?: number[]
  onSale?: boolean
  owner?: string[]
  currentOwner?: string[]
  saleInfo?: {
    seller?: string[]
    paymentToken?: string[]
    marketplace?: string[]
    auctionType?: string[]
  }
  range?: RangeFilter[]
  metadata?: {
    attributes?: NftMetadataAttributes[]
  }
  wasProcessed?: boolean
  cp_staked?: boolean
  activeAuction?: boolean
  customFilter?: string
  verifiedOnly?: boolean
}

export interface NftMetadataAttributes {
  trait_type: string
  value: string
}

export interface SearchNFTs {
  name?: string
  filters: Filter
  applyNftExtraDetails?: boolean
  select?: string[]
  strictSelect?: boolean
  orderBy?: string[]
  top?: number
  skip?: number
  includeCount?: boolean
}

export interface CollectionVolume {
  Day: string
  DR_Trades: number
  DR_Volume: number
  DR_VolumeUSD: number
  DR_Buyers: number
  DR_Sellers: number
  DR_FeesPaid: number
  DR_FeesPaidUSD: number
  DR_RoyaltiesPaid: number
  DR_RoyaltiesPaidUSD: number
  FM_Trades: number
  FM_Volume: number
  FM_VolumeUSD: number
  FM_Buyers: number
  FM_Sellers: number
  FM_FeesPaid: number
  FM_FeesPaidUSD: number
  FM_RoyaltiesPaid: number
  FM_RoyaltiesPaidUSD: number
  KG_Trades: number
  KG_Volume: number
  KG_VolumeUSD: number
  KG_Buyers: number
  KG_Sellers: number
  KG_FeesPaid: number
  KG_FeesPaidUSD: number
  KG_RoyaltiesPaid: number
  KG_RoyaltiesPaidUSD: number
  Total_Trades: number
  Total_Volume: number
  Total_VolumeUSD: number
  Total_Buyers: number
  Total_Sellers: number
  Total_FeesPaid: number
  Total_FeesPaidUSD: number
  Total_RoyaltiesPaid: number
  Total_RoyaltiesPaidUSD: number
  XO_Trades: number
  XO_Volume: number
  XO_VolumeUSD: number
  XO_Buyers: number
  XO_Sellers: number
  XO_FeesPaid: number
  XO_FeesPaidUSD: number
  XO_RoyaltiesPaid: number
  XO_RoyaltiesPaidUSD: number
}

export interface FloorPriceHistory {
  Day: string
  FloorPrice: number
  AveragePrice: number
}

export type FungibleAssets = {
  id?: string
  identifier: string
  collection?: string
  dataType?: string
  decimals: number
  name: string
  type: string
  category: string[]
  svgUrl: string
  pngUrl: string
  ticker: string
  usdPrice?: number
  isAshSupported: boolean
  _ts?: number
  chain?: ActivityChain
}

export type FungibleAssetsMap = {
  [key: string]: FungibleAssets
}

export type ISingleHolder = {
  address: string
  username?: string
  count: number
  weight: number
}

export type IOwners = {
  totalSupply: number
  onMarket: HoldedDetails
  staked: HoldedDetails
  otherSCs: HoldedDetails
  burnWallet: HoldedDetails
  uniqueHolders: HoldedDetails
  holded: AvgHolder
  walletDetails: ISingleHolder[]
}

export type HoldedDetails = {
  count: number
  weight: number
}

export interface AvgHolder extends HoldedDetails {
  avgPerHodler: number
}

export type GlobalOffers = {
  offerId: number
  collection: string
  quantity: number
  paymentToken: string
  price: string
  priceShort: number
  owner: Owner
  usdValue: string
  marketplace: string
  timestamp: number
  attributes: MetadataAttribute[]
  collectionInfo?: CollectionInfo
  isActive: boolean
  floorPrice: number
  floorPriceMargin: number | null
  chain?: ActivityChain
}

export type GlobalOfferOwner = {
  address: string
  userName: string
  profile: string
}

export type CollectionRanksExport = Partial<
  Pick<NftData, 'identifier' | 'name'>
> & {
  rank: number
}

export type GetCollectionMintInfo = {
  collection: string
  contractAddress: string
  collectionTag: string
  startTime: number
  prices?: StagePrice[]
  nftTransferLimited: boolean
  hasBotProtection: boolean
  kycRequired: boolean
  totalNftMinted: number
  collectionSize: number
  globalWalletLimit: number
  cid: string
  hasMetadata: boolean
  mediaType: string
  mintStages: MintStage[]
  collectionInfo: CollectionInfo
  creatorInfo: CreatorProfile
  isExcludedFromMint: boolean
}

export type MintStage = {
  name: string
  startTime: number
  endTime: number
  mintCount: number
  mintLimit: number
  mintEnabled: boolean
  isWhitelist: boolean
  walletLimit: number
  maxBuyable?: number
  walletLimitReached?: boolean
  userMintsPerStage?: number
  prices?: StagePrice[]
  isSoldOut: boolean
}

export type StagePrice = {
  tokenIdentifier: string
  tokenNonce: string
  amount: string
  amountShort: number
  usdValue: number
  decimals: number
}

export interface RangeFilter {
  min?: number
  max?: number
  field?: string
}

export type CollectionStatsDoc = {
  collection: string
  listedCount: number
  floorPrice: number
  tradingStats: {
    totalVolume: number
    totalTrades: number
    allTimeHigh: {
      price: number
      timestamp: number
      txHash: string
      identifier: string
    }
    day: TradingDataSummary
    week: TradingDataSummary
    month: TradingDataSummary
    quarter: TradingDataSummary
    halfYear: TradingDataSummary
    year: TradingDataSummary
  }
  collectionInfo: CollectionInfo
  id: string
}

export type TradingDataSummary = {
  volume: number
  volumeMargin: number
  trades: number
  tradesMargin: number
  minPrice?: number
  maxPrice?: number
  averagePrice?: number
}

export interface CollectionListings {
  density: Density[]
  listings: Pick<
    NftData,
    | 'name'
    | 'collection'
    | 'metadata'
    | 'saleInfo'
    | 'wasProcessed'
    | 'media'
    | 'url'
    | 'identifier'
    | 'id'
  >[]
}

export interface Density {
  key: string
  intervalName: string
  intervalCount: number
  totalCount: number
}

export interface Listing {
  identifier: string
  name: string
  collection: string
  metadata: Pick<NFTMetadata, 'rarity'>
  url: string
  media: Media
  wasProcessed: boolean
  saleInfo: Pick<SaleInfo, 'minBidShort'>
}
