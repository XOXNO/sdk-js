import type {
  ActivityChain,
  CollectionMintProfileDocWithStages,
  CollectionMintProfileFilter,
  CollectionMintProfilePaginated,
  CollectionProfileDoc,
  CollectionProfileFilter,
  CollectionProfilePaginated,
  EventProfile,
} from '@xoxno/types'

export const routes = {
  /* '/collection/:collection/profile': {
    input: {},
    output: {} as CollectionProfileDoc,
    PATCH: {
      input: {},
      body: {} as Partial<CollectionProfileDoc>,
      output: {} as CollectionProfileDoc,
    },
  },
  '/collection/:collection/floor-price': {
    input: {} as { token?: string },
    output: {} as { collection: string; price: number; usdPrice: number },
  },
  '/collection/floor-price': {
    input: {} as { collection: string[]; token?: string },
    output: {} as Record<string, number>,
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
    input: {} as { filter: CollectionProfileFilter },
    output: {} as CollectionProfilePaginated,
  },
  '/collection/drops/query': {
    input: {} as { filter: CollectionMintProfileFilter },
    output: {} as CollectionMintProfilePaginated,
  },
  '/collection/:collection/drop-info': {
    input: {},
    output: {} as CollectionMintProfileDocWithStages,
  },
  '/collection/:creatorTag/:collectionTag/drop-info': {
    input: {},
    output: {} as CollectionMintProfileDocWithStages,
  }, */
  '/collection/:creatorTag/:collectionTag/drop-info': {
    input: {},
    output: {} as CollectionMintProfileDocWithStages,
  },
  '/user/me/event': {
    input: {} as { extended: boolean },
    output: {} as EventProfile[],
    securityMode: 'requiredAny',
  },
  '/user/me/event/badge': {
    input: {},
    output: {} as string,
    securityMode: 'requiredAny',
  },
} as const
