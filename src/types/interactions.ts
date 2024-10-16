import type { BytesValue } from '@multiversx/sdk-core/out'

export type Offer = {
  offer_id: number
  collection: string
  quantity: number
  payment_token: string
  payment_nonce: number
  price: number
  timestamp: number
  owner: string
  attributes: Array<{
    trait_type: string
    value: string
  }>
  new_version: boolean
  price_long: string
}

export enum AuctionType {
  NftBid,
  Nft,
  SftAll,
  SftOnePerPayment,
}
export interface Auction {
  auctioned_token_type: string
  auctioned_token_nonce: number
  nr_auctioned_tokens: number
  auction_type: AuctionType
  payment_token_type: string
  payment_token_nonce: number
  min_bid: string
  max_bid: string
  start_time: number
  deadline: number
  original_owner: string
  current_bid: string
  current_winner: string
  marketplace_cut_percentage: string
  creator_royalties_percentage: string
}
export interface NFTBody {
  collection: string
  nonce: number
  amount?: number
}

export interface WithSenderAndNonce {
  address: string
  nonce?: number
}

export interface Payment extends Omit<NFTBody, 'amount'> {
  decimals?: number
  amount: string
}

export interface SendGlobalOffer {
  payment_token: string
  payment_nonce: number
  quantity: number
  price: number
  collection: string
  attributes?: string
  depositAmount?: string
}

export interface SendCustomOffer {
  payment_token: string
  payment_nonce: number
  price: number
  nft: NFTBody
  deadline: number
  depositAmount?: string
}

export interface AcceptGlobalOffer {
  nfts: NFTBody[] // Should be provided if the offer is for an NFT not listed on the marketplace
  offer_id: number
  market: string
  auction_ids_opt: number[] //  Only when the NFT you want to sell is listed, if signature is required, it will be 0 in case the NFT is not listed
  signature?: BytesValue // Only when the offer has required attribute
}

export interface ChangeListing {
  paymentToken: string
  price: string
  auctionID: number
  deadline: number
}

export interface NewListingArgs {
  min_bid: string
  max_bid?: string
  deadline?: number
  accepted_payment_token: string
  accepted_payment_token_decimals?: number
  bid: boolean
  opt_sft_max_one_per_payment?: boolean
  isSFTPack?: boolean
  opt_start_time?: number
  collection: string
  nonce: number
  nft_amount: number
}
