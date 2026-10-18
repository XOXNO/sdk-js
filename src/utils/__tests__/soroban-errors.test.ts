import { mapSorobanError } from '../soroban-errors'

describe('mapSorobanError', () => {
  it('maps the zero-amount rejection returned by lending transaction preparation', () => {
    expect(mapSorobanError('simulation failed: HostError: Error(Contract, #14)')).toEqual({
      code: 14,
      name: 'AmountMustBePositive',
      message: 'The amount must be greater than zero.',
    })
  })

  it('maps a known SpokeError contract error', () => {
    const raw = 'HostError: Error(Contract, #309)'
    expect(mapSorobanError(raw)).toEqual({
      code: 309,
      name: 'SpokeAssetInUse',
      message:
        'This spoke asset still has live positions; drain usage before removal.',
    })
  })

  it('maps the unlisted-asset SpokeError', () => {
    expect(mapSorobanError('Error(Contract, #307)')).toEqual({
      code: 307,
      name: 'AssetNotInSpoke',
      message: 'This asset is not listed on the spoke.',
    })
  })

  it('maps the seizure-halt SpokeError distinctly from SpokeAssetPaused', () => {
    expect(mapSorobanError('Error(Contract, #318)')).toEqual({
      code: 318,
      name: 'SpokeAssetSeizureHalted',
      message: 'Liquidation seizure is halted for this spoke asset.',
    })
    expect(mapSorobanError('Error(Contract, #315)')!.name).toBe(
      'SpokeAssetPaused'
    )
  })

  it('returns null for the retired SpokeCapBelowUsage code', () => {
    // Code 314 was retired: caps may sit below live usage (ratchet-down).
    expect(mapSorobanError('Error(Contract, #314)')).toBeNull()
  })

  it('maps a known OracleError contract error', () => {
    const raw = 'simulation failed: Error(Contract, #224)'
    expect(mapSorobanError(raw)).toEqual({
      code: 224,
      name: 'InvalidSanityBounds',
      message: 'Oracle sanity bounds are invalid (require 0 < min < max).',
    })
  })

  it('returns null for an unmapped code', () => {
    expect(mapSorobanError('Error(Contract, #99999)')).toBeNull()
  })

  it('returns null when there is no Error(Contract, #N) pattern', () => {
    expect(mapSorobanError('network request failed')).toBeNull()
  })

  it('does not loose-digit-match a bare number in unrelated text', () => {
    expect(mapSorobanError('tx fee 314 stroops too low')).toBeNull()
  })

  it('covers the liquidation, oracle and strategy codes', () => {
    expect(mapSorobanError('Error(Contract, #112)')!.name).toBe('InsufficientLiquidity')
    expect(mapSorobanError('Error(Contract, #133)')!.name).toBe('SelfLiquidationNotAllowed')
    expect(mapSorobanError('Error(Contract, #206)')!.name).toBe('PriceFeedStale')
    expect(mapSorobanError('Error(Contract, #400)')!.name).toBe('FlashLoanOngoing')
  })

  describe('scoped to lending contracts', () => {
    const CTRL = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const OTHER = 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

    it('picks the error emitted by an allowed contract', () => {
      const raw = [
        'HostError: Error(Contract, #401)',
        'Event log (newest first):',
        `   0: [Diagnostic Event] contract:${OTHER}, topics:[error, Error(Contract, #401)], data:"x"`,
        `   1: [Diagnostic Event] contract:${CTRL}, topics:[error, Error(Contract, #112)], data:"y"`,
      ].join('\n')
      expect(mapSorobanError(raw, { contracts: [CTRL] })!.code).toBe(112)
      // Unscoped keeps the first code in the string.
      expect(mapSorobanError(raw)!.code).toBe(401)
    })

    it('returns null when only another contract emitted the error', () => {
      const raw = `0: [Diagnostic Event] contract:${OTHER}, topics:[error, Error(Contract, #401)]`
      expect(mapSorobanError(raw, { contracts: [CTRL] })).toBeNull()
    })

    it('falls back to the invoked-contract tag when there is no event log', () => {
      const raw = `[xoxno-invoked:${CTRL}] HostError: Error(Contract, #14)`
      expect(mapSorobanError(raw, { contracts: [CTRL] })!.name).toBe('AmountMustBePositive')
      expect(mapSorobanError(raw, { contracts: [OTHER] })).toBeNull()
    })
  })
})
