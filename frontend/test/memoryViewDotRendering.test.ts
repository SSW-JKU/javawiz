import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(async () => await vite.close())

const support = await vite.ssrLoadModule('/test/memoryViewDotRendering.testSupport.ts')
const cases = support.createMemoryViewDotCases()

for (const dotCase of cases) {
  test(`Memory View renders exact DOT HTML for ${dotCase.name}`, () => {
    assert.equal(support.normalizeDotHtml(dotCase.actual), support.normalizeDotHtml(dotCase.expected))

    if (dotCase.graphviz === false)
      return

    const statement = dotCase.graphviz === 'node'
      ? dotCase.actual
      : `sample [label=<<table>${dotCase.actual}</table>>]`
    const graphviz = spawnSync('dot', ['-Tsvg'], {
      input: `digraph { node [shape="plaintext"] ${statement} }`,
      encoding: 'utf8'
    })
    assert.equal(graphviz.status, 0, graphviz.stderr)
    assert.match(graphviz.stdout, /<svg/)
  })
}

test('Memory View keeps byte text at the same horizontal positions on hover', () => {
  const nodes = support.createHoverStableObjectNodes()
  assert.notEqual(nodes.normal, nodes.hovered, 'the hover fixture must change a rendered color')
  for (const node of [nodes.normal, nodes.hovered]) {
    assert.match(node, /<td width="30" align="right"><b>20<\/b>&nbsp;\(\+4\)<\/td>/)
  }

  const renderSvg = (node: string): string => {
    const graphviz = spawnSync('dot', ['-Tsvg'], {
      input: `digraph { node [shape="plaintext"] ${node} }`,
      encoding: 'utf8'
    })
    assert.equal(graphviz.status, 0, graphviz.stderr)
    return graphviz.stdout
  }
  const byteTextPositions = (svg: string): string[] => Array.from(svg.matchAll(/<text[^>]* x="([^"]+)"[^>]*>([^<]*)<\/text>/g))
    .filter(([, , value]) => /\d/.test(value))
    .map(([, x, value]) => `${value.trim()}@${x}`)
  // Graphviz shifts shorter values right; equal-length values share one x-coordinate in a numeric column.
  const firstColumnBytePosition = (svg: string, value: string): string | undefined => Array.from(svg.matchAll(/<text[^>]* x="([^"]+)"[^>]*>([^<]*)<\/text>/g))
    .find(([, , text]) => text === value)?.[1]

  const normalSvg = renderSvg(nodes.normal)
  const hoveredSvg = renderSvg(nodes.hovered)
  assert.match(normalSvg, />\u00a0\(\+4\)<\/text>/)
  assert.match(hoveredSvg, />\u00a0\(\+4\)<\/text>/)
  for (const svg of [normalSvg, hoveredSvg]) {
    const rightEdge = firstColumnBytePosition(svg, '16')
    assert.ok(rightEdge, 'expected a right-aligned Header byte value')
    const singleDigitPosition = firstColumnBytePosition(svg, '4')
    assert.ok(singleDigitPosition, 'expected a right-aligned field byte value')
    assert.ok(Number(singleDigitPosition) > Number(rightEdge))
  }
  const normalPositions = byteTextPositions(normalSvg)
  const hoveredPositions = byteTextPositions(hoveredSvg)
  assert.ok(normalPositions.length >= 5, `expected byte labels in SVG, got ${normalPositions.join(', ')}`)
  assert.deepEqual(hoveredPositions, normalPositions)
})
