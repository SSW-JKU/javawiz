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
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { BaseType, select, Selection } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
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
import { useGeneralStore } from '@/store/GeneralStore'
import { getCoordinatesOfChange } from './node-utils'
import { DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/helpers/constants'

export let levelCoordinates: number[][] = [] // Y offset of levels
export let levelWidths: number[] = [] // widths of levels
let transform: any = zoomIdentity // holds the current zoom-state

export default defineComponent({
  name: 'TheTreeVisualization',
  components: { SvgDefinitions, NavigationBarWithSettings },
  setup () {
    const leftName = ref(localStorage.getItem(LOCAL_STORAGE.leftName) || 'left')
    const rightName = ref(localStorage.getItem(LOCAL_STORAGE.rightName) || 'right')
    const valueName = ref(localStorage.getItem(LOCAL_STORAGE.valueName) || 'val')
    const parentName = ref(localStorage.getItem(LOCAL_STORAGE.parentName) || 'parent')
    const resizeObserver = ref<ResizeObserver>()
    const zoomCall = ref(zoom().on('zoom', (event) => {
      transform = event.transform
      select(`#${HTML.ids.tree}`).attr('transform', transform)
    }))
    const svg = ref(select(`#${HTML.ids.treeSvg}`))
    const hoveredInfos = ref<HoverInfo[]>([])

    const generalStore = useGeneralStore()
    const stateIndex = computed(() => generalStore.currentTraceData?.processedTraceState?.stateIndex ?? 0)
    const traceState = computed(() => generalStore.currentTraceData?.processedTraceState)
    const firstState = computed(() => generalStore.currentTraceData!.firstTraceState!)
    const compiledClasses = computed(() => generalStore.debugger.getCompiledClasses()!)
    const treeClassName = computed(() => fuzzySearch(FUZZY_NAMES.tree, compiledClasses.value) ?? '')
    const nodeClassName = computed(() => fuzzySearch(FUZZY_NAMES.node, compiledClasses.value) ?? '')
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
    function redraw (hoveredInfos: HoverInfo[] = []) {
      const { root: heapTree, heapNodes } = getHeapTree(stateIndex.value, traceState.value, firstState.value, undefined)

      // create tree from heap tree
      // get trees
      const trees = getNodesOfType(heapNodes, treeClassName.value)

      // explore tree and create data-structure for tree nodes and child pointers
      levelCoordinates = []
      levelWidths = [calcTreeWidth(0)]
      const { treeNodes, childPointers, pointers } = createTreeAndChildPointerStructs(heapTree, trees, levelCoordinates, levelWidths, {
        nodeClassName: nodeClassName.value,
        valueName: valueName.value,
        leftName: leftName.value,
        rightName: rightName.value
      })

      // check if fields (left, right, value) in nodes exist
      const fieldNotFound = checkFields(treeNodes, [leftName.value, rightName.value, valueName.value], HTML.ids.fieldNotFound)
      if (fieldNotFound) {
        deleteViz()
        return
      }

      processChildren(treeNodes, {
        leftName: leftName.value,
        rightName: rightName.value
      })

      // create data-structure for node pointers
      const nodePointers = createPointerStructure(treeNodes, pointers, trees, {
        parentName: parentName.value,
        nodeClassName: nodeClassName.value
      })

      // visualize everything
      const _svg = svg.value as Selection<BaseType, unknown, HTMLElement, unknown>
      drawNodeRectangles(_svg, treeNodes, {
        leftName: leftName.value,
        rightName: rightName.value
      }, hoveredInfos)
      drawChildPointers(_svg, childPointers, hoveredInfos)
      drawPointers(_svg, nodePointers, hoveredInfos)

      // get changed pointers and their coordinate
      const { x, y } = getCoordinatesOfChange(nodePointers, childPointers)

      // add ability to zoom and pan
      _svg.call(zoomCall.value as any)

      // translate zoom, so x and y are visible
      zoomToChange(x, y, transform, zoomCall.value, HTML.ids.parentDiv, LAYOUT.svgWidth, _svg)
    }

    function onHover (hoverInfos: HoverInfo[]) {
      hoveredInfos.value = hoverInfos
      redraw(hoveredInfos.value)
    }
    function deleteViz () {
      removeChildren(`#${HTML.ids.treeNodes}`)
      removeChildren(`#${HTML.ids.childPointers}`)
      removeChildren(`#${HTML.ids.nodePointers}`)
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

    watch(stateIndex, () => redraw())

    watch(treeClassName, () => redraw())

    watch(leftName, () => {
      redraw()

      localStorage.setItem(LOCAL_STORAGE.leftName, leftName.value)
    }
    )
    watch(rightName, () => {
      localStorage.setItem(LOCAL_STORAGE.rightName, rightName.value)
      redraw()
    })
    watch(valueName, () => {
      localStorage.setItem(LOCAL_STORAGE.valueName, valueName.value)
      redraw()
    })
    watch(parentName, () => {
      localStorage.setItem(LOCAL_STORAGE.parentName, parentName.value)
      redraw()
    })

    onMounted(() => {
      // selection was empty when component was created, since template was not inserted yet
      svg.value = select(`#${HTML.ids.treeSvg}`)

      HoverSynchronizer.onHover(onHover)

      const div = document.getElementById(HTML.ids.parentDiv)
      resizeObserver.value = new ResizeObserver(() => {
        if (div) {
          const height = div.offsetHeight / div.offsetWidth * LAYOUT.svgWidth
          if (height) {
            svg.value.attr('viewBox', `0 0 ${LAYOUT.svgWidth} ${height}`)
          }
        }
      })
      resizeObserver.value.observe(div!)
      // delete old visualization
      deleteViz()
      redraw()
      // TODO: find out why second redraw is needed (tree is not drawn otherwise)
      redraw()
    })

    onUnmounted(() => {
      const div = document.getElementById(HTML.ids.parentDiv)
      if (div) {
        resizeObserver.value?.unobserve(div)
      }
      HoverSynchronizer.removeOnHover(onHover)
    })

    return {
      zoomIn, zoomOut, HTML, cssVariables, treeClassName, compiledClasses, zoomReset, BINARYTREE, nodeClassName, redraw, parentName, leftName, rightName, valueName
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
