<!--suppress CssUnresolvedCustomProperty -->
<template>
  <div :id="HTML.ids.parentDiv" :style="cssVariables">
    <div :id="HTML.ids.fieldNotFound" class="pane-default-text" style="color: red; display: none">
      The nodes do not contain the given fields. Please check the names of the left child, the right child and the value field in settings.
    </div>
    <svg
      :id="HTML.ids.treeSvg"
      width="100%"
      height="100%"
      viewBox="0 0 820 10000"
      preserveAspectRatio="xMidYMin slice">
      <SvgDefinitions />
      <g :id="HTML.ids.tree">
        <g :id="HTML.ids.treeNodes" />
        <g :id="HTML.ids.childPointers" />
        <g :id="HTML.ids.nodePointers" />
      </g>
    </svg>
    <NavigationBarWithSettings
      :zoom-in="zoomIn"
      :zoom-out="zoomOut"
      :zoom-reset="zoomReset"
      :pane-kind="BINARYTREE">
      <p class="no-break">
        <small><b>Tree settings:</b></small> <br>
        Name of tree class:
      </p>
      <select v-model="treeClassName" class="class-selector" name="tree class name" @change="redraw()">
        <option value="" />
        <option v-for="(compiledClass, i) in compiledClasses" :key="i" :value="compiledClass">
          {{ compiledClass }}
        </option>
      </select> <br>
      <small><b>Node settings:</b></small> <br>
      Name of node class: <br>
      <select v-model="nodeClassName" class="class-selector" name="node class name" @change="redraw()">
        <option value="" />
        <option v-for="(compiledClass, i) in compiledClasses" :key="i" :value="compiledClass">
          {{ compiledClass }}
        </option>
      </select> <br>
      Name of left child: <br>
      <input v-model="leftName" class="text-input" placeholder="Enter name of left child ..."> <br>
      Name of right child: <br>
      <input v-model="rightName" class="text-input" placeholder="Enter name of right child ..."> <br>
      Name of value field: <br>
      <input v-model="valueName" class="text-input" placeholder="Enter name of value field ..."> <br>

      <p class="no-break">
        <small><b>General settings:</b></small> <br>
        Name of parent variable:
      </p>
      <input v-model="parentName" class="text-input" placeholder="Enter name of parent variable ..."> <br>
    </NavigationBarWithSettings>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ProcessedTraceState, TraceState } from '@/dto/TraceState'
import { BaseType, select, Selection } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import {
} from '@/helpers/Common'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import SvgDefinitions from '@/helpers/SvgDefinitions.vue'
import { FUZZY_NAMES, HTML, LAYOUT, LOCAL_STORAGE } from './constants'
import { drawNodeRectangles, drawChildPointers, drawPointers } from './drawing'
import { processChildren, createTreeAndChildPointerStructs, createPointerStructure } from './preprocessing'
import { CSS } from '../constants'
import { zoomToChange } from '../zooming'
import { checkFields, fuzzySearch, getHeapTree, removeChildren } from '../utils'
import { getNodesOfType } from '../preprocessing-utils'
import { calcTreeWidth } from './layout'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'
import { BINARYTREE } from '@/store/PaneVisibilityStore'
import { mapStores } from 'pinia'
import { useGeneralStore } from '@/store/GeneralStore'
import { getCoordinatesOfChange } from './node-utils'
import { DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/helpers/constants'

export let levelCoordinates: number[][] = [] // Y offset of levels
export let levelWidths: number[] = [] // widths of levels
let transform: any = zoomIdentity // holds the current zoom-state

export default defineComponent({
  name: 'TheTreeVisualization',
  components: { SvgDefinitions, NavigationBarWithSettings },
  data: function () {
    return {
      leftName: localStorage.getItem(LOCAL_STORAGE.leftName) || 'left',
      rightName: localStorage.getItem(LOCAL_STORAGE.rightName) || 'right',
      valueName: localStorage.getItem(LOCAL_STORAGE.valueName) || 'val',
      parentName: localStorage.getItem(LOCAL_STORAGE.parentName) || 'parent',
      resizeObserver: null as unknown as ResizeObserver,
      zoomCall: zoom().on('zoom', (event) => {
        transform = event.transform
        select(`#${HTML.ids.tree}`).attr('transform', transform)
      }),
      svg: select(`#${HTML.ids.treeSvg}`),
      BINARYTREE,
      hoveredInfos: [] as HoverInfo[]
    }
  },
  computed: {
    ...mapStores(useGeneralStore),
    stateIndex (): number {
      return this.generalStore.currentTraceData?.stateIndex ?? 0
    },
    traceState (): ProcessedTraceState | undefined {
      return this.generalStore.currentTraceData?.processedTraceState
    },
    firstState (): TraceState {
      return this.generalStore.currentTraceData?.firstTraceState!
    },
    compiledClasses (): string[] {
      return this.generalStore.debugger.getCompiledClasses()!!
    },
    treeClassName () {
      return fuzzySearch(FUZZY_NAMES.tree, this.compiledClasses) ?? ''
    },
    nodeClassName () {
      return fuzzySearch(FUZZY_NAMES.node, this.compiledClasses) ?? ''
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
    }
  },
  watch: {
    stateIndex: function () {
      const vm = this
      vm.redraw()
    },
    treeClassName: function () {
      const vm = this
      vm.redraw()
    },
    leftName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.leftName, vm.leftName)
      vm.redraw()
    },
    rightName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.rightName, vm.rightName)
      vm.redraw()
    },
    valueName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.valueName, vm.valueName)
      vm.redraw()
    },
    parentName: function () {
      const vm = this
      localStorage.setItem(LOCAL_STORAGE.parentName, vm.parentName)
      vm.redraw()
    }
  },
  mounted () {
    const vm = this

    // selection was empty when component was created, since template was not inserted yet
    vm.svg = select(`#${HTML.ids.treeSvg}`)

    HoverSynchronizer.onHover(vm.onHover)

    const div = document.getElementById(HTML.ids.parentDiv)
    vm.resizeObserver = new ResizeObserver(() => {
      if (div) {
        const height = div.offsetHeight / div.offsetWidth * LAYOUT.svgWidth
        if (height) {
          vm.svg.attr('viewBox', `0 0 ${LAYOUT.svgWidth} ${height}`)
        }
      }
    })
    vm.resizeObserver.observe(div as any)
    // delete old visualization
    vm.deleteViz()
    vm.redraw()
    // TODO: find out why second redraw is needed (tree is not drawn otherwise)
    vm.redraw()
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
    deleteViz () {
      removeChildren(`#${HTML.ids.treeNodes}`)
      removeChildren(`#${HTML.ids.childPointers}`)
      removeChildren(`#${HTML.ids.nodePointers}`)
    },
    redraw: function (hoveredInfos: HoverInfo[] = []) {
      const vm = this
      const { root: heapTree, heapNodes } = getHeapTree(vm.stateIndex, vm.traceState, vm.firstState, undefined)

      // create tree from heap tree
      // get trees
      const trees = getNodesOfType(heapNodes, vm.treeClassName)

      // explore tree and create data-structure for tree nodes and child pointers
      levelCoordinates = []
      levelWidths = [calcTreeWidth(0)]
      const { treeNodes, childPointers, pointers } = createTreeAndChildPointerStructs(heapTree, trees, levelCoordinates, levelWidths, vm)

      // check if fields (left, right, value) in nodes exist
      const fieldNotFound = checkFields(treeNodes, [vm.leftName, vm.rightName, vm.valueName], HTML.ids.fieldNotFound)
      if (fieldNotFound) {
        vm.deleteViz()
        return
      }

      processChildren(treeNodes, vm)

      // create data-structure for node pointers
      const nodePointers = createPointerStructure(treeNodes, pointers, trees, vm)

      // visualize everything
      const svg = vm.svg as Selection<BaseType, any, HTMLElement, any>
      drawNodeRectangles(svg, treeNodes, vm, hoveredInfos)
      drawChildPointers(svg, childPointers, hoveredInfos)
      drawPointers(svg, nodePointers, hoveredInfos)

      // get changed pointers and their coordinate
      const { x, y } = getCoordinatesOfChange(nodePointers, childPointers)

      // add ability to zoom and pan
      vm.svg.call(vm.zoomCall as any)

      // translate zoom, so x and y are visible
      zoomToChange(x, y, transform, vm.zoomCall, HTML.ids.parentDiv, LAYOUT.svgWidth, vm.svg as Selection<BaseType, unknown, HTMLElement, any>)
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
    alignment-baseline:  middle;
  }

  :deep(line), :deep(rect) {
    stroke: black;
    fill: none;
    stroke-linecap: round;
  }

  :deep(.pointer-text div) {
    text-align: right;
    font-size: var(--pointer-font-size);
    direction: rtl;
  }

  :deep(.text-group div) {
    text-align: center;
    font-size: var(--cell-font-size);
  }

  :deep(.text-group div), :deep(.pointer-text div) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  #tree-div {
    position: relative;
    height: 100%;
  }

  #tree-svg {
    min-width: 100%;
    position: absolute;
  }

  .class-selector {
    width: 100%;
    padding: 3px 0px;
  }

  .text-input {
    width: 100%;
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
