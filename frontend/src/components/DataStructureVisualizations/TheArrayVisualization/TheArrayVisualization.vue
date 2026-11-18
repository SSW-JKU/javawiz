<template>
  <div :id="HTML.ids.parentDiv" :style="cssVariables">
    <div :class="[HTML.classes.indexTest, HTML.classes.textTester]">
      <div :id="HTML.ids.tester.index" />
    </div>
    <div :class="[HTML.classes.textGroup, HTML.classes.textTester]">
      <div :id="HTML.ids.tester.value" :class="HTML.classes.valueText" />
    </div>
    <svg
      :id="HTML.ids.arraySvg"
      width="100%"
      height="100%"
      viewBox="0 0 600 10000"
      preserveAspectRatio="xMidYMin slice">
      <SvgDefinitions />
      <g :id="HTML.ids.arrayViz">
        <g :id="HTML.ids.arrayPointers" />
        <g :id="HTML.ids.arrayIndexes" />
        <g :id="HTML.ids.arrays" />
        <g :id="HTML.ids.tempVariables" />
        <g :id="HTML.ids.arrayWriteAccesses.writeAccesses">
          <g :id="HTML.ids.arrayWriteAccesses.moving" />
          <g :id="HTML.ids.arrayWriteAccesses.static" />
        </g>
      </g>
    </svg>
    <!--suppress MagicNumberJS -->
    <VizSetting
      :zoom-in="() => viewZoom.zoomIn()"
      :zoom-out="() => viewZoom.zoomOut()"
      :zoom-reset="() => viewZoom.reset()"
      :viz-id="visualizationStore.ARRAY.id">
      <div style="margin: auto">
        <label class="no-break"><input v-model="showArgs" :class="HTML.classes.marginButton" type="checkbox">Show Args</label><br>
        <label class="no-break"><input v-model="onlyCurrentStackFrame" :class="HTML.classes.marginButton" type="checkbox">Only current stack frame</label><br>
        <label class="no-break"><input v-model="highlightIndexes" :class="HTML.classes.marginButton" type="checkbox">Highlight indexes</label><br>
      </div>
      <table style="table-layout: fixed; width: 300px">
        <thead>
          <tr>
            <th style="width: 86%;">
              Index Description
            </th>
            <th style="width: 14%; padding-left: 0px; margin-left: 0px">
              <IconWithTooltip
                :tooltip="{ arrow: 'right', placement: 'below' }"
                width="280px"
                :icon="help"
                style="white-space: pre-line; transform: translateX(-3px);"
                class="small-text"
                @action="() => {}">
                <table class="index-examples-table">
                  <thead>
                    <tr>
                      <th>Index</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span class="code">arr[i]</span></td>
                      <td>
                        Display index <span class="code">i</span> <br>
                        at array <span class="code">arr</span>
                      </td>
                    </tr>
                    <tr>
                      <td><span class="code">[i]</span> or <span class="code">*[i]</span></td>
                      <td>
                        Display index <span class="code">i</span> <br>
                        at every array
                      </td>
                    </tr>
                    <tr>
                      <td><span class="code">arr[i][j]</span></td>
                      <td>
                        Display index <span class="code">i</span> for rows <br>
                        and index <span class="code">j</span> for columns <br>
                        at array <span class="code">arr</span>
                      </td>
                    </tr>
                    <tr>
                      <td><span class="code">arr[][j]</span> or <span class="code">arr[*][j]</span></td>
                      <td>Display index <span class="code">j</span> for columns at array <span class="code">arr</span></td>
                    </tr>
                  </tbody>
                </table>
              </IconWithTooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(indexLabelSetting, i) in indexLabelSettings" :key="i">
            <td>
              <input
                v-model="indexLabelSetting.expression"
                style="width: 100%;"
                :disabled="indexLabelSetting.isDetected"
                :title="inputTitle(i)"
                :class="parsedIndexLabelSettings[i].isValid ? '' : 'invalid-input'"
                @change="saveIndexLabelSettings()">
            </td>
            <td>
              <button
                v-if="!indexLabelSetting.isDetected"
                class="index-button"
                @click="indexLabelSettings.splice(indexLabelSettings.indexOf(indexLabelSetting), 1); saveIndexLabelSettings()">
                <img src="../../../assets/icons/array-viz/delete.svg" class="button-svg" alt="delete index">
              </button>
              <button
                v-else
                style="width: 100%; height: 100%"
                class="index-button"
                @click="indexLabelSetting.isHidden = !indexLabelSetting.isHidden; redraw()">
                <img
                  v-if="indexLabelSetting.isHidden"
                  src="../../../assets/icons/array-viz/eye_hidden.svg"
                  class="button-svg"
                  alt="show index">
                <img
                  v-else
                  src="../../../assets/icons/array-viz/eye.svg"
                  class="button-svg"
                  alt="hide index">
              </button>
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <button class="index-button" @click="addIndexLabelSetting">
                <img src="../../../assets/icons/array-viz/add.svg" class="button-svg" alt="add index">
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </VizSetting>
  </div>
</template>

<script setup lang="ts">
import { HTML, LAYOUT, LOCAL_STORAGE } from './constants'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { select } from 'd3-selection'
import { rowYCoordinates } from './state'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import VizSetting from '@/components/VizSetting.vue'
import { getCoordinatesOfChange } from './utils'
import { parseSavedIndexLabelSettings, parseIndexLabelSetting } from './index-processing'
import { animateValueCopies, drawArrayBoxes, drawIndexLabels, drawVariablePointers, drawTemporaryVariableBoxes } from './drawing'
import {
  createArrayBoxesAndVariablePointers,
  createGhostIndexLabelsAndCopyAnimations,
  createIndexLabels,
  createTemporaryVariableBoxes,
  detectArrayAccesses,
  createRowYCoordinates
} from './preprocessing'
import { CSS, SVG } from '../constants'
import { getDataStructureGraph, removeChildren } from '../utils'
import { useVisualizationStore } from '@/store/VisualizationStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { ViewZoom } from '@/helpers/zooming'
import SvgDefinitions from '@/helpers/SvgDefinitions.vue'
import help from '../../../assets/icons/controls/help.svg'

const visualizationStore = useVisualizationStore()

const indexLabelSettings = ref(parseSavedIndexLabelSettings(localStorage.getItem(LOCAL_STORAGE.indexes)))
const showArgs = ref(localStorage.getItem(LOCAL_STORAGE.showArgs) ? localStorage.getItem(LOCAL_STORAGE.showArgs) === 'true' : true)
const onlyCurrentStackFrame = ref(localStorage.getItem(LOCAL_STORAGE.onlyCurrentStackFrame)
  ? localStorage.getItem(LOCAL_STORAGE.onlyCurrentStackFrame) === 'true'
  : false)
const highlightIndexes = ref(localStorage.getItem(LOCAL_STORAGE.highlightIndexes) ? localStorage.getItem(LOCAL_STORAGE.highlightIndexes) === 'true' : false)
const viewZoom = new ViewZoom(`#${HTML.ids.arrayViz}`)
viewZoom.contentLeft = measureContentLeft
const svg = shallowRef(select(`#${HTML.ids.arraySvg}`))

const generalStore = useGeneralStore()
const traceState = computed(() => generalStore.currentTraceData!.processedTraceState)
const firstState = computed(() => generalStore.currentTraceData!.firstTraceState)
const stateIndex = computed(() => generalStore.currentTraceData!.stateIndex)
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
const minCellWidth = SVG.cellHeight * LAYOUT.arrays.cells.widthMultiplier.min
const svgWidth = minCellWidth * (LAYOUT.defaultNumberOrCells + 1) + LAYOUT.xOrigin
const parsedIndexLabelSettings = computed(() => indexLabelSettings.value.map(index => parseIndexLabelSetting(index)))

function inputTitle (i: number) {
  const parsedIndexLabelSetting = parsedIndexLabelSettings.value[i]
  if (!parsedIndexLabelSetting.isValid) return 'invalid'
  return `array name: ${parsedIndexLabelSetting.arrayName}` +
    `\nvariable name(s): ${parsedIndexLabelSetting.variableNames}`
}

function deleteViz () {
  removeChildren(`#${HTML.ids.arrays}`)
  removeChildren(`#${HTML.ids.tempVariables}`)
  removeChildren(`#${HTML.ids.arrayIndexes}`)
  removeChildren(`#${HTML.ids.arrayPointers}`)
  removeChildren(`#${HTML.ids.arrayWriteAccesses.moving}`)
  removeChildren(`#${HTML.ids.arrayWriteAccesses.static}`)
}

function addIndexLabelSetting () {
  indexLabelSettings.value.push({ expression: 'arr[i]', isDetected: false })
  saveIndexLabelSettings()
}
function saveIndexLabelSettings () {
  localStorage.setItem(LOCAL_STORAGE.indexes, JSON.stringify(indexLabelSettings.value.filter(index => !index.isDetected)))
  redraw()
}

/** Left edge of the drawn arrays and pointers in screen pixels, or Infinity while nothing is drawn. */
function measureContentLeft () {
  // Pointer labels are right-aligned inside wide foreignObjects. Measure their
  // actual divs rather than moving the camera for unpainted label padding.
  const content = (svg.value.node() as SVGSVGElement | null)?.querySelector(`#${HTML.ids.arrayViz}`)?.querySelectorAll('rect, line, path, foreignObject > div')
  return Array.from(content ?? [], element => element.getBoundingClientRect())
    .filter(bounds => bounds.width || bounds.height)
    .reduce((left, bounds) => Math.min(left, bounds.left), Infinity)
}

function redraw () {
  // process heap
  const { rootDataStructureGraphNode } = getDataStructureGraph(stateIndex.value, traceState.value, firstState.value, onlyCurrentStackFrame.value)

  // reset detected indexes
  const hiddenIndexLabelSettings = indexLabelSettings.value.filter(index => index.isHidden)
  indexLabelSettings.value = indexLabelSettings.value.filter(index => !index.isDetected)

  // create structures
  const temporaryVariableBoxes = createTemporaryVariableBoxes(
    rootDataStructureGraphNode,
    { traceState: traceState.value, minCellWidth, onlyCurrentStackFrame: onlyCurrentStackFrame.value }
  )
  const { arrayBoxes, variableToArrayPointers } = createArrayBoxesAndVariablePointers(rootDataStructureGraphNode, { showArgs: showArgs.value, minCellWidth })
  rowYCoordinates.value = createRowYCoordinates(variableToArrayPointers, arrayBoxes)
  // find writes
  let { ghostIndexLabelCandidates, copyAnimationGroup, vanishedSourceVariables, changeCoordinates } = createGhostIndexLabelsAndCopyAnimations(
    arrayBoxes,
    temporaryVariableBoxes,
    svg.value.select(`#${HTML.ids.arrayWriteAccesses.writeAccesses}`),
    {traceState: traceState.value}
  )
  // detect indexes and add to settings
  detectArrayAccesses(arrayBoxes, hiddenIndexLabelSettings, { traceState: traceState.value, parsedIndexLabelSettings, indexLabelSettings: indexLabelSettings.value })

  const indexLabels = createIndexLabels(arrayBoxes, rootDataStructureGraphNode, ghostIndexLabelCandidates, { parsedIndexLabelSettings: parsedIndexLabelSettings.value })

  // visualize arrays
  drawTemporaryVariableBoxes(svg.value, temporaryVariableBoxes, vanishedSourceVariables, copyAnimationGroup)
  drawArrayBoxes(svg.value, arrayBoxes)
  drawVariablePointers(svg.value, variableToArrayPointers)
  drawIndexLabels(svg.value, indexLabels)
  animateValueCopies(copyAnimationGroup)

  // search changes
  if (!changeCoordinates) {
    changeCoordinates = getCoordinatesOfChange(variableToArrayPointers, indexLabels)
  }

  // move the view to the change; the first drawing also moves clear of the navigation icons
  if (changeCoordinates) {
    viewZoom.followChange(changeCoordinates[0], changeCoordinates[1], { width: SVG.cellWidth, height: 2 * SVG.cellHeight })
  } else {
    viewZoom.positionClearOfNavigation()
  }
}

watch(stateIndex, () => redraw())
watch(showArgs, () => {
  localStorage.setItem(LOCAL_STORAGE.showArgs, showArgs.value ? 'true' : 'false')
  redraw()
})
watch(onlyCurrentStackFrame, () => {
  localStorage.setItem(LOCAL_STORAGE.onlyCurrentStackFrame, onlyCurrentStackFrame.value ? 'true' : 'false')
  redraw()
})
watch(highlightIndexes, () => {
  localStorage.setItem(LOCAL_STORAGE.highlightIndexes, highlightIndexes.value ? 'true' : 'false')
})

onMounted(() => {
  // selection was empty when component was created, since template was not inserted yet
  svg.value = select(`#${HTML.ids.arraySvg}`)
  viewZoom.attach(svg.value.node() as SVGSVGElement)
  viewZoom.observeViewport(document.getElementById(HTML.ids.parentDiv)!, () => svgWidth, () => {
    // Retry initial positioning with the real viewport; an empty view keeps
    // it pending until a later redraw supplies the first array.
    if (viewZoom.initialPositionPending) redraw()
  })
  deleteViz()
  redraw()
})

onUnmounted(() => {
  viewZoom.detach()
})
</script>

<!--suppress CssUnresolvedCustomProperty -->
<style scoped>
:deep(line), :deep(rect) {
  stroke: black;
  fill: none;
  stroke-linecap: round;
}

:deep(.array-group rect), :deep(.pointer-lines), :deep(.temp-var-group) {
  stroke-width: 0.6pt;
}

:deep(.text-group div), :deep(.pointer-text div), :deep(.index-text div), :deep(.temp-var-text div), :deep(.index-nr div) {
  text-align: center;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.text-group div) {
  font-size: var(--cell-font-size);
}

:deep(.empty-array) {
  font-size: var(--cell-font-size);
  font-family: var(--cell-value-font-family);
  font-weight: var(--cell-value-font-weight);
  font-style: italic;
  text-align: center;
}

:deep(.value-text) {
  font-family: var(--cell-value-font-family);
  font-weight: var(--cell-value-font-weight);
}

:deep(.cell-dividers) {
  stroke-width: 0.35pt;
}

:deep(.changed line), :deep(.changed) {
  color: red;
  stroke: red;
  fill: red;
  font-weight: normal;
}

:deep(.pointer-text div) {
  text-align: right;
  font-size: var(--pointer-font-size);
  font-family: var(--pointer-name-font-family);
  direction: rtl;
  float: right;
}

:deep(.index-text div), :deep(.temp-var-text div)  {
  font-size: var(--pointer-font-size);
  font-family: var(--pointer-name-font-family);
  text-align: left;
}

:deep(.index-text div)  {
  text-align: left;
}

:deep(.temp-var-text div)  {
  text-align: center;
}

:deep(.index-nr div) {
  font-family: var(--pointer-parent-font-family);
  font-size: var(--pointer-parent-font-size);
  font-style: var(--pointer-parent-font-style);
  text-align: center;
}

:deep(.rotated-index div) {
  text-align: left;
}

:deep(.two-dim-index div) {
  margin-left: 15%;
  text-align: left;
  position: relative;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.highlighted-cells) {
  display: v-bind('highlightIndexes ? "block" : "none"');
  stroke: none;
}

:deep(.highlighted-source-cells) {
  stroke: var(--jw-action-blue);
  stroke-width: 0.7pt;
}

:deep(.highlighted-target-cells) {
  stroke: indianred;
  stroke-width: 0.7pt;
}

#array-div {
  position: relative;
  height: 100%;
}

#array-svg {
  min-width: 100%;
  min-height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.margin-button {
  margin: 5pt;
}

.index-button {
  width: 24px;
  height: 24px;
  display: contents;
}

.button-svg {
  width: 24px;
  height: 24px;
  transition: 0.2s;
}

.button-svg:hover {
  transform: scale(1.1);
  cursor: pointer;
}

.text-tester {
  position: absolute;
  visibility: hidden;
  height: auto;
  width: auto;
  white-space: nowrap;
}

.invalid-input {
  color: darkred;
  background-color: #fff0f4;
  border-radius: 2px;
  border-color: var(--jw-medium-gray);
}

.index-examples-table tbody {
  font-weight: normal;
}

.index-examples-table td, .index-examples-table th {
  text-align: center;
  border: 1px solid white;
}

.index-examples-table tr:first-child th {
  border-top: 0;
}

.index-examples-table tr:last-child td {
  border-bottom: 0;
}

.index-examples-table tr th:first-child, .index-examples-table tr td:first-child {
  border-left: 0;
}

.index-examples-table tr th:last-child, .index-examples-table tr td:last-child {
  border-right: 0;
}

.code {
  font-family: var(--font-family-monospace);
}

.small-text {
  font-size: 0.65rem;
}

</style>
