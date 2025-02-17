<template>
  <div id="heap-wrapper">
    <NavigationBarWithSettings
      :zoom-in="zoomIn"
      :zoom-out="zoomOut"
      :zoom-reset="zoomReset"
      :pane-kind="HEAP" />
  </div>
</template>

<script lang="ts">
import * as d3 from 'd3'
import { graphviz } from 'd3-graphviz'
import 'd3-transition'
import { defineComponent } from 'vue'
import { ProcessedTraceState } from '@/dto/TraceState'
import {
  HeapVizHeapArray,
  HeapVizHeapArrayElementVar,
  HeapVizHeapItem, HeapVizHeapObject,
  HeapVizHeapString,
  HeapVizReferenceVal,
  HeapVizStackFrame,
  HeapVizTraceState,
  HeapVizVar
} from '@/components/TheHeapVisualization/types'
import { fromProcessedTraceState } from './mapping'
import { shortTypeName } from '@/helpers/Common'
import shared from '@Shared/Shared'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'
import {
  getHeapItemOrArrayHeaderBGOnHover,
  getHeapItemToHeapItemHoverInfos,
  getItemColorOnHover,
  getLocalOrStaticsToHeapItemHoverInfos,
  getMethodHeaderBGOnHover,
  getMethodHoverInfos,
  isHighlightedEdge,
  relevantChange
} from './hover'
import sanitizer from '@/helpers/sanitizer'
import { HEAP } from '@/store/PaneVisibilityStore'
import { useHeapVizMetaStore } from '@/store/HeapVizMetaStore'
import { mapStores } from 'pinia'
import { useGeneralStore } from '@/store/GeneralStore'
import {
  BTN_ZOOM_FACTOR,
  CHANGED_VAR_COLOR,
  CHANGED_VAR_TAG,
  CLUSTER_TITLE_FONT_SIZE,
  CONTENT_FONT_SIZE,
  DEFAULT_TRANSITION_TIME,
  FONT_FACE_CLUSTER_TITLE,
  FONT_FACE_TABLES,
  FONT_FACE_VALUES,
  MAIN_HEADER_BG_COLOR,
  MAX_ARRAY_ELEMENTS,
  MAX_FIELDS_THRESHOLD,
  MAX_SHOWN_FIELDS,
  MAX_ZOOM_IN_FACTOR,
  MAX_ZOOM_OUT_FACTOR,
  MIN_WIDTH, NULL_VAL,
  SUB_HEADER_BG_COLOR,
  TABLE_FORMAT,
  TRANSFORMATION_DURATION,
  TYPE_FONT_COLOR,
  UNCHANGED_VAR_COLOR,
  UNCHANGED_VAR_TAG
} from './constants'

const TRANSFORMATION_EASE = d3.easeCubic
const DOT_PARTS = {
  digraphStart:
    `digraph {
       graph [ rankdir="LR", ranksep="0.55", nodesep="0.02", penwidth="1.0", splines="true" ]
       edge [ dir="both", arrowtail="odot", arrowhead="vee", arrowsize="0.7", penwidth="1.2"] /* sametail="x"; samehead="x" not working */
       node [ shape="plaintext" ]
    `,
  rootsClusterStart:
    `subgraph cluster_roots {
     shape="box";
     style="invis";
  `,
  rootsTableStart:
    `roots[shape="plaintext";
           label=<
             <font face="${FONT_FACE_TABLES}" point-size="${CONTENT_FONT_SIZE}">
               <table ${TABLE_FORMAT} id="rootsTable">
                 <tr>
                   <td colspan="5" bgcolor="${MAIN_HEADER_BG_COLOR}" id="staticsHeader">
                     <font face="${FONT_FACE_CLUSTER_TITLE}" point-size="${CLUSTER_TITLE_FONT_SIZE}">
                       <b>Statics</b>
                     </font>
                   </td>
                 </tr>
    `,
  stackTableMethodHeaderRow:
    `            <tr>
                   <td bgcolor="###BG_COLOR###" colspan="5" href="###IDENTIFIER###">
                     <font face="${FONT_FACE_CLUSTER_TITLE}">
                       <b>###TITLE###</b>
                     </font>
                   </td>
                 </tr>
  `,
  internalStackFramesDots:
    `            <tr>
                   <td bgcolor="${SUB_HEADER_BG_COLOR}" colspan="5">
                     <font face="${FONT_FACE_CLUSTER_TITLE}">
                       <b>…</b>
                     </font>
                   </td>
                 </tr>
  `,
  rootsTableSeparator:
    `            <tr>
                   <td colspan="5" border="0" height="15"></td>
                 </tr>
    `,
  stackTableStart:
    `            <tr>
                   <td colspan="5" bgcolor="${MAIN_HEADER_BG_COLOR}" id="stackHeader">
                     <font face="${FONT_FACE_CLUSTER_TITLE}" point-size="${CLUSTER_TITLE_FONT_SIZE}">
                      <b>Stack</b>
                     </font>
                   </td>
                 </tr>
    `,
  staticsTableClassHeaderRow:
    `            <tr>
                   <td bgcolor="${SUB_HEADER_BG_COLOR}" colspan="5">
                     <font face="${FONT_FACE_CLUSTER_TITLE}">
                       <b>
                         ###CLASS###
                       </b>
                     </font>
                   </td>
                 </tr>
    `,
  rootsTableEnd:
    `          </table>
             </font>
           >
    ]
    `,
  rootsClusterEnd: '\n}\n',

  heapClusterStart:
    `subgraph cluster_heap {
       shape="box";
       label=<
         <font point-size="${CLUSTER_TITLE_FONT_SIZE}" face="${FONT_FACE_CLUSTER_TITLE}">
           Heap
         </font>
       >;
    `,

  heapObjectProperties:
    `[label=###LABEL###, class="###CLASS###"]`,

  heapObjectLabelStart:
    `<<font face="${FONT_FACE_TABLES}" point-size="${CONTENT_FONT_SIZE}">
       <table ${TABLE_FORMAT}>
    `,

  heapObjectHeaderRow:
    `    <tr>
           <td bgcolor="###BG_COLOR###" sides="TBL" port="heap_object_type"></td>
           <td align="center" colspan="3" href="###IDENTIFIER###" bgcolor="###BG_COLOR###" sides="TB">
             <b>###TYPE###</b>
           </td>
           <td align="right" bgcolor="###BG_COLOR###" sides="TBR">
           </td>
         </tr>
    `,
  heapArrayHeaderRow:
    `    <tr>
           <td bgcolor="###BG_COLOR###" sides="TBL" port="heap_object_type"></td>
           <td align="center" colspan="3" href="###IDENTIFIER###" bgcolor="###BG_COLOR###" sides="TB">
             <b>###TYPE###</b>
           </td>
           <td align="right" bgcolor="###BG_COLOR###" sides="TBR"></td>
         </tr>
    `,
  // Example replacements:
  // TYPE: "java.lang.String"
  // NAME: "myString"
  // PORT: "l_3_myString" ((l)ocal var) or "s_MyClass_myString" ((s)tatic field) or "myString" (in object) or "" (if null)
  // IDENTIFIER: similar to port, see TheHeapVisualizationData.ts (is used for identification on click)
  // HIGHLIGHT_COLOR: "#000000" (hex RGB)
  // HIGHLIGHT_TAG: "b" (changed) or "font" (not changed)
  // VALUE: "➕" or "➖" (reference) or "o" (null)
  referenceVarRow:
    `    <tr>
           <td sides="R"></td>
           <td width="${MIN_WIDTH}" align="right" href="###IDENTIFIER###" bgcolor="###BG_COLOR###">
             <font color="${TYPE_FONT_COLOR}">
               <###HIGHLIGHT_TAG###>###TYPE###</###HIGHLIGHT_TAG###>
             </font>
             <font color="###HIGHLIGHT_COLOR###">
               <###HIGHLIGHT_TAG###>&nbsp;###NAME###</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td align="right" cellpadding="0" cellspacing="0" href="###IDENTIFIER###" port="###PORT###" sides="LTB" bgcolor="###BG_COLOR###">
             <font color="###BG_COLOR###">xx</font>
           </td>
           <td align="left" cellpadding="0" cellspacing="0" href="###IDENTIFIER###" sides="RTB" bgcolor="###BG_COLOR###">
             <###HIGHLIGHT_TAG###>###VALUE###</###HIGHLIGHT_TAG###>
           </td>
           <td sides="L"></td>
         </tr>
  `,
  // Example replacements:
  // TYPE: "int"
  // NAME: "i"
  // IDENTIFIER: similar to port, see TheHeapVisualizationData.ts (is used for identification on click)
  // HIGHLIGHT_COLOR: "#000000" (hex RGB)
  // HIGHLIGHT_TAG: "b" (changed) or "font" (not changed)
  // VALUE: "13"
  // TOOL_TIP is used to expand floats (i.e. 1.234...E12 to 1.234567890E12) see JW-50 for an explanation on why we need a href
  primitiveVarRow:
    `    <tr>
           <td sides="R"></td>
           <td width="${MIN_WIDTH}" align="right" href="###IDENTIFIER###" bgcolor="###BG_COLOR###">
             <font color="${TYPE_FONT_COLOR}">
               <###HIGHLIGHT_TAG###>###TYPE###</###HIGHLIGHT_TAG###>
             </font>
             <font color="###HIGHLIGHT_COLOR###">
               <###HIGHLIGHT_TAG###>&nbsp;###NAME###</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td align="right" cellpadding="0" cellspacing="0" sides="LTB" bgcolor="###BG_COLOR###">

           </td>
           <td align="left" cellpadding="0" cellspacing="0" sides="RTB" tooltip="###TOOL_TIP###" href="###IDENTIFIER###" pointer-events="none" bgcolor="###BG_COLOR###">
             <font color="###HIGHLIGHT_COLOR###" face="${FONT_FACE_VALUES}">
               <###HIGHLIGHT_TAG###>###VALUE###&nbsp;&nbsp;</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td sides="L"></td>
         </tr>
  `,
  stringRow:
    `    <tr>
           <td sides="R"></td>
           <td width="${MIN_WIDTH}" colspan="3" href="###IDENTIFIER###" bgcolor="###BG_COLOR###">
             <font color="###HIGHLIGHT_COLOR###" face="${FONT_FACE_VALUES}">
               <###HIGHLIGHT_TAG###>"###VALUE###"</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td sides="L"></td>
         </tr>
  `,
  referenceArrayRow:
    `    <tr>
           <td sides="R"></td>
           <td width="${MIN_WIDTH}" href="###IDENTIFIER###" bgcolor="###BG_COLOR###">
             <font color="###HIGHLIGHT_COLOR###">
               <###HIGHLIGHT_TAG###>[###INDEX###]</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td align="right" cellpadding="0" cellspacing="0" href="###IDENTIFIER###" port="i_###INDEX###" sides="LTB" bgcolor="###BG_COLOR###">
             <font color="white">--</font>
           </td>
           <td align="left" cellpadding="0" cellspacing="0" href="###IDENTIFIER###" sides="RTB" bgcolor="###BG_COLOR###">
             <###HIGHLIGHT_TAG###>###VALUE###</###HIGHLIGHT_TAG###>
           </td>
           <td sides="L"></td>
         </tr>
  `,
  largeArrayRow:
    `    <tr>
           <td sides="R"></td>
           <td colspan="3" href="###IDENTIFIER###">
             ###TEXT###
           </td>
           <td sides="L"></td>
         </tr>
  `,
  arrayEmptyRow:
    `    <tr>
           <td sides="R"></td>
           <td colspan="3" href="###IDENTIFIER###" bgcolor="###BG_COLOR###">
             <font face="${FONT_FACE_VALUES}">
               <i>
                 empty
               </i>
             </font>
           </td>
           <td sides="L"></td>
         </tr>
  `,
  heapObjectLabelEnd:
    `  </table>
     </font>>
  `,
  heapClusterEnd: '\n}\n',
  digraphEnd: '\n}\n'
}

function thisVar (stackFrame: HeapVizStackFrame, stackFrameNr: number, newlyEnteredStackframe: boolean): HeapVizVar {
  return {
    type: stackFrame.class,
    name: 'this',
    port: `localvar_${stackFrameNr}_this`,
    identifier: `roots:localvar_${stackFrameNr}_this`,
    changed: newlyEnteredStackframe,
    kind: 'HeapVizVar',
    value: {
      kind: 'HeapVizReferenceVal',
      reference: stackFrame.this!.reference
    }
  }
}

function isLargeArray (heapItem: HeapVizHeapItem): boolean {
  return heapItem.kind === 'HeapVizHeapArray' && heapItem.elements.length > MAX_ARRAY_ELEMENTS
}

function isLargeObject (heapItem: HeapVizHeapItem): boolean {
  return heapItem.kind === 'HeapVizHeapObject' && heapItem.fields.length > MAX_FIELDS_THRESHOLD
}

function varColor (variable: HeapVizVar | HeapVizHeapArrayElementVar): string {
  return variable.changed ? CHANGED_VAR_COLOR : UNCHANGED_VAR_COLOR
}

function varTag (variable: HeapVizVar | HeapVizHeapArrayElementVar): string {
  return variable.changed ? CHANGED_VAR_TAG : UNCHANGED_VAR_TAG
}

function heapItemHeaderType (heapItem: HeapVizHeapItem) {
  return shortTypeName(heapItem.type)
}

export default defineComponent({
  name: 'TheHeapVisualization',
  components: { NavigationBarWithSettings },
  data: function () {
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([MAX_ZOOM_OUT_FACTOR, MAX_ZOOM_IN_FACTOR])
      .on('zoom', (e: any) => { // e is a ZoomEvent, although d3 typings do not seem to know that
        d3.select('#heap-wrapper > svg g').attr('transform', e.transform)
      })

    const highlightedItems: HoverInfo[] = []

    return {
      // viewBoxBeforeUpdate: '0.00 0.00 368.00 152.00',
      HEAP,
      zoomBehavior,
      highlightedItems
    }
  },
  computed: {
    currentHeapVizTraceState: function (): HeapVizTraceState {
      const vm = this
      /*  we want to use processedTrace to access the already computed changed-flag for highlighting changed elements,
       *  but it's only available after the first step, so the first state still has to come from the original trace
       *  (because we want to display static fields, args etc. _before_ the first step)
      */
      if (vm.generalStore.currentTraceData?.processedTraceState) {
        return fromProcessedTraceState(vm.generalStore.currentTraceData?.processedTraceState)
      }
      const first = vm.generalStore.currentTraceData?.firstTraceState!
      const processedState: ProcessedTraceState = {
        kind: 'ProcessedTraceState',
        localUri: first.sourceFileUri,
        line: first.line,
        heapBeforeExecution: first.heap,
        stackBeforeExecution: first.stack,
        loadedClassesBeforeExecution: first.loadedClasses,
        stateIndex: 0,
        heapAfterExecution: first.heap,
        stackAfterExecution: first.stack,
        loadedClassesAfterExecution: first.loadedClasses
      }

      processedState.stackAfterExecution!!.flatMap(frame => frame.localVariables).forEach(lv => {
        lv.changed = true
      })
      processedState.loadedClassesAfterExecution!!.flatMap(clazz => clazz.staticFields).forEach(sf => {
        sf.changed = true
      })

      return fromProcessedTraceState(processedState)
    },
    ...mapStores(useGeneralStore, useHeapVizMetaStore)
  },
  watch: {
    currentHeapVizTraceState: function () {
      const vm = this

      /*
      3 cases:
      - object is already in map (because isFullyVisible was accessed at some point) => don't touch
      - object is not in map, but one of its fields is already in map (because isExpanded was accessed) => don't touch
      - object is not in map and none of its fields have been accessed before => must be fresh large objs => set isExpanded for all fields to false
       */
      vm.currentHeapVizTraceState.heapAfterExecution
        .filter(heapItem => isLargeObject(heapItem) && !vm.heapVizMetaStore.isIdentifierInMap(heapItem.identifier))
        .forEach(heapObject => {
          const fields = (heapObject as HeapVizHeapObject).fields
          if (fields.every(f => !vm.heapVizMetaStore.isIdentifierInMap(f.identifier))) {
            fields.forEach(field => vm.heapVizMetaStore.setExpandedIdentifier({ identifier: field.identifier, e: false }))
          }
        })

      vm.redraw()
    }
  },
  mounted () {
    const vm = this
    vm.redraw()
    HoverSynchronizer.onHover(vm.onHover)
  },
  unmounted () {
    const vm = this
    HoverSynchronizer.removeOnHover(vm.onHover)
  },
  methods: {
    stackTableFrameHeaderRow: function (stackFrame: HeapVizStackFrame): string {
      const vm = this
      const title = sanitizer.escapeHtml(stackFrame.displayText)
      return DOT_PARTS.stackTableMethodHeaderRow
        .replaceAll('###TITLE###', title)
        .replaceAll('###IDENTIFIER###', stackFrame.displayText)
        .replaceAll('###BG_COLOR###', getMethodHeaderBGOnHover(stackFrame, vm.highlightedItems))
    },
    varRow: function (v: HeapVizVar): string {
      const vm = this
      const value = vm.varValue(v)

      if (v.value.kind === 'HeapVizPrimitiveVal') {
        return DOT_PARTS.primitiveVarRow
          .replaceAll('###TYPE###', shortTypeName(v.type))
          .replaceAll('###NAME###', v.name)
          .replaceAll('###IDENTIFIER###', v.identifier)
          .replaceAll('###HIGHLIGHT_COLOR###', varColor(v))
          .replaceAll('###HIGHLIGHT_TAG###', varTag(v))
          .replaceAll('###VALUE###', v.type === 'char' ? `'${value}'` : value)
          .replaceAll('###TOOL_TIP###', v.value.title ?? '')
          .replaceAll('###BG_COLOR###', () => getItemColorOnHover(v, vm.highlightedItems, vm.currentHeapVizTraceState))
      }
      return DOT_PARTS.referenceVarRow
        .replaceAll('###TYPE###', shortTypeName(v.type))
        .replaceAll('###NAME###', v.name)
        .replaceAll('###PORT###', v.port)
        .replaceAll('###IDENTIFIER###', v.identifier)
        .replaceAll('###HIGHLIGHT_COLOR###', varColor(v))
        .replaceAll('###HIGHLIGHT_TAG###', varTag(v))
        .replaceAll('###VALUE###', value)
        .replaceAll('###BG_COLOR###', getItemColorOnHover(v, vm.highlightedItems, vm.currentHeapVizTraceState))
    },
    stringRow: function (s: HeapVizHeapString): string {
      const vm = this
      const value = s.vizString
      return DOT_PARTS.stringRow
        .replaceAll('###HIGHLIGHT_COLOR###', varColor(s.charArr))
        .replaceAll('###HIGHLIGHT_TAG###', varTag(s.charArr))
        .replaceAll('###VALUE###', sanitizer.escapeHtml(value))
        .replaceAll('###IDENTIFIER###', s.identifier)
        .replaceAll('###BG_COLOR###', getItemColorOnHover(s, vm.highlightedItems, vm.currentHeapVizTraceState))
    },
    staticsTableClassHeaderRow: function (clazz: string): string {
      return DOT_PARTS.staticsTableClassHeaderRow.replaceAll('###CLASS###', sanitizer.escapeHtml(shortTypeName(clazz)))
    },
    headerRow: function (heapItem: HeapVizHeapItem): string {
      if (heapItem.kind === 'HeapVizHeapArray') {
        return this.heapArrayHeaderRow(heapItem)
      } else {
        return this.heapObjectHeaderRow(heapItem)
      }
    },
    heapObjectHeaderRow: function (heapItem: HeapVizHeapItem): string {
      const vm = this
      return DOT_PARTS.heapObjectHeaderRow
        .replaceAll('###TYPE###', heapItemHeaderType(heapItem))
        .replaceAll('###IDENTIFIER###', heapItem.identifier)
        .replaceAll('###BG_COLOR###', getHeapItemOrArrayHeaderBGOnHover(heapItem, vm.highlightedItems))
    },
    heapArrayHeaderRow: function (heapArray: HeapVizHeapArray) {
      const vm = this
      return DOT_PARTS.heapArrayHeaderRow
        .replaceAll('###TYPE###', heapItemHeaderType(heapArray))
        .replaceAll('###IDENTIFIER###', heapArray.identifier)
        .replaceAll('###BG_COLOR###', getHeapItemOrArrayHeaderBGOnHover(heapArray, vm.highlightedItems))
    },
    heapReferenceArrayRow: function (arr: HeapVizHeapArray, index: number): string {
      const vm = this
      const elem = arr.elements[index]

      return DOT_PARTS.referenceArrayRow
        .replaceAll('###INDEX###', elem.index.toString())
        .replaceAll('###IDENTIFIER###', elem.identifier)
        .replaceAll('###HIGHLIGHT_COLOR###', varColor(elem))
        .replaceAll('###HIGHLIGHT_TAG###', varTag(elem))
        .replaceAll('###VALUE###', vm.varValue(elem))
        .replaceAll('###BG_COLOR###', getItemColorOnHover(elem, vm.highlightedItems, vm.currentHeapVizTraceState))
      // .replaceAll('###TOOL_TIP###', vm.varTitle(elem))
    },
    largeArrayRow: function (heapArray: HeapVizHeapArray): string {
      const vm = this
      let moreLessText = ''

      if (vm.isCollapsedArray(heapArray)) {
        moreLessText += vm.heapItemContainsHiddenChangedElement(heapArray)
          ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`
          : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`
      } else {
        moreLessText += `<font color="black"><i>show less</i></font>`
      }
      return DOT_PARTS.largeArrayRow
        .replaceAll('###IDENTIFIER###', heapArray.identifier)
        .replaceAll('###TEXT###', moreLessText)
    },
    heapArrayEmptyRow: function (heapArray: HeapVizHeapArray): string {
      const vm = this
      return DOT_PARTS.arrayEmptyRow
        .replaceAll('###IDENTIFIER###', heapArray.identifier)
        .replaceAll('###BG_COLOR###', getItemColorOnHover(heapArray, vm.highlightedItems, vm.currentHeapVizTraceState))
    },
    onHover (hoverInfos: HoverInfo[]) {
      const vm = this
      if (relevantChange(vm.highlightedItems, hoverInfos)) {
        vm.highlightedItems = hoverInfos
        vm.redraw(true)
      }
    },
    zoomIn () {
      const vm = this
      d3.transition().select('#heap-wrapper > svg')
        .duration(TRANSFORMATION_DURATION)
        .ease(TRANSFORMATION_EASE)
        .call(vm.zoomBehavior.scaleBy as any, BTN_ZOOM_FACTOR)
    },
    zoomOut () {
      const vm = this
      d3.transition().select('#heap-wrapper > svg')
        .duration(TRANSFORMATION_DURATION)
        .ease(TRANSFORMATION_EASE)
        .call(vm.zoomBehavior.scaleBy as any, 1 / BTN_ZOOM_FACTOR)
    },
    zoomReset () {
      const vm = this
      const svg = d3.select('#heap-wrapper svg')
      const viewBox = svg.attr('viewBox').split(' ')
      const graphHeight = +viewBox[3]

      const transform = vm.zoomBehavior.transform as any

      // Define which point should be centered, resetting zoom to 1
      // +4 and -4 are used since they seem to be the default d3-graphviz offsets
      svg.transition('translateTransition').duration(TRANSFORMATION_DURATION)
        .ease(TRANSFORMATION_EASE)
        .call(transform, d3.zoomIdentity.translate(4, graphHeight - 4))
    },
    toggleExpanded (variable: HeapVizVar) {
      const vm = this
      vm.toggleExpandedIdentifier(variable.identifier)
    },
    setExpanded (variable: HeapVizVar, e: boolean) {
      const vm = this
      vm.heapVizMetaStore.setExpandedIdentifier({ identifier: variable.identifier, e })
    },
    setExpandedIdentifier (identifier: string, e: boolean) {
      const vm = this
      vm.heapVizMetaStore.setExpandedIdentifier({ identifier, e })
    },
    isExpanded (variable: HeapVizVar | HeapVizHeapArrayElementVar): boolean {
      const vm = this
      return vm.heapVizMetaStore.isExpandedIdentifier(variable.identifier)
    },
    toggleExpandedIdentifier (identifier: string) {
      const vm = this
      vm.heapVizMetaStore.setExpandedIdentifier({ identifier, e: !vm.heapVizMetaStore.isExpandedIdentifier(identifier) })
    },
    toggleIsFullyVisibleIdentifier (identifier: string) {
      const vm = this
      vm.heapVizMetaStore.setIsFullyVisibleIdentifier({ identifier, e: !vm.heapVizMetaStore.isFullyVisibleIdentifier(identifier) })
    },
    numberOfVisibleArrayElements: function (arr: HeapVizHeapArray): number {
      const vm = this
      return isLargeArray(arr) && !vm.heapVizMetaStore.isFullyVisibleIdentifier(arr.identifier)
        ? MAX_ARRAY_ELEMENTS
        : arr.elements.length
    },
    numberOfVisibleObjectFields: function (obj: HeapVizHeapObject): number {
      const vm = this
      return isLargeObject(obj) && !vm.heapVizMetaStore.isFullyVisibleIdentifier(obj.identifier)
        ? MAX_SHOWN_FIELDS
        : obj.fields.length
    },
    isCollapsedArray: function (arr: HeapVizHeapArray): boolean {
      const vm = this
      return isLargeArray(arr) && !vm.heapVizMetaStore.isFullyVisibleIdentifier(arr.identifier)
    },
    isCollapsedObject: function (obj: HeapVizHeapObject): boolean {
      const vm = this
      return isLargeObject(obj) && !vm.heapVizMetaStore.isFullyVisibleIdentifier(obj.identifier)
    },
    heapItemContainsHiddenChangedElement: function (item: HeapVizHeapItem): boolean {
      if (item.kind === 'HeapVizHeapArray') {
        return item.elements.some((elem: HeapVizHeapArrayElementVar, index: number) => index >= MAX_ARRAY_ELEMENTS && elem.changed)
      } else if (item.kind === 'HeapVizHeapObject') {
        return item.fields.some((field: HeapVizVar, index: number) => index >= MAX_SHOWN_FIELDS && field.changed)
      } else {
        // must be string (or dragons :D), irrelevant
        return false
      }
    },
    varTitle: function (variable: HeapVizVar | HeapVizHeapArrayElementVar): string {
      if (variable.value.kind === 'HeapVizPrimitiveVal') {
        return variable.value.title || ''
      }
      return ''
    },
    varValue: function (variable: HeapVizVar | HeapVizHeapArrayElementVar): string {
      const vm = this
      if (variable.value.kind === 'HeapVizPrimitiveVal') {
        const value = variable.value.vizValue
        return `${value}`
      } else if (variable.value.kind === 'HeapVizReferenceVal') {
        let refVarString = '<font color="white">'
        if (vm.isExpanded(variable)) {
          return refVarString + 'xx</font>'
        }
        refVarString += '➕'
        return refVarString + '</font>'
        // TODO center/make smaller // Remark: The + symbol is always black. The white font color is on purpose to ensure that the collapsed and the expanded version have the same number of SVG elements, which is needed to ensure correct transition animations
      } else {
        return NULL_VAL
      }
    },
    redraw: function (hoverChanged: boolean = false) {
      const vm = this

      if (!vm.currentHeapVizTraceState) {
        try {
          graphviz('#heap-wrapper')
            .renderDot('')
        } catch (ex) {
          console.error(ex)
        }
        return
      }

      vm.calculateNodeVisibility()

      const dotString = vm.heapToDotString()

      shared.logDebug(dotString)

      try {
        if (!d3.select('#heap-wrapper').node()) {
          console.warn('Cannot render heap because the div is not present.')
          return
        }
        const graphVisualization = graphviz('#heap-wrapper')
        // d3-graphviz transition animations are broken for HTML-like lables
        // changing the following settings does NOT have the expected result / no result at all:
        // graphVisualization.fade(true) // default
        // graphVisualization.growEnteringEdges(true)
        // graphVisualization.tweenPaths(false)
        // graphVisualization.logEvents(false) // default
        // graphVisualization.tweenPrecision('5%')
        // graphVisualization.tweenShapes(false)
        graphVisualization.onerror(dotErrorMessage => console.error(dotErrorMessage))
        graphVisualization.on('initEnd', () => {
          const duration = hoverChanged ? 0 : DEFAULT_TRANSITION_TIME
          // if (diffSinceLast < 1.1 * DEFAULT_TRANSITION_TIME) {
          //  duration = 100
          // }
          const t = d3.transition().duration(duration) as any
          graphVisualization.transition(t)
          graphVisualization.renderDot(dotString, function () {
            // vm.updateViewBox()

            // using the callback of renderDot ensures that the listeners are only attached after the rendering has finished
            d3.selectAll('g a')
              .on('click', null)

            d3.selectAll('g.large-heap-element a')
              .on('click.large-heap-element', function (event: any) {
                event.preventDefault()

                vm.toggleIsFullyVisibleIdentifier(d3.select(this).attr('href'))
                vm.redraw()
              })

            d3.selectAll('g:not(large-heap-element) a')
              .on('click.other', function (event: any) {
                event.preventDefault() // to stop navigation

                vm.toggleExpandedIdentifier(d3.select(this).attr('href'))

                // vm.viewBoxBeforeUpdate = d3.select('#heap-wrapper > svg').attr('viewBox')
                vm.redraw()
              })

            d3.select('#heap-wrapper')
              .on('mousemove', (event) => {
                // see JW-264 for an explanation on why we use mousemove on entire heapviz rather than mouseenter/exit on objects within the heapviz
                let node = event.target
                if (!(node instanceof Node)) return
                let identifier = null
                while (node.parentElement !== null) {
                  node = node.parentElement
                  if (node instanceof SVGSVGElement) {
                    break
                  }
                  if (!(node instanceof SVGElement)) {
                    break
                  }
                  const href = node.getAttribute('href')
                  if (href != null) {
                    identifier = href
                    break
                  }
                }
                if (identifier == null) {
                  HoverSynchronizer.hover([])
                  return
                }
                let hoverInfos = []
                // check if a heap object is hovered
                if (identifier.charAt(0) === 'o') {
                  hoverInfos = getHeapItemToHeapItemHoverInfos(identifier, vm.currentHeapVizTraceState)
                  // check if a stack or statics item is hovered
                } else if (identifier.search('l_') >= 0 || identifier.search('s_') >= 0 || identifier.search('localvar_') >= 0) {
                  hoverInfos = getLocalOrStaticsToHeapItemHoverInfos(identifier.split(':')[1], vm.currentHeapVizTraceState)
                } else { // otherwise a method is hovered
                  hoverInfos = getMethodHoverInfos(identifier, vm.currentHeapVizTraceState)
                }
                HoverSynchronizer.hover(hoverInfos)
              })
          })
        })
      } catch (ex) {
        // This happens when we want to redraw while another draw / transition is already in progress
        // What happens now is that this already ongoing transition is cancelled
        // After that, we again call redraw (see one line below) which now will not encounter an
        // already ongoing draw / transition and will work fine
        console.error(ex)
        vm.redraw()
      }
    },
    heapToDotString (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }
      return DOT_PARTS.digraphStart +
        vm.getNodes() +
        vm.getEdges() +
        DOT_PARTS.digraphEnd
    },
    getStackAndStaticsNodeCluster (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }
      let dotString = DOT_PARTS.rootsClusterStart
      dotString += vm.getStaticsNode()
      dotString += vm.getStackNode()
      dotString += DOT_PARTS.rootsClusterEnd
      return dotString
    },
    getStackNode (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }

      const stack = vm.currentHeapVizTraceState.stackAfterExecution
      let dotString = DOT_PARTS.stackTableStart

      let aboveInternalStackFrame = false // only add a symbol (DOT_PARTS.internalStackFramesDots) for internal stack frames once for every continuous block of internal stack frames
      for (let stackFrameNr = 0; stackFrameNr < stack.length; stackFrameNr++) {
        if (stack[stackFrameNr].internal) {
          if (!aboveInternalStackFrame) {
            dotString += DOT_PARTS.internalStackFramesDots
          }
          aboveInternalStackFrame = true
        } else {
          dotString += vm.stackTableFrameHeaderRow(stack[stackFrameNr])
          if (stack[stackFrameNr].this) {
            dotString += vm.varRow(
              thisVar(stack[stackFrameNr], stackFrameNr, stackFrameNr === stack.length - 1 &&
                vm.currentHeapVizTraceState.stackAfterExecution.length > vm.currentHeapVizTraceState.stack.length))
          }
          for (const localVar of stack[stackFrameNr].localVariables) {
            dotString += vm.varRow(localVar)
          }
          aboveInternalStackFrame = false
        }
      }

      dotString += DOT_PARTS.rootsTableEnd

      return dotString
    },
    getStaticsNode (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }

      let dotString = DOT_PARTS.rootsTableStart

      for (const loadedClass of vm.currentHeapVizTraceState.loadedClassesAfterExecution) {
        if (loadedClass.staticFields.length > 0) {
          dotString += vm.staticsTableClassHeaderRow(loadedClass.class)
          for (const staticVar of loadedClass.staticFields) {
            dotString += vm.varRow(staticVar)
          }
        }
      }

      dotString += DOT_PARTS.rootsTableSeparator

      return dotString
    },
    getNodes (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }

      const dotString = vm.getStackAndStaticsNodeCluster() + vm.getHeapNodeCluster()

      return dotString.replaceAll(/^\s+/gm, '')
    },
    getHeapNodeCluster (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }
      let dotString = DOT_PARTS.heapClusterStart

      for (const heapItem of vm.currentHeapVizTraceState.heapAfterExecution) {
        if (heapItem.isVisible) {
          dotString += vm.node(heapItem)
        }
      }

      dotString += DOT_PARTS.heapClusterEnd
      return dotString
    },
    calculateNodeVisibility (): void {
      const vm = this
      const ids: number[] = []
      const toVisit: number[] = []

      if (!vm.currentHeapVizTraceState) {
        return
      }

      vm.currentHeapVizTraceState.heapAfterExecution.forEach(function (ho: HeapVizHeapItem) {
        ho.isVisible = ho.faked
      })

      for (const stackFrame of vm.currentHeapVizTraceState.stackAfterExecution) {
        for (const localVar of stackFrame.localVariables) {
          if (localVar.value.kind === 'HeapVizReferenceVal') {
            if (vm.isExpanded(localVar)) {
              ids.push(localVar.value.reference)
              toVisit.push(localVar.value.reference)
            }
          } else {
            // PrimitiveVal or NullVal
          }
        }
        if (stackFrame.this) {
          ids.push(stackFrame.this.reference)
          toVisit.push(stackFrame.this.reference)
        }
      }

      for (const loadedClass of vm.currentHeapVizTraceState.loadedClassesAfterExecution) {
        for (const staticVar of loadedClass.staticFields) {
          if (staticVar.value.kind === 'HeapVizReferenceVal') {
            if (vm.isExpanded(staticVar)) {
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
        const nextItem = vm.getHeapItemById(nextId)
        if (!nextItem) {
          console.error('could not find heap object with ID ' + nextId)
          console.error(vm.currentHeapVizTraceState?.heapAfterExecution)
        }
        nextItem.isVisible = true

        if (nextItem.kind === 'HeapVizHeapObject') {
          for (let i = 0; i < vm.numberOfVisibleObjectFields(nextItem); i++) {
            const field = nextItem.fields[i]
            if (field.value.kind === 'HeapVizReferenceVal') {
              if (vm.isExpanded(field) && !ids.includes(field.value.reference)) {
                ids.push(field.value.reference)
                toVisit.push(field.value.reference)
              }
            } else {
              // PrimitiveVal or NullVal
            }
          }
        } else if (nextItem.kind === 'HeapVizHeapArray') {
          for (let i = 0; i < vm.numberOfVisibleArrayElements(nextItem); i++) {
            const element = nextItem.elements[i]
            if (element.value.kind === 'HeapVizPrimitiveVal') {
              break // no need to iterate over the whole array
            }
            if (element.value.kind === 'HeapVizReferenceVal') {
              if (vm.isExpanded(nextItem.elements[i]) && !ids.includes(element.value.reference)) {
                ids.push(element.value.reference)
                toVisit.push(element.value.reference)
              }
            }
          }
        }
      }
    },
    edge: function (v: HeapVizVar | HeapVizHeapArrayElementVar): string {
      const vm = this
      let additionalProperties
      if (isHighlightedEdge(v.identifier, vm.refTarget(v), vm.highlightedItems, vm.currentHeapVizTraceState)) {
        additionalProperties = '[color="#eda167" penwidth="2.0"]'
      } else if (v.changed) {
        additionalProperties = '[color="red" penwidth="2.0"]'
      } else {
        additionalProperties = '[]'
      }
      return `${v.identifier}:e -> ${vm.refTarget(v)}:w ${additionalProperties};`
    },
    refTarget: function (v: HeapVizVar | HeapVizHeapArrayElementVar) {
      const vm = this
      const referenceVal = v.value as unknown as HeapVizReferenceVal
      return `${vm.getHeapItemById(referenceVal.reference).identifier}:heap_object_type`
    },
    // Must be called with valid ID!!!
    getHeapItemById (id: number): HeapVizHeapItem {
      const vm = this
      return vm.currentHeapVizTraceState.heapAfterExecution.find(ho => ho.id === id)!
    },
    getHeapItemByRef (ref: HeapVizReferenceVal): HeapVizHeapItem {
      const vm = this
      return vm.getHeapItemById(ref.reference)
    },

    node: function (heapItem: HeapVizHeapItem): string {
      const vm = this
      return heapItem.identifier + vm.getNodeProperties(heapItem) + ';\n\n'
    },
    getNodeProperties (heapItem: HeapVizHeapItem): string {
      const vm = this
      let htmlClass = heapItem.kind.toLowerCase()

      if (isLargeArray(heapItem) || isLargeObject(heapItem)) {
        htmlClass += ' large-heap-element'
      }

      return DOT_PARTS.heapObjectProperties
        .replaceAll('###LABEL###', vm.getNodeLabel(heapItem))
        .replaceAll('###CLASS###', htmlClass)
    },
    getNodeLabel (heapItem: HeapVizHeapItem): string {
      const vm = this
      let dotString = DOT_PARTS.heapObjectLabelStart
      dotString += vm.headerRow(heapItem)

      switch (heapItem.kind) {
        case 'HeapVizHeapString': {
          dotString += vm.stringRow(heapItem)
          break
        }
        case 'HeapVizHeapArray': {
          const heapArray = heapItem
          if (heapArray.elements.length > 0) {
            const isRefArray = heapArray.elements[0].value.kind !== 'HeapVizPrimitiveVal'
            if (isRefArray) {
              for (let i = 0; i < vm.numberOfVisibleArrayElements(heapArray); i++) {
                dotString += vm.heapReferenceArrayRow(heapArray, i)
              }

              if (isLargeArray(heapArray)) {
                dotString += vm.largeArrayRow(heapArray)
              }
            } else {
              // primitive array
              dotString += '<tr><td sides="R"></td>'
              const nVisibleElements = vm.numberOfVisibleArrayElements(heapArray)
              for (let i = 0; i < nVisibleElements; i++) {
                const varValueColor = varColor(heapArray.elements[i])
                const itemColor = getItemColorOnHover(heapArray.elements[i], vm.highlightedItems, vm.currentHeapVizTraceState)
                dotString += `<td width="${MIN_WIDTH}" bgcolor="${itemColor}"><font color="${varValueColor}">[${i}]</font></td>`
              }

              if (isLargeArray(heapArray)) {
                let moreLessText = ''

                if (vm.isCollapsedArray(heapArray)) {
                  moreLessText += vm.heapItemContainsHiddenChangedElement(heapArray)
                    ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS}<br/>more</i></font>`
                    : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS}<br/>more</i></font>`
                } else {
                  moreLessText += `<font color="black"><i>show<br/>less</i></font>`
                }
                dotString += `<td rowspan="2" width="${MIN_WIDTH}" href="${heapArray.identifier}">${moreLessText}</td>`
              }

              dotString += '</tr>'
              dotString += '<tr><td sides="R"></td>'
              for (let i = 0; i < nVisibleElements; i++) {
                const varValueColor = varColor(heapArray.elements[i])
                const bgcolor = getItemColorOnHover(heapArray.elements[i], vm.highlightedItems, vm.currentHeapVizTraceState)
                dotString += `<td
                  width="${MIN_WIDTH}"
                  href = "${heapArray.identifier}:i_${i}"
                  tooltip="${vm.varTitle(heapArray.elements[i])}"
                  pointer-events="none"
                  bgcolor="${bgcolor}"><font color="${varValueColor}">`
                dotString += vm.varValue(heapArray.elements[i])
                dotString += `</font></td>`
              }

              dotString += '</tr>'
            }
          } else {
            dotString += vm.heapArrayEmptyRow(heapArray)
          }
          break
        }
        case 'HeapVizHeapObject': {
          const nVisibleFields = vm.numberOfVisibleObjectFields(heapItem)
          for (let i = 0; i < nVisibleFields; i++) {
            dotString += vm.varRow(heapItem.fields[i])
          }

          if (isLargeObject(heapItem)) {
            let moreLessText = ''
            if (vm.isCollapsedObject(heapItem)) {
              moreLessText += vm.heapItemContainsHiddenChangedElement(heapItem)
                ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapItem.fields.length - MAX_SHOWN_FIELDS} more</i></font>`
                : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapItem.fields.length - MAX_SHOWN_FIELDS} more</i></font>`
            } else {
              moreLessText += `<font color="black"><i>show less</i></font>`
            }

            dotString += `<tr>
                            <td sides="R"></td>
                            <td colspan="3" width="${MIN_WIDTH}" href="${heapItem.identifier}">${moreLessText}</td>
                            <td sides="L"></td>
                          </tr>`
          }
          break
        }
      }
      dotString += DOT_PARTS.heapObjectLabelEnd
      return dotString
    },
    getEdges (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }
      let dotString = ''

      dotString += vm.getStackEdges()
      dotString += vm.getStaticsEdges()
      dotString += vm.getFieldEdges()

      return dotString
    },
    getStackEdges (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }

      let dotString = ''
      for (let stackFrameNr = 0; stackFrameNr < vm.currentHeapVizTraceState.stackAfterExecution.length; stackFrameNr++) {
        const stackFrame = vm.currentHeapVizTraceState.stackAfterExecution[stackFrameNr]
        for (const localVar of stackFrame.localVariables) {
          if (localVar.value.kind === 'HeapVizReferenceVal' && vm.isExpanded(localVar)) {
            dotString += vm.edge(localVar)
          }
        }

        if (stackFrame.this) {
          const thiz = thisVar(stackFrame, stackFrameNr, vm.currentHeapVizTraceState.stackAfterExecution.length > vm.currentHeapVizTraceState.stack.length)
          if (vm.isExpanded(thiz)) {
            dotString += vm.edge(thiz)
          }
        }
      }
      return dotString
    },
    getStaticsEdges (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }

      let dotString = ''
      for (const loadedClass of vm.currentHeapVizTraceState.loadedClassesAfterExecution) {
        for (const staticVar of loadedClass.staticFields) {
          if (staticVar.value.kind === 'HeapVizReferenceVal' && vm.isExpanded(staticVar)) {
            dotString += vm.edge(staticVar)
          }
        }
      }
      return dotString
    },
    getFieldEdges (): string {
      const vm = this
      if (!vm.currentHeapVizTraceState) {
        return ''
      }

      let dotString = ''
      for (const heapObject of vm.currentHeapVizTraceState.heapAfterExecution) {
        if (heapObject.isVisible) {
          dotString += vm.getEdgesForObject(heapObject)
        }
      }
      return dotString
    },
    getEdgesForObject (heapItem: HeapVizHeapItem): string {
      const vm = this
      let dotString = ''
      switch (heapItem.kind) {
        case 'HeapVizHeapString': {
          // no edges
          break
        }
        case 'HeapVizHeapArray': {
          for (let i = 0; i < vm.numberOfVisibleArrayElements(heapItem); i++) {
            const element = heapItem.elements[i]
            if (element.value.kind === 'HeapVizReferenceVal' && vm.isExpanded(element)) {
              dotString += vm.edge(element)
            }
          }
          break
        }
        case 'HeapVizHeapObject': {
          for (let i = 0; i < vm.numberOfVisibleObjectFields(heapItem); i++) {
            const field = heapItem.fields[i]
            if (field.value.kind === 'HeapVizReferenceVal' && vm.isExpanded(field)) {
              dotString += vm.edge(field)
            }
          }
          break
        }
      }
      return dotString
    },
    clearHoverHighlighting () {
      HoverSynchronizer.clear()
    }
  }
})
</script>

<style>
#heap-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

#heap-wrapper > svg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

</style>
