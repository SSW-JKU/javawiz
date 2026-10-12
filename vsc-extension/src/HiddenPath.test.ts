import assert from 'node:assert/strict'
import test from 'node:test'
import { hasHiddenPathSegment } from './HiddenPath'

test('retains visible Java paths', () => {
  assert.equal(hasHiddenPathSegment('Main.java'), false)
  assert.equal(hasHiddenPathSegment('src/Main.java'), false)
  assert.equal(hasHiddenPathSegment('src\\Main.java'), false)
})

test('recognizes dot-prefixed Java files', () => {
  assert.equal(hasHiddenPathSegment('._In.java'), true)
  assert.equal(hasHiddenPathSegment('.metadata.java'), true)
})

test('recognizes Java files below dot-prefixed directories', () => {
  assert.equal(hasHiddenPathSegment('.metadata/Hidden.java'), true)
  assert.equal(hasHiddenPathSegment('.metadata\\Hidden.java'), true)
  assert.equal(hasHiddenPathSegment('src/.metadata/Hidden.java'), true)
  assert.equal(hasHiddenPathSegment('src\\.metadata\\Hidden.java'), true)
})
