/**
 * Stellar lending math: contract-exact share conversion, rate curve, account
 * risk, per-action limits and projections in native `BigInt`. Ground truth is
 * `rs-lending-xlm` (`common/src/rates/*.rs`, `contracts/controller/src/risk/*`,
 * `docs/reference/formulas.md`); each function names the source it mirrors.
 * @module Stellar lending math
 */
export * from './scaled'
export * from './rates'
export * from './account'
export * from './limits'
export * from './projection'
