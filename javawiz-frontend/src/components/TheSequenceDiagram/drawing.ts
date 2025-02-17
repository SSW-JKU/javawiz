import { BaseType, Selection } from 'd3-selection'
import { DURATION, FONT_FAMILY, HTML, LAYOUT } from '@/components/TheSequenceDiagram/constants'
import { easeCubic } from 'd3-ease'
import { LifeLine, Box, Elements } from '@/components/TheSequenceDiagram/types'
import { DEFINITIONS } from '@/helpers/SvgDefinitions.vue'
import {
  getCoordsForSelfCallArrow,
  getSecondXBaseForArrow,
  getXBaseForBox,
  getXBaseForArrowText,
  getYCoordsForCross,
  getTextCoordinate,
  getFirstXForArrow,
  getCrossOpacity,
  getXForVerticalLine,
  getXForHorizontal,
  getXForCross,
  getXForBox,
  getXForArrow,
  getXForArrowText,
  getYForArrow,
  getSecondYForVerticalLine,
  getCYForDot,
  getUpdatedHeight,
  getDotOpacity,
  getCXForDot,
  getArrowOpacity,
  getLifeLineOpacity,
  updateDots,
  updateArrows,
  updateLifeLines,
  updateCrosses,
  getXForLabel,
  getX2ForArrow,
  getYForVerticalLine,
  getCoordinatesForLifeLine,
  getCoordinatesForArrow,
  getCoordinatesForBox
} from '@/components/TheSequenceDiagram/drawing-utils'

import { blendInAnimation } from '@/components/DataStructureVisualizations/animations'
import {
  setHiddenBoxes,
  setHiddenArrows,
  setHiddenLifeLines,
  getLastTimeIdx,
  isVisible,
  wasVisible,
  toggleLifeLine,
  getActiveTimeIndices,
  getBoxEnd
} from '@/components/TheSequenceDiagram/data-utils'
import { TRANSFORMATION } from '@/helpers/constants'

/**
 * Draws lifelines for static classes and objects
 * @param svg svg for the visualization
 * @param elems all relevant elements including arrows, boxes and lifelines
 * @param timeIdx current time index in the program execution
 * @param activeTimeIndices all currently active time indices
 * @param vm
 * @param hiddenLifeLines all lifelines that are hidden
 * @param hiddenIntervals all boxes that are hidden
 */
export function drawLifeLines (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  elems: Elements,
  timeIdx: number,
  activeTimeIndices: number[],
  vm: any,
  hiddenLifeLines: LifeLine[],
  hiddenIntervals: Box[]
) {
  svg.select(`#${HTML.ids.lifeLines}`)
    .selectAll('g')
    .data(elems.lifeLines)
    .join(
      e => {
        const group = e.append('g')
          .attr('transform', d => `translate(${[getCoordinatesForLifeLine(d, activeTimeIndices)[0], getCoordinatesForLifeLine(d, activeTimeIndices)[1]]})`) // translate the whole group to (x,y)
          .on('dblclick', (e, d) => {
            e.preventDefault()
            e.stopPropagation()
            toggleLifeLine(elems, d, timeIdx, hiddenIntervals, hiddenLifeLines)
            vm.redraw()
          })
        group.append('line')
          .attr('id', HTML.ids.verticalLine)
          .attr('x1', d => getXForVerticalLine(d, elems.lifeLines))
          .attr('x2', d => getXForVerticalLine(d, elems.lifeLines))
          .attr('y1', d => getYForVerticalLine(d, activeTimeIndices))
          .attr('y2', d => getSecondYForVerticalLine(d, activeTimeIndices, elems.boxes, timeIdx))
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .style('opacity', d => getLifeLineOpacity(d))
        blendInAnimation(group)
        group.append('foreignObject')
          .attr('id', HTML.ids.textLabel)
          .attr('x', d => getXForLabel(d, elems.lifeLines) - 4.5)
          .attr('y', d => getYForVerticalLine(d, activeTimeIndices) - 10)
          .attr('width', d => getXForHorizontal(d, elems.lifeLines)[1] - getXForHorizontal(d, elems.lifeLines)[0] + 9)
          .attr('height', 12)
          .attr('font-size', LAYOUT.text.fontSize)
          .attr('font-family', FONT_FAMILY)
          .attr('font-weight', LAYOUT.text.fontWeight)
          .style('opacity', d => getLifeLineOpacity(d))
          .append('xhtml:div')
          .text(d => d.heapId ? `${d.label} : ${d.className}` : `${d.className}`)
          .attr('title', d => d.heapId ? `${d.label} : ${d.className}` : `${d.className}`)
        group.append('line')
          .attr('id', HTML.ids.horizontalLine)
          .attr('x1', d => getXForHorizontal(d, elems.lifeLines)[0])
          .attr('x2', d => getXForHorizontal(d, elems.lifeLines)[1])
          .attr('y1', d => getYForVerticalLine(d, activeTimeIndices))
          .attr('y2', d => getYForVerticalLine(d, activeTimeIndices))
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.horizontalLine.strokeWidth)
          .style('opacity', d => getLifeLineOpacity(d))
        group.append('line')
          .attr('id', HTML.ids.firstCrossLine)
          .attr('x1', d => getXForCross(d, elems.lifeLines)[0])
          .attr('x2', d => getXForCross(d, elems.lifeLines)[1])
          .attr('y1', d => getYCoordsForCross(d, HTML.ids.firstCrossLine, timeIdx, activeTimeIndices, elems.boxes).y1)
          .attr('y2', d => getYCoordsForCross(d, HTML.ids.firstCrossLine, timeIdx, activeTimeIndices, elems.boxes).y2)
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .style('opacity', d => getCrossOpacity(d, timeIdx))
        group.append('line')
          .attr('id', HTML.ids.secondCrossLine)
          .attr('x1', d => getXForCross(d, elems.lifeLines)[0])
          .attr('x2', d => getXForCross(d, elems.lifeLines)[1])
          .attr('y1', d => getYCoordsForCross(d, HTML.ids.secondCrossLine, timeIdx, activeTimeIndices, elems.boxes).y1)
          .attr('y2', d => getYCoordsForCross(d, HTML.ids.secondCrossLine, timeIdx, activeTimeIndices, elems.boxes).y2)
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .style('opacity', d => getCrossOpacity(d, timeIdx))
        return group
      },
      u => {
        u.interrupt()
          .filter(d => (!wasVisible(d) && isVisible(d)))
          .attr('transform', d => `translate(${[getCoordinatesForLifeLine(d, activeTimeIndices)[0], getCoordinatesForLifeLine(d, activeTimeIndices)[1]]})`)
        u.interrupt()
          .transition()
          .duration(DURATION)
          .ease(easeCubic)
          .style('opacity', '1')
          .attr('transform', d => `translate(${[getCoordinatesForLifeLine(d, activeTimeIndices)[0], getCoordinatesForLifeLine(d, activeTimeIndices)[1]]})`)
        u.on('dblclick', (e, d) => {
          e.preventDefault()
          e.stopPropagation()
          toggleLifeLine(elems, d, timeIdx, hiddenIntervals, hiddenLifeLines)
          vm.redraw()
        })
        updateLifeLines(u, activeTimeIndices, elems.boxes, elems.lifeLines, timeIdx)
        updateCrosses(u, activeTimeIndices, elems.boxes, elems.lifeLines, timeIdx)
        u.filter(d => !isVisible(d))
          .transition()
          .duration(DURATION)
          .ease(easeCubic)
          .style('opacity', d => {
            if (wasVisible(d)) {
              d.prevState = d.currState
              d.wasDrawn = d.isDrawn
            }
            return '0'
          })
        return u
      },
      r => {
        r.transition()
          .duration(DURATION)
          .ease(TRANSFORMATION.ease)
          .style('opacity', d => {
            d.currState = 'expanded'
            d.changed = true
            if (hiddenLifeLines.includes(d)) {
              hiddenLifeLines.splice(hiddenLifeLines.indexOf(d), 1)
            }
            return '0'
          })
          .transition()
          .remove()
      }
    )
}

/**
 * Draws arrows for method calls and return expressions
 * @param svg svg where the arrows should be visualized
 * @param elems all elements that are relevant including arrows, boxes and lifelines
 * @param activeTimeIndices all currently active time indices
 * @param hiddenLifeLines all lifelines that are hidden
 */
export function drawArrows (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  elems: Elements,
  activeTimeIndices: number[],
  hiddenLifeLines: LifeLine[]
) {
  svg.select(`#${HTML.ids.arrows}`)
    .selectAll('g')
    .data(elems.arrows)
    .join(
      e => {
        const group = e.append('g')
          .attr('transform', d => `translate(${[getCoordinatesForArrow(d)[0], getCoordinatesForArrow(d)[1]]})`) // translate the whole group to (x,y)
        // call arrow between diverse lifelines
        group.filter(d => (d.to !== d.from) && (d.kind === 'Call'))
          .append('line')
          .attr('id', HTML.ids.callArrowLine)
          .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, elems.lifeLines))
          .attr('x2', d => getX2ForArrow(getSecondXBaseForArrow(d), d, elems.lifeLines))
          .attr('y1', d => getYForArrow(LAYOUT.arrow.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('y2', d => getYForArrow(LAYOUT.arrow.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .attr('marker-end', `${DEFINITIONS.urls.thinArrow}`)
          .style('opacity', d => getArrowOpacity(d))
        blendInAnimation(group)
        group.filter(d => (d.to !== d.from) && (d.kind === 'Call'))
          .append('foreignObject')
          .attr('id', HTML.ids.callTextLabel)
          .attr('x', d => getXForArrow(getXBaseForArrowText(d), d, elems.lifeLines))
          .attr('y', d => getYForArrow(LAYOUT.arrowText.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) - 1)
          .attr('width', LAYOUT.box.distance - 5)
          .attr('height', 7)
          .attr('font-size', LAYOUT.arrowText.fontSize)
          .attr('font-family', FONT_FAMILY)
          .style('opacity', d => getArrowOpacity(d))
          .append('xhtml:div')
          .text(d => `${d.label}`)
          .attr('title', d => `${d.label}`)
        group.filter(d => (d.to === d.from) && (d.kind === 'Call'))
          .append('line')
          .attr('id', HTML.ids.selfCallArrowLine1)
          .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line1.x1, d, elems.lifeLines))
          .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line1.x2, d, elems.lifeLines))
          .attr('y1', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('y2', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .style('opacity', d => getArrowOpacity(d))
        group.filter(d => (d.to === d.from) && (d.kind === 'Call'))
          .append('line')
          .attr('id', HTML.ids.selfCallArrowLine2)
          .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line2.x1, d, elems.lifeLines))
          .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line2.x2, d, elems.lifeLines))
          .attr('y1', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('y2', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .style('opacity', d => getArrowOpacity(d))
        group.filter(d => (d.to === d.from) && (d.kind === 'Call'))
          .append('line')
          .attr('id', HTML.ids.selfCallArrowLine3)
          .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line3.x1, d, elems.lifeLines))
          .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line3.x2, d, elems.lifeLines))
          .attr('y1', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('y2', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .attr('marker-end', `${DEFINITIONS.urls.thinArrow}`)
          .style('opacity', d => getArrowOpacity(d))
        group.filter(d => (d.to === d.from) && (d.kind === 'Call'))
          .append('foreignObject')
          .attr('id', HTML.ids.selfCallArrowText)
          .attr('x', d => getXForArrow(getTextCoordinate(d), d, elems.lifeLines))
          .attr('y', d => getYForArrow(LAYOUT.arrowText.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) - LAYOUT.text.selfCall)
          .attr('width', LAYOUT.box.distance - 20)
          .attr('height', 7)
          .attr('font-size', LAYOUT.arrowText.fontSize)
          .attr('font-family', FONT_FAMILY)
          .style('opacity', d => getArrowOpacity(d))
          .append('xhtml:div')
          .text(d => `${d.label}`)
          .attr('title', d => `${d.label}`)
        group.filter(d => d.kind === 'Return' && d.to !== d.from)
          .append('line')
          .attr('id', HTML.ids.returnArrowLine)
          .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, elems.lifeLines))
          .attr('y1', d => getYForArrow(LAYOUT.arrow.return.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) + LAYOUT.returnOffset)
          .attr('x2', d => getSecondXBaseForArrow(d))
          .attr('y2', d => getYForArrow(LAYOUT.arrow.return.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) + LAYOUT.returnOffset)
          .attr('stroke', 'black')
          .attr('stroke-dasharray', '6,3')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .attr('marker-end', `${DEFINITIONS.urls.thinArrow}`)
          .style('opacity', d => getArrowOpacity(d))
        group.filter(d => d.kind === 'Return' && d.to !== d.from)
          .append('foreignObject')
          .attr('id', HTML.ids.returnTextLabel)
          .attr('x', d => getXForArrowText(d, elems.lifeLines))
          .attr('y', d => getYForArrow(LAYOUT.arrowText.return.yOffset, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes))
          .attr('width', LAYOUT.box.distance - 22)
          .attr('height', 7)
          .attr('font-size', LAYOUT.arrowText.fontSize)
          .attr('font-family', FONT_FAMILY)
          .style('opacity', d => getArrowOpacity(d))
          .append('xhtml:div')
          .text(d => `${d.label}`)
          .attr('title', d => `${d.label}`)
        group.filter(d => d.kind === 'Constructor' && d.to !== undefined)
          .append('line')
          .attr('id', HTML.ids.constructorLine)
          .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, elems.lifeLines))
          .attr('x2', d => getX2ForArrow(getSecondXBaseForArrow(d), d, elems.lifeLines) - LAYOUT.constructorOffset)
          .attr('y1', d => getYForArrow(LAYOUT.arrow.constructor, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) + LAYOUT.constructorOffset)
          .attr('y2', d => getYForArrow(LAYOUT.arrow.constructor, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) + LAYOUT.constructorOffset)
          .attr('stroke', 'black')
          .attr('stroke-width', LAYOUT.strokeWidth)
          .attr('marker-end', `${DEFINITIONS.urls.thinArrow}`)
          .style('opacity', d => getArrowOpacity(d))
        blendInAnimation(group)
        group.filter(d => d.kind === 'Constructor' && d.to !== undefined)
          .append('foreignObject')
          .attr('id', HTML.ids.constructorLabel)
          .attr('x', d => getXForArrow(getXBaseForArrowText(d), d, elems.lifeLines))
          .attr('y', d => getYForArrow(LAYOUT.arrowText.constructor, activeTimeIndices, d, hiddenLifeLines, elems.arrows, elems.boxes) + LAYOUT.text.constructor)
          .attr('width', LAYOUT.box.distance - 5)
          .attr('height', 7)
          .attr('font-size', LAYOUT.arrowText.fontSize)
          .attr('font-family', FONT_FAMILY)
          .style('opacity', d => {
            const opacity = getArrowOpacity(d)
            if (d.wasHidden!! && !d.isHidden) {
              d.wasHidden = false
            }
            return opacity
          })
          .append('xhtml:div')
          .text(d => `${d.label}`)
          .attr('title', d => `${d.label}`)
        return group
      },
      u => {
        u.interrupt()
          .transition()
          .duration(DURATION)
          .style('opacity', '1')
          .attr('transform', d => `translate(${[getCoordinatesForArrow(d)[0], getCoordinatesForArrow(d)[1]]})`)
        updateArrows(u, activeTimeIndices, hiddenLifeLines, elems)
        u.filter(d => d.isHidden)
          .transition()
          .duration(DURATION)
          .ease(easeCubic)
          .style('opacity', d => {
            if (d.wasHidden === undefined) {
              d.wasHidden = d.isHidden
            }
            return '0'
          })
        return u
      },
      r => {
        r.transition()
          .duration(DURATION)
          .ease(TRANSFORMATION.ease)
          .style('opacity', d => {
            d.changed = true
            d.isHidden = false
            d.wasHidden = false
            return '0'
          })
          .transition()
          .remove()
      }
    )
}

/**
 * Draws boxes for method scopes
 * @param svg svg where the boxes should be visualized
 * @param elems all elements that are relevant including arrows, boxes and lifelines
 * @param timeIdx current time index in the program execution
 * @param hiddenIntervals time intervals that are collapsed and not visible
 * @param hiddenLifeLines all lifelines that are hidden
 * @param activeTimeIndices all currently active time indices
 * @param vm
 */
export function drawBoxes (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  elems: Elements,
  timeIdx: number,
  hiddenIntervals: Box[],
  hiddenLifeLines: LifeLine[],
  activeTimeIndices: number[],
  vm: any) {
  console.assert(activeTimeIndices.includes(timeIdx))
  svg.select(`#${HTML.ids.boxes}`)
    .selectAll('.box')
    .data(elems.boxes)
    .join(
      e => {
        const group = e.append('g')
          .classed('box', true)
          .attr('transform', d => `translate(${[getCoordinatesForBox(d, activeTimeIndices)[0], getCoordinatesForBox(d, activeTimeIndices)[1]]})`)
          .on('dblclick', (e, d) => {
            e.preventDefault()
            e.stopPropagation()
            if (d.currState === 'collapsed') {
              hiddenIntervals.splice(hiddenIntervals.indexOf(d), 1)
            } else {
              if (((d.start !== timeIdx || d === elems.boxes[0]) && getBoxEnd(d, timeIdx) - d.start > 1) || !d.callArrow) {
                hiddenIntervals.push(d)
              }
            }
            const indices = getActiveTimeIndices(hiddenLifeLines, hiddenIntervals, timeIdx, elems)
            setHiddenBoxes(elems.boxes, d, getLastTimeIdx(elems.boxes), hiddenIntervals, indices)
            setHiddenArrows(elems, indices, hiddenLifeLines, timeIdx)
            setHiddenLifeLines(elems, indices, hiddenLifeLines)
            vm.redraw()
          })
        group.append('rect')
          .attr('id', `${HTML.ids.methodCallBox}`)
          .attr('x', d => {
            if (d.currState === 'hidden') {
              return getXBaseForBox(d)
            }
            return getXForBox(d, elems.lifeLines)
          })
          .attr('y', LAYOUT.box.yOffset)
          .attr('width', LAYOUT.box.width)
          .attr('height', d => {
            if (d.currState === 'hidden') {
              return 0
            }
            return getUpdatedHeight(d, activeTimeIndices, timeIdx, hiddenLifeLines, elems)
          })
          .attr('fill', d => d.currState === 'collapsed' && d.isDrawn ? LAYOUT.altBoxColor : LAYOUT.mainBoxColor)
          .attr('stroke-width', LAYOUT.strokeWidth)
          .attr('stroke', 'black')
          .style('opacity', d => (d.currState === 'expanded' || (d.currState === 'collapsed' && d.isDrawn)) ? '1' : '0')
        group.append('circle')
          .attr('id', `${HTML.ids.dot1}`)
          .attr('cx', d => getCXForDot(d, elems.lifeLines))
          .attr('cy', d => getCYForDot(HTML.ids.dot1, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .attr('r', LAYOUT.circle.radius)
          .attr('stroke', LAYOUT.dotColor)
          .attr('stroke-width', LAYOUT.circle.strokeWidth)
          .attr('fill', LAYOUT.dotColor)
          .style('opacity', d => {
            if (d.currState === 'collapsed' && d.isDrawn && d.stepOver) {
              d.prevState = 'collapsed'
              d.wasDrawn = true
            }
            return getDotOpacity(d)
          })
        group.append('circle')
          .attr('id', `${HTML.ids.dot2}`)
          .attr('cx', d => getCXForDot(d, elems.lifeLines))
          .attr('cy', d => getCYForDot(HTML.ids.dot2, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .attr('r', LAYOUT.circle.radius)
          .attr('stroke', LAYOUT.dotColor)
          .attr('stroke-width', LAYOUT.circle.strokeWidth)
          .attr('fill', LAYOUT.dotColor)
          .style('opacity', d => {
            return getDotOpacity(d)
          })
        group.append('circle')
          .attr('id', `${HTML.ids.dot3}`)
          .attr('cx', d => getCXForDot(d, elems.lifeLines))
          .attr('cy', d => getCYForDot(HTML.ids.dot3, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .attr('r', LAYOUT.circle.radius)
          .attr('stroke', LAYOUT.dotColor)
          .attr('stroke-width', LAYOUT.circle.strokeWidth)
          .attr('fill', LAYOUT.dotColor)
          .style('opacity', d => {
            return getDotOpacity(d)
          })
        blendInAnimation(group)
        return group
      },
      u => {
        u.filter(d => !wasVisible(d) && isVisible(d))
          .interrupt()
          .attr('transform', d => `translate(${[getCoordinatesForBox(d, activeTimeIndices)[0], getCoordinatesForBox(d, activeTimeIndices)[1]]})`)
          .transition()
          .duration(DURATION)
          .style('opacity', '1')
        u.filter(d => wasVisible(d) && isVisible(d))
          .interrupt()
          .style('opacity', '1')
          .transition()
          .duration(DURATION)
          .attr('transform', d => `translate(${[getCoordinatesForBox(d, activeTimeIndices)[0], getCoordinatesForBox(d, activeTimeIndices)[1]]})`)
        u.filter(d => wasVisible(d) && !isVisible(d))
          .interrupt()
          .transition()
          .duration(DURATION)
          .style('opacity', '0')
          .transition()
          .duration(DURATION)
          .attr('transform', d => `translate(${[getCoordinatesForBox(d, activeTimeIndices)[0], getCoordinatesForBox(d, activeTimeIndices)[1]]})`)
        u.on('dblclick', (e, d) => {
          e.preventDefault()
          e.stopPropagation()
          if (d.currState === 'collapsed') {
            hiddenIntervals.splice(hiddenIntervals.indexOf(d), 1)
          } else {
            if (((d.start !== timeIdx || d === elems.boxes[0]) && getBoxEnd(d, timeIdx) - d.start > 1) || !d.callArrow) {
              hiddenIntervals.push(d)
            }
          }
          const indices = getActiveTimeIndices(hiddenLifeLines, hiddenIntervals, timeIdx, elems)
          console.assert(activeTimeIndices.includes(timeIdx))
          setHiddenBoxes(elems.boxes, d, getLastTimeIdx(elems.boxes), hiddenIntervals, indices)
          setHiddenArrows(elems, indices, hiddenLifeLines, timeIdx)
          setHiddenLifeLines(elems, indices, hiddenLifeLines)
          vm.redraw()
        })
        u.select(`#${HTML.ids.methodCallBox}`)
          .filter(d => d.currState === 'expanded' && (d.prevState === 'hidden' || (d.prevState === 'collapsed' && !d.wasDrawn)))
          .attr('x', d => getXForBox(d, elems.lifeLines))
          .attr('y', LAYOUT.box.yOffset)
          .attr('height', d => getUpdatedHeight(d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .transition()
          .ease(easeCubic)
          .duration(DURATION)
          .attr('fill', LAYOUT.mainBoxColor)
          .style('opacity', '1')
        u.select(`#${HTML.ids.methodCallBox}`)
          .filter(d => d.currState === 'collapsed' && d.isDrawn && ((d.prevState === 'collapsed' && !d.wasDrawn) || d.prevState === 'hidden'))
          .attr('height', d => getUpdatedHeight(d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .attr('x', d => d.isDrawn ? getXForBox(d, elems.lifeLines) : getXBaseForBox(d))
          .attr('y', LAYOUT.box.yOffset)
          .transition()
          .ease(easeCubic)
          .duration(DURATION)
          .attr('fill', LAYOUT.altBoxColor)
          .style('opacity', '1')
        u.select(`#${HTML.ids.methodCallBox}`)
          .filter(d => d.currState === 'expanded' && wasVisible(d))
          .transition()
          .ease(easeCubic)
          .duration(DURATION)
          .attr('x', d => getXForBox(d, elems.lifeLines))
          .attr('y', LAYOUT.box.yOffset)
          .attr('height', d => getUpdatedHeight(d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .attr('fill', LAYOUT.mainBoxColor)
          .style('opacity', '1')
        u.select(`#${HTML.ids.methodCallBox}`)
          .filter(d => d.currState === 'collapsed' && d.isDrawn && (d.prevState === 'expanded' || (d.prevState === 'collapsed' && d.wasDrawn)))
          .transition()
          .ease(easeCubic)
          .duration(DURATION)
          .attr('height', d => getUpdatedHeight(d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
          .attr('x', d => d.isDrawn ? getXForBox(d, elems.lifeLines) : getXBaseForBox(d))
          .attr('y', LAYOUT.box.yOffset)
          .attr('fill', LAYOUT.altBoxColor)
          .style('opacity', '1')
        u.select(`#${HTML.ids.methodCallBox}`)
          .filter(d => (d.currState === 'collapsed' && !d.isDrawn) || d.currState === 'hidden')
          .transition()
          .ease(easeCubic)
          .duration(DURATION)
          .style('opacity', '0')
          .transition()
          .duration(1)
          .attr('height', 0)
        updateDots(u, activeTimeIndices, elems, timeIdx, hiddenLifeLines)
        return u
      },
      r => {
        r.transition()
          .ease(TRANSFORMATION.ease)
          .duration(DURATION)
          .style('opacity', d => {
            d.stepOver = false
            d.currState = 'expanded'
            d.prevState = 'expanded'
            d.changed = true
            if (hiddenIntervals.includes(d)) {
              hiddenIntervals.splice(hiddenIntervals.indexOf(d), 1)
            }
            return '0'
          })
          .transition()
          .remove()
      }
    )
}
