<template>
  <div id="the-sequence-diagram">
    <svg
      id="sequence-diagram-svg"
      width="100%"
      height="100%"
      viewBox="0 0 600 10000"
      preserveAspectRatio="xMidYMin slice">
      <SvgDefinitions />
      <g id="sequence-diagram">
        <g id="life-lines" />
        <g id="boxes" />
        <g id="arrows" />
      </g>
    </svg>
    <NavigationBarWithSettings
      :zoom-in="zoomIn"
      :zoom-out="zoomOut"
      :zoom-reset="zoomReset"
      :settings-button="false"
      :pane-kind="SEQUENCEDIAGRAM" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { select } from 'd3-selection'
import { drawLifeLines, drawArrows, drawBoxes } from '@/components/TheSequenceDiagram/drawing'
import { zoom, zoomIdentity } from 'd3-zoom'
import { HTML, SVG, DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/components/TheSequenceDiagram/constants'
import { removeChildren } from '@/components/DataStructureVisualizations/utils'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import SvgDefinitions from '@/helpers/SvgDefinitions.vue'
import {
  setHiddenArrows,
  isVisible,
  setHiddenLifeLines, sort,
  getActiveTimeIndices,
  updateHiddenLabelsForBoxes,
  pushUnlessIncluded,
  getBoxEnd,
  getLastTimeIdx,
  setHiddenBoxesAfterStepOver,
  isMainBox
} from '@/components/TheSequenceDiagram/data-utils'
import { getCoordinatesOfChange, zoomToChange } from './zooming-utils'
import { SEQUENCEDIAGRAM } from '@/store/PaneVisibilityStore'
import { mapStores } from 'pinia'
import { useGeneralStore } from '@/store/GeneralStore'
import { Elements } from './types'

let transform: any = zoomIdentity // holds the current zoom-state
export default defineComponent({
  name: 'TheSequenceDiagram',
  components: { SvgDefinitions, NavigationBarWithSettings },
  data: function () {
    return {
      svg: select('#sequence-diagram-svg'),
      resizeObserver: null as unknown as ResizeObserver,
      zoomCall: zoom().on('zoom', (event) => {
        transform = event.transform
        select(`#sequence-diagram`).attr('transform', transform)
      }),
      hiddenIntervals: [],
      hiddenLifeLines: [],
      SEQUENCEDIAGRAM
    }
  },
  computed: {
    ...mapStores(useGeneralStore),
    svgWidth () {
      return window.innerWidth * SVG.multiplier
    },
    lifeLines () {
      return this.generalStore.currentTraceData!.lifeLines
    },
    arrows () {
      return this.generalStore.currentTraceData!.arrows
    },
    boxes () {
      return this.generalStore.currentTraceData!.boxes
    },
    timeIdx () {
      return this.generalStore.currentTraceData!.timeIdx
    },
    stateIndex () {
      return this.generalStore.currentTraceData!.stateIndex
    },
    timeIdxStateIdxMap () {
      return this.generalStore.currentTraceData!.timeIdxStateIdxMap
    },
    vmRunning () {
      return this.generalStore.debugger.running
    },
    undoStack () {
      return this.generalStore.debugger!.getUndoStack()
    },
    visitedLines () {
      return this.generalStore.currentTraceData!.visitedLines
    }
  },
  watch: {
    stateIndex: function () {
      const vm = this
      vm.redraw()
    },
    vmRunning: function () {
      const vm = this
      vm.redraw()
    }
  },
  mounted () {
    const vm = this
    vm.svg = select('#sequence-diagram-svg')
    const div = document.getElementById(HTML.ids.parentDiv)
    vm.resizeObserver = new ResizeObserver(() => { // receive notifications when size of element changes
      if (div) {
        const height = div.offsetHeight / div.offsetWidth * vm.svgWidth
        if (height) {
          vm.svg.attr('viewBox', `0 0 ${vm.svgWidth} ${height}`)
        }
      }
    })
    vm.resizeObserver.observe(div as any)
    // delete old visualization
    vm.deleteViz()
    vm.redraw()
  },
  unmounted () {
    const div = document.getElementById(HTML.ids.parentDiv)
    if (div) {
      this.resizeObserver.unobserve(div)
    }
  },
  methods: {
    deleteViz: function () {
      removeChildren(`#${HTML.ids.lifeLines}`)
      removeChildren(`#${HTML.ids.arrows}`)
      removeChildren(`#${HTML.ids.boxes}`)
    },
    getPreviousTimeIndex: function (previousStateIndex: number) {
      let prevTimeIdx = 0
      for (const [timeIdx, mapStateIdx] of this.timeIdxStateIdxMap) {
        if (previousStateIndex === mapStateIdx && timeIdx > prevTimeIdx) {
          prevTimeIdx = timeIdx
        }
      }
      return prevTimeIdx
    },
    getTransition: function () {
      const vm = this
      return vm.svg.transition().duration(TRANSFORMATION.duration)
        .ease(TRANSFORMATION.ease) as any
    },
    redraw () {
      const vm = this
      const elems: Elements = { boxes: this.boxes, arrows: this.arrows, lifeLines: this.lifeLines }

      if (this.lifeLines.length === 1 && this.lifeLines[0].currState === 'expanded') {
        this.hiddenLifeLines = []
      }

      // detect step over
      let activeTimeIndices = getActiveTimeIndices(this.hiddenLifeLines, this.hiddenIntervals, this.timeIdx, elems)
      if (this.boxes.length > 0 && this.boxes[0].currState !== 'collapsed' && this.lifeLines.length > 0 && this.lifeLines[0].currState !== 'collapsed') {
        updateHiddenLabelsForBoxes(this.boxes, activeTimeIndices, this.hiddenLifeLines, this.timeIdx)
        const previousStateIndex = this.undoStack[this.undoStack.length - 1] + 1
        let previousTimeIndex = this.getPreviousTimeIndex(previousStateIndex)
        const stepOverCollapsedBoxes = []
        for (let i = 0; i < this.boxes.length; i++) { // compute stepOverCollapsedBoxes; update active time indices; add hidden intervals; set stepOver flags
          const box = this.boxes[i]
          const boxEnd = getBoxEnd(box, this.timeIdx)
          if (box.callArrow === undefined && box.end) {
            for (let j = 0; j < this.arrows.length; j++) {
              const arrow = this.arrows[j]
              if (
                arrow.kind === 'Constructor' &&
                arrow.to === box.lifeLine &&
                !arrow.isHidden &&
                this.visitedLines.length >= 3 &&
                this.visitedLines.at(-2) === arrow.line &&
                this.visitedLines.at(-3) === arrow.line &&
                !box.stepOver
              ) {
                if (box.currState !== 'hidden' && box.prevState !== 'hidden') {
                  stepOverCollapsedBoxes.push(box)
                  pushUnlessIncluded(this.hiddenIntervals, box)
                  activeTimeIndices = getActiveTimeIndices(
                    this.hiddenLifeLines,
                    this.hiddenIntervals,
                    this.timeIdx,
                    elems
                  )
                  previousTimeIndex = boxEnd + 1
                }
                box.stepOver = true
              }
            }
          }

          const exists = this.arrows.some(arrow => arrow.kind === 'Return' && box.callArrow && arrow.methodCallId === box.callArrow!!.methodCallId)
          if (
            exists &&
            !isMainBox(box) &&
            box.start === previousTimeIndex &&
            previousStateIndex !== this.stateIndex &&
            !box.stepOver &&
            box.start !== this.timeIdx
          ) {
            if (box.currState !== 'hidden' && box.prevState !== 'hidden' && boxEnd - box.start > 1) {
              stepOverCollapsedBoxes.push(box)
              pushUnlessIncluded(this.hiddenIntervals, box)
              activeTimeIndices = getActiveTimeIndices(
                this.hiddenLifeLines,
                this.hiddenIntervals,
                this.timeIdx,
                elems
              )
              previousTimeIndex = boxEnd + 1
            }
            box.stepOver = true
          }
        }

        for (let j = 0; j < stepOverCollapsedBoxes.length; j++) {
          setHiddenBoxesAfterStepOver(this.boxes, stepOverCollapsedBoxes[j], getLastTimeIdx(this.boxes), this.hiddenIntervals, activeTimeIndices)
        }
      }

      updateHiddenLabelsForBoxes(this.boxes, activeTimeIndices, this.hiddenLifeLines, this.timeIdx)
      setHiddenArrows(elems, activeTimeIndices, this.hiddenLifeLines, this.timeIdx)
      setHiddenLifeLines(elems, activeTimeIndices, this.hiddenLifeLines)
      if (this.boxes.length === 1 && activeTimeIndices.length === 3) {
        this.hiddenIntervals = []
      }
      for (let i = 0; i < this.lifeLines.length; i++) {
        const lifeLine = this.lifeLines[i]
        if (lifeLine.currState === 'hidden' && lifeLine.end && !lifeLine.programEnd && activeTimeIndices.includes(lifeLine.end!!)) {
          activeTimeIndices.splice(activeTimeIndices.indexOf(lifeLine.end!!), 1)
        }
      }
      if (this.lifeLines.length > 0 && this.lifeLines[0].currState !== 'collapsed' && this.boxes.length > 0 && this.boxes[0].currState !== 'collapsed') {
        activeTimeIndices = getActiveTimeIndices(this.hiddenLifeLines, this.hiddenIntervals, this.timeIdx, elems)
        updateHiddenLabelsForBoxes(this.boxes, activeTimeIndices, this.hiddenLifeLines, this.timeIdx)
        setHiddenArrows(elems, activeTimeIndices, this.hiddenLifeLines, this.timeIdx)
        setHiddenLifeLines(elems, activeTimeIndices, this.hiddenLifeLines)
      }

      activeTimeIndices = getActiveTimeIndices(this.hiddenLifeLines, this.hiddenIntervals, this.timeIdx, elems)

      if (this.boxes.length > 0 && this.boxes[0].currState === 'collapsed' && this.boxes[0].isDrawn) {
        if (this.lifeLines.length > 0 && this.lifeLines[0].programEnd) {
          activeTimeIndices = [0, 1, 2, this.timeIdx]
        } else {
          if (this.timeIdx !== 2) {
            const end = this.boxes[0].lifeLine.end
            const lastIdx = end ?? this.timeIdx
            activeTimeIndices = [0, 1, 2, lastIdx]
          } else {
            activeTimeIndices = [0, 1, 2]
          }
        }
      } else if (this.lifeLines.length > 0 && this.lifeLines[0].currState === 'collapsed' && this.lifeLines[0].isDrawn) {
        if (this.timeIdx !== 2) {
          activeTimeIndices = [0, 1, 2, this.timeIdx]
        } else {
          activeTimeIndices = [0, 1, 2]
        }
      }
      setHiddenLifeLines(elems, activeTimeIndices, this.hiddenLifeLines)
      for (let i = 0; i < this.arrows.length; i++) { // remove time indices of all hidden arrows
        const arrow = this.arrows[i]
        if (!arrow.isHidden || arrow.time === this.timeIdx || arrow.kind === 'CallMain') {
          continue
        }
        for (let j = 0; j < this.boxes.length; j++) {
          if (!activeTimeIndices.includes(arrow.time!!)) { // arrow already removed
            break
          }
          const box = this.boxes[j]
          const boxEnd = getBoxEnd(box, this.timeIdx)
          if (box.currState === 'collapsed' && box.isDrawn && arrow.time !== boxEnd && arrow.time !== box.start) {
            const found = this.lifeLines.some(lifeLine => isVisible(lifeLine) && lifeLine.start === arrow.time)
            if (!found) activeTimeIndices.splice(activeTimeIndices.indexOf(arrow.time!!), 1)
          }
        }
      }
      for (let i = 0; i < this.lifeLines.length; i++) { // remove time indices for all hidden lifeline start times
        const lifeLine = this.lifeLines[i]
        if (isVisible(lifeLine) || this.lifeLines[0].currState === 'collapsed') {
          continue
        }
        for (let j = 0; j < this.boxes.length; j++) {
          const box = this.boxes[j]
          const startIndex = activeTimeIndices.indexOf(lifeLine.start)
          const boxEnd = getBoxEnd(box, this.timeIdx)
          if (box.currState === 'collapsed' && startIndex >= 0 && box.isDrawn && lifeLine.start !== boxEnd) {
            activeTimeIndices.splice(startIndex, 1)
          }
        }
      }
      for (let i = 0; i < this.boxes.length; i++) {
        const box = this.boxes[i]
        const boxEnd = getBoxEnd(box, this.timeIdx)
        for (let j = box.start; j <= boxEnd; j++) {
          if (!isVisible(box) && activeTimeIndices.includes(j) && i !== 0) {
            activeTimeIndices.splice(activeTimeIndices.indexOf(j), 1)
          }
        }
      }

      for (let i = 0; i < this.boxes.length; i++) {
        const box = this.boxes[i]
        if (box.currState === 'collapsed' && box.isDrawn) {
          pushUnlessIncluded(activeTimeIndices, box.start)
          const boxEnd = getBoxEnd(box, this.timeIdx)
          pushUnlessIncluded(activeTimeIndices, boxEnd)
        }
      }

      pushUnlessIncluded(activeTimeIndices, this.timeIdx)
      sort(activeTimeIndices)

      for (let i = 0; i < this.arrows.length; i++) {
        if (!activeTimeIndices.includes(this.arrows[i].time!!)) {
          this.arrows[i].isHidden = true
        }
      }

      // visualize everything
      drawLifeLines(vm.svg, elems, vm.timeIdx, activeTimeIndices, vm, this.hiddenLifeLines, this.hiddenIntervals)
      drawArrows(vm.svg, elems, activeTimeIndices, this.hiddenLifeLines)
      drawBoxes(vm.svg, elems, vm.timeIdx, this.hiddenIntervals, this.hiddenLifeLines, activeTimeIndices, vm)

      // add ability to zoom and pan
      vm.svg.call(vm.zoomCall as any)

      // get coordinates of change
      const coordinatesOfChange = getCoordinatesOfChange(elems, this.timeIdx, activeTimeIndices)
      if (coordinatesOfChange) {
        // translate zoom to make x and y visible
        zoomToChange(
          coordinatesOfChange[0],
          coordinatesOfChange[1],
          transform,
          vm.zoomCall,
          HTML.ids.parentDiv,
          vm.svgWidth,
          vm.svg
        )
      }
    },
    zoomIn: function () {
      const vm = this
      vm.zoomCall.scaleBy(vm.getTransition(), DEFAULT_ZOOM_FACTOR)
    },
    zoomOut: function () {
      const vm = this
      vm.zoomCall.scaleBy(vm.getTransition(), 1 / DEFAULT_ZOOM_FACTOR)
    },
    zoomReset: function () {
      const vm = this
      vm.zoomCall.transform(vm.getTransition(), zoomIdentity)
    }
  }
})
</script>

<style scoped>
#sequence-diagram-svg {
  min-width: 100%;
  min-height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

#the-sequence-diagram {
  height: 100%;
  position: relative;
}

:deep(#label div) {
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

:deep(#callLabel div), :deep(#self-call-arrow-text div), :deep(#returnLabel div), :deep(#constructor-label div){
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
</style>
