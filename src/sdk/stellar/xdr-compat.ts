import { Buffer } from 'buffer'

type FieldValue<T> = T extends (...args: never[]) => infer R ? R : T

/** SDK 16 exposes XDR getters; SDK 17 exposes the same fields as properties. */
export function xdrField<T, K extends keyof T>(value: T, key: K): FieldValue<T[K]> {
  const field = value[key]
  return (typeof field === 'function' ? field.call(value) : field) as FieldValue<T[K]>
}

export function xdrType(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const union = value as { type?: string; switch?: () => { name: string } }
  return typeof union.switch === 'function' ? union.switch().name : union.type
}

/** SDK 17 opaque byte fields wrap their Uint8Array in `value`. */
export function xdrBytes(value: { bytes: unknown }): Buffer {
  return xdrOpaque(xdrField(value, 'bytes'))
}

export function xdrOpaque(value: unknown): Buffer {
  const bytes = value as Uint8Array | { value: Uint8Array }
  return Buffer.from('value' in bytes ? bytes.value : bytes)
}
