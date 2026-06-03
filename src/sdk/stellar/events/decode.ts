/**
 * Decoders for the 21 Stellar lending controller `#[contractevent]`s.
 *
 * The public API takes base64-XDR strings (`decodeStellarLendingEvent(topicsB64,
 * dataB64)`) and parses them with this SDK's bundled `@stellar/stellar-sdk`, so
 * no live `xdr.ScVal` crosses the consumer boundary. Soroban RPC `getEvents`
 * already delivers `topic[]` and `value` as base64 XDR — pass them straight
 * through.
 *
 * Each contractevent `data` serializes as an `ScMap` keyed by field name, so
 * `scValToNative` yields a snake_case-keyed object with `bigint` for i128/u64,
 * `number` for u32, strkey strings for addresses, strings for symbols, `null`
 * for absent `Option`s, and arrays for `Vec`s.
 */

import { scValToNative, xdr } from '@stellar/stellar-sdk'
import type {
  StellarLendingDecodedEvent,
  StellarLendingOracleUpdateStruct,
} from '@xoxno/types'

type Raw = Record<string, unknown>

/**
 * Serialize a live `xdr.ScVal` to base64 XDR for the string-only decoder API.
 * Use this if you hold parsed ScVals (e.g. from the high-level RPC client);
 * `.toXDR` is wire-format/structural, so it is safe across SDK copies.
 */
export const toBase64Xdr = (scv: { toXDR(format: 'base64'): string }): string =>
  scv.toXDR('base64')

const parse = (b64: string): xdr.ScVal => xdr.ScVal.fromXDR(b64, 'base64')

/** Build the `"<domain>:<action>"` dispatch key from the event topic ScVals. */
export const stellarLendingDispatchKey = (topicsB64: readonly string[]): string =>
  topicsB64.map((t) => String(scValToNative(parse(t)))).join(':')

// ---- native-value coercion (scValToNative output → normalized fields) -------

const dec = (v: unknown): string =>
  typeof v === 'bigint' || typeof v === 'number' ? v.toString() : String(v)
const num = (v: unknown): number => (typeof v === 'bigint' ? Number(v) : Number(v))
const str = (v: unknown): string => String(v)
const optDec = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : dec(v)
const optStr = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : str(v)
const hex = (v: unknown): string =>
  v instanceof Uint8Array
    ? Buffer.from(v).toString('hex')
    : Buffer.isBuffer(v)
      ? (v as Buffer).toString('hex')
      : String(v)

const POSITION_MODE = ['None', 'Multiply', 'Long', 'Short'] as const
const ORACLE_STRATEGY = ['Single', 'PrimaryWithAnchor'] as const
const ORACLE_PROVIDER = ['ReflectorSep40', 'RedStonePriceFeed'] as const
const ORACLE_READ_MODE = ['Spot', 'Twap'] as const

const positionType = (v: unknown): 'Deposit' | 'Borrow' =>
  num(v) === 2 ? 'Borrow' : 'Deposit'
const positionMode = (v: unknown): 'None' | 'Multiply' | 'Long' | 'Short' =>
  POSITION_MODE[num(v)] ?? 'None'

// ---- nested struct decoders -------------------------------------------------

const decodeAssetConfig = (c: Raw) => ({
  loanToValueBps: num(c.loan_to_value_bps),
  liquidationThresholdBps: num(c.liquidation_threshold_bps),
  liquidationBonusBps: num(c.liquidation_bonus_bps),
  liquidationFeesBps: num(c.liquidation_fees_bps),
  isCollateralizable: Boolean(c.is_collateralizable),
  isBorrowable: Boolean(c.is_borrowable),
  isIsolatedAsset: Boolean(c.is_isolated_asset),
  isSiloedBorrowing: Boolean(c.is_siloed_borrowing),
  isFlashloanable: Boolean(c.is_flashloanable),
  isolationBorrowEnabled: Boolean(c.isolation_borrow_enabled),
  isolationDebtCeilingUsdWad: dec(c.isolation_debt_ceiling_usd_wad),
  flashloanFeeBps: num(c.flashloan_fee_bps),
  borrowCap: dec(c.borrow_cap),
  supplyCap: dec(c.supply_cap),
  minCollatFloorUsdWad: dec(c.min_collat_floor_usd_wad),
  minDebtFloorUsdWad: dec(c.min_debt_floor_usd_wad),
  eModeCategories: ((c.e_mode_categories as unknown[]) ?? []).map(num),
})

const decodePositionDelta = (d: Raw) => {
  const pt = positionType(d.position_type)
  const isBorrow = pt === 'Borrow'
  return {
    action: str(d.action),
    positionType: pt,
    asset: str(d.asset),
    scaledAmountRay: dec(d.scaled_amount_ray),
    indexRay: dec(d.index_ray),
    amount: dec(d.amount),
    assetPriceWad: optDec(d.asset_price_wad),
    // Borrow deltas carry no collateral risk params — surface undefined, not 0.
    liquidationThresholdBps: isBorrow ? undefined : num(d.liquidation_threshold_bps),
    liquidationBonusBps: isBorrow ? undefined : num(d.liquidation_bonus_bps),
    loanToValueBps: isBorrow ? undefined : num(d.loan_to_value_bps),
  }
}

const decodeOracleSource = (o: Raw, prefix: 'primary' | 'anchor') => {
  const readMode = ORACLE_READ_MODE[num(o[`${prefix}_read_mode`])] ?? 'Spot'
  const assetAddr = o[`${prefix}_asset`]
  const symbol = o[`${prefix}_symbol`]
  const asset =
    assetAddr !== null && assetAddr !== undefined
      ? { kind: 'Stellar', value: str(assetAddr) }
      : symbol !== null && symbol !== undefined
        ? { kind: 'Symbol', value: str(symbol) }
        : undefined
  return {
    provider: ORACLE_PROVIDER[num(o[`${prefix}_provider`])] ?? 'ReflectorSep40',
    contractAddress: str(o[`${prefix}_contract`]),
    asset,
    feedId: optStr(o[`${prefix}_feed_id`]),
    readMode,
    twapRecords: readMode === 'Twap' ? num(o[`${prefix}_twap_records`]) : undefined,
    decimals: num(o[`${prefix}_decimals`]),
    resolutionSeconds: num(o[`${prefix}_resolution_seconds`]),
    maxStaleSeconds: num(o[`${prefix}_max_stale_seconds`]),
  }
}

const decodeOracleProvider = (o: Raw): StellarLendingOracleUpdateStruct => {
  const hasAnchor = o.anchor_provider !== null && o.anchor_provider !== undefined
  const oracle = {
    baseTokenId: str(o.base_token_id),
    quoteTokenId: str(o.quote_token_id),
    tolerance: {
      firstUpperRatio: num(o.first_upper_ratio_bps ?? (o.tolerance as Raw)?.first_upper_ratio_bps),
      firstLowerRatio: num(o.first_lower_ratio_bps ?? (o.tolerance as Raw)?.first_lower_ratio_bps),
      lastUpperRatio: num(o.last_upper_ratio_bps ?? (o.tolerance as Raw)?.last_upper_ratio_bps),
      lastLowerRatio: num(o.last_lower_ratio_bps ?? (o.tolerance as Raw)?.last_lower_ratio_bps),
    },
    assetDecimals: num(o.asset_decimals),
    maxPriceStaleSeconds: num(o.max_price_stale_seconds),
    strategy: ORACLE_STRATEGY[num(o.strategy)] ?? 'Single',
    primary: decodeOracleSource(o, 'primary'),
    anchor: hasAnchor ? decodeOracleSource(o, 'anchor') : undefined,
  }
  return oracle as unknown as StellarLendingOracleUpdateStruct
}

// ---- registry: dispatch key → decoder producing a typed union member --------

type DecoderFn = (data: Raw) => StellarLendingDecodedEvent

const REGISTRY: Record<string, DecoderFn> = {
  'market:create': (d) => ({
    topic: 'market:create',
    data: {
      baseAsset: str(d.base_asset),
      maxBorrowRate: dec(d.max_borrow_rate),
      baseBorrowRate: dec(d.base_borrow_rate),
      slope1: dec(d.slope1),
      slope2: dec(d.slope2),
      slope3: dec(d.slope3),
      midUtilization: dec(d.mid_utilization),
      optimalUtilization: dec(d.optimal_utilization),
      maxUtilization: optDec(d.max_utilization),
      reserveFactor: num(d.reserve_factor),
      marketAddress: str(d.market_address),
      config: decodeAssetConfig(d.config as Raw),
    },
  }),
  'market:params_update': (d) => ({
    topic: 'market:params_update',
    data: {
      asset: str(d.asset),
      maxBorrowRateRay: dec(d.max_borrow_rate_ray),
      baseBorrowRateRay: dec(d.base_borrow_rate_ray),
      slope1Ray: dec(d.slope1_ray),
      slope2Ray: dec(d.slope2_ray),
      slope3Ray: dec(d.slope3_ray),
      midUtilizationRay: dec(d.mid_utilization_ray),
      optimalUtilizationRay: dec(d.optimal_utilization_ray),
      maxUtilizationRay: optDec(d.max_utilization_ray),
      reserveFactorBps: num(d.reserve_factor_bps),
    },
  }),
  'market:batch_state_update': (d) => ({
    topic: 'market:batch_state_update',
    data: {
      updates: ((d.updates as Raw[]) ?? []).map((u) => ({
        asset: str(u.asset),
        timestamp: num(u.timestamp),
        supplyIndexRay: dec(u.supply_index_ray),
        borrowIndexRay: dec(u.borrow_index_ray),
        reservesRay: dec(u.reserves_ray),
        suppliedRay: dec(u.supplied_ray),
        borrowedRay: dec(u.borrowed_ray),
        revenueRay: dec(u.revenue_ray),
        assetPriceWad: optDec(u.asset_price_wad),
      })),
    },
  }),
  'position:batch_update': (d) => ({
    topic: 'position:batch_update',
    data: {
      accountId: dec(d.account_id),
      accountAttributes: {
        owner: str((d.account_attributes as Raw).owner),
        isIsolatedPosition: Boolean((d.account_attributes as Raw).is_isolated_position),
        eModeCategoryId: num((d.account_attributes as Raw).e_mode_category_id),
        mode: positionMode((d.account_attributes as Raw).mode),
        isolatedToken: optStr((d.account_attributes as Raw).isolated_token),
      },
      updates: ((d.updates as Raw[]) ?? []).map(decodePositionDelta),
    },
  }),
  'position:flash_loan': (d) => ({
    topic: 'position:flash_loan',
    data: {
      asset: str(d.asset),
      receiver: str(d.receiver),
      caller: str(d.caller),
      amount: dec(d.amount),
      fee: dec(d.fee),
    },
  }),
  'config:asset': (d) => ({
    topic: 'config:asset',
    data: { asset: str(d.asset), config: decodeAssetConfig(d.config as Raw) },
  }),
  'config:oracle': (d) => ({
    topic: 'config:oracle',
    data: {
      asset: str(d.asset),
      oracle: decodeOracleProvider(d.oracle as Raw),
      minSanityPriceWad: optDec(d.min_sanity_price_wad),
      maxSanityPriceWad: optDec(d.max_sanity_price_wad),
    },
  }),
  'config:emode_category': (d) => ({
    topic: 'config:emode_category',
    data: {
      category: {
        categoryId: num((d.category as Raw).category_id),
        loanToValueBps: num((d.category as Raw).loan_to_value_bps),
        liquidationThresholdBps: num((d.category as Raw).liquidation_threshold_bps),
        liquidationBonusBps: num((d.category as Raw).liquidation_bonus_bps),
        isDeprecated: Boolean((d.category as Raw).is_deprecated),
      },
    },
  }),
  'config:emode_asset': (d) => ({
    topic: 'config:emode_asset',
    data: {
      asset: str(d.asset),
      config: {
        isCollateralizable: Boolean((d.config as Raw).is_collateralizable),
        isBorrowable: Boolean((d.config as Raw).is_borrowable),
      },
      categoryId: num(d.category_id),
    },
  }),
  'config:remove_emode_asset': (d) => ({
    topic: 'config:remove_emode_asset',
    data: { asset: str(d.asset), categoryId: num(d.category_id) },
  }),
  'debt:ceiling_update': (d) => ({
    topic: 'debt:ceiling_update',
    data: { asset: str(d.asset), totalDebtUsdWad: dec(d.total_debt_usd_wad) },
  }),
  'debt:ceiling_batch_update': (d) => ({
    topic: 'debt:ceiling_batch_update',
    data: {
      updates: ((d.updates as Raw[]) ?? []).map((u) => ({
        asset: str(u.asset),
        totalDebtUsdWad: dec(u.total_debt_usd_wad),
      })),
    },
  }),
  'debt:bad_debt': (d) => ({
    topic: 'debt:bad_debt',
    data: {
      accountId: dec(d.account_id),
      totalBorrowUsdWad: dec(d.total_borrow_usd_wad),
      totalCollateralUsdWad: dec(d.total_collateral_usd_wad),
    },
  }),
  'strategy:initial_payment': (d) => ({
    topic: 'strategy:initial_payment',
    data: {
      token: str(d.token),
      amount: dec(d.amount),
      usdValueWad: dec(d.usd_value_wad),
      accountId: dec(d.account_id),
    },
  }),
  'config:approve_token': (d) => ({
    topic: 'config:approve_token',
    data: { wasmHash: hex(d.wasm_hash), approved: Boolean(d.approved) },
  }),
  'config:aggregator': (d) => ({
    topic: 'config:aggregator',
    data: { aggregator: str(d.aggregator) },
  }),
  'config:accumulator': (d) => ({
    topic: 'config:accumulator',
    data: { accumulator: str(d.accumulator) },
  }),
  'config:pool_template': (d) => ({
    topic: 'config:pool_template',
    data: { wasmHash: hex(d.wasm_hash) },
  }),
  'config:position_limits': (d) => ({
    topic: 'config:position_limits',
    data: {
      maxSupplyPositions: num(d.max_supply_positions),
      maxBorrowPositions: num(d.max_borrow_positions),
    },
  }),
  'config:oracle_disabled': (d) => ({
    topic: 'config:oracle_disabled',
    data: { asset: str(d.asset) },
  }),
  'oracle:twap_degraded': (d) => ({
    topic: 'oracle:twap_degraded',
    data: { oracle: str(d.oracle), reasonCode: num(d.reason_code) },
  }),
}

/** Topic keys this SDK can decode (the 21 controller contractevents). */
export const STELLAR_LENDING_TOPICS = Object.freeze(
  Object.keys(REGISTRY)
) as readonly string[]

/**
 * Decode a Stellar lending controller event from its base64-XDR topics and
 * data (exactly as Soroban RPC `getEvents` delivers them). Returns `null` for a
 * topic this SDK does not decode (e.g. access-control `role_granted` events),
 * so consumers can skip unknown events without throwing.
 */
export function decodeStellarLendingEvent(
  topicsB64: readonly string[],
  dataB64: string
): StellarLendingDecodedEvent | null {
  const key = stellarLendingDispatchKey(topicsB64)
  const decoder = REGISTRY[key]
  if (!decoder) return null
  const native = scValToNative(parse(dataB64)) as Raw
  return decoder(native)
}
