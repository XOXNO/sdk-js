import type { CosmosDbGenericFilter } from '@xoxno/types'

import { CollectionNotFoundError, PaginatedTopError } from './errors'
import { isValidCollectionTicker } from './regex'

export function collectionGuard<T>(collection: string, callback: Promise<T>) {
  if (!isValidCollectionTicker(collection)) {
    throw new CollectionNotFoundError(collection)
  }
  return callback
}

export function collectionGuardOnly(collection: string) {
  return collectionGuard(collection, Promise.resolve())
}

export function paginatedGuard<T, R>(
  filter: CosmosDbGenericFilter<T>,
  callback: (filter: string) => Promise<R>
) {
  if (filter.top && filter.top > 100) {
    throw new PaginatedTopError(filter.top)
  }
  return callback(JSON.stringify(filter))
}
