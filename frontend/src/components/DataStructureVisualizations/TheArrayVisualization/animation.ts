import { BaseType, Selection } from 'd3-selection'
import { HTML, LAYOUT } from './constants'
import { SelectionOrTransition, Transition } from 'd3'
import { IndexLabel, ArrayBox, CopyAnimationGroup, TemporaryVariableBox } from './types'
import { getCoordinatesAndWidth } from './utils'
import { ArrayAccessValue } from '@/dto/TraceState'
import { getArrayLength } from './array-utils'
import { SVG } from '../constants'

// updates the duration of the animation of array accesses
export function updateDuration (sourceCoordinates: [number, number], targetCoordinates: [number, number], copyAnimationGroup: CopyAnimationGroup) {
  const dX = sourceCoordinates[0] - targetCoordinates[0]
  const dY = sourceCoordinates[1] - targetCoordinates[1]
  const distance = dX * dX + dY * dY
  const duration = 1500 + distance * 0.01
  if (copyAnimationGroup.duration < duration) {
    copyAnimationGroup.duration = duration
  }
}

// adds a 'flying' rectangle and highlights the source's and the target's cell
export function visualizeValueCopy (
  copyAnimationGroup: CopyAnimationGroup,
  staticViz: Selection<BaseType, unknown, HTMLElement, unknown>,
  animationInfo: {
    source: ArrayBox | TemporaryVariableBox,
    target: ArrayBox | TemporaryVariableBox | { kind: 'VanishedSourceVariable', coordinates: [number, number], width: number },
    isWholeArrayCopy: boolean
  },
  cellIndexes: {
    source?: number,
    target?: number
  }
) {
  const { coordinates: sourceCoordinates, width: sourceWidth } = getCoordinatesAndWidth(animationInfo.source, animationInfo.isWholeArrayCopy, cellIndexes.source)
  const { coordinates: targetCoordinates, width: targetWidth } = animationInfo.target.kind === 'VanishedSourceVariable'
    ? animationInfo.target
    : getCoordinatesAndWidth(animationInfo.target, animationInfo.isWholeArrayCopy, cellIndexes.target)

  if (animationInfo.target.kind !== 'VanishedSourceVariable') {
    // highlight source
    appendHighlightedCell(staticViz, sourceCoordinates, sourceWidth, 'source')
  }
  // highlight target
  appendHighlightedCell(staticViz, targetCoordinates, targetWidth, 'target')

  updateDuration(sourceCoordinates, targetCoordinates, copyAnimationGroup)
  copyAnimationGroup.copyAnimations.push({
    sourceCoordinates,
    targetCoordinates,
    sourceWidth,
    targetWidth
  })
}

// adds a highlighted cell
function appendHighlightedCell (
  viz: Selection<BaseType, unknown, HTMLElement, unknown>,
  coordinates: [number, number],
  cellWidth: number,
  color: 'source' | 'target'
) {
  viz.append('rect')
    .classed(color === 'source' ? HTML.classes.highlightedCells.sources : HTML.classes.highlightedCells.targets, true)
    .attr('x', coordinates[0])
    .attr('y', coordinates[1])
    .attr('width', cellWidth)
    .attr('height', SVG.cellHeight)
}

// returns a animation to animate along a path
export function animateAlongPath (path: Selection<SVGPathElement, unknown, HTMLElement, unknown>) {
  const length = path.node()!.getTotalLength()
  return () => {
    return (x: number) => {
      const p = path.node()!.getPointAtLength(length * x)
      return `translate(${[p.x, p.y]})`
    }
  }
}

// sets the attributes for highlighting rectangles
export function highlightRectAttributes (rect: SelectionOrTransition<any, IndexLabel, BaseType, unknown>) {
  (rect.attr('x', (d: IndexLabel) => d.arrayBox.kind === 'TwoDimArrayBox'
    ? -LAYOUT.indexes.row.xOffset - d.arrayBox.dimensions[1] * d.arrayBox.cellWidth
    : 0) as Transition<any, IndexLabel, BaseType, unknown>)
    .attr('y', (d: IndexLabel) => d.arrayBox.kind === 'TwoDimArrayBox' ? 0 : LAYOUT.indexes.col.yOffset)
    .attr('width', (d: IndexLabel) => d.arrayBox.kind === 'TwoDimArrayBox' ? d.arrayBox.dimensions[1] * d.arrayBox.cellWidth : d.arrayBox.cellWidth)
    .attr('height', (d: IndexLabel) => d.arrayBox.kind === 'TwoDimArrayRowBox'
      ? d.arrayBox.parentDimensions[0] * SVG.cellHeight
      : SVG.cellHeight
    )
    .style('fill', (d: IndexLabel) => d.arrayBox.kind === 'TwoDimArrayBox' ? LAYOUT.indexes.highlightColor.horizontal : LAYOUT.indexes.highlightColor.vertical)
    .style('opacity', d => d.cellIndex < 0 || d.cellIndex >= getArrayLength(d.arrayBox) ? '0' : '1')
}

// returns the array to be used for value copy animations
export function getAnimationArray (arrayAccessValue: ArrayAccessValue, arrayBox: ArrayBox) {
  if (arrayBox.kind === 'TwoDimArrayBox') {
    return arrayBox.childDataStructureGraphNodes[arrayAccessValue.indexValues[arrayAccessValue.indexValues.length - 1]]
  } else {
    return arrayBox
  }
}
