import { arraySize, stringSize } from '@/components/TheHeapVisualization/MemorySize'

export interface AllocationCase {
  name: string
  actual: number
  expected: number
}

/** Allocation examples that pin the displayed Header + Length + payload arithmetic. */
export function createAllocationCases (): AllocationCase[] {
  return [
    { name: 'empty primitive array', actual: arraySize(0, 1), expected: 24 },
    { name: 'one boolean array', actual: arraySize(1, 1), expected: 24 },
    { name: 'four boolean array without padding', actual: arraySize(4, 1), expected: 24 },
    { name: 'five boolean array with padding', actual: arraySize(5, 1), expected: 32 },
    { name: 'one int array without padding', actual: arraySize(1, 4), expected: 24 },
    { name: 'two int array', actual: arraySize(2, 4), expected: 32 },
    { name: 'one reference array', actual: arraySize(1, 8), expected: 32 },
    { name: 'two reference array', actual: arraySize(2, 8), expected: 40 },
    { name: 'compact empty Latin-1 string', actual: stringSize('', 'byte[]'), expected: 48 },
    { name: 'compact four-character Latin-1 string', actual: stringSize('Tony', 'byte[]'), expected: 48 },
    { name: 'compact thirteen-character Latin-1 string', actual: stringSize('Main Street 7', 'byte[]'), expected: 64 },
    { name: 'compact four-character UTF-16 string', actual: stringSize('Tony', 'char[]'), expected: 56 }
  ]
}
