/**
 * Decoders for the 21 Stellar lending controller `#[contractevent]`s.
 *
 * The public API takes base64-XDR strings (`decodeStellarLendingEvent(topicsB64,
 * dataB64)`) and parses them with this SDK's bundled `@stellar/stellar-sdk`, so
 * no live `xdr.ScVal` crosses the consumer boundary. Soroban RPC `getEvents`
 * already delivers `topic[]` and `value` as base64 XDR — pass them straight
 * through.
 *
 * Most contractevent `data` serializes as an `ScMap` keyed by field name, so
 * `scValToNative` yields a snake_case-keyed object with `bigint` for i128/u64,
 * `number` for u32, strkey strings for addresses, strings for symbols, `null`
 * for absent `Option`s, and arrays for `Vec`s.
 *
 * The three hot topics (`position:batch_update`, `market:batch_state_update`,
 * `debt:ceiling_batch_update`) use the vec-encoded ABI v2 instead: `data` is an
 * `ScVec` whose field order IS the ABI, so `scValToNative` yields nested arrays
 * decoded positionally.
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

/** PositionAction u32 discriminant → legacy action string (frozen wire table). */
const POSITION_ACTION = [
  'supply',
  'borrow',
  'withdraw',
  'repay',
  'liq_repay',
  'liq_seize',
  'multiply',
  'param_upd',
  'sw_debt_r',
  'sw_col_wd',
  'rp_col_wd',
  'rp_col_r',
  'close_wd',
] as const

const positionMode = (v: unknown): 'None' | 'Multiply' | 'Long' | 'Short' =>
  POSITION_MODE[num(v)] ?? 'None'
// Unknown discriminants surface as their decimal string instead of throwing.
const positionAction = (v: unknown): string => POSITION_ACTION[num(v)] ?? dec(v)
const vec = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : [])

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
  eModeCategories: ((c.e_mode_categories as unknown[]) ?? []).map(num),
})

/**
 * Vec-encoded position delta. Deposit entries are arrays of 8
 * `[action, asset, scaled_amount_ray, index_ray, amount, liq_threshold_bps,
 * liq_bonus_bps, ltv_bps]`; borrow entries stop after `amount` (array of 5).
 */
const decodePositionDelta = (e: readonly unknown[], pt: 'Deposit' | 'Borrow') => {
  const isBorrow = pt === 'Borrow'
  return {
    action: positionAction(e[0]),
    positionType: pt,
    asset: str(e[1]),
    scaledAmountRay: dec(e[2]),
    indexRay: dec(e[3]),
    amount: dec(e[4]),
    // Borrow deltas carry no collateral risk params — surface undefined, not 0.
    liquidationThresholdBps: isBorrow ? undefined : num(e[5]),
    liquidationBonusBps: isBorrow ? undefined : num(e[6]),
    loanToValueBps: isBorrow ? undefined : num(e[7]),
  }
}

/** Vec-encoded account attributes: array of 5
 * `[owner, e_mode_category_id, is_isolated_position, mode, isolated_token?]`. */
const decodeAccountAttributes = (a: readonly unknown[]) => ({
  owner: str(a[0]),
  isIsolatedPosition: Boolean(a[2]),
  eModeCategoryId: num(a[1]),
  mode: positionMode(a[3]),
  isolatedToken: optStr(a[4]),
})

/** Vec-encoded market snapshot: array of 9
 * `[asset, timestamp_ms, supply_index, borrow_index, reserves, supplied,
 * borrowed, revenue, asset_price_wad?]`. */
const decodeMarketSnapshot = (e: readonly unknown[]) => ({
  asset: str(e[0]),
  timestamp: num(e[1]),
  supplyIndexRay: dec(e[2]),
  borrowIndexRay: dec(e[3]),
  reservesRay: dec(e[4]),
  suppliedRay: dec(e[5]),
  borrowedRay: dec(e[6]),
  revenueRay: dec(e[7]),
  assetPriceWad: optDec(e[8]),
})

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
    primaryQuoteToken: optStr(o.primary_quote_token),
    anchorQuoteToken: optStr(o.anchor_quote_token),
    minSanityPriceWad: optDec(o.min_sanity_price_wad),
    maxSanityPriceWad: optDec(o.max_sanity_price_wad),
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
  // Vec-encoded (ABI v2): data is the entries Vec directly, each an array of 9.
  'market:batch_state_update': (d) => ({
    topic: 'market:batch_state_update',
    data: {
      updates: vec(d).map((u) => decodeMarketSnapshot(vec(u))),
    },
  }),
  // Vec-encoded (ABI v2): data = [account_id, attributes, deposits, borrows].
  // `updates` merges all deposit entries first, then all borrow entries.
  'position:batch_update': (d) => {
    const v = vec(d)
    return {
      topic: 'position:batch_update',
      data: {
        accountId: dec(v[0]),
        accountAttributes: decodeAccountAttributes(vec(v[1])),
        updates: [
          ...vec(v[2]).map((e) => decodePositionDelta(vec(e), 'Deposit')),
          ...vec(v[3]).map((e) => decodePositionDelta(vec(e), 'Borrow')),
        ],
      },
    }
  },
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
  // Vec-encoded (ABI v2): data is the entries Vec directly, each `[asset, total_debt_usd_wad]`.
  'debt:ceiling_batch_update': (d) => ({
    topic: 'debt:ceiling_batch_update',
    data: {
      updates: vec(d).map((u) => {
        const e = vec(u)
        return { asset: str(e[0]), totalDebtUsdWad: dec(e[1]) }
      }),
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
