import {
  AddressNotFoundError,
  CollectionNotFoundError,
  NFTNotFoundError,
  PaginatedTopError,
} from './errors'
import { isValidCollectionTicker, isValidNftIdentifier } from './regex'

export function collectionGuard<T>(collection: string, callback: Promise<T>) {
  if (!isValidCollectionTicker(collection)) {
    throw new CollectionNotFoundError(collection)
  }
  return callback
}

export function addressGuard<T>(address: string, callback: Promise<T>) {
  if (!isValidCollectionTicker(address)) {
    throw new AddressNotFoundError(address)
  }
  return callback
}

export function nftGuard<T>(identifier: string, callback: Promise<T>) {
  if (!isValidNftIdentifier(identifier)) {
    throw new NFTNotFoundError(identifier)
  }
  return callback
}

export function collectionGuardOnly(collection: string) {
  return collectionGuard(collection, Promise.resolve())
}

export function paginatedGuard<T extends { top?: number }, R>(
  filter: T,
  callback: (filter: string) => Promise<R>
) {
  if (filter.top && filter.top > 100) {
    throw new PaginatedTopError(filter.top)
  }
  return callback(JSON.stringify(filter))
}
