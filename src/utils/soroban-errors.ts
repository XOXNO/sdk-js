/**
 * rs-lending-xlm Soroban contract error codes → human-readable messages.
 * Mirrors every enum in `common/src/errors.rs` (`GenericError`,
 * `CollateralError`, `OracleError`, `SpokeError`, `FlashLoanError`,
 * `StrategyError`). Reserved codes stay listed so numbers are never reused.
 * Keep in sync when that file changes.
 *
 * Codes are scoped per contract: the swap aggregator, XOXNO oracle and DeFindex
 * adapter declare their own enums, so the same number can mean something else
 * there. Pass `contracts` to map only errors emitted by the lending contracts.
 */
const SOROBAN_ERROR_CATALOG: Record<number, { name: string; message: string }> = {
  // GenericError
  1: { name: 'AssetNotSupported', message: 'This asset is not supported by the protocol.' },
  2: { name: 'AssetAlreadySupported', message: 'This asset is already supported.' },
  3: { name: 'InvalidTicker', message: 'Invalid asset ticker.' },
  5: { name: 'PoolAlreadyDeployed', message: 'Singleton pool, controller, or price aggregator already recorded.' },
  6: { name: 'InvalidAsset', message: 'Invalid asset address.' },
  7: { name: 'AssetsAreTheSame', message: 'Same market or token where distinct HubAssetKeys or underlying assets, respectively, are required.' },
  8: { name: 'WrongToken', message: 'Params.asset_id differs from the market\'s asset.' },
  10: { name: 'InvalidWasmHash', message: 'The WASM hash is empty or invalid.' },
  11: { name: 'InvalidExchangeSrc', message: 'The oracle configuration is invalid.' },
  12: { name: 'PairNotActive', message: 'No oracle is configured for this asset.' },
  13: { name: 'AccountNotInMarket', message: 'Caller lacks the account\'s position NFT, or the account has no metadata.' },
  14: { name: 'AmountMustBePositive', message: 'The amount must be greater than zero.' },
  16: { name: 'InvalidPayments', message: 'Payments or route list empty when required, non-empty when forbidden, or over the view limit.' },
  18: { name: 'NotSmartContract', message: 'Address is not a deployed contract.' },
  24: { name: 'AccountNotFound', message: 'Account id has no state, or its NFT owner is unresolvable.' },
  25: { name: 'AccountModeMismatch', message: 'Account mode differs from the call\'s required mode.' },
  27: { name: 'AggregatorNotSet', message: 'Swap or price aggregator not configured.' },
  29: { name: 'PositionLimitsNotSet', message: 'No position limits stored.' },
  30: { name: 'PoolNotInitialized', message: 'Pool or controller unset, or market params/state missing.' },
  32: { name: 'OwnerNotSet', message: 'The contract owner has not been set.' },
  33: { name: 'MathOverflow', message: 'Checked arithmetic overflow or failed narrowing conversion.' },
  34: { name: 'InternalError', message: 'Internal invariant failed. Report it.' },
  36: { name: 'InvalidPositionLimits', message: 'Supply or borrow limit is zero or above POSITION_LIMIT_MAX (5).' },
  38: { name: 'SpotOnlyNotProductionSafe', message: 'Every oracle source reads an unsmoothed spot market.' },
  39: { name: 'InvalidTimelockDelay', message: 'The timelock delay is out of the allowed range.' },
  40: { name: 'TimelockOperationExpired', message: 'Scheduled operation\'s grace period elapsed.' },
  41: { name: 'InvalidRole', message: 'The caller does not hold the required role.' },
  42: { name: 'BlendPoolNotApproved', message: 'Blend pool not approved.' },
  43: { name: 'HubNotActive', message: 'This hub is not active.' },
  44: { name: 'NotAuthorized', message: 'The caller is not authorized to perform this action.' },
  45: { name: 'RegistryCapReached', message: 'Account already has MAX_DELEGATES (16).' },
  46: { name: 'OperationNotCancellable', message: 'This governance operation cannot be cancelled.' },
  47: { name: 'BorrowRoundsToZeroShares', message: 'Positive borrow mints zero scaled debt shares.' },
  48: { name: 'CannotRemoveLastProposer', message: 'Revoke would leave no proposer.' },
  49: { name: 'WithdrawRoundsToZeroShares', message: 'Positive withdrawal burns zero scaled supply shares.' },
  50: { name: 'NetSettleRoundsToZeroShares', message: 'Positive net settlement burns zero shares.' },
  51: { name: 'SupplyRoundsToZeroShares', message: 'Positive supply mints zero scaled shares.' },
  52: { name: 'RepayRoundsToZeroShares', message: 'Positive net repayment burns zero scaled debt shares.' },
  53: { name: 'PositionNftNotSet', message: 'NFT address unset on a path needing it, such as account creation. Ownership lookup can return #24 instead.' },
  54: { name: 'PositionNftAlreadyDeployed', message: 'Position-NFT address already recorded.' },
  55: { name: 'DivisionByZero', message: 'Fixed-point multiply-divide with zero denominator.' },
  // CollateralError
  100: { name: 'InsufficientCollateral', message: 'Post-operation LTV-weighted collateral below total debt, or health factor below 1 WAD.' },
  101: { name: 'HealthFactorTooHigh', message: 'Target has no debt or health factor >= 1 WAD; not liquidatable.' },
  102: { name: 'HealthFactorTooLow', message: 'Update_account_threshold with has_risks = true ends below 1.05 WAD. A gated liquidation-tuple refresh skips a tuple that fails its hypothetical health-factor check.' },
  104: { name: 'NotCollateral', message: 'Spoke listing disallows the asset as collateral.' },
  107: { name: 'AssetNotBorrowable', message: 'Spoke listing disallows borrowing the asset.' },
  109: { name: 'PositionLimitExceeded', message: 'New slot exceeds the position limit, or a sub-3-decimal supply leg would coexist with another supply slot.' },
  110: { name: 'PositionNotFound', message: 'Reserved code; no longer emitted.' },
  111: { name: 'InvalidPositionMode', message: 'Mode is not Multiply, Long, or Short.' },
  112: { name: 'InsufficientLiquidity', message: 'Market cash below the draw, or the draw breaks the liquidation buffer.' },
  113: { name: 'InvalidLiqThreshold', message: 'LTV, liquidation threshold, or bonus is out of bounds.' },
  114: { name: 'CannotCleanBadDebt', message: 'Account fails the bad-debt gate.' },
  115: { name: 'WithdrawLessThanFee', message: 'Liquidation protocol fee exceeds the gross withdrawal.' },
  116: { name: 'InvalidBorrowParams', message: 'Supply or borrow cap configuration is invalid.' },
  117: { name: 'InvalidUtilRange', message: 'Interest-rate utilization breakpoints are invalid.' },
  118: { name: 'OptUtilTooHigh', message: 'Optimal utilization >= 100%.' },
  119: { name: 'InvalidReserveFactor', message: 'Reserve factor >= 100%.' },
  120: { name: 'DebtPositionNotFound', message: 'No debt position for that hub asset.' },
  121: { name: 'CollateralPositionNotFound', message: 'No supply position for that hub asset.' },
  122: { name: 'CannotCloseWithRemainingDebt', message: 'Close_position with borrow positions open.' },
  123: { name: 'PoolInsolvent', message: 'Supplier claims exceed cash plus debt, or zero supply with debt outstanding.' },
  126: { name: 'MinBorrowCollateralNotMet', message: 'With debt outstanding, LTV-weighted collateral below the USD floor, or a sub-3-decimal supply leg under 2 raw units after floor conversion.' },
  127: { name: 'UtilizationAboveMax', message: 'Post-operation utilization above max_utilization.' },
  128: { name: 'BaseRateNegative', message: 'Negative base borrow rate.' },
  129: { name: 'SlopeNonMonotonic', message: 'Rate slopes do not increase monotonically.' },
  130: { name: 'MaxRateBelowBase', message: 'Max borrow rate not strictly above base.' },
  131: { name: 'MaxBorrowRateTooHigh', message: 'Max borrow rate exceeds MAX_BORROW_RATE_RAY (200% APR).' },
  132: { name: 'AssetDecimalsTooHigh', message: 'Asset decimals exceed the protocol maximum (27).' },
  133: { name: 'SelfLiquidationNotAllowed', message: 'SeizeMode::Credit(id) receiver is the liquidated account. Owners may still liquidate their own account.' },
  134: { name: 'InvalidLiquidationCurve', message: 'Curve bounds fail validation.' },
  135: { name: 'FullCloseRequired', message: 'Retired; no error site.' },
  // OracleError
  201: { name: 'InvalidAggregator', message: 'Proposed aggregator is not a deployed contract.' },
  204: { name: 'InvalidOracleTokenType', message: 'Reflector asset given as string; only address or symbol accepted.' },
  205: { name: 'UnsafePriceNotAllowed', message: 'Two legs disagree beyond tolerance, or only one produced a reading.' },
  206: { name: 'PriceFeedStale', message: 'Observation exceeds its staleness budget. Timestamps over 60 s ahead are dropped; the error then depends on remaining sources.' },
  208: { name: 'BadLastTolerance', message: 'Upper ratio outside 10150..12500 (excess over BPS outside 150..2500 bps), or lower ratio is not the required rounded reciprocal.' },
  210: { name: 'NoLastPrice', message: 'No readable source, or an Aquarius LP read failed (for example, reserves or shares).' },
  211: { name: 'NoAccumulator', message: 'Controller has no revenue accumulator.' },
  212: { name: 'ReflectorHistoryEmpty', message: 'Reflector returns no price history.' },
  216: { name: 'OracleNotConfigured', message: 'No oracle for the price key, or the response omits a requested asset.' },
  217: { name: 'InvalidPrice', message: 'Price <= 0, or LP fair-value math non-representable.' },
  218: { name: 'InvalidStalenessConfig', message: 'Max_stale_seconds out of range or below the source\'s guaranteed freshness.' },
  219: { name: 'TwapInsufficientObservations', message: 'Record count zero or below the smoothing minimum, or history too short, too long, or denser than feed resolution.' },
  220: { name: 'InvalidOracleBase', message: 'The oracle quote asset/market is missing or invalid.' },
  221: { name: 'InvalidOracleDecimals', message: 'The oracle decimals value is invalid.' },
  222: { name: 'InvalidOracleResolution', message: 'Reflector resolution below minimum, above max_stale_seconds, or implying a TWAP span above it.' },
  223: { name: 'SanityBoundViolated', message: 'Price outside the stored sanity band.' },
  224: { name: 'InvalidSanityBounds', message: 'Oracle sanity bounds are invalid (require 0 < min < max).' },
  225: { name: 'OracleCycleDetected', message: 'A cycle was detected in the oracle quote chain.' },
  226: { name: 'SanityBandTooWideForSingleSource', message: 'Band exceeds the tighter limit for single-source, LP, or dual-source oracles with identical provider trust sets.' },
  227: { name: 'SanityBandMustTighten', message: 'Set_sanity_band would widen the band. Widen via timelocked ConfigureAssetOracle.' },
  228: { name: 'TwapRecordsOutOfRange', message: 'Record count above MAX_TWAP_RECORDS (12).' },
  229: { name: 'OracleDepthExceeded', message: 'Composition nests deeper than MAX_RESOLUTION_DEPTH (3).' },
  230: { name: 'FactorOutOfBounds', message: 'Scaled source\'s factor price outside its min/max.' },
  231: { name: 'SourceCountOutOfRange', message: 'Zero or over two sources, or Aquarius LP combined with another source.' },
  232: { name: 'IndependenceNotDeclared', message: 'Sources violate RequireDisjoint, or AllowShared is empty or not exactly the shared providers.' },
  234: { name: 'UnsupportedAquariusPool', message: 'Aquarius pool of wrong type, or zero reserve or total shares.' },
  235: { name: 'InsufficientAquariusLiquidity', message: 'Pool value below min_pool_value_wad.' },
  // SpokeError
  300: { name: 'SpokeNotFound', message: 'This spoke does not exist.' },
  301: { name: 'SpokeDeprecated', message: 'This spoke has been deprecated.' },
  307: { name: 'AssetNotInSpoke', message: 'This asset is not listed on the spoke.' },
  308: { name: 'AssetAlreadyInSpoke', message: 'This asset is already listed in the spoke.' },
  309: { name: 'SpokeAssetInUse', message: 'This spoke asset still has live positions; drain usage before removal.' },
  310: { name: 'SpokeMismatch', message: 'Account\'s spoke differs from the targeted spoke.' },
  311: { name: 'SpokeSupplyCapReached', message: 'Supply would exceed the spoke supply cap.' },
  312: { name: 'SpokeBorrowCapReached', message: 'Borrow would exceed the spoke borrow cap.' },
  315: { name: 'SpokeAssetPaused', message: 'This spoke asset is paused.' },
  316: { name: 'SpokeAssetFrozen', message: 'This spoke asset is frozen.' },
  317: { name: 'SpokeAssetFlagRelaxation', message: 'Guardian flag updates may only tighten; clearing a flag requires the timelocked edit.' },
  318: { name: 'SpokeAssetSeizureHalted', message: 'Liquidation seizure is halted for this spoke asset.' },
  319: { name: 'SpokeFlagsEpochMismatch', message: 'RelaxSpokeAssetFlags epoch is stale or wrong; checked at proposal and execution.' },
  // FlashLoanError
  400: { name: 'FlashLoanOngoing', message: 'Flash loan in progress; re-entrant calls refused.' },
  401: { name: 'FlashloanNotEnabled', message: 'Market is_flashloanable is false.' },
  402: { name: 'InvalidFlashloanRepay', message: 'Allowance below principal plus fee, or a pool balance check after payout, callback, or repayment fails.' },
  409: { name: 'StrategyFeeExceeds', message: 'Strategy fee exceeds the borrowed amount.' },
  412: { name: 'InvalidFlashloanReceiver', message: 'Receiver not a deployed Wasm contract, or a controller payout targets the controller or pool.' },
  // StrategyError
  500: { name: 'ConvertStepsRequired', message: 'Multiply initial payment is neither collateral nor debt asset, with no convert_swap.' },
  501: { name: 'RouterOverspend', message: 'Controller input balance rose during the swap, or router spent over amount_in.' },
  502: { name: 'NoSwapOutput', message: 'Swap produced no positive measured output.' },
  503: { name: 'CollateralRequired', message: 'Flash_position collateral list has no positive minimum. Empty list raises #16.' },
  504: { name: 'CollateralMinimumNotMet', message: 'Measured deposit below its minimum, or none positive.' },
  505: { name: 'FlashPositionClosed', message: 'Flash_position ended without supply or positive debt in its debt market.' },
}

export interface MapSorobanErrorOptions {
  /**
   * Accept only an error emitted by one of these contract IDs (`C…`), for
   * example the lending controller and pool. The emitter is read from the
   * diagnostic event log, or from the `[xoxno-invoked:<id>]` tag that
   * `prepareStellarTxXdr` adds when the string has no event log.
   *
   * RPC simulation errors usually carry only the top-level code
   * (`HostError: Error(Contract, #N)`). With only the tag, a code raised by a
   * nested contract (for example the swap aggregator) cannot be told apart;
   * read the simulation's diagnostic events when that matters.
   */
  contracts?: readonly string[]
}

const ERROR_CODE = /Error\(Contract,\s*#(\d+)\)/
const EMITTED_ERROR = /contract:(C[A-Z2-7]{55})[^\n]*?Error\(Contract,\s*#(\d+)\)/g
const INVOKED_TAG = /\[xoxno-invoked:(C[A-Z2-7]{55})\]/
const HAS_EVENT_LOG = /contract:C[A-Z2-7]{55}/

const scopedCode = (raw: string, allowed: ReadonlySet<string>): number | null => {
  for (const m of raw.matchAll(EMITTED_ERROR)) {
    if (allowed.has(m[1]!)) return Number(m[2])
  }
  if (HAS_EVENT_LOG.test(raw)) return null
  const tag = raw.match(INVOKED_TAG)
  const first = raw.match(ERROR_CODE)
  return tag && allowed.has(tag[1]!) && first ? Number(first[1]) : null
}

/**
 * Extracts a `Error(Contract, #N)` code from a raw Soroban simulation/RPC error
 * string and resolves it against the rs-lending-xlm catalog. Matches only the
 * exact `Error(Contract, #N)` pattern — never loose digits, since raw error
 * strings can contain unrelated numbers (fees, ledgers, sequence numbers).
 *
 * Without `opts.contracts` it maps the first code in the string, whichever
 * contract emitted it.
 */
export function mapSorobanError(
  raw: string,
  opts?: MapSorobanErrorOptions
): { code: number; name: string; message: string } | null {
  let code: number | null
  if (opts?.contracts?.length) {
    code = scopedCode(raw, new Set(opts.contracts))
  } else {
    const match = raw.match(ERROR_CODE)
    code = match ? Number(match[1]) : null
  }
  if (code === null) return null
  const entry = SOROBAN_ERROR_CATALOG[code]
  return entry ? { code, ...entry } : null
}
