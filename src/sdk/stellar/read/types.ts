/** Render-ready REST data. Null means unavailable, never an inferred zero. */
export type LendingAssetUsage = 'collateral' | 'borrow'
export type LendingDataStatus = 'ready' | 'stale' | 'incomplete'

export interface LendingToken {
  sac: string
  symbol: string
  name: string
  decimals: number | null
  logoUrl: string | null
}

export interface LendingPriceStatus {
  valid: boolean
  stale: boolean
  deviation: boolean
  timestamp: number | null
}

export interface PositionAsset extends LendingToken {
  hubId: number
  hubName: string
  /** Integer token base units, never scaled shares. */
  amountRaw: string | null
  amount: string | null
  /** Fraction: 0.05 means 5%. */
  apy: number | null
  priceUsd: number | null
  valueUsd: number | null
  priceStatus: LendingPriceStatus
  indexRay: string | null
  indexedAt: number
  indexedLedger: number
}

export interface LendingPosition {
  accountId: string
  nftContract: string
  /** Dynamic position SVG served by the network's XOXNO API. */
  nftImage: string
  network: 'mainnet' | 'testnet'
  spokeId: number | null
  spokeName: string | null
  supplied: PositionAsset[]
  borrow: PositionAsset[]
  /** Null when account rows are unavailable. */
  hasDebt: boolean | null
  /** Null without debt or when risk inputs are unavailable. */
  healthFactor: number | null
  borrowLimitUsd: number | null
  /** Account headroom, before per-market constraints. */
  availableBorrowUsd: number | null
  /** Net annual yield divided by positive net equity; fraction. */
  netApy: number | null
  dataStatus: LendingDataStatus
}

export interface Capacity {
  amountRaw: string | null
  amount: string | null
  usd: number | null
}

export interface AssetSpoke {
  spokeId: number
  spokeName: string
  ltvBps: number
  supplyCapacity: Capacity
  borrowCapacity: Capacity
  canSupply: boolean
  canBeCollateral: boolean
  canBorrow: boolean
  /** Spoke admits new accounts; other entry gates still apply. */
  canOpenAccount: boolean
}

export interface LendingAsset extends LendingToken {
  hubId: number
  hubName: string
  network: 'mainnet' | 'testnet'
  /** Fraction: 0.05 means 5%. */
  supplyApy: number | null
  /** Fraction: 0.05 means 5%. */
  borrowApy: number | null
  priceUsd: number | null
  priceStatus: LendingPriceStatus
  spokes: AssetSpoke[]
  dataStatus: LendingDataStatus
  /** Pool timestamp. Capacities are indexed estimates; prepare/simulate before signing. */
  indexedAt: number
  indexedLedger: number
}
