import { parseStellarTokenAmount } from '../lending'

describe('builder token amount parsing', () => {
  it('preserves exact precision and the positive i128 boundary', () => {
    expect(parseStellarTokenAmount('1.25', 7)).toBe('12500000')
    expect(parseStellarTokenAmount('1.000000000000000001', 18)).toBe('1000000000000000001')
    expect(parseStellarTokenAmount('0001.2500', 7)).toBe('12500000')
    expect(parseStellarTokenAmount('0.0000001', 7)).toBe('1')
    expect(parseStellarTokenAmount(((1n << 127n) - 1n).toString(), 0)).toBe(((1n << 127n) - 1n).toString())
  })

  it.each(['0', '-1', '+1', '1e7', '0x10', ' 1', '1 ', '.1', '1.', '1,25', '1.00000001'])('rejects invalid or over-precise input: %s', amount => {
    expect(() => parseStellarTokenAmount(amount, 7)).toThrow()
  })

  it.each([null, -1, 7.5, 19, NaN, Infinity])('rejects missing or invalid token decimals: %s', decimals => {
    expect(() => parseStellarTokenAmount('1', decimals)).toThrow()
  })

  it('rejects i128 overflow and numeric input that can lose precision', () => {
    expect(() => parseStellarTokenAmount((1n << 127n).toString(), 0)).toThrow(/i128/)
    expect(() => parseStellarTokenAmount(1.25 as unknown as string, 7)).toThrow(/decimal text/)
  })
})
