import {
  AuctionTypes,
  type CollectionProfileDoc,
  type CollectionTraitMap,
  type NftCosmosResponse,
  type NftDoc,
  type NftDocFilter,
} from '@xoxno/types'

type IsLeaf<T> = [T] extends [object]
  ? // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    T extends Function | any[]
    ? true
    : keyof T extends never
      ? true
      : false
  : true

type LeafKeyPaths<T, Prefix extends string = ''> = {
  [K in keyof T]-?: IsLeaf<NonNullable<T[K]>> extends true
    ? `${Prefix}${Extract<K, string>}`
    : LeafKeyPaths<NonNullable<T[K]>, `${Prefix}${Extract<K, string>}.`>
}[keyof T]

type MakeFilter<T> = { [K in keyof T]-?: T[K][] }

type Test = {
  saleInfo?: {
    minBidShort: string
  }
  foo: string
}

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

class RangeFilter<T extends string> {
  min?: number
  max?: number
  field?: T
}

type IFilter = NftDocFilter & { range: RangeFilter<LeafKeyPaths<NftDoc>> }

type Test2 = Prettify<
  IFilter['range'] extends undefined ? undefined : IFilter['range']['field']
>
