import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findClassCandidates,
  reconcileClassSelection,
  reconcileClassSelections
} from '../src/components/DataStructureVisualizations/classSelection.ts'

test('ranks exact simple names before containing matches while preserving stable order', () => {
  const compiledClasses = [
    'example.SortedList',
    'example.LinkedList',
    'other.List',
    'example.CustomList'
  ]

  assert.deepEqual(findClassCandidates(compiledClasses, 'list'), [
    'other.List',
    'example.SortedList',
    'example.LinkedList',
    'example.CustomList'
  ])
})

test('classifies qualified and nested names by the innermost simple name', () => {
  const compiledClasses = [
    'list.package.Unrelated',
    'example.List$Entry',
    'example.Outer$BinaryTree',
    'example.Outer$Node'
  ]

  assert.deepEqual(findClassCandidates(compiledClasses, 'list'), [])
  assert.deepEqual(findClassCandidates(compiledClasses, 'tree'), ['example.Outer$BinaryTree'])
  assert.deepEqual(findClassCandidates(compiledClasses, 'node'), ['example.Outer$Node'])
})

test('matches roles case-insensitively and returns original class names', () => {
  const compiledClasses = ['example.mylist', 'example.TREE', 'example.recordNODE']

  assert.deepEqual(findClassCandidates(compiledClasses, 'list'), ['example.mylist'])
  assert.deepEqual(findClassCandidates(compiledClasses, 'tree'), ['example.TREE'])
  assert.deepEqual(findClassCandidates(compiledClasses, 'node'), ['example.recordNODE'])
})

test('gives node classification precedence over list and tree wrappers', () => {
  const compiledClasses = ['ListNode', 'TreeNode', 'NodeList', 'List', 'Tree']

  assert.deepEqual(findClassCandidates(compiledClasses, 'list'), ['List'])
  assert.deepEqual(findClassCandidates(compiledClasses, 'tree'), ['Tree'])
  assert.deepEqual(findClassCandidates(compiledClasses, 'node'), [
    'ListNode',
    'TreeNode',
    'NodeList'
  ])
})

test('reconciliation preserves valid manual selections', () => {
  const compiledClasses = ['List', 'CustomList']

  assert.equal(reconcileClassSelection('CustomList', compiledClasses, 'list'), 'CustomList')
})

test('reconciliation replaces missing selections and handles empty candidates', () => {
  assert.equal(reconcileClassSelection('RemovedList', ['SortedList', 'List'], 'list'), 'List')
  assert.equal(reconcileClassSelection('RemovedList', ['Unrelated'], 'list'), '')
  assert.equal(reconcileClassSelection('', [], 'list'), '')
})

test('multi-selection reconciliation preserves surviving choices in compilation order', () => {
  assert.deepEqual(
    reconcileClassSelections(['RemovedList', 'CustomList', 'List'], ['List', 'CustomList', 'Other'], 'list'),
    ['List', 'CustomList']
  )
})

test('multi-selection reconciliation selects every suitable default when none survive', () => {
  assert.deepEqual(
    reconcileClassSelections(['RemovedList'], ['SortedList', 'List', 'ListNode'], 'list'),
    ['List', 'SortedList']
  )
  assert.deepEqual(reconcileClassSelections([], ['Unrelated'], 'list'), [])
})

test('list-view default selections cover the manual class-selection matrix', () => {
  const scenarios = [
    { name: 'no matches', classes: ['HelloWorld', 'Element'], lists: [], nodes: [] },
    { name: 'single pair', classes: ['HelloWorld', 'List', 'Node'], lists: ['List'], nodes: ['Node'] },
    { name: 'node only', classes: ['HelloWorld', 'Node'], lists: [], nodes: ['Node'] },
    {
      name: 'multiple classes',
      classes: ['HelloWorld', 'List', 'SortedList', 'IntNode', 'PersonNode', 'Person'],
      lists: ['List', 'SortedList'],
      nodes: ['IntNode', 'PersonNode']
    },
    {
      name: 'ListNode precedence',
      classes: ['HelloWorld', 'List', 'ListNode'],
      lists: ['List'],
      nodes: ['ListNode']
    }
  ]

  for (const scenario of scenarios) {
    assert.deepEqual(reconcileClassSelections([], scenario.classes, 'list'), scenario.lists, scenario.name)
    assert.deepEqual(reconcileClassSelections([], scenario.classes, 'node'), scenario.nodes, scenario.name)
  }
})

test('tree-view default selections cover the manual class-selection matrix', () => {
  const scenarios = [
    { name: 'no matches', classes: ['HelloWorld', 'Element'], trees: [], nodes: [] },
    { name: 'single pair', classes: ['HelloWorld', 'Tree', 'Node'], trees: ['Tree'], nodes: ['Node'] },
    { name: 'node only', classes: ['HelloWorld', 'Node'], trees: [], nodes: ['Node'] },
    {
      name: 'multiple classes',
      classes: ['HelloWorld', 'Tree', 'BinaryTree', 'IntNode', 'PersonNode', 'Person'],
      trees: ['Tree', 'BinaryTree'],
      nodes: ['IntNode', 'PersonNode']
    },
    {
      name: 'TreeNode precedence',
      classes: ['HelloWorld', 'Tree', 'TreeNode'],
      trees: ['Tree'],
      nodes: ['TreeNode']
    }
  ]

  for (const scenario of scenarios) {
    assert.deepEqual(reconcileClassSelections([], scenario.classes, 'tree'), scenario.trees, scenario.name)
    assert.deepEqual(reconcileClassSelections([], scenario.classes, 'node'), scenario.nodes, scenario.name)
  }
})
