// Inline OpenAPI 3 schemas shared with servers; no decorators or runtime dependencies.
const string = { type: 'string' as const }
const number = { type: 'number' as const }
const boolean = { type: 'boolean' as const }
const nullableString = { ...string, nullable: true }
const nullableNumber = { ...number, nullable: true }
const network = { ...string, enum: ['mainnet', 'testnet'] }
const dataStatus = { ...string, enum: ['ready', 'stale', 'incomplete'] }

function object<T extends Record<string, unknown>>(properties: T) {
  return { type: 'object' as const, required: Object.keys(properties), properties }
}

const token = {
  sac: string, symbol: string, name: string,
  decimals: nullableNumber, logoUrl: nullableString,
}
const priceStatus = object({
  valid: boolean, stale: boolean, deviation: boolean, timestamp: nullableNumber,
})
const positionAsset = object({
  ...token, hubId: number, hubName: string,
  amountRaw: { ...nullableString, description: 'Integer token base units, never scaled shares.' },
  amount: nullableString,
  apy: { ...nullableNumber, description: 'Fraction: 0.05 means 5%.' },
  priceUsd: nullableNumber, valueUsd: nullableNumber, priceStatus,
  indexRay: nullableString, indexedAt: number, indexedLedger: number,
})
const capacity = object({
  amountRaw: nullableString, amount: nullableString, usd: nullableNumber,
})
const spoke = object({
  spokeId: number, spokeName: string, ltvBps: number,
  supplyCapacity: capacity, borrowCapacity: capacity,
  canSupply: boolean, canBeCollateral: boolean, canBorrow: boolean,
  canOpenAccount: { ...boolean, description: 'Spoke admits new accounts; other entry gates still apply.' },
})

/** OpenAPI response schema for LendingPosition[]. Every property is required; nullable data remains explicit. */
export const lendingPositionsSchema = {
  type: 'array' as const,
  items: object({
    accountId: string, nftContract: string, network,
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
    ...token, hubId: number, hubName: string, network,
    supplyApy: { ...nullableNumber, description: 'Fraction: 0.05 means 5%.' },
    borrowApy: { ...nullableNumber, description: 'Fraction: 0.05 means 5%.' },
    priceUsd: nullableNumber, priceStatus,
    spokes: { type: 'array' as const, items: spoke },
    dataStatus,
    indexedAt: { ...number, description: 'Pool state timestamp. Capacities are indexed snapshot estimates; prepare/simulate before signing.' },
    indexedLedger: number,
  }),
}
