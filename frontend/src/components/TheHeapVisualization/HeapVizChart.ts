import * as d3 from 'd3';
import { graphviz } from 'd3-graphviz';
import { ref, toRaw, watch } from 'vue';
import { HoverInfo } from '@/hover/types';
import { HeapVizHeapArray } from './Types/HeapVizHeapArray';
import { HeapVizHeapString } from './Types/HeapVizHeapString';
import { ProcessedTraceState } from '@/dto/TraceState';
import { useGeneralStore } from '@/store/GeneralStore';
import { HeapVizTraceState } from './Types/HeapVizTraceState';
import { HeapVizReferenceVal } from './Types/HeapVizReferenceVal';
import { HoverSynchronizer } from '@/hover/HoverSynchronizer';
import { useHeapVizMetaStore } from '@/store/HeapVizMetaStore';
import { useVisualizationStore } from '@/store/VisualizationStore';
import { IHeapVizHeapItem } from './Types/HeapVizHeapItem';
import { HeapVizHeapObject } from './Types/HeapVizHeapObject';
import { getLocalOrStaticsToHeapItemHoverInfos, getMethodHoverInfos, getReferencesOfHoveredHeapItem } from './hover';
import { createHoverArrayCell, createHoverClass, createHoverField, createHoverHeapObject } from '@/hover/hoverinfo-builder';
import {
  BTN_ZOOM_FACTOR,
  CLUSTER_TITLE_FONT_SIZE,
  DEFAULT_TRANSITION_TIME,
  FONT_FACE_CLUSTER_TITLE,
  MAIN_HEADER_BG_COLOR,
  MAIN_HEADER_FONT_COLOR,
  MAX_ZOOM_IN_FACTOR,
  MAX_ZOOM_OUT_FACTOR,
  NewLine,
  TRANSFORMATION_DURATION
} from './constants';
import { linkHeapItemsToLoadedClasses } from '@/debugger/processedTraceState';
import type { DataStructureVisibilitySettings } from './DataStructureVisibility'
import { MemoryViewRenderContext } from './MemoryViewRenderContext'
import { processInjectedTitles } from './HeapLookup'
import { applyHoverStyles, type HoverStyles, hoverStylesFromDot } from './HoverRecoloring'
import { desanitizeIdentifier, identifierFromSvgCellIdentifier, SVG_CELL_SUFFIXES } from './identifiers'
import type { HeapVizVar } from './Types/HeapVizVar'
import { renderRootsNode } from './RootsNodeRenderer'

export class HeapVizChart {

  private rendering = false
  private isInitialized = false
  private isMounted = false
  private chartRootElement: Element | null = null
  private traceState!: HeapVizTraceState;
  private highlightedItems = ref<HoverInfo[]>([])
  private heapVizMetaStore = useHeapVizMetaStore()
  private lastRenderedDotString: string | null = null
  private visualizationStore = useVisualizationStore()
  private graphvizInstance: ReturnType<typeof graphviz> | null = null
  private readonly renderContext = new MemoryViewRenderContext()
  private readonly hoverHandler = this.onHover.bind(this)
  private pendingUpdate = false
  /** Hover styles currently shown in the SVG; null while no SVG matches the current trace state. */
  private drawnHoverStyles: HoverStyles | null = null
  /** Elements of the current SVG by id, so a hover change does not search the DOM for each cell. */
  private svgElementsById = new Map<string, Element>()
  private stopTraceWatch: (() => void) | null = null

  /** The callback lets wrapper-owned overlays redraw only after the replacement SVG is ready. */
  constructor (private readonly onRenderComplete: () => void = () => {}) {}

  public get store (): any { return this.visualizationStore }
  public get domReady (): boolean { return this.chartRootElement !== null }

  public init () {
    this.highlightedItems = ref<HoverInfo[]>([])
    const generalStore = useGeneralStore()
    const cachedTraceState = ref<HeapVizTraceState>()
    this.stopTraceWatch?.()
    this.stopTraceWatch = watch(() => generalStore.currentTraceData, (newData) => {
      newData = toRaw(newData)
      if (!newData)
        return
      if (newData?.processedTraceState) {
        cachedTraceState.value = new HeapVizTraceState(newData.processedTraceState, this.renderContext)
      } else {
        const first = newData.firstTraceState
        if (!first)
          return
        const processedState: ProcessedTraceState = {
          kind: 'ProcessedTraceState',
          localUri: first.sourceFileUri,
          line: first.line,
          heapBeforeExecution: linkHeapItemsToLoadedClasses(first.heap, first.loadedClasses),
          stackBeforeExecution: first.stack,
          loadedClassesBeforeExecution: first.loadedClasses,
          stateIndex: 0,
          heapAfterExecution: linkHeapItemsToLoadedClasses(first.heap, first.loadedClasses),
          stackAfterExecution: first.stack,
          loadedClassesAfterExecution: first.loadedClasses
        }
        processedState.stackAfterExecution!.flatMap(frame => frame.localVariables).forEach(lv => {
          lv.changed = true
        })
        processedState.loadedClassesAfterExecution!.flatMap(clazz => clazz.staticFields).forEach(sf => {
          sf.changed = true
        })
        cachedTraceState.value = new HeapVizTraceState(processedState, this.renderContext)
      }
      this.traceState = cachedTraceState.value!
      this.redraw();
    }, { immediate: true })

  }
  public setDataStructureVisibilitySettings (settings: DataStructureVisibilitySettings): void {
    this.renderContext.setDataStructureVisibilitySettings(settings)
    if (this.traceState) {
      this.traceState.loadedClasses.forEach(loadedClass => loadedClass.updateVisibility())
      this.traceState.loadedClassesAfterExecution.forEach(loadedClass => loadedClass.updateVisibility())
      this.redraw()
    }
  }
  /** Applies the memory-size display setting and refreshes an existing trace immediately. */
  public setShowMemory (showMemory: boolean): void {
    this.renderContext.setShowMemory(showMemory)
    if (this.traceState) {
      this.redraw()
    }
  }
  public redraw () {
    if (this.rendering) {
      this.pendingUpdate = true
      return
    }

    this.calculateNodeVisibility()
    const dotString = this.render()

    if (dotString === this.lastRenderedDotString)
      return

    if (!this.domReady) {
      console.warn('Cannot render heap because the div is not present.')
      return
    }
    if (!this.isInitialized || this.graphvizInstance == null)
      return null;

    this.lastRenderedDotString = dotString
    const renderedHoverStyles = hoverStylesFromDot(dotString)
    this.drawnHoverStyles = null
    this.rendering = true

    this.graphvizInstance
      // Per d3-graphviz docs: (a) use a factory so the transition is scheduled *after* layout,
      // not before; (b) the transition must be named when zoom is enabled, otherwise the zoom
      // behavior interrupts it and the graph renders incorrectly.
      .transition(() => d3.transition('heapviz-transition').duration(DEFAULT_TRANSITION_TIME) as any)
      .renderDot(dotString, () => {
        if (!this.isMounted) {
          this.rendering = false
          return
        }
        // Graphviz cannot attach arbitrary attributes to HTML-label cells, so restore them before interaction and overlays run.
        processInjectedTitles(this.chartRootElement!)
        this.svgElementsById = new Map(Array.from(this.chartRootElement!.querySelectorAll('[id]'), element => [element.id, element]))
        this.drawnHoverStyles = renderedHoverStyles
        this.rendering = false
        // The hover may have changed while Graphviz was rendering.
        this.applyHoverColors()
        this.installClickListener()
        this.installMouseMoveListenersForHover()
        this.onRenderComplete()
        if (this.pendingUpdate) {
          this.pendingUpdate = false
          this.redraw()
        }
      })
  }
  public onHover (hoverInfos: HoverInfo[]) {
    if (this.relevantChange(this.highlightedItems.value, hoverInfos)) {
      this.highlightedItems.value = hoverInfos
      this.renderContext.setHoverInfos(hoverInfos)
      this.applyHoverColors()
    }
  }
  /**
   * Shows the current hover by recoloring the existing SVG instead of running a new Graphviz layout.
   * It builds the DOT string for the current hover, which is cheap compared with a layout, and copies
   * the colors that differ from the drawn ones. While Graphviz is rendering, the render callback applies them.
   */
  private applyHoverColors () {
    if (this.drawnHoverStyles === null || !this.traceState)
      return
    const nextHoverStyles = hoverStylesFromDot(this.render())
    applyHoverStyles(this.svgElementsById, this.drawnHoverStyles, nextHoverStyles)
    this.drawnHoverStyles = nextHoverStyles
  }
  public zoomIn () {
    this.scaleBy(BTN_ZOOM_FACTOR)
  }
  public zoomOut () {
    this.scaleBy(1 / BTN_ZOOM_FACTOR)
  }
  public zoomReset () {
    // resetZoom animates back to the graph's own layout position at scale 1.
    // d3-graphviz recomputes that position on every render, so it stays correct when the graph changes size.
    // It throws before the first render, when d3-graphviz has not attached its zoom behavior yet.
    if (this.graphvizInstance?.zoomBehavior())
      this.graphvizInstance.resetZoom(this.zoomTransition() as any)
  }
  /** Creates the animation shared by the zoom buttons. */
  private zoomTransition () {
    return d3.transition()
      .duration(TRANSFORMATION_DURATION)
      .ease(d3.easeCubic)
  }
  /**
   * Animates the zoom by `factor` around the view center, using the zoom behavior that d3-graphviz attached
   * to the SVG. Mouse-wheel and button zooming then share one state and one set of scale limits.
   * Does nothing before the first render, because d3-graphviz attaches its zoom behavior only then.
   */
  private scaleBy (factor: number) {
    const zoomBehavior = this.graphvizInstance?.zoomBehavior()
    if (!zoomBehavior)
      return
    d3.select(this.chartRootElement).select('svg')
      .transition(this.zoomTransition() as any)
      .call(zoomBehavior.scaleBy as any, factor)
  }

  public close () {
    this.isMounted = false
    this.stopTraceWatch?.()
    this.stopTraceWatch = null
    HoverSynchronizer.removeOnHover(this.hoverHandler)
    d3.select(this.chartRootElement).on('.heapviz', null)
    this.chartRootElement = null
    this.graphvizInstance = null
    this.isInitialized = false
    this.rendering = false
    this.pendingUpdate = false
    this.drawnHoverStyles = null
    this.svgElementsById = new Map()
    this.lastRenderedDotString = null
  }
  public render (): string {
    if (!this.traceState) {
      return ''
    }
    let dotString = `digraph {
                            graph [ rankdir="LR", ranksep="0.55", nodesep="0.02", penwidth="1.0", splines="true" ]
                            edge [ dir="both", arrowtail="odot", arrowhead="vee", arrowsize="0.7", penwidth="1.2"] /* sametail="x"; samehead="x" not working */
                            node [ shape="plaintext" ]
                            `
    dotString += this.getNodes()
    dotString += this.traceState.edges()
    dotString += '\n}\n'
    return dotString;
  }
  public onMounted (chartRootElement: Element) {
    this.chartRootElement = chartRootElement
    this.isMounted = true
    // d3-graphviz accepts the root DOM node directly. Keeping that exact node makes the
    // renderer instance-safe even if another chart later reuses the same CSS selector.
    this.graphvizInstance = graphviz(chartRootElement)
      // d3-graphviz attaches its own zoom behavior (mouse wheel, drag, zoom buttons) on the first render and
      // reads the scale limits only at that point, so they must be set before anything is rendered.
      // The wheel and the buttons share these limits but step differently: the wheel uses d3-zoom's default
      // step (about 1.1-1.2x per notch, depending on browser and device), zooms around the mouse pointer and
      // is not animated. The buttons zoom by BTN_ZOOM_FACTOR around the view center, with an animation.
      .zoomScaleExtent([MAX_ZOOM_OUT_FACTOR, MAX_ZOOM_IN_FACTOR])
      //.logEvents(true) // -> for large graphs, dataProcessPass1End is the event that takes the longest by far
      .onerror((msg: string) => console.error(msg))
      .on('initEnd', () => {
        if (!this.isMounted)
          return
        this.isInitialized = true
        this.redraw()
        HoverSynchronizer.onHover(this.hoverHandler)
      })
  }
  private relevantChange (current: HoverInfo[], next: HoverInfo[]) {
    const changes = (new Set(current) as any).symmetricDifference(new Set(next))
    for (const hoverInfo of changes) {
      if (hoverInfo.kind !== 'Line' && hoverInfo.kind !== 'Condition')
        return true
    }
    return false
  }
  private getNodes (): string {
    const dotString = NewLine + this.getStackAndStaticsNodeCluster() + NewLine + this.getHeapNodeCluster()
    return dotString.replaceAll(/^\s+/gm, '')
  }
  private getStackAndStaticsNodeCluster (): string {
    return renderRootsNode(this.traceState)
  }
  /**
   * Renders the heap as a Graphviz cluster with a blue "Heap" header bar across its full width.
   *
   * Graphviz clusters only support a plain title, and a filled bar cannot be sized before layout. So the heap is
   * drawn as two nested clusters: the outer one is filled blue, has no inner margin (`margin="0"`), and carries the
   * title; the inner one is filled white and covers the outer one everywhere except the title strip at the top.
   * The inner cluster keeps the default margin around the heap nodes. Because the bar is part of the layout,
   * it follows zoom, animated transitions, and image export without extra code.
   */
  public getHeapNodeCluster (): string {
    let dotString = `subgraph cluster_heap {
       shape="box";
       style="filled";
       fillcolor="${MAIN_HEADER_BG_COLOR}";
       color="black";
       margin="0";
       label=<
         <font point-size="${CLUSTER_TITLE_FONT_SIZE}" face="${FONT_FACE_CLUSTER_TITLE}" color="${MAIN_HEADER_FONT_COLOR}"><b>Heap</b></font>
       >;
       subgraph cluster_heap_body {
         style="filled";
         fillcolor="white";
         color="black";
         label="";\n`
    for (const heapItem of this.traceState.heapAfterExecution) {

      if (heapItem.isVisible) {
        dotString += heapItem.renderNode()
      }
    }
    dotString += '\n}\n}\n'
    return dotString
  }

  private calculateNodeVisibility (): void {
    const ids: number[] = []
    const toVisit: number[] = []
    if (this.traceState == null) {
      return
    }
    this.traceState.heapAfterExecution.forEach(e => {
      e.isVisible = e.faked
      if (e.faked) {
        ids.push(e.id)
        toVisit.push(e.id)
      }
    })
    for (const stackFrame of this.traceState.stackAfterExecution) {
      for (const localVar of stackFrame.localVariables) {
        if (localVar.value instanceof HeapVizReferenceVal) {
          if (localVar.isExpanded) {
            ids.push(localVar.value.reference)
            toVisit.push(localVar.value.reference)
          }
        } else {
          // PrimitiveVal or NullVal
        }
      }
      if (stackFrame.this) {
        ids.push((stackFrame.this.value as HeapVizReferenceVal).reference)
        toVisit.push((stackFrame.this.value as HeapVizReferenceVal).reference)
      }
    }
    for (const loadedClass of this.traceState.loadedClassesAfterExecution) {
      if (!loadedClass.isVisible)
        continue

      for (const staticVar of loadedClass.staticFields) {
        if (staticVar.value instanceof HeapVizReferenceVal) {
          if (staticVar.isExpanded) {
            ids.push(staticVar.value.reference)
            toVisit.push(staticVar.value.reference)
          }
        } else {
          // PrimitiveVal or NullVal
        }
      }
    }
    while (toVisit.length > 0) {
      const nextId = toVisit.pop()!
      const nextItem = this.getHeapItemById(nextId)
      if (!nextItem) {
        console.error('could not find heap object with ID ' + nextId)
        console.error(this.traceState.heapAfterExecution)
      }
      nextItem.isVisible = true
      if (nextItem instanceof HeapVizHeapObject && nextItem.fieldsAreVisible) {
        if (nextItem.isVisible) {
          for (let i = 0; i < nextItem.numberOfVisibleObjectFields(); i++) {
            const field = nextItem.fields[i]
            if (field.value instanceof HeapVizReferenceVal) {
              if (field.isExpanded && !ids.includes(field.value.reference)) {
                ids.push(field.value.reference)
                toVisit.push(field.value.reference)
              }
            } else {
              // PrimitiveVal or NullVal
            }
          }
        }
      } else if (nextItem instanceof HeapVizHeapArray) {
        for (let i = 0; i < nextItem.numberOfVisibleArrayElements(); i++) {
          const element = nextItem.elements[i]
          if (element.value.kind === 'HeapVizPrimitiveVal') {
            break // no need to iterate over the whole array
          }
          if (element.value instanceof HeapVizReferenceVal) {
            if (nextItem.elements[i].isExpanded && !ids.includes(element.value.reference)) {
              ids.push(element.value.reference)
              toVisit.push(element.value.reference)
            }
          }
        }
      } else if (nextItem instanceof HeapVizHeapString && nextItem.fieldIsVisible) {
        const field = nextItem.charArr
        if (field.value instanceof HeapVizReferenceVal && field.isExpanded && !ids.includes(field.value.reference)) {
          ids.push(field.value.reference)
          toVisit.push(field.value.reference)
        }
      }
    }
  }
  // Must be called with valid ID!!!
  private getHeapItemById (id: number): IHeapVizHeapItem {
    return this.traceState.heapAfterExecution.find(ho => ho.id === id)!
  }

  private identifierAtEventTarget (target: EventTarget | null): string | null {
    let element = target instanceof Element ? target : null
    while (element && element !== this.chartRootElement) {
      if (element.id)
        return element.id
      element = element.parentElement
    }
    return null
  }

  private referenceVariable (identifier: string): HeapVizVar | undefined {
    const stackVariables = this.traceState.stackAfterExecution.flatMap(frame => [
      ...(frame.this ? [frame.this] : []),
      ...frame.localVariables
    ])
    const staticVariables = this.traceState.loadedClassesAfterExecution.flatMap(loadedClass => loadedClass.staticFields)
    const objectVariables = this.traceState.heapAfterExecution.flatMap(heapItem => {
      if (heapItem instanceof HeapVizHeapObject)
        return heapItem.fields
      if (heapItem instanceof HeapVizHeapString)
        return [heapItem.charArr]
      return []
    })
    return [...stackVariables, ...staticVariables, ...objectVariables]
      .find(variable => variable.identifier === identifier && variable.value instanceof HeapVizReferenceVal)
  }

  private isReferenceArrayElement (identifier: string): boolean {
    return this.traceState.heapAfterExecution
      .filter((heapItem): heapItem is HeapVizHeapArray => heapItem instanceof HeapVizHeapArray)
      .flatMap(heapItem => heapItem.elements)
      .some(element => element.identifier === identifier && element.value instanceof HeapVizReferenceVal)
  }

  private installClickListener (): void {
    d3.select(this.chartRootElement).on('click.heapviz', (event: MouseEvent) => {
      const cellIdentifier = this.identifierAtEventTarget(event.target)
      if (!cellIdentifier)
        return

      const identifier = identifierFromSvgCellIdentifier(cellIdentifier)
      if (cellIdentifier.endsWith(`:${SVG_CELL_SUFFIXES.moreLess}`)) {
        this.heapVizMetaStore.setIsFullyVisibleIdentifier({
          identifier,
          e: !this.heapVizMetaStore.isFullyVisibleIdentifier(identifier)
        })
        this.redraw()
      } else if (this.referenceVariable(identifier) || this.isReferenceArrayElement(identifier)) {
        this.heapVizMetaStore.setExpandedIdentifier({
          identifier,
          e: !this.heapVizMetaStore.isExpandedIdentifier(identifier)
        })
        this.redraw()
      }
    })
  }
  private getHeapItemToHeapItemHoverInfos (sanitizedIdentifier: string, state: HeapVizTraceState): HoverInfo[] {
    const identifier = desanitizeIdentifier(sanitizedIdentifier)
    const hoverInfos: HoverInfo[] = []
    const splitId = identifier.split(':')
    const id = splitId[0].match(/\d+/g)
    const fieldName = splitId.length > 1 ? splitId[1] : ''
    let reference = -1
    if (id === null) {
      return []
    }
    const objId = Number(id[0])
    const heapItem = state.heapAfterExecution.find(o => o.id === objId)
    if (!heapItem) {
      return []
    }
    if (heapItem instanceof HeapVizHeapObject && fieldName.length > 0) {
      heapItem.fields.forEach(field => {
        if (field.name === fieldName && field.value instanceof HeapVizReferenceVal) {
          reference = field.value.reference
        }
      })
      hoverInfos.push(createHoverField(heapItem.id, fieldName, reference))
      if (reference !== -1) {
        hoverInfos.push(createHoverHeapObject(reference))
      }
      hoverInfos.push(createHoverClass(heapItem.varType))
      return hoverInfos
    }
    if (heapItem instanceof HeapVizHeapArray && fieldName.startsWith('i_')) {
      const idx = Number(fieldName.match(/\d+/g)![0])
      const arrayElement = heapItem.elements[idx]
      hoverInfos.push(createHoverArrayCell(objId, idx))
      if (arrayElement.value instanceof HeapVizReferenceVal) {
        hoverInfos.push(createHoverHeapObject(arrayElement.value.reference))
      }
      return hoverInfos
    }
    hoverInfos.push(createHoverHeapObject(objId))
    if (objId !== -1) {
      hoverInfos.push(...getReferencesOfHoveredHeapItem(objId, state))
    }
    if (!(heapItem instanceof HeapVizHeapArray)) {
      // info about which class the hovered object belongs to
      hoverInfos.push(createHoverClass(heapItem.varType))
    }
    return hoverInfos
  }
  private installMouseMoveListenersForHover () {
    d3.select(this.chartRootElement)
      .on('mousemove.heapviz', (event: MouseEvent) => {
        // see JW-264 for an explanation on why we use mousemove on entire heapviz rather than mouseenter/exit on objects within the heapviz
        const cellIdentifier = this.identifierAtEventTarget(event.target)
        if (cellIdentifier == null) {
          HoverSynchronizer.hover([])
          return
        }
        const identifier = identifierFromSvgCellIdentifier(cellIdentifier)
        const hoverInfos = identifier.charAt(0) === 'o'
          ? this.getHeapItemToHeapItemHoverInfos(identifier, this.traceState)
          : identifier.search('l_') >= 0 || identifier.search('s_') >= 0
            ? getLocalOrStaticsToHeapItemHoverInfos(identifier.split(':')[1], this.traceState)
            : getMethodHoverInfos(identifier, this.traceState)
        HoverSynchronizer.hover(hoverInfos)
      })
  }

}
