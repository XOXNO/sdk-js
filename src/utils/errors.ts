export class CollectionNotFoundError extends Error {
  constructor(item: string) {
    super(`Invalid collection ticker: ${item}`)
  }
}

export class PaginatedTopError extends Error {
  constructor(top: number) {
    super(`Top cannot be greater than 100, found ${top}`)
  }
}
