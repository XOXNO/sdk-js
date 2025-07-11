import type {
  ActivityChain,
  CollectionCosmosResponse,
  CollectionMintProfileDocWithStages,
  CollectionMintProfileFilter,
  CollectionProfileDoc,
  CollectionProfileDto,
  CollectionProfileFilter,
  DropsQueryDto,
} from '@xoxno/types'

export type WithChains = { chain?: ActivityChain[] }

export const routes = {
  '/collection/:collection/profile': {
    input: {},
    output: {} as CollectionProfileDto,
    PATCH: {
      input: {} as Partial<CollectionProfileDto>,
      output: {} as CollectionProfileDto,
    },
  },
  '/collection/:collection/floor-price': {
    input: {} as { token?: string },
    output: {} as { collection: string; price: number; usdPrice: number },
  },
  '/collection/floor-price': {
    input: {} as { collection: string[]; token?: string },
    output: {} as Record<string, number>,
    joinArrays: true,
  },
  '/collection/pinned': {
    input: {} as WithChains,
    output: {} as CollectionProfileDoc[],
  },
  '/collection/pinned-drops': {
    input: {} as WithChains,
    output: {} as CollectionProfileDoc[],
  },
  '/collection/:collection/pinned-drops': {
    input: {},
    output: {} as {
      collection: string
      status: boolean
    },
  },
  '/collection/:collection/pinned': {
    input: {},
    output: {} as {
      collection: string
      status: boolean
    },
  },
  '/collection/:collection/follow': {
    input: {},
    output: {},
    POST: {
      input: {},
      output: {} as { isFavorite: boolean; collection: string },
    },
  },
  '/collection/query': {
    input: {} as CollectionProfileFilter,
    output: {} as CollectionCosmosResponse,
  },
  '/collection/drops/query': {
    input: {} as CollectionMintProfileFilter,
    output: {} as DropsQueryDto,
  },
  '/collection/:collection/drop-info': {
    input: {},
    output: {} as CollectionMintProfileDocWithStages,
  },
  '/collection/:creatorTag/:collectionTag/drop-info': {
    input: {},
    output: {} as CollectionMintProfileDocWithStages,
  },
} as const
