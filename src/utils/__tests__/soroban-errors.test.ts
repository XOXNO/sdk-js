import { mapSorobanError } from '../soroban-errors'

describe('mapSorobanError', () => {
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
})
