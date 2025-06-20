export const isValidCollectionTicker = (ticker: string): boolean => {
  const isSuiCollection =
    (ticker.length >= 4 && ticker.length <= 40) ||
    /^0x[a-fA-F0-9]{1,64}::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+(<.+>)?$/.test(
      decodeURIComponent(ticker)
    )

  const isXoxnoCollection = /^[A-Z0-9]{3,10}-[a-z0-9]{6}$/.test(ticker)
  return isSuiCollection || isXoxnoCollection
}

export const isValidNftIdentifier = (identifier: string): boolean => {
  const isSuiNft = /^0x[a-fA-F0-9]{1,64}$/.test(identifier)
  const isXoxnoNft =
    /^[A-Za-z0-9]{3,10}-[A-Za-z0-9]{6}-[A-Za-z0-9]{2,7}(?:-\d+(?:-[A-Za-z0-9]+)?)?$/.test(
      identifier
    )
  return isSuiNft || isXoxnoNft
}
