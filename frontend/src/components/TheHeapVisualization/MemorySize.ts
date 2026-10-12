/**
 * Simplified educational JVM layout used by the Memory View.
 *
 * This is deliberately a fixed model rather than a claim about every JVM:
 * references and object alignment are 8 bytes, and ordinary object headers are
 * 16 bytes. Arrays add a 4-byte length and align the complete allocation to 8 bytes.
 */
export const REFERENCE_BYTES = 8
export const OBJECT_ALIGNMENT_BYTES = 8
export const OBJECT_HEADER_BYTES = 16
export const ARRAY_LENGTH_BYTES = 4
export const STRING_OBJECT_BYTES = OBJECT_HEADER_BYTES + REFERENCE_BYTES
export const CLASS_BYTES = 24
export const BYTE_BYTES = 1
export const SHORT_BYTES = 2
export const CHAR_BYTES = 2
export const INT_BYTES = 4
export const LONG_BYTES = 8
export const FLOAT_BYTES = 4
export const DOUBLE_BYTES = 8

export function alignmentPadding (bytes: number): number {
  const remainder = bytes % OBJECT_ALIGNMENT_BYTES
  return remainder === 0 ? 0 : OBJECT_ALIGNMENT_BYTES - remainder
}

export function alignBytes (bytes: number): number {
  return bytes + alignmentPadding(bytes)
}

export function arraySize (elementCount: number, elementBytes: number): number {
  return alignBytes(OBJECT_HEADER_BYTES + ARRAY_LENGTH_BYTES + elementCount * elementBytes)
}

function canUseCompactLatin1 (value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0xff)
      return false
  }
  return true
}

export function stringBackingArraySize (value: string, backingArrayType: string): number {
  if (backingArrayType.endsWith('byte[]')) {
    const bytesPerCodeUnit = canUseCompactLatin1(value) ? 1 : 2
    return arraySize(value.length, bytesPerCodeUnit)
  }

  if (backingArrayType.endsWith('char[]'))
    return arraySize(value.length, 2)

  throw new Error(`Unsupported String backing-array type: ${backingArrayType}`)
}

export function stringSize (value: string, backingArrayType: string): number {
  return STRING_OBJECT_BYTES + stringBackingArraySize(value, backingArrayType)
}
