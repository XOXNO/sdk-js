import type { BytesValue } from '@multiversx/sdk-core/out/smartcontracts/typesystem/bytes'

interface NFTBody {
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
  nfts: NFTBody[]
  offer_id: number
  market: string
  auction_ids_opt: number[]
  signature?: BytesValue
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
