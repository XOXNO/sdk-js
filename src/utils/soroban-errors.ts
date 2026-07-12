/**
 * rs-lending-xlm Soroban contract error codes → human-readable messages.
 * Mirrors `common/src/errors.rs` (`GenericError`, `CollateralError`,
 * `SpokeError`, `OracleError`). Keep in sync when that file changes.
 */
const SOROBAN_ERROR_CATALOG: Record<number, { name: string; message: string }> = {
  // GenericError
  1: { name: 'AssetNotSupported', message: 'This asset is not supported by the protocol.' },
  2: { name: 'AssetAlreadySupported', message: 'This asset is already supported.' },
  3: { name: 'InvalidTicker', message: 'Invalid asset ticker.' },
  6: { name: 'InvalidAsset', message: 'Invalid asset address.' },
  10: { name: 'InvalidPoolTemplate', message: 'The liquidity pool template hash is invalid.' },
  11: { name: 'InvalidExchangeSrc', message: 'The oracle configuration is invalid.' },
  12: { name: 'PairNotActive', message: 'No oracle is configured for this asset.' },
  32: { name: 'OwnerNotSet', message: 'The contract owner has not been set.' },
  39: { name: 'InvalidTimelockDelay', message: 'The timelock delay is out of the allowed range.' },
  41: { name: 'InvalidRole', message: 'The caller does not hold the required role.' },
  43: { name: 'HubNotActive', message: 'This hub is not active.' },
  44: { name: 'NotAuthorized', message: 'The caller is not authorized to perform this action.' },
  46: { name: 'OperationNotCancellable', message: 'This governance operation cannot be cancelled.' },
  // CollateralError
  113: { name: 'InvalidLiqThreshold', message: 'LTV, liquidation threshold, or bonus is out of bounds.' },
  116: { name: 'InvalidBorrowParams', message: 'Supply or borrow cap configuration is invalid.' },
  117: { name: 'InvalidUtilRange', message: 'Interest-rate utilization breakpoints are invalid.' },
  132: { name: 'AssetDecimalsTooHigh', message: 'Asset decimals exceed the protocol maximum (27).' },
  // SpokeError
  300: { name: 'SpokeNotFound', message: 'This spoke does not exist.' },
  301: { name: 'SpokeDeprecated', message: 'This spoke has been deprecated.' },
  307: { name: 'AssetNotInSpoke', message: 'This asset is not listed on the spoke.' },
  308: { name: 'AssetAlreadyInSpoke', message: 'This asset is already listed in the spoke.' },
  309: { name: 'SpokeAssetInUse', message: 'This spoke asset still has live positions; drain usage before removal.' },
  315: { name: 'SpokeAssetPaused', message: 'This spoke asset is paused.' },
  316: { name: 'SpokeAssetFrozen', message: 'This spoke asset is frozen.' },
  // OracleError
  220: { name: 'InvalidOracleBase', message: 'The oracle quote asset/market is missing or invalid.' },
  221: { name: 'InvalidOracleDecimals', message: 'The oracle decimals value is invalid.' },
  224: { name: 'InvalidSanityBounds', message: 'Oracle sanity bounds are invalid (require 0 < min < max).' },
  225: { name: 'OracleCycleDetected', message: 'A cycle was detected in the oracle quote chain.' },
}

/**
 * Extracts a `Error(Contract, #N)` code from a raw Soroban simulation/RPC error
 * string and resolves it against the rs-lending-xlm catalog. Matches only the
 * exact `Error(Contract, #N)` pattern — never loose digits, since raw error
 * strings can contain unrelated numbers (fees, ledgers, sequence numbers).
 */
export function mapSorobanError(
  raw: string
): { code: number; name: string; message: string } | null {
  const match = raw.match(/Error\(Contract,\s*#(\d+)\)/)
  if (!match) return null
  const code = Number(match[1])
  const entry = SOROBAN_ERROR_CATALOG[code]
  return entry ? { code, ...entry } : null
}
