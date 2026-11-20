export const isValidCollectionTicker = (ticker: string): boolean => {
  const isXoxnoCollection = /^[A-Z0-9]{3,10}-[a-z0-9]{6}$/.test(ticker)
  // Stellar: the collection IS the NFT contract (Soroban contract strkey)
  const isStellarCollection = /^C[A-Z2-7]{55}$/.test(ticker)
  return isXoxnoCollection || isStellarCollection
}

export const isValidNftIdentifier = (identifier: string): boolean => {
  const isXoxnoNft =
    /^[A-Za-z0-9]{3,10}-[A-Za-z0-9]{6}-[A-Za-z0-9]{2,7}(?:-\d+(?:-[A-Za-z0-9]+)?)?$/.test(
      identifier
    )
  // Stellar: `{contract strkey}-{decimal token id}`
  const isStellarNft = /^C[A-Z2-7]{55}-\d+$/.test(identifier)
  return isXoxnoNft || isStellarNft
}
