import { mapSorobanError } from '../soroban-errors'

describe('mapSorobanError', () => {
  it('maps a known SpokeError contract error', () => {
    const raw = 'HostError: Error(Contract, #314)'
    expect(mapSorobanError(raw)).toEqual({
      code: 314,
      name: 'SpokeCapBelowUsage',
      message: 'The new cap is below current usage on this spoke asset.',
    })
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
