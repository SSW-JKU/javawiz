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
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
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
import { useGeneralStore } from '@/store/GeneralStore'
import { Box, Elements, LifeLine } from './types'
import { HoverInfo } from '@/hover/types'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { ProcessedTraceState } from '@/dto/TraceState'
import { fromProcessedTraceState } from '@/components/TheHeapVisualization/mapping'

let transform: any = zoomIdentity // holds the current zoom-state
export default defineComponent({
  name: 'TheSequenceDiagram',
  components: { SvgDefinitions, NavigationBarWithSettings },
  setup () {
    const svg = ref(select('#sequence-diagram-svg'))
    const resizeObserver = ref<ResizeObserver>()
    const zoomCall = ref(zoom().on('zoom', (event) => {
      transform = event.transform
      select(`#sequence-diagram`).attr('transform', transform)
    }))
    const hiddenIntervals = ref<Box[]>([])
    const hiddenLifeLines = ref<LifeLine[]>([])
    const hoveredInfos = ref([] as HoverInfo[])

    const generalStore = useGeneralStore()
    const svgWidth = computed(() => window.innerWidth * SVG.multiplier)
    const lifeLines = computed(() => generalStore.currentTraceData!.lifeLines)
    const arrows = computed(() => generalStore.currentTraceData!.arrows)
    const boxes = computed(() => generalStore.currentTraceData!.boxes)
    const timeIdx = computed(() => generalStore.currentTraceData!.timeIdx)
    const stateIndex = computed(() => generalStore.currentTraceData!.stateIndex)
    const timeIdxStateIdxMap = computed(() => generalStore.currentTraceData!.timeIdxStateIdxMap)
    const vmRunning = computed(() => generalStore.debugger.running)
    const undoStack = computed(() => generalStore.debugger.getUndoStack())
    const visitedLines = computed(() => generalStore.currentTraceData!.visitedLines)
    const currentHeapVizTraceState = computed(() => {
      /*  we want to use processedTrace to access the already computed changed-flag for highlighting changed elements,
       *  but it's only available after the first step, so the first state still has to come from the original trace
       *  (because we want to display static fields, args etc. _before_ the first step)
      */
      if (generalStore.currentTraceData?.processedTraceState) {
        return fromProcessedTraceState(generalStore.currentTraceData?.processedTraceState)
      }
      const first = generalStore.currentTraceData!.firstTraceState
      const processedState: ProcessedTraceState = {
        kind: 'ProcessedTraceState',
        localUri: first.sourceFileUri,
        line: first.line,
        heapBeforeExecution: first.heap,
        stackBeforeExecution: first.stack,
        loadedClassesBeforeExecution: first.loadedClasses,
        stateIndex: 0,
        heapAfterExecution: first.heap,
        stackAfterExecution: first.stack,
        loadedClassesAfterExecution: first.loadedClasses
      }

      processedState.stackAfterExecution!.flatMap(frame => frame.localVariables).forEach(lv => {
        lv.changed = true
      })
      processedState.loadedClassesAfterExecution!.flatMap(clazz => clazz.staticFields).forEach(sf => {
        sf.changed = true
      })

      return fromProcessedTraceState(processedState)
    })

    function getPreviousTimeIndex (previousStateIndex: number) {
      let prevTimeIdx = 0
      for (const [timeIdx, mapStateIdx] of timeIdxStateIdxMap.value) {
        if (previousStateIndex === mapStateIdx && timeIdx > prevTimeIdx) {
          prevTimeIdx = timeIdx
        }
      }
      return prevTimeIdx
    }

    function onHover (hoverInfos: HoverInfo[]) {
      hoveredInfos.value = hoverInfos
      redraw(hoveredInfos.value)
    }

    function redraw (hoveredInfos: HoverInfo[] = []) {
      const elems: Elements = { boxes: boxes.value, arrows: arrows.value, lifeLines: lifeLines.value }

      if (lifeLines.value.length === 1 && lifeLines.value[0].currState === 'expanded') {
        hiddenLifeLines.value = []
      }

      // detect step over
      let activeTimeIndices = getActiveTimeIndices(hiddenLifeLines.value, hiddenIntervals.value, timeIdx.value, elems)
      if (boxes.value.length > 0 && boxes.value[0].currState !== 'collapsed' && lifeLines.value.length > 0 && lifeLines.value[0].currState !== 'collapsed') {
        updateHiddenLabelsForBoxes(boxes.value, activeTimeIndices, hiddenLifeLines.value, timeIdx.value)
        const previousStateIndex = undoStack.value[undoStack.value.length - 1] + 1
        let previousTimeIndex = getPreviousTimeIndex(previousStateIndex)
        const stepOverCollapsedBoxes = []
        for (let i = 0; i < boxes.value.length; i++) { // compute stepOverCollapsedBoxes; update active time indices; add hidden intervals; set stepOver flags
          const box = boxes.value[i]
          const boxEnd = getBoxEnd(box, timeIdx.value)
          if (box.callArrow === undefined && box.end) {
            for (let j = 0; j < arrows.value.length; j++) {
              const arrow = arrows.value[j]
              if (
                arrow.kind === 'Constructor' &&
                arrow.to === box.lifeLine &&
                !arrow.isHidden &&
                visitedLines.value.length >= 3 &&
                visitedLines.value.at(-2) === arrow.line &&
                visitedLines.value.at(-3) === arrow.line &&
                !box.stepOver
              ) {
                if (box.currState !== 'hidden' && box.prevState !== 'hidden') {
                  stepOverCollapsedBoxes.push(box)
                  pushUnlessIncluded(hiddenIntervals.value, box)
                  activeTimeIndices = getActiveTimeIndices(
                    hiddenLifeLines.value,
                    hiddenIntervals.value,
                    timeIdx.value,
                    elems
                  )
                  previousTimeIndex = boxEnd + 1
                }
                box.stepOver = true
              }
            }
          }

          // eslint-disable-next-line vue/max-len
          const exists = arrows.value.some((arrow: { kind: string; methodCallId: any }) => arrow.kind === 'Return' && box.callArrow && arrow.methodCallId === box.callArrow!.methodCallId)
          if (
            exists &&
            !isMainBox(box) &&
            box.start === previousTimeIndex &&
            previousStateIndex !== stateIndex.value &&
            !box.stepOver &&
            box.start !== timeIdx.value
          ) {
            if (box.currState !== 'hidden' && box.prevState !== 'hidden' && boxEnd - box.start > 1) {
              stepOverCollapsedBoxes.push(box)
              pushUnlessIncluded(hiddenIntervals.value, box)
              activeTimeIndices = getActiveTimeIndices(
                hiddenLifeLines.value,
                hiddenIntervals.value,
                timeIdx.value,
                elems
              )
              previousTimeIndex = boxEnd + 1
            }
            box.stepOver = true
          }
        }

        for (let j = 0; j < stepOverCollapsedBoxes.length; j++) {
          setHiddenBoxesAfterStepOver(boxes.value, stepOverCollapsedBoxes[j], getLastTimeIdx(boxes.value), hiddenIntervals.value, activeTimeIndices)
        }
      }

      updateHiddenLabelsForBoxes(boxes.value, activeTimeIndices, hiddenLifeLines.value, timeIdx.value)
      setHiddenArrows(elems, activeTimeIndices, hiddenLifeLines.value, timeIdx.value)
      setHiddenLifeLines(elems, activeTimeIndices, hiddenLifeLines.value)
      if (boxes.value.length === 1 && activeTimeIndices.length === 3) {
        hiddenIntervals.value = []
      }
      for (let i = 0; i < lifeLines.value.length; i++) {
        const lifeLine = lifeLines.value[i]
        if (lifeLine.currState === 'hidden' && lifeLine.end && !lifeLine.programEnd && activeTimeIndices.includes(lifeLine.end!)) {
          activeTimeIndices.splice(activeTimeIndices.indexOf(lifeLine.end!), 1)
        }
      }
      if (lifeLines.value.length > 0 && lifeLines.value[0].currState !== 'collapsed' && boxes.value.length > 0 && boxes.value[0].currState !== 'collapsed') {
        activeTimeIndices = getActiveTimeIndices(hiddenLifeLines.value, hiddenIntervals.value, timeIdx.value, elems)
        updateHiddenLabelsForBoxes(boxes.value, activeTimeIndices, hiddenLifeLines.value, timeIdx.value)
        setHiddenArrows(elems, activeTimeIndices, hiddenLifeLines.value, timeIdx.value)
        setHiddenLifeLines(elems, activeTimeIndices, hiddenLifeLines.value)
      }

      activeTimeIndices = getActiveTimeIndices(hiddenLifeLines.value, hiddenIntervals.value, timeIdx.value, elems)

      if (boxes.value.length > 0 && boxes.value[0].currState === 'collapsed' && boxes.value[0].isDrawn) {
        if (lifeLines.value.length > 0 && lifeLines.value[0].programEnd) {
          activeTimeIndices = [0, 1, 2, timeIdx.value]
        } else {
          if (timeIdx.value !== 2) {
            const end = boxes.value[0].lifeLine.end
            const lastIdx = end ?? timeIdx.value
            activeTimeIndices = [0, 1, 2, lastIdx]
          } else {
            activeTimeIndices = [0, 1, 2]
          }
        }
      } else if (lifeLines.value.length > 0 && lifeLines.value[0].currState === 'collapsed' && lifeLines.value[0].isDrawn) {
        if (timeIdx.value !== 2) {
          activeTimeIndices = [0, 1, 2, timeIdx.value]
        } else {
          activeTimeIndices = [0, 1, 2]
        }
      }
      setHiddenLifeLines(elems, activeTimeIndices, hiddenLifeLines.value)
      for (let i = 0; i < arrows.value.length; i++) { // remove time indices of all hidden arrows
        const arrow = arrows.value[i]
        if (!arrow.isHidden || arrow.time === timeIdx.value || arrow.kind === 'CallMain') {
          continue
        }
        for (let j = 0; j < boxes.value.length; j++) {
          if (!activeTimeIndices.includes(arrow.time!)) { // arrow already removed
            break
          }
          const box = boxes.value[j]
          const boxEnd = getBoxEnd(box, timeIdx.value)
          if (box.currState === 'collapsed' && box.isDrawn && arrow.time !== boxEnd && arrow.time !== box.start) {
            const found = lifeLines.value.some((lifeLine: Box | LifeLine) => isVisible(lifeLine) && lifeLine.start === arrow.time)
            if (!found) activeTimeIndices.splice(activeTimeIndices.indexOf(arrow.time!), 1)
          }
        }
      }
      for (let i = 0; i < lifeLines.value.length; i++) { // remove time indices for all hidden lifeline start times
        const lifeLine = lifeLines.value[i]
        if (isVisible(lifeLine) || lifeLines.value[0].currState === 'collapsed') {
          continue
        }
        for (let j = 0; j < boxes.value.length; j++) {
          const box = boxes.value[j]
          const startIndex = activeTimeIndices.indexOf(lifeLine.start)
          const boxEnd = getBoxEnd(box, timeIdx.value)
          if (box.currState === 'collapsed' && startIndex >= 0 && box.isDrawn && lifeLine.start !== boxEnd) {
            activeTimeIndices.splice(startIndex, 1)
          }
        }
      }
      for (let i = 0; i < boxes.value.length; i++) {
        const box = boxes.value[i]
        const boxEnd = getBoxEnd(box, timeIdx.value)
        for (let j = box.start; j <= boxEnd; j++) {
          if (!isVisible(box) && activeTimeIndices.includes(j) && i !== 0) {
            activeTimeIndices.splice(activeTimeIndices.indexOf(j), 1)
          }
        }
      }

      for (let i = 0; i < boxes.value.length; i++) {
        const box = boxes.value[i]
        if (box.currState === 'collapsed' && box.isDrawn) {
          pushUnlessIncluded(activeTimeIndices, box.start)
          const boxEnd = getBoxEnd(box, timeIdx.value)
          pushUnlessIncluded(activeTimeIndices, boxEnd)
        }
      }

      pushUnlessIncluded(activeTimeIndices, timeIdx.value)
      sort(activeTimeIndices)

      for (let i = 0; i < arrows.value.length; i++) {
        if (!activeTimeIndices.includes(arrows.value[i].time!)) {
          arrows.value[i].isHidden = true
        }
      }

      // visualize everything
      drawLifeLines(svg.value, elems, timeIdx.value, activeTimeIndices, { redraw }, hiddenLifeLines.value, hiddenIntervals.value, hoveredInfos, currentHeapVizTraceState.value)
      drawArrows(svg.value, elems, activeTimeIndices, hiddenLifeLines.value, hoveredInfos, timeIdx.value, currentHeapVizTraceState.value)
      drawBoxes(svg.value, elems, timeIdx.value, hiddenIntervals.value, hiddenLifeLines.value, activeTimeIndices, { redraw }, hoveredInfos, currentHeapVizTraceState.value)

      // add ability to zoom and pan
      svg.value.call(zoomCall.value as any)

      // get coordinates of change
      const coordinatesOfChange = getCoordinatesOfChange(elems, timeIdx.value, activeTimeIndices)
      if (coordinatesOfChange) {
        // translate zoom to make x and y visible
        zoomToChange(
          coordinatesOfChange[0],
          coordinatesOfChange[1],
          transform,
          zoomCall.value,
          HTML.ids.parentDiv,
          svgWidth.value,
          svg.value
        )
      }
    }
    function deleteViz () {
      removeChildren(`#${HTML.ids.lifeLines}`)
      removeChildren(`#${HTML.ids.arrows}`)
      removeChildren(`#${HTML.ids.boxes}`)
    }
    onMounted(() => {
      svg.value = select('#sequence-diagram-svg')
      HoverSynchronizer.onHover(onHover)
      const div = document.getElementById(HTML.ids.parentDiv)
      resizeObserver.value = new ResizeObserver(() => { // receive notifications when size of element changes
        if (div) {
          const height = div.offsetHeight / div.offsetWidth * svgWidth.value
          if (height) {
            svg.value.attr('viewBox', `0 0 ${svgWidth.value} ${height}`)
          }
        }
      })
      resizeObserver.value.observe(div as any)
      // delete old visualization
      deleteViz()
      redraw(hoveredInfos.value)
    })
    onUnmounted(() => {
      const div = document.getElementById(HTML.ids.parentDiv)
      if (div) {
        resizeObserver.value?.unobserve(div)
      }
      HoverSynchronizer.removeOnHover(onHover)
    })

    // TODO: local storage ?
    watch(stateIndex, () => redraw(hoveredInfos.value))
    watch(vmRunning, () => redraw(hoveredInfos.value))
    watch(lifeLines, () => redraw(hoveredInfos.value))
    watch(arrows, () => redraw(hoveredInfos.value))
    watch(boxes, () => redraw(hoveredInfos.value))

    function getTransition () {
      return svg.value.transition().duration(TRANSFORMATION.duration)
        .ease(TRANSFORMATION.ease) as any
    }
    function zoomIn () {
      zoomCall.value.scaleBy(getTransition(), DEFAULT_ZOOM_FACTOR)
    }
    function zoomOut () {
      zoomCall.value.scaleBy(getTransition(), 1 / DEFAULT_ZOOM_FACTOR)
    }
    function zoomReset () {
      zoomCall.value.transform(getTransition(), zoomIdentity)
    }
    return {
      SEQUENCEDIAGRAM, zoomIn, zoomOut, zoomReset, lifeLines, arrows, boxes, redraw
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

:deep(.highlighted-box rect) {
  fill: #ffe9d8;
}

:deep(.highlighted-box circle) {
  fill: #c9b7a9;
  stroke: #c9b7a9;
}

:deep(.highlighted-arrow), :deep(.highlighted-arrow line) {
  stroke: #eda167;
  color: #eda167;
}

:deep(.highlighted-ref-arrow), :deep(.highlighted-ref-arrow line) {
  stroke: #a1c79d;
  color: #a1c79d;
}

:deep(.highlighted-lifeline), :deep(.highlighted-lifeline line) {
  color: #eda167;
  stroke: #eda167;
}

</style>
