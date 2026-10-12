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
  MAX_ZOOM_IN_FACTOR,
  MAX_ZOOM_OUT_FACTOR,
  NewLine,
  TRANSFORMATION_DURATION
} from './constants';
import { linkHeapItemsToLoadedClasses } from '@/debugger/processedTraceState';
import type { DataStructureVisibilitySettings } from './DataStructureVisibility'
import { MemoryViewRenderContext } from './MemoryViewRenderContext'
import { processInjectedTitles } from './HeapLookup'
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
  private pendingUpdate: { needed: boolean, hoverChanged: boolean } = { needed: false, hoverChanged: false }
  private stopTraceWatch: (() => void) | null = null
  private zoomBehaviour!: import('vue').Ref<d3.ZoomBehavior<Element, unknown>, d3.ZoomBehavior<Element, unknown>>;

  /** The callback lets wrapper-owned overlays redraw only after the replacement SVG is ready. */
  constructor (private readonly onRenderComplete: () => void = () => {}) {}

  public get store (): any { return this.visualizationStore }
  public get domReady (): boolean { return this.chartRootElement !== null }

  public init () {
    this.zoomBehaviour = ref(d3
      .zoom()
      .scaleExtent([MAX_ZOOM_OUT_FACTOR, MAX_ZOOM_IN_FACTOR])
      .on('zoom', (e: any) => { // e is a ZoomEvent, although d3 typings do not seem to know that
        d3.select(this.chartRootElement)
          .select('svg g')
          .attr('transform', e.transform)
      }))
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
  public redraw (hoverChanged: boolean = false) {
    if (this.rendering) {
      this.pendingUpdate = {
        needed: true,
        hoverChanged: hoverChanged || this.pendingUpdate.hoverChanged
      }
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

    const duration = hoverChanged ? 0 : DEFAULT_TRANSITION_TIME
    this.lastRenderedDotString = dotString
    this.rendering = true

    this.graphvizInstance
      // Per d3-graphviz docs: (a) use a factory so the transition is scheduled *after* layout,
      // not before; (b) the transition must be named when zoom is enabled, otherwise the zoom
      // behavior interrupts it and the graph renders incorrectly.
      .transition(() => d3.transition('heapviz-transition').duration(duration) as any)
      .renderDot(dotString, () => {
        if (!this.isMounted) {
          this.rendering = false
          return
        }
        // Graphviz cannot attach arbitrary attributes to HTML-label cells, so restore them before interaction and overlays run.
        processInjectedTitles(this.chartRootElement!)
        this.installClickListener()
        this.installMouseMoveListenersForHover()
        this.onRenderComplete()
        this.rendering = false
        if (this.pendingUpdate.needed) {
          const nextHoverChanged = this.pendingUpdate.hoverChanged
          this.pendingUpdate = { needed: false, hoverChanged: false }
          this.redraw(nextHoverChanged)
        }
      })
  }
  public onHover (hoverInfos: HoverInfo[]) {
    if (this.relevantChange(this.highlightedItems.value, hoverInfos)) {
      this.highlightedItems.value = hoverInfos
      this.renderContext.setHoverInfos(hoverInfos)
      this.redraw(true)
    }
  }
  public zoomIn () {
    d3.select(this.chartRootElement).select('svg')
      .transition()
      .duration(TRANSFORMATION_DURATION)
      .ease(d3.easeCubic)
      .call(this.zoomBehaviour.value.scaleBy as any, BTN_ZOOM_FACTOR)
  }
  public zoomOut () {
    d3.select(this.chartRootElement).select('svg')
      .transition()
      .duration(TRANSFORMATION_DURATION)
      .ease(d3.easeCubic)
      .call(this.zoomBehaviour.value.scaleBy as any, 1 / BTN_ZOOM_FACTOR)
  }
  public zoomReset () {
    const svg = d3.select(this.chartRootElement).select('svg')
    const viewBox = svg.attr('viewBox').split(' ')
    const graphHeight = +viewBox[3]
    const transform = this.zoomBehaviour.value.transform as any
    // Define which point should be centered, resetting zoom to 1
    // +4 and -4 are used since they seem to be the default d3-graphviz offsets
    svg.transition('translateTransition').duration(TRANSFORMATION_DURATION)
      .ease(d3.easeCubic)
      .call(transform, d3.zoomIdentity.translate(4, graphHeight - 4))
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
    this.pendingUpdate = { needed: false, hoverChanged: false }
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
  public getHeapNodeCluster (): string {
    let dotString = `subgraph cluster_heap {
       shape="box";
       label=<
         <font point-size="${CLUSTER_TITLE_FONT_SIZE}" face="${FONT_FACE_CLUSTER_TITLE}">Heap</font>
       >;\n`
    for (const heapItem of this.traceState.heapAfterExecution) {

      if (heapItem.isVisible) {
        dotString += heapItem.renderNode()
      }
    }
    dotString += '\n}\n'
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
  private isHighlightedEdge (sanitizedFrom: string, sanitizedTo: string, highlightedItems: HoverInfo[], state: HeapVizTraceState): boolean {

    const from = desanitizeIdentifier(sanitizedFrom)
    const to = desanitizeIdentifier(sanitizedTo)
    const toObjId = Number(to.match(/\d+/g)![0])
    const objectHighlighted = highlightedItems.some(item => item.kind === 'HeapObject' && item.objId === toObjId)
    if (!objectHighlighted) {
      return false
    }
    const isLocal = from.split(':')[1].startsWith('l_')
    const isStatic = from.split(':')[1].startsWith('s_')
    if (from.startsWith('o_')) { // check if a field references a heap item
      const splitFrom = from.split(':')
      const fromObjId = Number(splitFrom[0].match(/\d+/g)![0])
      if (splitFrom[1].startsWith('i_')) {
        const index = Number(splitFrom[1].split('_')[1])
        for (const item of highlightedItems) {
          if (item.kind === 'ArrayCell' &&
            item.objId === fromObjId &&
            item.index === index) {
            return true
          }
        }
        return false
      }
      const field = splitFrom[1]
      for (const item of highlightedItems) {
        if (item.kind === 'Field' &&
          item.objId === fromObjId &&
          item.name === field &&
          item.reference === toObjId) {
          return true
        }
      }
      return false
    }
    if (isLocal) { // check if a local variable or static field is referencing a heap item
      const splitFrom = from.split('_')
      const name = splitFrom[splitFrom.length - 1]
      const stackFrame = state.stackAfterExecution[Number(splitFrom[1])]
      for (const item of highlightedItems) {
        if (item.kind === 'Local' &&
          item.class === stackFrame.class &&
          item.method === stackFrame.method &&
          item.name === name &&
          item.reference === toObjId) {
          return true
        }
      }
      return false
    }
    if (isStatic) {
      const splitFrom = from.split('_')
      const name = splitFrom.slice(2).join('_')
      const classOfStaticField = from.split('_')[1]
      const loadedClass = state.loadedClasses.find(loadedClass => loadedClass.class === classOfStaticField)!
      for (const item of highlightedItems) {
        if (item.kind === 'Static' &&
          item.class === loadedClass.class &&
          item.name === name &&
          item.reference === toObjId) {
          return true
        }
      }
      return false
    }
    if (from.split(':')[1].search('localvar_') === 0) {
      const stackFrameNr = Number(from.split('_')[1])
      const thisVar = state.stackAfterExecution.at(stackFrameNr)?.this?.value as HeapVizReferenceVal
      if (thisVar === undefined) {
        return false
      }
      for (const item of highlightedItems) {
        if (item.kind === 'ThisVar' &&
          thisVar.reference === toObjId &&
          item.methodId === stackFrameNr &&
          item.reference === toObjId) {
          return true
        }
      }
      for (const item of highlightedItems) {
        if (item.kind === 'ThisVar' ||
          item.kind === 'Static' ||
          item.kind === 'Local' ||
          item.kind === 'Field') {
          return false
        }
      }
      return thisVar.reference === toObjId && highlightedItems.some(item => item.kind === 'HeapObject' && item.objId === toObjId)
    }
    return false
  }

}
