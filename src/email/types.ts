import { NftActivityType } from '../types';

export const tradeTypes = [
  NftActivityType.TRADE,
  NftActivityType.BULK_TRADE,
  NftActivityType.OTHER_TRADE,
  NftActivityType.OFFER_TRADE,
  NftActivityType.GLOBAL_OFFER_TRADE,
] as const;

export const offerTypes = [
  NftActivityType.OFFER_CREATE,
  NftActivityType.OFFER_REJECT,
] as const;

export const bidTypes = [
  NftActivityType.AUCTION_BID,
  NftActivityType.AUCTION_OUT_BID,
] as const;

export const depositTypes = ['deposit'] as const;

export type ITradeTypes = (typeof tradeTypes)[number];

export type IDepositTypes = (typeof depositTypes)[number];

export type IBidTypes = (typeof bidTypes)[number];

export type IOfferTypes = (typeof offerTypes)[number];

const emailActivityTypes = [
  ...tradeTypes,
  ...offerTypes,
  ...depositTypes,
  ...bidTypes,
] as const;

export type IEmailActivityType = (typeof emailActivityTypes)[number];

export enum NotificationAssetType {
  NFT = 'nft',
  USER = 'user',
  CHAT = 'chat',
}

export interface IBaseNotification {
  id: string;
  isRead: boolean;
  txHash: string;
  source: string;
  activityType: IEmailActivityType | '';
  message?: string;
  asset: {
    type: NotificationAssetType;
    collection?: string;
    identifier?: string;
    address?: string; // for user related notifications like deposit or new message
    name?: string; // nft name | collection name | user name
    url?: string; // nft url | collection profile | user profile
  };
  activity: {
    price?: number; // for auctions or offers, or deposit balance
    paymentToken?: string;
    quantity?: number;
    buyer?: string;
    seller?: string;
    previousBidder?: string; // for xoxno outbid event
    deadline?: number; // for offers or auctions(maybe not needed)
    unreadCount?: number;
  };
  owner: string;
  timestamp: number;
}

export interface INotification extends Omit<IBaseNotification, 'asset'> {
  asset: Omit<IBaseNotification['asset'], 'url'> & { url: string[] };
}
