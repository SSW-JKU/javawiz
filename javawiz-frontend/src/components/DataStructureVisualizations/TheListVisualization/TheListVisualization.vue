<template>
  <div :id="HTML.ids.parentDiv" :style="cssVariables">
    <div :id="HTML.ids.fieldNotFound" class="pane-default-text" style="color: red; display: none">
      The nodes do not contain the given fields. Please check the names of the next pointer and the value field in settings.
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
    <NavigationBarWithSettings
      :zoom-in="zoomIn"
      :zoom-out="zoomOut"
      :zoom-reset="zoomReset"
      :pane-kind="LINKEDLIST">
      <p class="no-break">
        <small><b>List settings:</b></small><br>
        Name of list class:
      </p>
      <select v-model="listClassName" class="class-selector" name="list class name" @change="redraw(hoveredInfos)">
        <option value="" />
        <option v-for="(compiledClass, i) in compiledClasses" :key="i" :value="compiledClass">
          {{ compiledClass }}
        </option>
      </select> <br>
      <small><b>Node settings:</b></small> <br>
      Name of node class: <br>
      <select v-model="nodeClassName" class="class-selector" name="node class name" @change="redraw(hoveredInfos)">
        <option value="" />
        <option v-for="(compiledClass, i) in compiledClasses" :key="i" :value="compiledClass">
          {{ compiledClass }}
        </option>
      </select> <br>
      Name of next pointer: <br>
      <input v-model="nextName" class="text-input" placeholder="Enter name of next pointer ..."> <br>
      Name of value field: <br>
      <input v-model="valName" class="text-input" placeholder="Enter name of value field ..."> <br>
      <p class="no-break">
        <small><b>General settings:</b></small> <br>
        Name of previous variable:
      </p>
      <input v-model="prevName" class="text-input" placeholder="Enter name of previous variable ..."> <br>
    </NavigationBarWithSettings>
  </div>
</template>

<script lang="ts">
import { BaseType, select, Selection } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity } from 'd3-zoom'
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import SvgDefinitions from '@/helpers/SvgDefinitions.vue'
import { FUZZY_NAMES, HTML, LAYOUT, LOCAL_STORAGE } from './constants'
import { drawNextPointers, drawNodeRectangles, drawPointers, drawReferenceNodes } from './drawing'
import { processChildren, createListAndNextPointerStructs, createPointerStructure } from './preprocessing'
import { getCoordinatesOfChange } from './node-utils'
import { CSS, SVG } from '../constants'
import { zoomToChange } from '../zooming'
import { checkFields, fuzzySearch, getHeapTree, removeChildren } from '../utils'
import { getNodesOfType } from '../preprocessing-utils'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'
import { LINKEDLIST } from '@/store/PaneVisibilityStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/helpers/constants'

export let levelCoordinates: number[] = [LAYOUT.nodes.yOrigin] // Y offsets of levels
let transform: any = zoomIdentity // holds the current zoom-state

export default defineComponent({
  name: 'TheListVisualization',
  components: { SvgDefinitions, NavigationBarWithSettings },
  setup () {
    const nextName = ref(localStorage.getItem(LOCAL_STORAGE.nextName) || 'next')
    const valName = ref(localStorage.getItem(LOCAL_STORAGE.valName) || 'val')
    const prevName = ref(localStorage.getItem(LOCAL_STORAGE.prevName) || 'prev')
    const resizeObserver = ref(null as unknown as ResizeObserver)
    const zoomCall = ref(zoom().on('zoom', (event) => {
      transform = event.transform
      select(`#${HTML.ids.list}`).attr('transform', transform)
    }))
    const listClassName = ref<string | undefined>('')
    const nodeClassName = ref<string | undefined>('')
    const svg = ref(select(`#${HTML.ids.listSvg}`))
    const hoveredInfos = ref([] as HoverInfo[])

    const generalStore = useGeneralStore()
    const traceState = computed(() => generalStore.currentTraceData?.processedTraceState)
    const firstState = computed(() => generalStore.currentTraceData!.firstTraceState)
    const stateIndex = computed(() => generalStore.currentTraceData?.stateIndex ?? 0)
    const compiledClasses = computed(() => generalStore.debugger.getCompiledClasses()!)
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
      const { root: heapTree, heapNodes } = getHeapTree(stateIndex.value, traceState.value, firstState.value, undefined)

      // get lists
      const lists = getNodesOfType(heapNodes, listClassName.value!)

      // create data-structure for nodes and next-pointers
      levelCoordinates = [LAYOUT.nodes.yOrigin]
      const { nodes, pointers, nextPointers, referenceNodes } = createListAndNextPointerStructs(heapTree, lists, levelCoordinates, {
        nodeClassName: nodeClassName.value!, nextName: nextName.value, valName: valName.value
      })
      // create data-structure for node pointers
      const _svg = svg.value as Selection<BaseType, unknown, HTMLElement, any>
      const nodePointers = createPointerStructure(_svg, nodes, pointers, lists, {
        prevName: prevName.value, nodeClassName: nodeClassName.value!
      })

      // check if fields (next, value) in nodes exist
      const fieldNotFound = checkFields(nodes, [nextName.value, valName.value], HTML.ids.fieldNotFound)
      if (fieldNotFound) {
        deleteViz()
        return
      }

      processChildren(nodes, { valName: valName.value, nextName: nextName.value })
      processChildren(referenceNodes)

      // visualize everything
      drawNodeRectangles(_svg, nodes, { valName: valName.value, nextName: nextName.value }, hoveredInfos)
      drawReferenceNodes(_svg, referenceNodes, hoveredInfos)
      drawNextPointers(_svg, nextPointers, hoveredInfos)
      drawPointers(_svg, nodePointers, hoveredInfos)

      // get coordinate of first change
      const { x, y } = getCoordinatesOfChange(nodePointers, nextPointers)

      // add ability to zoom and pan
      _svg.call(zoomCall.value as any)

      // translate zoom, so x and y are visible
      zoomToChange(x, y, transform, zoomCall.value, HTML.ids.parentDiv, svgWidth, _svg)
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
    watch(compiledClasses, () => {
      listClassName.value = fuzzySearch(FUZZY_NAMES.list, compiledClasses.value)
      nodeClassName.value = fuzzySearch(FUZZY_NAMES.node, compiledClasses.value)
    })

    onMounted(() => {
      // selection was empty when component was created, since template was not inserted yet
      svg.value = select(`#${HTML.ids.listSvg}`)

      HoverSynchronizer.onHover(onHover)

      const div = document.getElementById(HTML.ids.parentDiv)
      resizeObserver.value = new ResizeObserver(() => {
        if (div) {
          const height = div.offsetHeight / div.offsetWidth * svgWidth
          if (height) {
            svg.value.attr('viewBox', `0 0 ${svgWidth} ${height}`)
          }
        }
      })
      resizeObserver.value.observe(div as any)
      // delete old visualization
      deleteViz()
      redraw(hoveredInfos.value)
      // TODO: find out why second redraw is needed (list is not drawn otherwise)
      redraw(hoveredInfos.value)
    })
    onUnmounted(() => {
      const div = document.getElementById(HTML.ids.parentDiv)
      if (div) {
        resizeObserver.value.unobserve(div)
      }
      HoverSynchronizer.removeOnHover(onHover)
    })
    return { zoomIn, zoomOut, zoomReset, cssVariables, LINKEDLIST, HTML, listClassName, compiledClasses, nodeClassName, hoveredInfos, redraw, nextName, valName, prevName }
  }
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

#list-svg {
  min-width: 100%;
  min-height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.class-selector {
  width: 100%;
  padding: 3px 0px;
}

.text-input {
  width: 100%;
}

p {
  padding: 0px;
  margin: 0px;
}

:deep(.highlighted) {
  fill: #ffe9d8;
}

:deep(.highlighted-ref rect) {
  fill: #e3eee2;
}

:deep(.highlighted-pointer), :deep(.highlighted-pointer line) {
  stroke: #eda167;
  color: #eda167;
}
</style>
