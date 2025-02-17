<template>
  <div style="position: relative;height: 100%;">
    <NavigationBarWithSettings
      :zoom-in="zoomIn"
      :zoom-out="zoomOut"
      :zoom-reset="zoomReset"
      :pane-kind="FLOWCHART">
      <FlowChartSettings
        :auto-inline="autoInline"
        :show-values="showValues"
        :follow-active="followActive"
        :top-offset="16"
        @update:auto-inline="v => { autoInline = v; init() }"
        @update="init"
        @update:show-values="v => { showValues = v; init(); }"
        @update:follow-active="v => { followActive = v; init(); }" />
    </NavigationBarWithSettings>

    <div
      style="height: 100%;">
      <svg id="flowchart">
        <g class="chart">
          <g id="primary" />
          <g id="overlays" />
        </g>

        <g id="statics-overlay" />
        <g id="function-selector">
          <foreignObject
            v-if="showFunctionSelectOverlay"
            x="0"
            y="0"
            width="100%"
            height="100%"

            @click="showFunctionSelectOverlay = false">
            <div style="text-align: center;" @click="e => e.stopPropagation()">
              <select v-model="selectedFunctionIdx" style="font-weight:bold; font-size: large;">
                <option value="-1">Select method</option>
                <option v-for="(option, index) in functionSelectOptions" :key="index" :value="index">{{ option }}</option>
              </select>
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'
import {
  InlinedFnMap,
  FullHierarchyNode,
  CallSite
} from './types'
import { renderChart } from './render'
import { createLayout } from './layout'
import { StackOverlayManager, renderStaticsOverlay } from './overlay'
import { FONT_FAMILY } from '@/components/TheFlowChart/Font'
import { ELEMENT } from './Element'
import { createD3HierarchyByMethod, createTempInlinedFnMap } from './ast-utils'
import {
  openCollapsedUntilHighlight,
  addCatchClausesToCollapsed,
  createCollapseToggleFn,
  findActiveStatement,
  getFocusCoordinates
} from './meta-utils'
import { createInlineMethodToggle } from './toggle'
import FlowChartSettings from './FlowChartSettings.vue'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { FullWidthManager } from './FullWidthManager'
import { AstElement, AstFile } from '@/dto/AbstractSyntaxTree'
import { FLOWCHART } from '@/store/PaneVisibilityStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { DEFAULT_ZOOM_FACTOR, TRANSFORMATION } from '@/helpers/constants'

const SIZE = 50000
const CENTER = SIZE / 2

export default defineComponent({
  name: 'TheFlowChart',
  components: { FlowChartSettings, NavigationBarWithSettings },
  setup () {
    const generalStore = useGeneralStore()

    const fullWidthManager = new FullWidthManager(() => init())
    const autoInline = ref(true)
    const showValues = ref(true)
    const followActive = ref(true)
    const collapsed = ref(new Set<string>())
    const historicalCollapsedUuids = ref(new Set<string>())

    const stackOverlayManager = new StackOverlayManager()

    const inlinedMethods = ref<InlinedFnMap>(new Map())

    // No need to make reactive, will not change
    const asts = generalStore.asts

    const currentFileUri = computed(() => generalStore.debugger.latestTraceState?.sourceFileUri ?? '')
    const currentMethod = computed(() => generalStore.debugger.latestTopStackFrame?.method ?? '')
    const latestStack = computed(() => {
      return generalStore.debugger.latestTraceState?.stack ?? []
    })

    const rootCurrentMethod = ref(currentMethod)
    const rootCurrentClass = ref(latestStack.value[0].class)

    const prevPosX = ref<number>(0)
    const prevCenterX = ref<number>(CENTER)

    const prevScale = ref<number>(1)

    const showFunctionSelectOverlay = ref<boolean>(false)
    const functionSelectOptions = ref<string[]>([])
    const selectedFunctionIdx = ref<number>(-1)

    function getNodeWithMainClass (): AstFile | undefined {
      if (!asts || asts.length === 0) { return }
      const mainClass = latestStack.value.at(-1)!!.class
      return asts.find(ast => ast.file.classes.find(cls => cls.name === mainClass))?.file
    }

    /**
     * Create a layout for a method with an given AST
     * @param node root node of an AST
     * @param method method name selected as starting method
     * @param clazz the class of the method selected as starting method
     */
    function createLayoutAstByMethod (root: AstFile, method: string, clazz: string) {
      const stackFrameMethods: CallSite[] = latestStack.value
        .map<CallSite>(stackFrame => { return { method: stackFrame.method, line: stackFrame.line, class: stackFrame.class } })

      const main = 'main'
      const mainClass = latestStack.value.at(-1)!!.class

      let autoInlinedFnMap = new Map()
      if (autoInline.value) {
        const classes = asts.flatMap(ast => ast.file.classes)
        autoInlinedFnMap = createTempInlinedFnMap(classes, stackFrameMethods)
      }

      const rootMethodName = autoInline.value ? main : method
      const rootClassName = autoInline.value ? mainClass : clazz
      const allInlinedFnMap = new Map([...autoInlinedFnMap, ...inlinedMethods.value])

      const plainHierarchy = createD3HierarchyByMethod(root, main, mainClass, undefined, allInlinedFnMap)
      addCatchClausesToCollapsed(plainHierarchy, collapsed.value, historicalCollapsedUuids.value) // collapse newly created catch clauses
      const tempCollapsed = openCollapsedUntilHighlight(stackFrameMethods, plainHierarchy, collapsed.value)

      // update with the updated collapsed items
      const updatedAst = createD3HierarchyByMethod(root, rootMethodName, rootClassName, tempCollapsed, allInlinedFnMap)

      // 1 round layout creation
      let rootLayout = createLayout(
        updatedAst,
        { posX: 0 },
        tempCollapsed,
        allInlinedFnMap,
        generalStore.currentLine,
        stackFrameMethods,
        fullWidthManager
      )

      const deltaCenterX = prevCenterX.value - rootLayout.box.centerX
      // TODO: calculate x
      // 2 round layout creation

      rootLayout = createLayout(
        updatedAst,
        { posX: prevPosX.value + deltaCenterX },
        tempCollapsed,
        allInlinedFnMap,
        generalStore.currentLine,
        stackFrameMethods,
        fullWidthManager
      )

      prevCenterX.value = rootLayout.box.centerX
      prevPosX.value = rootLayout.pos.x

      return rootLayout
    }

    /**
     * Create the next layout and draw it
     */
    function generateLayout (focus: boolean) {
      const rootNode = getNodeWithMainClass()
      if (!rootNode) { return }
      const nextLayout = createLayoutAstByMethod(rootNode, rootCurrentMethod.value, rootCurrentClass.value)
      redraw(nextLayout, focus)
    }

    /**
     * Draws a provided AST that contains layout information
     * @param ast Fully resolved AST
     * @param focus if true, center the active statement in case it went out of the svg scope
     */
    function redraw (ast: FullHierarchyNode<AstElement>, focus: boolean) {
      const root = d3.select('#flowchart').select('.chart')

      const g = root.select('#primary')

      renderChart(
        ast.descendants().filter(d => d && d.data),
        g as any,
        createCollapseToggleFn(ast, collapsed.value),
        createInlineMethodToggle(
          inlinedMethods.value,
          (uuids) => {
            return asts
              .flatMap(ast => ast.file.classes)
              .flatMap(clazz => clazz.methods)
              .filter(method => uuids.includes(method.uuid))
          },
          (options: string[]) => createFunctionSelect(options)),
        fullWidthManager
      )

      const overlays = root.select('#overlays')
      stackOverlayManager.renderStackOverlays(
        overlays,
        showValues.value,
        generalStore.currentTraceData?.flowChartOverlayLocals,
        ast,
        fullWidthManager,
        generalStore.currentTraceData?.stateIndex ?? 0)

      const staticsOverlay = d3.select('#flowchart').select('#statics-overlay')
      renderStaticsOverlay(staticsOverlay, showValues.value, generalStore.currentTraceData?.flowChartOverlayStatics)

      if (focus) {
        focusActiveStatementIfOutOfScope(ast)
      }
    }

    /**
     * set flags to open a selector for deciding which one of several possible functions to expand when clicking on a function
     * @param options the possible functions
     * @returns a Promise that resolves to the corresponding index in the options array, or -1 if the user clicks away
     */
    function createFunctionSelect (options: string[]): Promise<number> {
      functionSelectOptions.value = options
      selectedFunctionIdx.value = -1

      showFunctionSelectOverlay.value = true

      return new Promise((resolve, _reject) => {
        const stopWatch = watch(selectedFunctionIdx, newValue => {
          stopWatch() // disable watcher callback
          showFunctionSelectOverlay.value = false
          resolve(newValue)
        })
        const stopWatch2 = watch(showFunctionSelectOverlay, newValue => {
          stopWatch2()
          if (!newValue) {
            resolve(-1)
          }
        })
      })
    }

    /**
     * Put the active statement in the center of the SVG if it went out of scope (i.e. is no longer visible on the screen)
     * @param ast the current AST
     */
    function focusActiveStatementIfOutOfScope (ast: FullHierarchyNode<AstElement>) {
      const active = findActiveStatement(ast)
      if (!active) {
        return
      }
      const { x, y } = getFocusCoordinates(active)
      const svg = (d3.select('#flowchart').node() as SVGElement).getBoundingClientRect()

      const chart = (d3.select('#flowchart').select('.chart')
        .node() as SVGElement).getBoundingClientRect()

      const relPosX = x - ast.pos.x
      const relPosY = y - ast.pos.y

      const offsetX = chart.right - ast.box.width * prevScale.value
      const offsetY = chart.y

      /*
       Note: offsetX should equal chart.x in most cases.
       When a block is newly expanded, this x value is wrong for some reason.
       Therefore we use the chart.right coordinate to compute offsetX
       */

      const posX = relPosX * prevScale.value + offsetX
      const posY = relPosY * prevScale.value + offsetY

      const statementVisible = svg.left <= posX && posX <= svg.right && svg.top <= posY && posY <= svg.bottom

      if (!statementVisible) {
        zoomBehavior.translateTo(getTransition(), CENTER + relPosX - ast.box.centerX, relPosY)
      }
    }

    function getTransition () {
      const svg = d3.select<SVGSVGElement, unknown>('#flowchart')
      return svg.transition().duration(TRANSFORMATION.duration)
        .ease(TRANSFORMATION.ease)
    }

    /**
     * Reset the zoom by setting the zoom to the center of the screen
     */
    function zoomReset () {
      const svg = d3.select<SVGSVGElement, unknown>('#flowchart')
      const realWidth = svg.node()?.getBoundingClientRect().width || 0
      const x = -CENTER + realWidth / 2
      zoomBehavior.transform(getTransition(), d3.zoomIdentity.translate(x, 0))
    }

    function zoomIn () {
      zoomBehavior.scaleBy(getTransition(), DEFAULT_ZOOM_FACTOR)
    }

    function zoomOut () {
      zoomBehavior.scaleBy(getTransition(), 1 / DEFAULT_ZOOM_FACTOR)
    }

    /**
     * Initialize the flowchart.
     */
    function init () {
      inlinedMethods.value.clear()
      generateLayout(false)
    }

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (e) => {
        prevScale.value = e.transform.k

        d3.select('#flowchart g.chart')
          .attr('transform', e.transform)
      })

    onMounted(() => {
      init()
      zoomReset()
      const chartRoot = d3.select<SVGSVGElement, unknown>('#flowchart')
      chartRoot.call(zoomBehavior)
        .on('dblclick.zoom', () => zoomReset())
    })
    watch(currentFileUri, init)

    watch(latestStack, () => {
      generateLayout(followActive.value)
    })

    watch([collapsed, inlinedMethods, historicalCollapsedUuids], () => {
      generateLayout(false)
    }, { deep: true })

    watch(currentMethod, () => {
      if (currentMethod.value) {
        const _inlinedState = inlinedMethods.value.get(currentMethod.value) // TODO: find current method
        // eslint-disable-next-line no-constant-condition
        if (false) {
          // keep root current method
        } else {
          rootCurrentMethod.value = currentMethod.value
          rootCurrentClass.value = latestStack.value[0].class
        }
      } else {
        rootCurrentMethod.value = currentMethod.value
        rootCurrentClass.value = latestStack.value[0].class
      }
    })

    // keep track of changes in the call stack
    watch(autoInline, () => init())
    watch(showValues, () => init())
    watch(collapsed, (cur) => {
      cur.forEach(c => historicalCollapsedUuids.value.add(c))
    }, { deep: true })

    return {
      fontFamily: FONT_FAMILY,
      fontSize: ELEMENT.Statement.fontSize + 'px',
      autoInline,
      showValues,
      followActive,
      init,
      zoomIn,
      zoomOut,
      zoomReset,
      showFunctionSelectOverlay,
      selectedFunctionIdx,
      functionSelectOptions,
      FLOWCHART,
      latestStack
    }
  }
})
</script>

<style>
#flowchart {
  font-family: v-bind(fontFamily);
  font-size: v-bind(fontSize);
  user-select: none;

  height: 100%;
  width: 100%;
}

.collapsible {
  cursor: pointer;
}
</style>
