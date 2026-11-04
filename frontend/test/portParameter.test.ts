import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePortParameter } from '../src/helpers/portParameter.ts'

test('accepts whole numbers from 1 to 65535', () => {
  assert.equal(parsePortParameter('1'), 1)
  assert.equal(parsePortParameter('51235'), 51235)
  assert.equal(parsePortParameter('65535'), 65535)
})

test('rejects missing, empty, and repeated parameters', () => {
  assert.equal(parsePortParameter(undefined), undefined)
  assert.equal(parsePortParameter(null), undefined)
  assert.equal(parsePortParameter(''), undefined)
  assert.equal(parsePortParameter(['51235', '51236']), undefined)
})

test('rejects values that are not valid ports', () => {
  assert.equal(parsePortParameter('0'), undefined)
  assert.equal(parsePortParameter('65536'), undefined)
  assert.equal(parsePortParameter('12a'), undefined)
  assert.equal(parsePortParameter('-1'), undefined)
  assert.equal(parsePortParameter('1.5'), undefined)
})
