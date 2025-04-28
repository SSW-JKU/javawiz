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
    <NavigationBarWithSettings
      :zoom-in="zoomIn"
      :zoom-out="zoomOut"
      :zoom-reset="zoomReset"
      :pane-kind="ARRAY">
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
          <tr v-for="(index, i) in indexes" :key="i">
            <td>
              <input
                v-model="index.displayString"
                style="width: 100%;"
                :disabled="index.isDetected"
                :title="inputTitle(i)"
                :class="processedIndexes[i].isValid ? '' : 'invalid-input'"
                @change="saveIndexes()">
            </td>
            <td>
              <button v-if="!index.isDetected" class="index-button" @click="indexes.splice(indexes.indexOf(index), 1); saveIndexes()">
                <img src="../../../assets/icons/array-viz/delete.svg" class="button-svg" alt="delete index">
              </button>
              <button
                v-else
                style="width: 100%; height: 100%"
                class="index-button"
                @click="index.isHidden = !index.isHidden; redraw()">
                <img
                  v-if="index.isHidden"
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
              <button class="index-button" @click="addIndex">
                <img src="../../../assets/icons/array-viz/add.svg" class="button-svg" alt="add index">
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </NavigationBarWithSettings>
  </div>
</template>

<script lang="ts">
import { HTML, LAYOUT, LOCAL_STORAGE } from './constants'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { BaseType, select, Selection } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { SettingsIndex } from './types'
import { getCoordinatesOfChange } from './utils'
import { processIndex } from './index-processing'
import { animateValueCopies, drawArrays, drawIndexes, drawPointers, drawTempVariables } from './drawing'
import {
  createArrayAndPointerStructure,
  createGhostIdxAndTempVarsStruct,
  createIndexesStructure,
  createTempVariablesStructure,
  detectArrayAccesses,
  createLevelCoordinates
} from './preprocessing'
import { CSS, SVG } from '../constants'
import { zoomToChange } from '../zooming'
import { getHeapTree, removeChildren } from '../utils'
import { ARRAY } from '@/store/PaneVisibilityStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/helpers/constants'
import SvgDefinitions from '@/helpers/SvgDefinitions.vue'
import help from '../../../assets/icons/controls/help.svg'

let transform: any = zoomIdentity

const levelCoordinates = ref<number[]>([]) // y offsets of levels
export {
  transform,
  levelCoordinates
}

export default defineComponent({
  name: 'TheArrayVisualization',
  components: { NavigationBarWithSettings, IconWithTooltip, SvgDefinitions },
  setup () {
    const indexes = ref(localStorage.getItem(LOCAL_STORAGE.indexes) ? JSON.parse(localStorage.getItem(LOCAL_STORAGE.indexes)!) as SettingsIndex[] : [] as SettingsIndex[])
    const showArgs = ref(localStorage.getItem(LOCAL_STORAGE.showArgs) ? localStorage.getItem(LOCAL_STORAGE.showArgs) === 'true' : true)
    const onlyCurrentStackFrame = ref(localStorage.getItem(LOCAL_STORAGE.onlyCurrentStackFrame)
      ? localStorage.getItem(LOCAL_STORAGE.onlyCurrentStackFrame) === 'true'
      : false)
    const highlightIndexes = ref(localStorage.getItem(LOCAL_STORAGE.highlightIndexes) ? localStorage.getItem(LOCAL_STORAGE.highlightIndexes) === 'true' : false)
    const resizeObserver = ref<ResizeObserver>(null as any)
    const zoomCall = ref(zoom().on('zoom', (event) => {
      transform = event.transform
      select(`#${HTML.ids.arrayViz}`).attr('transform', transform)
    }))
    const svg = ref(select(`#${HTML.ids.arraySvg}`))

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
    const processedIndexes = computed(() => indexes.value.map(index => processIndex(index)))

    function inputTitle (i: number) {
      const index = processedIndexes.value[i]
      if (!index.isValid) return 'invalid'
      return `array name: ${index.arrayName}` +
        `\nvariable name(s): ${index.variableNames}`
    }

    function deleteViz () {
      removeChildren(`#${HTML.ids.arrays}`)
      removeChildren(`#${HTML.ids.tempVariables}`)
      removeChildren(`#${HTML.ids.arrayIndexes}`)
      removeChildren(`#${HTML.ids.arrayPointers}`)
      removeChildren(`#${HTML.ids.arrayWriteAccesses.moving}`)
      removeChildren(`#${HTML.ids.arrayWriteAccesses.static}`)
    }

    function addIndex () {
      indexes.value.push({ displayString: 'arr[i]', isDetected: false })
      saveIndexes()
    }
    function saveIndexes () {
      localStorage.setItem(LOCAL_STORAGE.indexes, JSON.stringify(indexes.value.filter(index => !index.isDetected)))
      redraw()
    }

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

    function redraw () {
      // process heap
      const { root: heapTree } = getHeapTree(stateIndex.value, traceState.value, firstState.value, onlyCurrentStackFrame.value)

      // reset detected indexes
      const hiddenIndexes = indexes.value.filter(index => index.isHidden)
      indexes.value = indexes.value.filter(index => !index.isDetected)

      // create structures
      const tempVariables = createTempVariablesStructure(heapTree, { traceState: traceState.value, minCellWidth, onlyCurrentStackFrame: onlyCurrentStackFrame.value })
      const { arrays, arrayPointers } = createArrayAndPointerStructure(heapTree, { showArgs: showArgs.value, minCellWidth })
      levelCoordinates.value = createLevelCoordinates(arrayPointers, arrays)
      // find writes
      let { ghostIndexes, copyAnimations, missingSources, changeCoordinates } = createGhostIdxAndTempVarsStruct(
        arrays,
        tempVariables,
        svg.value.select(`#${HTML.ids.arrayWriteAccesses.writeAccesses}`),
        {}
      )
      // detect indexes and add to settings
      detectArrayAccesses(arrays, hiddenIndexes, { traceState: traceState.value, processedIndexes: processedIndexes.value, indexes: indexes.value })

      const indices = createIndexesStructure(arrays, heapTree, ghostIndexes, { processedIndexes: processedIndexes.value })

      // visualize arrays
      drawTempVariables(svg.value, tempVariables, missingSources, copyAnimations)
      drawArrays(svg.value, arrays)
      drawPointers(svg.value, arrayPointers)
      drawIndexes(svg.value, indices)
      animateValueCopies(copyAnimations)

      // add ability to zoom and pan
      svg.value.call(zoomCall.value as any)

      // search changes
      if (!changeCoordinates) {
        changeCoordinates = getCoordinatesOfChange(arrayPointers, indices)
      }

      // zoom to changes
      if (changeCoordinates) {
        zoomToChange(
          changeCoordinates[0],
          changeCoordinates[1],
          transform,
          zoomCall.value,
          HTML.ids.parentDiv,
          svgWidth,
          svg.value as Selection<BaseType, unknown, HTMLElement, any>)
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

      const div = document.getElementById(HTML.ids.parentDiv)
      resizeObserver.value = new ResizeObserver(() => {
        if (div) {
          const height = div.offsetHeight / div.offsetWidth * svgWidth
          if (height) {
            svg.value.attr('viewBox', `0 0 ${svgWidth} ${height}`)
          }
        }
      })
      resizeObserver.value.observe(div!)
      deleteViz()
      redraw()
    })

    return {
      ARRAY,
      inputTitle,
      addIndex,
      zoomIn,
      zoomOut,
      zoomReset,
      cssVariables,
      HTML,
      highlightIndexes,
      indexes,
      processedIndexes,
      saveIndexes,
      redraw,
      showArgs,
      onlyCurrentStackFrame,
      help
    }
  }
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
  stroke: cornflowerblue;
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
  border-color: gray;
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
