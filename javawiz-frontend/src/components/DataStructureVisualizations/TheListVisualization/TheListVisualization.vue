<!--suppress CssUnresolvedCustomProperty -->
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
import { defineComponent } from 'vue'
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
import { mapStores } from 'pinia'
import { ProcessedTraceState, TraceState } from '@/dto/TraceState'
import { DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/helpers/constants'

export let levelCoordinates: number[] = [LAYOUT.nodes.yOrigin] // Y offsets of levels
let transform: any = zoomIdentity // holds the current zoom-state

export default defineComponent({
  name: 'TheListVisualization',
  components: { SvgDefinitions, NavigationBarWithSettings },
  data: function () {
    return {
      nextName: localStorage.getItem(LOCAL_STORAGE.nextName) || 'next',
      valName: localStorage.getItem(LOCAL_STORAGE.valName) || 'val',
      prevName: localStorage.getItem(LOCAL_STORAGE.prevName) || 'prev',
      resizeObserver: null as unknown as ResizeObserver,
      zoomCall: zoom().on('zoom', (event) => {
        transform = event.transform
        select(`#${HTML.ids.list}`).attr('transform', transform)
      }),
      svg: select(`#${HTML.ids.listSvg}`),
      LINKEDLIST,
      hoveredInfos: [] as HoverInfo[],
      listClassName: '',
      nodeClassName: ''
    }
  },
  computed: {
    ...mapStores(useGeneralStore),
    traceState (): ProcessedTraceState | undefined {
      return this.generalStore.currentTraceData?.processedTraceState
    },
    firstState (): TraceState {
      return this.generalStore.currentTraceData?.firstTraceState!
    },
    stateIndex (): number {
      return this.generalStore.currentTraceData?.stateIndex ?? 0
    },
    compiledClasses (): string[] {
      return this.generalStore.debugger.getCompiledClasses()!!
    },
    HTML () {
      return HTML
    },
    cssVariables () {
      return {
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
    },
    svgWidth () {
      return SVG.cellWidth * ((LAYOUT.defaultNumberOfNodes + 2) * LAYOUT.nodes.distances.multiplier + LAYOUT.nodes.distances.constant)
    }
  },
  watch: {
    stateIndex: function () {
      const vm = this
      vm.redraw(vm.hoveredInfos)
    },
    nextName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.nextName, vm.nextName)
      vm.redraw(vm.hoveredInfos)
    },
    valName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.valName, vm.valName)
      vm.redraw(vm.hoveredInfos)
    },
    prevName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.prevName, vm.prevName)
      vm.redraw(vm.hoveredInfos)
    },
    compiledClasses: function () {
      const vm = this
      vm.listClassName = fuzzySearch(FUZZY_NAMES.list, vm.compiledClasses) ?? ''
      vm.nodeClassName = fuzzySearch(FUZZY_NAMES.node, vm.compiledClasses) ?? ''
    }
  },
  mounted () {
    const vm = this

    // selection was empty when component was created, since template was not inserted yet
    vm.svg = select(`#${HTML.ids.listSvg}`)

    HoverSynchronizer.onHover(vm.onHover)

    const div = document.getElementById(HTML.ids.parentDiv)
    vm.resizeObserver = new ResizeObserver(() => {
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
    vm.redraw(vm.hoveredInfos)
    // TODO: find out why second redraw is needed (list is not drawn otherwise)
    vm.redraw(vm.hoveredInfos)
  },
  unmounted () {
    const vm = this

    const div = document.getElementById(HTML.ids.parentDiv)
    if (div) {
      this.resizeObserver.unobserve(div)
    }
    HoverSynchronizer.removeOnHover(vm.onHover)
  },
  methods: {
    onHover: function (hoverInfos: HoverInfo[]) {
      const vm = this

      vm.hoveredInfos = hoverInfos
      vm.redraw(vm.hoveredInfos)
    },
    deleteViz: function () {
      removeChildren(`#${HTML.ids.listNodes}`)
      removeChildren(`#${HTML.ids.nextPointers}`)
      removeChildren(`#${HTML.ids.nodePointers}`)
    },
    redraw: function (hoveredInfos: HoverInfo[]) {
      const vm = this
      const { root: heapTree, heapNodes } = getHeapTree(vm.stateIndex, vm.traceState, vm.firstState, undefined)

      // get lists
      const lists = getNodesOfType(heapNodes, vm.listClassName)

      // create data-structure for nodes and next-pointers
      levelCoordinates = [LAYOUT.nodes.yOrigin]
      const { nodes, pointers, nextPointers, referenceNodes } = createListAndNextPointerStructs(heapTree, lists, levelCoordinates, vm)
      // create data-structure for node pointers
      const svg = vm.svg as Selection<BaseType, unknown, HTMLElement, any>
      const nodePointers = createPointerStructure(svg, nodes, pointers, lists, vm)

      // check if fields (next, value) in nodes exist
      const fieldNotFound = checkFields(nodes, [vm.nextName, vm.valName], HTML.ids.fieldNotFound)
      if (fieldNotFound) {
        vm.deleteViz()
        return
      }

      processChildren(nodes, vm)
      processChildren(referenceNodes)

      // visualize everything
      drawNodeRectangles(svg, nodes, vm, hoveredInfos)
      drawReferenceNodes(svg, referenceNodes, hoveredInfos)
      drawNextPointers(svg, nextPointers, hoveredInfos)
      drawPointers(svg, nodePointers, hoveredInfos)

      // get coordinate of first change
      const { x, y } = getCoordinatesOfChange(nodePointers, nextPointers)

      // add ability to zoom and pan
      vm.svg.call(vm.zoomCall as any)

      // translate zoom, so x and y are visible
      zoomToChange(x, y, transform, vm.zoomCall, HTML.ids.parentDiv, vm.svgWidth, vm.svg as Selection<BaseType, unknown, HTMLElement, any>)
    },
    getTransition: function () {
      const vm = this
      return vm.svg.transition().duration(TRANSFORMATION.duration)
        .ease(TRANSFORMATION.ease) as any
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
