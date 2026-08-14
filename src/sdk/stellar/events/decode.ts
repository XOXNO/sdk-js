/**
 * Decoders for the Stellar lending `#[contractevent]`s (controller, pool, and
 * the price-aggregator's `config:asset_oracle`).
 *
 * Decodes core protocol topics plus pool `strategy:fee` and live controller
 * config topics used by the indexer. Intentional omissions still return
 * `null`: `config:spoke_asset` / `config:remove_spoke_asset` / `config:hub` /
 * `strategy:blend_migration` (handled by az-functions own decoders).
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
 * The hot topics (`position:batch_update`, `market:batch_state_update`) use the
 * vec-encoded ABI v2 instead: `data` is an `ScVec` whose field order IS the ABI,
 * so `scValToNative` yields nested arrays decoded positionally.
 *
 * `market:batch_params_update` is likewise single-value: `data` is the updates
 * `ScVec` directly (NOT an ScMap wrapping `updates`) — read `d`, not `d.updates`
 * — though each entry is itself an ScMap.
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
const hex = (v: unknown): string =>
  v instanceof Uint8Array
    ? Buffer.from(v).toString('hex')
    : Buffer.isBuffer(v)
      ? (v as Buffer).toString('hex')
      : String(v)

const POSITION_MODE = ['None', 'Multiply', 'Long', 'Short'] as const
/**
 * PositionAction u32 discriminant → legacy action string (frozen wire table).
 * Index IS the on-chain discriminant, so entries may only be appended.
 *
 * `liq_seize` (5) and `liq_credit` (15) are two halves of ONE share-credit
 * seizure and must never be summed together: `liq_seize` is the liquidated
 * account's debit, **gross** of the protocol fee, and `liq_credit` is the
 * receiving account's credit, **net** of it (the fee is the difference).
 * `SeizeMode::Transfer` emits only `liq_seize`, also gross.
 */
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
  'migrate',
  'rp_col_net',
  'liq_credit',
] as const

const positionMode = (v: unknown): 'None' | 'Multiply' | 'Long' | 'Short' =>
  POSITION_MODE[num(v)] ?? 'None'
// Unknown discriminants surface as their decimal string instead of throwing.
const positionAction = (v: unknown): string => POSITION_ACTION[num(v)] ?? dec(v)
const vec = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : [])

// ---- nested struct decoders -------------------------------------------------

const decodeMarketParams = (p: Raw) => ({
  maxBorrowRateRay: dec(p.max_borrow_rate),
  baseBorrowRateRay: dec(p.base_borrow_rate),
  slope1Ray: dec(p.slope1),
  slope2Ray: dec(p.slope2),
  slope3Ray: dec(p.slope3),
  midUtilizationRay: dec(p.mid_utilization),
  optimalUtilizationRay: dec(p.optimal_utilization),
  maxUtilizationRay: dec(p.max_utilization),
  reserveFactorBps: num(p.reserve_factor),
  isFlashloanable: Boolean(p.is_flashloanable),
  flashloanFeeBps: num(p.flashloan_fee),
  assetId: str(p.asset_id),
  assetDecimals: num(p.asset_decimals),
})

/**
 * Vec-encoded position delta. Deposit entries are arrays of 10
 * `[action, hub_id, asset, scaled_amount_ray, index_ray, amount,
 * liq_threshold_bps, liq_bonus_bps, ltv_bps, liq_fees_bps]`; borrow entries
 * stop after `amount` (array of 6).
 */
const decodePositionDelta = (e: readonly unknown[], pt: 'Deposit' | 'Borrow') => {
  const isBorrow = pt === 'Borrow'
  return {
    action: positionAction(e[0]),
    positionType: pt,
    hubId: num(e[1]),
    asset: str(e[2]),
    scaledAmountRay: dec(e[3]),
    indexRay: dec(e[4]),
    amount: dec(e[5]),
    // Borrow deltas carry no collateral risk params — surface undefined, not 0.
    liquidationThresholdBps: isBorrow ? undefined : num(e[6]),
    liquidationBonusBps: isBorrow ? undefined : num(e[7]),
    loanToValueBps: isBorrow ? undefined : num(e[8]),
    liquidationFeesBps: isBorrow ? undefined : num(e[9]),
  }
}

/** Vec-encoded account attributes: array of 3 `[owner, spoke_id, mode]`. */
const decodeAccountAttributes = (a: readonly unknown[]) => ({
  owner: str(a[0]),
  spokeId: num(a[1]),
  mode: positionMode(a[2]),
})

/** Vec-encoded market snapshot: array of 9
 * `[hub_id, asset, timestamp_ms, supply_index, borrow_index, cash, supplied,
 * borrowed, revenue]`. */
const decodeMarketSnapshot = (e: readonly unknown[]) => ({
  hubId: num(e[0]),
  asset: str(e[1]),
  timestamp: num(e[2]),
  supplyIndexRay: dec(e[3]),
  borrowIndexRay: dec(e[4]),
  cash: dec(e[5]),
  suppliedRay: dec(e[6]),
  borrowedRay: dec(e[7]),
  revenueRay: dec(e[8]),
})

// `scValToNative` decodes Soroban enums to `[variantName, ...payload]` arrays
// (unit variants in mixed enums decode to a 1-element array).
const enumTag = (v: unknown): string => (Array.isArray(v) ? str(v[0]) : str(v))
const enumVal = (v: unknown): unknown => (Array.isArray(v) ? v[1] : undefined)

/** Decode on-chain `PriceKey` → `{ Token }` / `{ Ref }`. */
const decodePriceKey = (key: unknown): Record<string, string> => {
  const tag = enumTag(key)
  if (tag === 'Token') return { Token: str(enumVal(key)) }
  if (tag === 'Ref') return { Ref: str(enumVal(key)) }
  // scValToNative may already yield a map
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    const o = key as Raw
    if (o.Token !== undefined) return { Token: str(o.Token) }
    if (o.Ref !== undefined) return { Ref: str(o.Ref) }
  }
  return { Token: str(key) }
}

/**
 * `AssetOracle` (price-aggregator event `oracle` field) → API struct.
 * Sources stay as raw decoded objects (Feed / Scaled / LpShare) so consumers
 * can re-encode without losing shape.
 */
const decodeAssetOracle = (c: Raw): StellarLendingOracleUpdateStruct => {
  const tolerance = (c.tolerance ?? {}) as Raw
  return {
    assetDecimals: num(c.asset_decimals),
    maxPriceStaleSeconds: num(c.max_price_stale_seconds),
    sources: vec(c.sources).map((s) => s as Record<string, unknown>),
    tolerance: {
      upperRatio: num(tolerance.upper_ratio_bps),
      lowerRatio: num(tolerance.lower_ratio_bps),
    },
    independence: c.independence as string | Record<string, unknown>,
    minSanityPriceWad: dec(c.min_sanity_price_wad),
    maxSanityPriceWad: dec(c.max_sanity_price_wad),
  } as StellarLendingOracleUpdateStruct
}

// ---- registry: dispatch key → decoder producing a typed union member --------

type DecoderFn = (data: Raw) => StellarLendingDecodedEvent

const REGISTRY: Record<string, DecoderFn> = {
  'market:create': (d) => ({
    topic: 'market:create',
    data: {
      hubId: num(d.hub_id),
      baseAsset: str(d.base_asset),
      maxBorrowRate: dec(d.max_borrow_rate),
      baseBorrowRate: dec(d.base_borrow_rate),
      slope1: dec(d.slope1),
      slope2: dec(d.slope2),
      slope3: dec(d.slope3),
      midUtilization: dec(d.mid_utilization),
      optimalUtilization: dec(d.optimal_utilization),
      maxUtilization: dec(d.max_utilization),
      reserveFactor: num(d.reserve_factor),
      marketAddress: str(d.market_address),
    },
  }),
  'market:params_update': (d) => ({
    topic: 'market:params_update',
    data: {
      asset: str(d.asset),
      maxBorrowRateRay: dec(d.max_borrow_rate),
      baseBorrowRateRay: dec(d.base_borrow_rate),
      slope1Ray: dec(d.slope1),
      slope2Ray: dec(d.slope2),
      slope3Ray: dec(d.slope3),
      midUtilizationRay: dec(d.mid_utilization),
      optimalUtilizationRay: dec(d.optimal_utilization),
      maxUtilizationRay: dec(d.max_utilization),
      reserveFactorBps: num(d.reserve_factor),
    },
  }),
  // Vec-encoded (ABI v2): data is the entries Vec directly, each an array of 9.
  'market:batch_state_update': (d) => ({
    topic: 'market:batch_state_update',
    data: {
      updates: vec(d).map((u) => decodeMarketSnapshot(vec(u))),
    },
  }),
  // Vec-encoded (single-value): `data` is the updates `Vec` directly (NOT an
  // ScMap wrapping an `updates` field), each entry an ScMap { asset, params }.
  'market:batch_params_update': (d) =>
    ({
      topic: 'market:batch_params_update',
      data: {
        updates: vec(d).map((entry) => {
          const row = entry as Raw
          return {
            hubId: num(row.hub_id),
            asset: str(row.asset),
            params: decodeMarketParams(row.params as Raw),
          }
        }),
      },
    }) as Extract<StellarLendingDecodedEvent, { topic: 'market:batch_params_update' }>,
  // Vec-encoded (ABI v2): data = [account_id, attributes, deposits, borrows].
  // `updates` merges all deposit entries first, then all borrow entries.
  //
  // One event = one account. A `SeizeMode::Credit` liquidation emits TWO of
  // these — the liquidated account first, then the receiving account (supply
  // side only, legs whose net credit is zero omitted). Consumers must not
  // assume one batch per liquidation, and a `Credit(0)` receiver is announced
  // ONLY through the second batch's `accountAttributes`: there is no
  // account-creation event to discover it from.
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
      hubId: num(d.hub_id),
      asset: str(d.asset),
      receiver: str(d.receiver),
      caller: str(d.caller),
      amount: dec(d.amount),
      fee: dec(d.fee),
    },
  }),
  // Live price-aggregator: `{ key: PriceKey, oracle: AssetOracle }`.
  'config:asset_oracle': (d) => ({
    topic: 'config:asset_oracle',
    data: {
      key: decodePriceKey(d.key),
      oracle: decodeAssetOracle(d.oracle as Raw),
    },
  }),
  // Legacy pre-composable payload (historical ledgers only).
  'config:oracle': (d) => ({
    topic: 'config:oracle',
    data: {
      asset: str(d.asset),
      oracle: decodeAssetOracle((d.config ?? d.oracle) as Raw),
    },
  }),
  // `repaidUsdWad` is the repayment the pool MEASURED, not the planned one:
  // net of any overpayment refunded and of any shortfall from an
  // under-delivering debt token, so it agrees with the batch's `liq_repay`
  // legs. The event carries no seizure or protocol-fee figure at all.
  'position:liquidation': (d) => ({
    topic: 'position:liquidation',
    data: {
      liquidator: str(d.liquidator),
      accountId: dec(d.account_id),
      repaidUsdWad: dec(d.repaid_usd_wad),
      bonusBps: dec(d.bonus_bps),
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
  'strategy:fee': (d) => ({
    topic: 'strategy:fee',
    data: {
      hubId: num(d.hub_id),
      asset: str(d.asset),
      amount: dec(d.amount),
      fee: dec(d.fee),
      amountSent: dec(d.amount_sent),
    },
  }),
  'config:approve_blend_pool': (d) => ({
    topic: 'config:approve_blend_pool',
    data: {
      pool: str(d.pool ?? d.blend_pool ?? d.token),
      approved: Boolean(d.approved ?? d.is_approved ?? true),
    },
  }),
  'config:approve_token': (d) => ({
    topic: 'config:approve_token',
    data: { wasmHash: hex(d.wasm_hash ?? d.pool), approved: Boolean(d.approved) },
  }),
  'config:swap_aggregator': (d) => ({
    topic: 'config:swap_aggregator',
    data: { aggregator: str(d.aggregator ?? d.swap_aggregator) },
  }),
  'config:price_aggregator': (d) => ({
    topic: 'config:price_aggregator',
    data: { aggregator: str(d.aggregator ?? d.price_aggregator) },
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
  'config:min_borrow_collateral': (d) => ({
    topic: 'config:min_borrow_collateral',
    data: {
      minBorrowCollateralUsdWad: dec(
        d.min_borrow_collateral_usd_wad ?? d.floor_wad ?? d.value
      ),
    },
  }),
  'config:oracle_disabled': (d) => ({
    topic: 'config:oracle_disabled',
    data: { asset: str(d.asset) },
  }),
  'config:spoke': (d) => {
    const s = d.spoke as Raw
    return {
      topic: 'config:spoke',
      data: {
        spokeId: num(s.spoke_id),
        isDeprecated: Boolean(s.is_deprecated),
        liquidationTargetHfWad: dec(s.liquidation_target_hf_wad),
        healthFactorForMaxBonusWad: dec(s.hf_for_max_bonus_wad),
        liquidationBonusFactorBps: num(s.liquidation_bonus_factor_bps),
      },
    }
  },
}

/** Topic keys this SDK can decode. See the module header for the intentional
 * omissions. */
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
