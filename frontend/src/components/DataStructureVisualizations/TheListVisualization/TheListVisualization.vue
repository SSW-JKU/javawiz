<template>
  <div :id="HTML.ids.parentDiv" :style="cssVariables">
    <div v-if="visualizationMessage" :id="HTML.ids.fieldNotFound" class="pane-default-text" style="color: red">
      {{ visualizationMessage }}
    </div>
    <svg
      :id="HTML.ids.listSvg"
      width="100%"
      height="100%"
      viewBox="0 0 600 10000"
      preserveAspectRatio="xMidYMin slice">
      <SvgDefinitions />
      <g :id="HTML.ids.list">
        <g :id="HTML.ids.listNodes" />
        <g :id="HTML.ids.nextPointers" />
        <g :id="HTML.ids.nodePointers" />
      </g>
    </svg>
    <VizSetting
      :zoom-in="() => viewZoom.zoomIn()"
      :zoom-out="() => viewZoom.zoomOut()"
      :zoom-reset="() => viewZoom.reset()"
      :viz-id="visualizationStore.LINKEDLIST.id">
      <ClassCheckboxGroup
        id-prefix="list-wrapper-class"
        :classes="compiledClasses"
        label="List classes:"
        :model-value="selectedListClassNames"
        @update:model-value="updateListClassNames" />
      <ClassCheckboxGroup
        id-prefix="list-node-class"
        :classes="compiledClasses"
        label="Node classes:"
        :model-value="selectedNodeClassNames"
        @update:model-value="updateNodeClassNames" />
      Name of next pointer: <br>
      <input v-model="nextName" class="text-input" placeholder="Enter name of next pointer ..."> <br>
      Name of value field: <br>
      <input v-model="valName" class="text-input" placeholder="Enter name of value field ..."> <br>
      <p class="no-break">
        <small><b>General settings:</b></small> <br>
        Name of previous variable:
      </p>
      <input v-model="prevName" class="text-input" placeholder="Enter name of previous variable ..."> <br>
    </VizSetting>
  </div>
</template>

<script setup lang="ts">
import { BaseType, select, Selection } from 'd3-selection'
import 'd3-transition'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { rowYCoordinates, setRowYCoordinates } from './state'
import VizSetting from '@/components/VizSetting.vue'
import ClassCheckboxGroup from '../ClassCheckboxGroup.vue'
import SvgDefinitions from '@/helpers/SvgDefinitions.vue'
import { HTML, LAYOUT, LOCAL_STORAGE } from './constants'
import { drawNextFieldPointers, drawListNodeBoxes, drawVariablePointers, drawValueObjectBoxes } from './drawing'
import { processChildren, createListNodeBoxesAndNextFieldPointers, createVariablePointers } from './preprocessing'
import { getCoordinatesOfChange } from './node-utils'
import { CSS, SVG } from '../constants'
import { getDataStructureGraph, removeChildren } from '../utils'
import { reconcileClassSelections } from '../classSelection'
import { findMissingFieldsByClass, formatMissingFields, getNodesOfTypes } from '../preprocessing-utils'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'
import { useVisualizationStore } from '@/store/VisualizationStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { ViewZoom } from '@/helpers/zooming'

const visualizationStore = useVisualizationStore()

const nextName = ref(localStorage.getItem(LOCAL_STORAGE.nextName) || 'next')
const valName = ref(localStorage.getItem(LOCAL_STORAGE.valName) || 'val')
const prevName = ref(localStorage.getItem(LOCAL_STORAGE.prevName) || 'prev')
const viewZoom = new ViewZoom(`#${HTML.ids.list}`)
const selectedListClassNames = ref<string[]>([])
const selectedNodeClassNames = ref<string[]>([])
const selectedListClassNameSet = computed<ReadonlySet<string>>(() => new Set(selectedListClassNames.value))
const selectedNodeClassNameSet = computed<ReadonlySet<string>>(() => new Set(selectedNodeClassNames.value))
const fieldValidationMessage = ref('')
const visualizationMessage = computed(() => {
  // Node classes alone are enough, e.g. for nodes linked by hand without a list class. List classes alone
  // are not: a list cannot be drawn without its nodes.
  if (selectedNodeClassNames.value.length === 0) {
    return 'Select at least one node class and/or one list class in the settings.'
  }
  return fieldValidationMessage.value
})
const svg = shallowRef(select(`#${HTML.ids.listSvg}`))
const hoveredInfos = ref([] as HoverInfo[])

const generalStore = useGeneralStore()
const compiledClasses = generalStore.debugger.getCompiledClasses()
const traceState = computed(() => generalStore.currentTraceData?.processedTraceState)
const firstState = computed(() => generalStore.currentTraceData!.firstTraceState)
const stateIndex = computed(() => generalStore.currentTraceData?.stateIndex ?? 0)
let isMounted = false
const cssVariables = {
  '--cell-font-size': CSS.cell.fontSize + 'px',
  '--cell-name-font-family': CSS.cell.name.fontFamily,
  '--cell-name-font-weight': CSS.cell.name.fontWeight,
  '--cell-value-font-family': CSS.cell.value.fontFamily,
  '--cell-value-font-weight': CSS.cell.value.fontWeight,
  '--pointer-font-size': CSS.pointer.fontSize + 'px',
  '--pointer-parent-font-size': CSS.pointer.parent.fontSize + 'px',
  '--pointer-parent-font-style': CSS.pointer.parent.fontStyle,
  '--pointer-parent-font-family': CSS.pointer.parent.fontFamily,
  '--pointer-name-font-family': CSS.pointer.name.fontFamily

}
const svgWidth = SVG.cellWidth * ((LAYOUT.defaultNumberOfNodes + 2) * LAYOUT.nodes.distances.multiplier + LAYOUT.nodes.distances.constant)

function onHover (hoverInfos: HoverInfo[]) {
  hoveredInfos.value = hoverInfos
  redraw(hoveredInfos.value)
}
function deleteViz () {
  removeChildren(`#${HTML.ids.listNodes}`)
  removeChildren(`#${HTML.ids.nextPointers}`)
  removeChildren(`#${HTML.ids.nodePointers}`)
}

function redraw (hoveredInfos: HoverInfo[]) {
  const { rootDataStructureGraphNode, heapContentDataStructureGraphNodes } = getDataStructureGraph(stateIndex.value, traceState.value, firstState.value, undefined)

  // get lists
  const lists = getNodesOfTypes(heapContentDataStructureGraphNodes, selectedListClassNameSet.value)

  // create data-structure for list node boxes and next field pointers
  setRowYCoordinates([LAYOUT.nodes.yOrigin])
  const { listNodeBoxes, variableDataStructureGraphNodes, nextFieldPointers, valueObjectBoxes } = createListNodeBoxesAndNextFieldPointers(
    rootDataStructureGraphNode, lists, rowYCoordinates,
    { nodeClassNames: selectedNodeClassNameSet.value, nextName: nextName.value, valName: valName.value }
  )
  // create the pointers of variables that reference a list node
  const _svg = svg.value as Selection<BaseType, unknown, HTMLElement, any>
  const variableToListNodePointers = createVariablePointers(_svg, listNodeBoxes, variableDataStructureGraphNodes, lists, {
    prevName: prevName.value, nodeClassNames: selectedNodeClassNameSet.value
  })

  const missingFields = findMissingFieldsByClass(
    listNodeBoxes.flatMap(listNodeBox => listNodeBox.dataStructureGraphNode ? [listNodeBox.dataStructureGraphNode] : []),
    [nextName.value, valName.value]
  )
  fieldValidationMessage.value = formatMissingFields(missingFields)
  if (fieldValidationMessage.value) {
    deleteViz()
    return
  }

  processChildren(listNodeBoxes, { valName: valName.value, nextName: nextName.value })
  processChildren(valueObjectBoxes)

  // visualize everything
  drawListNodeBoxes(_svg, listNodeBoxes, { valName: valName.value, nextName: nextName.value }, hoveredInfos)
  drawValueObjectBoxes(_svg, valueObjectBoxes, hoveredInfos)
  drawNextFieldPointers(_svg, nextFieldPointers, hoveredInfos)
  drawVariablePointers(_svg, variableToListNodePointers, hoveredInfos)

  // get coordinate of first change
  const { x, y } = getCoordinatesOfChange(variableToListNodePointers, nextFieldPointers)

  // move the view, so x and y are visible
  viewZoom.followChange(x, y, { width: SVG.cellWidth, height: 2 * SVG.cellHeight })
}

/** Applies a manual wrapper-class selection and redraws the mounted visualization. */
function updateListClassNames (classNames: string[]) {
  selectedListClassNames.value = classNames
  if (isMounted) {
    redraw(hoveredInfos.value)
  }
}

/** Applies a manual node-class selection and redraws the mounted visualization. */
function updateNodeClassNames (classNames: string[]) {
  selectedNodeClassNames.value = classNames
  if (isMounted) {
    redraw(hoveredInfos.value)
  }
}

watch(stateIndex, () => redraw(hoveredInfos.value))
watch(nextName, () => {
  localStorage.setItem(LOCAL_STORAGE.nextName, nextName.value)
  redraw(hoveredInfos.value)
})
watch(valName, () => {
  localStorage.setItem(LOCAL_STORAGE.valName, valName.value)
  redraw(hoveredInfos.value)
})
watch(prevName, () => {
  localStorage.setItem(LOCAL_STORAGE.prevName, prevName.value)
  redraw(hoveredInfos.value)
})
watch(compiledClasses, (classes) => {
  // Reconcile only on compilation changes so a manually cleared group stays empty.
  selectedListClassNames.value = reconcileClassSelections(selectedListClassNames.value, classes, 'list')
  selectedNodeClassNames.value = reconcileClassSelections(selectedNodeClassNames.value, classes, 'node')

  if (isMounted) {
    redraw(hoveredInfos.value)
  }
}, { immediate: true })

onMounted(() => {
  isMounted = true
  // selection was empty when component was created, since template was not inserted yet
  svg.value = select(`#${HTML.ids.listSvg}`)
  viewZoom.attach(svg.value.node() as SVGSVGElement)

  HoverSynchronizer.onHover(onHover)

  viewZoom.observeViewport(document.getElementById(HTML.ids.parentDiv)!, () => svgWidth)
  // delete old visualization
  deleteViz()
  redraw(hoveredInfos.value)
  // TODO: find out why second redraw is needed (list is not drawn otherwise)
  redraw(hoveredInfos.value)
})
onUnmounted(() => {
  isMounted = false
  viewZoom.detach()
  HoverSynchronizer.removeOnHover(onHover)
})
</script>

<style scoped>
:deep(text) {
  font-size: x-small;
  text-anchor: middle;
  alignment-baseline: middle;
}

:deep(line), :deep(rect) {
  stroke: black;
  fill: none;
  stroke-linecap: round;
}

:deep(.text-group div), :deep(.pointer-text div) {
  text-align: center;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.text-group div) {
  font-size: var(--cell-font-size);
}

:deep(.pointer-text div) {
  font-size: var(--pointer-font-size);
}

:deep(.pointer-parent div) {
  font-family: var(--pointer-parent-font-family);
  font-size: var(--pointer-parent-font-size);
  font-style: var(--pointer-parent-font-style);
}

:deep(.changed line), :deep(.changed) {
  color: red;
  stroke: red;
  fill: red;
  font-weight: normal;
}

:deep(.changed text) {
  stroke: none;
}

:deep(.changed rect) {
  stroke: red;
}

:deep(.pointer-name) {
  font-family: var(--pointer-name-font-family);
}

:deep(.field-text) {
  font-family: var(--cell-name-font-family);
  font-weight: var(--cell-name-font-weight);
}

:deep(.value-text) {
  font-family: var(--cell-value-font-family);
  font-weight: var(--cell-value-font-weight);
}

#list-div {
  position: relative;
  height: 100%;
}

#list-field-not-found {
  transform: translateX(35px);
}

#list-svg {
  min-width: 100%;
  min-height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.text-input {
  width: 100%;
}

p {
  padding: 0px;
  margin: 0px;
}

:deep(.highlighted) {
  fill: var(--jw-object-hover);
}

:deep(.highlighted-ref rect) {
  fill: var(--jw-referenced-object-hover);
}

:deep(.highlighted-pointer), :deep(.highlighted-pointer line) {
  stroke: var(--jw-object-accent);
  color: var(--jw-object-accent);
}
</style>
