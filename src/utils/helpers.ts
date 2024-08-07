export const nonceToHex = (nonce: number): string => {
  let nonceHex = nonce.toString(16)
  if (nonceHex.length % 2 !== 0) {
    nonceHex = '0' + nonceHex
  }
  return nonceHex
}

export const getIdentifierFromColAndNonce = (
  collection: string,
  nonce: number
): string => {
  return [collection, nonceToHex(nonce)].join('-')
}

export const isAddressValid = (address: string | Buffer): boolean => {
  return address.includes('erd1')
}
