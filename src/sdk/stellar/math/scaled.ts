/**
 * Contract-exact fixed-point primitives for the Stellar lending math module.
 *
 * Mirrors `rs-lending-xlm/common/src/math/fp_core.rs` (`mul_div_*`,
 * `rescale_*`, `div_by_int_half_up`), `common/src/math/fp.rs` (`Ray`, `Wad`)
 * and `common/src/rates/scaling.rs` (`unscale_supply_floor`,
 * `unscale_borrow_ceil`). All arithmetic is native `BigInt` on the raw decimal
 * strings the API serves; nothing here touches floating point except the
 * `*Short` display converters at the bottom.
 *
 * Every helper assumes the contract's non-negative domain (`Ray`, `Wad` and
 * position balances are never negative on-chain); {@link toBigInt} enforces
 * that at the string boundary.
 */

/** 10^27 — shares, indexes, rates and utilization. */
export const RAY = 10n ** 27n
/** 10^18 — USD values, prices per whole token, health factor. */
export const WAD = 10n ** 18n
/** 10,000 — risk ratios and fees. */
export const BPS = 10_000n
export const RAY_DECIMALS = 27
export const WAD_DECIMALS = 18

/** Parse a raw integer string (or bigint/number) into a non-negative bigint. */
export function toBigInt(value: string | number | bigint, label = 'value'): bigint {
  let out: bigint
  if (typeof value === 'bigint') out = value
  else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Stellar math: ${label} must be a safe integer, got ${value}`)
    }
    out = BigInt(value)
  } else {
    const trimmed = value.trim()
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`Stellar math: ${label} must be a decimal integer string, got "${value}"`)
    }
    out = BigInt(trimmed)
  }
  if (out < 0n) throw new Error(`Stellar math: ${label} must be non-negative, got ${out}`)
  return out
}

/** `fp_core::mul_div_floor` — floor(x * y / d) for non-negative operands. */
export function mulDivFloor(x: bigint, y: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('Stellar math: division by zero')
  return (x * y) / d
}

/** `fp_core::mul_div_ceil` — ceil(x * y / d) for non-negative operands. */
export function mulDivCeil(x: bigint, y: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('Stellar math: division by zero')
  const p = x * y
  const q = p / d
  return p % d === 0n ? q : q + 1n
}

/** `fp_core::mul_div_half_up` — floor((x * y + d/2) / d) for non-negative operands. */
export function mulDivHalfUp(x: bigint, y: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('Stellar math: division by zero')
  return (x * y + d / 2n) / d
}

/** `fp_core::div_by_int_half_up` — a / b rounded half up (non-negative a, b > 0). */
export function divByIntHalfUp(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Stellar math: division by zero')
  const q = a / b
  const r = a % b
  const half = b / 2n + (b % 2n)
  return r >= half ? q + 1n : q
}

const pow10 = (n: number): bigint => 10n ** BigInt(n)

/** `fp_core::rescale_floor` — move `a` between decimal scales, truncating when dropping digits. */
export function rescaleFloor(a: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return a
  if (toDecimals > fromDecimals) return a * pow10(toDecimals - fromDecimals)
  return a / pow10(fromDecimals - toDecimals)
}

/** `fp_core::rescale_ceil` — like {@link rescaleFloor} but rounds a dropped remainder up. */
export function rescaleCeil(a: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return a
  if (toDecimals > fromDecimals) return a * pow10(toDecimals - fromDecimals)
  const factor = pow10(fromDecimals - toDecimals)
  const q = a / factor
  return a % factor === 0n ? q : q + 1n
}

/** `fp_core::rescale_half_up` — like {@link rescaleFloor} but rounds a dropped remainder half up. */
export function rescaleHalfUp(a: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return a
  if (toDecimals > fromDecimals) return a * pow10(toDecimals - fromDecimals)
  return divByIntHalfUp(a, pow10(fromDecimals - toDecimals))
}

export type Rounding = 'floor' | 'ceil' | 'halfUp'

const MUL_DIV: Record<Rounding, (x: bigint, y: bigint, d: bigint) => bigint> = {
  floor: mulDivFloor,
  ceil: mulDivCeil,
  halfUp: mulDivHalfUp,
}
const RESCALE: Record<Rounding, (a: bigint, from: number, to: number) => bigint> = {
  floor: rescaleFloor,
  ceil: rescaleCeil,
  halfUp: rescaleHalfUp,
}

/**
 * Scaled shares → token base units with one rounding direction at both steps.
 * `scaling.rs`: `unscale_supply_floor` = `mul_floor` + `to_asset_floor`,
 * `unscale_borrow_ceil` = `mul_ceil` + `to_asset_ceil`, `unscale_supply` /
 * `unscale_borrow` (displayed balance) = `mul` (half-up) + `to_asset` (half-up).
 */
export function unscale(
  scaledRay: bigint,
  indexRay: bigint,
  decimals: number,
  rounding: Rounding
): bigint {
  return RESCALE[rounding](MUL_DIV[rounding](scaledRay, indexRay, RAY), RAY_DECIMALS, decimals)
}

/**
 * Current supplied amount in token base units — `scaling.rs::unscale_supply_floor`
 * (`mul_floor` then `to_asset_floor`). This is what the pool pays on a full
 * withdrawal, so the SDK never reports more collateral than the contract releases.
 */
export function unscaleSupplyFloor(scaledRay: string | bigint, indexRay: string | bigint, decimals: number): bigint {
  return unscale(toBigInt(scaledRay, 'scaledRay'), toBigInt(indexRay, 'indexRay'), decimals, 'floor')
}

/**
 * Current borrowed amount in token base units — `scaling.rs::unscale_borrow_ceil`
 * (`mul_ceil` then `to_asset_ceil`). A repayment of at least this amount burns
 * every debt share (`resolve_repay`), so a max repay always covers the debt.
 *
 * Note: the xoxno-ui mirror (`stellar-scaled-math.ts`) rounds the share product
 * half-up before the ceil rescale; the contract ceils both steps. This module
 * follows the contract.
 */
export function unscaleBorrowCeil(scaledRay: string | bigint, indexRay: string | bigint, decimals: number): bigint {
  return unscale(toBigInt(scaledRay, 'scaledRay'), toBigInt(indexRay, 'indexRay'), decimals, 'ceil')
}

/**
 * Displayed balance in token base units — `scaling.rs::unscale_supply` /
 * `unscale_borrow` (half-up at both steps). `resolve_withdrawal` treats a
 * request at or above this value as a full withdrawal.
 */
export function unscaleHalfUp(scaledRay: string | bigint, indexRay: string | bigint, decimals: number): bigint {
  return unscale(toBigInt(scaledRay, 'scaledRay'), toBigInt(indexRay, 'indexRay'), decimals, 'halfUp')
}

/** `Ray::from_asset` — token base units → RAY (exact for decimals ≤ 27). */
export function baseToRay(amountBase: bigint, decimals: number): bigint {
  if (decimals > RAY_DECIMALS) throw new Error(`Stellar math: decimals ${decimals} exceed RAY scale`)
  return rescaleFloor(amountBase, decimals, RAY_DECIMALS)
}

/**
 * USD value (WAD) of a scaled position — `common/src/rates/value.rs`
 * `position_value` (halfUp) / `position_value_floor` / `position_value_ceil`:
 * `asset_ray = round(scaled * index / RAY)`, `asset_wad = round(asset_ray / 1e9)`,
 * `usd_wad = round(asset_wad * price / WAD)` with one direction at all three steps.
 */
export function positionValueWad(
  scaledRay: bigint,
  indexRay: bigint,
  priceWad: bigint,
  rounding: Rounding
): bigint {
  const assetRay = MUL_DIV[rounding](scaledRay, indexRay, RAY)
  const assetWad = RESCALE[rounding](assetRay, RAY_DECIMALS, WAD_DECIMALS)
  return MUL_DIV[rounding](assetWad, priceWad, WAD)
}

/**
 * USD value (WAD) of a token amount in base units, using the same last two
 * steps as {@link positionValueWad}. Used by projections, where the hypothetical
 * amount is a token quantity rather than shares.
 */
export function baseValueWad(amountBase: bigint, decimals: number, priceWad: bigint, rounding: Rounding): bigint {
  const assetWad = RESCALE[rounding](baseToRay(amountBase, decimals), RAY_DECIMALS, WAD_DECIMALS)
  return MUL_DIV[rounding](assetWad, priceWad, WAD)
}

/** WAD → JS number (display only; ~1e-16 relative precision). */
export const wadToNumber = (wad: bigint): number => Number(wad) / 1e18

/** RAY → JS number (display only). */
export const rayToNumber = (ray: bigint): number => Number(ray) / 1e27

/** Token base units → human-readable number (display only). */
export const baseToShort = (amountBase: bigint, decimals: number): number =>
  Number(amountBase) / 10 ** decimals

/**
 * Decimal JS number (a `usdPrice` / `*Short` API field) → integer at `decimals`.
 * Uses `toFixed` so no float arithmetic runs after the parse; precision is that
 * of the input double (~15–16 significant digits). Domain: `0 < value < 1e21`
 * (`toFixed` switches to exponential notation at 1e21); anything outside,
 * non-finite included, maps to 0 rather than throwing.
 */
export function numberToScaled(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0 || value >= 1e21) return 0n
  const fixed = value.toFixed(decimals)
  const [whole = '0', frac = ''] = fixed.split('.')
  return BigInt(whole + frac.padEnd(decimals, '0'))
}

/** JS USD price → WAD, see {@link numberToScaled}. */
export const numberToWad = (usd: number): bigint => numberToScaled(usd, WAD_DECIMALS)
