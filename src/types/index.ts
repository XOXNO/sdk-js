import type {
  KustoOrderDirection,
  OfferType,
  UserStatsOrderByColumn,
} from '@xoxno/types'

export * from './collection'
export * from './nft'
export * from './interactions'
export * from './staking'
export * from './user'
export * from './common'

export interface WithSkipAndTop {
  skip: number
  top: number
}

export interface ArgsAddress extends WithSkipAndTop {
  address: string
}

export interface ArgsIdentifier extends WithSkipAndTop {
  identifier: string
}

export interface ArgsUserStats extends WithSkipAndTop {
  orderBy: UserStatsOrderByColumn
  orderDirection: KustoOrderDirection
}

export interface ArgsUserOffers extends ArgsAddress {
  type: OfferType
}
