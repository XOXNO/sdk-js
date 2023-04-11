export type Offer = {
  offer_id: number;
  collection: string;
  quantity: number;
  payment_token: string;
  payment_nonce: number;
  price: number;
  timestamp: number;
  owner: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  new_version: boolean;
  price_long: string;
};
