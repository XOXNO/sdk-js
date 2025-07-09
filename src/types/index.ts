export * from './collection'
export * from './nft'
export * from './trading'
export * from './interactions'
export * from './staking'
export * from './user'
export * from './common'
export * from './event'

export type PublicOnly<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T as T[K] extends Function ? never : K]: T[K]
}

export interface ArgsQueryTop {
  identifier: string
  skip: number
  top: number
}

export interface ArgsUserOffers extends ArgsQueryTop {
  type: OfferType
}

export enum OfferType {
  Received = 'received',
  Placed = 'placed',
}
