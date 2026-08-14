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

export const isAddressValid = (address: string): boolean => {
  return address
    ? (address.startsWith('erd1') && address.length === 62) ||
        /^0x[a-fA-F0-9]{40,64}$/.test(address) ||
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) ||
        // Stellar strkey: `G` = ed25519 account, `C` = Soroban contract.
        // Contracts hold balances, positions and profiles just like accounts,
        // and the route builder runs every `:address` param through here — so
        // rejecting `C` blocked all contract-account endpoints client-side.
        /^[GC][A-Z2-7]{55}$/.test(address)
    : false
}
