/**
 * Map MVX `PositionMode` numbering to the Stellar lending controller enum.
 *
 * MVX: None=0, Normal=1, Multiply=2, Long=3, Short=4
 * Stellar: Normal=0, Multiply=1, Long=2, Short=3
 */
export function toStellarPositionMode(mvxMode: number): number {
  if (mvxMode <= 0 || mvxMode > 4) {
    throw new Error(
      `Invalid PositionMode ${mvxMode} for Stellar — ` +
        `expected 1 (Normal) through 4 (Short). ` +
        `"None" (0) has no Stellar equivalent.`
    )
  }
  return mvxMode - 1
}