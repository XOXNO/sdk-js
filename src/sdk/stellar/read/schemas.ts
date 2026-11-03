// Inline OpenAPI 3 schemas shared with servers; no decorators or runtime dependencies.
const string = { type: 'string' as const }
const number = { type: 'number' as const }
const boolean = { type: 'boolean' as const }
const nullableString = { ...string, nullable: true }
const nullableNumber = { ...number, nullable: true }
const network = { ...string, enum: ['mainnet', 'testnet'] }
const dataStatus = { ...string, enum: ['ready', 'stale', 'incomplete'] }

function object<T extends Record<string, unknown>>(properties: T, optional: readonly (keyof T)[] = []) {
  return { type: 'object' as const, required: Object.keys(properties).filter(key => !optional.includes(key)), properties }
}

const token = {
  sac: string, symbol: string, name: string,
  decimals: nullableNumber, logoUrl: nullableString,
}
const priceStatus = object({
  valid: boolean, stale: boolean, deviation: boolean, timestamp: nullableNumber,
})
const extraApy = { type: 'object' as const, properties: { nativeApy: number, feesApr: number }, description: 'Embedded annualized yield fractions, separate from base lending interest.' }
const positionAsset = object({
  extraApy,
  ...token, hubId: number, hubName: string,
  amountRaw: { ...nullableString, description: 'Integer token base units, never scaled shares.' },
  amount: nullableString,
  apy: { ...nullableNumber, description: 'Fraction: 0.05 means 5%.' },
  priceUsd: nullableNumber, valueUsd: nullableNumber, priceStatus,
  indexRay: nullableString, indexedAt: number, indexedLedger: number,
}, ['extraApy'])
const capacity = object({
  amountRaw: nullableString, amount: nullableString, usd: nullableNumber,
})
const spoke = object({
  spokeId: number, spokeName: string, ltvBps: number,
  supplyCapacity: capacity, borrowCapacity: capacity,
  canSupply: boolean, canBeCollateral: boolean, canBorrow: boolean,
  canOpenAccount: { ...boolean, description: 'Spoke admits new accounts; other entry gates still apply.' },
})

/** OpenAPI response schema for LendingPosition[]. Nullable data remains explicit; underlying yield is optional. */
export const lendingPositionsSchema = {
  type: 'array' as const,
  items: object({
    accountId: string, nftContract: string,
    nftImage: { ...string, format: 'uri', description: 'Dynamic position SVG served by the network\'s XOXNO API.' }, network,
    spokeId: nullableNumber, spokeName: nullableString,
    supplied: { type: 'array' as const, items: positionAsset },
    borrow: { type: 'array' as const, items: positionAsset },
    hasDebt: { ...boolean, nullable: true, description: 'Null when account rows are unavailable.' },
    healthFactor: { ...nullableNumber, description: 'Null without debt or when risk inputs are unavailable.' },
    borrowLimitUsd: nullableNumber,
    availableBorrowUsd: { ...nullableNumber, description: 'Account headroom, before per-market constraints.' },
    netApy: { ...nullableNumber, description: 'Net annual yield divided by positive net equity; fraction.' },
    dataStatus,
  }),
}

/** OpenAPI response schema for LendingAsset[]. Capacities are indexed estimates. */
export const lendingAssetsSchema = {
  type: 'array' as const,
  items: object({
    extraApy,
    ...token, hubId: number, hubName: string, network,
    supplyApy: { ...nullableNumber, description: 'Fraction: 0.05 means 5%.' },
    borrowApy: { ...nullableNumber, description: 'Fraction: 0.05 means 5%.' },
    priceUsd: nullableNumber, priceStatus,
    spokes: { type: 'array' as const, items: spoke },
    dataStatus,
    indexedAt: { ...number, description: 'Pool state timestamp. Capacities are indexed snapshot estimates; prepare/simulate before signing.' },
    indexedLedger: number,
  }, ['extraApy']),
}
