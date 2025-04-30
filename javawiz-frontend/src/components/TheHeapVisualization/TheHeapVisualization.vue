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
import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { ProcessedTraceState } from '@/dto/TraceState'
import {
  HeapVizHeapArray,
  HeapVizHeapArrayElementVar,
  HeapVizHeapItem, HeapVizHeapObject,
  HeapVizHeapString,
  HeapVizReferenceVal,
  HeapVizStackFrame, HeapVizTraceState,
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
  setup () {
    const zoomBehaviour = ref(d3
      .zoom()
      .scaleExtent([MAX_ZOOM_OUT_FACTOR, MAX_ZOOM_IN_FACTOR])
      .on('zoom', (e: any) => { // e is a ZoomEvent, although d3 typings do not seem to know that
        d3.select('#heap-wrapper > svg g').attr('transform', e.transform)
      }))
    const highlightedItems = ref<HoverInfo[]>([])
    const generalStore = useGeneralStore()
    const heapVizMetaStore = useHeapVizMetaStore()
    const cachedTraceState = ref<HeapVizTraceState>()

    watch(() => generalStore.currentTraceData, (newData) => {
      if (newData?.processedTraceState) {
        cachedTraceState.value = fromProcessedTraceState(newData.processedTraceState)
      } else {
        const first = newData?.firstTraceState
        const processedState: ProcessedTraceState = {
          kind: 'ProcessedTraceState',
          localUri: first!.sourceFileUri,
          line: first!.line,
          heapBeforeExecution: first!.heap,
          stackBeforeExecution: first!.stack,
          loadedClassesBeforeExecution: first!.loadedClasses,
          stateIndex: 0,
          heapAfterExecution: first!.heap,
          stackAfterExecution: first!.stack,
          loadedClassesAfterExecution: first!.loadedClasses
        }

        processedState.stackAfterExecution!.flatMap(frame => frame.localVariables).forEach(lv => {
          lv.changed = true
        })
        processedState.loadedClassesAfterExecution!.flatMap(clazz => clazz.staticFields).forEach(sf => {
          sf.changed = true
        })

        cachedTraceState.value = fromProcessedTraceState(processedState)
      }
    }, { immediate: true })

    const currentHeapVizTraceState = cachedTraceState

    function stackTableFrameHeaderRow (stackFrame: HeapVizStackFrame): string {
      const title = sanitizer.escapeHtml(stackFrame.displayText)
      return DOT_PARTS.stackTableMethodHeaderRow
        .replaceAll('###TITLE###', title)
        .replaceAll('###IDENTIFIER###', stackFrame.displayText)
        .replaceAll('###BG_COLOR###', getMethodHeaderBGOnHover(stackFrame, highlightedItems.value))
    }
    function isExpanded (variable: HeapVizVar | HeapVizHeapArrayElementVar): boolean {
      return heapVizMetaStore.isExpandedIdentifier(variable.identifier)
    }
    function varValue (variable: HeapVizVar | HeapVizHeapArrayElementVar): string {
      if (variable.value.kind === 'HeapVizPrimitiveVal') {
        const value = variable.value.vizValue
        return `${value}`
      } else if (variable.value.kind === 'HeapVizReferenceVal') {
        let refVarString = '<font color="white">'
        if (isExpanded(variable)) {
          return refVarString + 'xx</font>'
        }
        refVarString += '➕'
        return refVarString + '</font>'
        // TODO center/make smaller // Remark: The + symbol is always black. The white font color is on purpose to ensure that the collapsed and the expanded version have the same number of SVG elements, which is needed to ensure correct transition animations
      } else {
        return NULL_VAL
      }
    }
    function varRow (v: HeapVizVar): string {
      const value = varValue(v)

      if (v.value.kind === 'HeapVizPrimitiveVal') {
        return DOT_PARTS.primitiveVarRow
          .replaceAll('###TYPE###', shortTypeName(v.type))
          .replaceAll('###NAME###', v.name)
          .replaceAll('###IDENTIFIER###', v.identifier)
          .replaceAll('###HIGHLIGHT_COLOR###', varColor(v))
          .replaceAll('###HIGHLIGHT_TAG###', varTag(v))
          .replaceAll('###VALUE###', v.type === 'char' ? `'${value}'` : value)
          .replaceAll('###TOOL_TIP###', v.value.title ?? '')
          .replaceAll('###BG_COLOR###', () => getItemColorOnHover(v, highlightedItems.value, currentHeapVizTraceState.value!))
      }
      return DOT_PARTS.referenceVarRow
        .replaceAll('###TYPE###', shortTypeName(v.type))
        .replaceAll('###NAME###', v.name)
        .replaceAll('###PORT###', v.port)
        .replaceAll('###IDENTIFIER###', v.identifier)
        .replaceAll('###HIGHLIGHT_COLOR###', varColor(v))
        .replaceAll('###HIGHLIGHT_TAG###', varTag(v))
        .replaceAll('###VALUE###', value)
        .replaceAll('###BG_COLOR###', getItemColorOnHover(v, highlightedItems.value, currentHeapVizTraceState.value!))
    }
    function stringRow (s: HeapVizHeapString): string {
      const value = s.vizString
      return DOT_PARTS.stringRow
        .replaceAll('###HIGHLIGHT_COLOR###', varColor(s.charArr))
        .replaceAll('###HIGHLIGHT_TAG###', varTag(s.charArr))
        .replaceAll('###VALUE###', sanitizer.escapeHtml(value))
        .replaceAll('###IDENTIFIER###', s.identifier)
        .replaceAll('###BG_COLOR###', getItemColorOnHover(s, highlightedItems.value, currentHeapVizTraceState.value!))
    }
    function staticsTableClassHeaderRow (clazz: string): string {
      return DOT_PARTS.staticsTableClassHeaderRow.replaceAll('###CLASS###', sanitizer.escapeHtml(shortTypeName(clazz)))
    }
    function heapObjectHeaderRow (heapItem: HeapVizHeapItem): string {
      return DOT_PARTS.heapObjectHeaderRow
        .replaceAll('###TYPE###', heapItemHeaderType(heapItem))
        .replaceAll('###IDENTIFIER###', heapItem.identifier)
        .replaceAll('###BG_COLOR###', getHeapItemOrArrayHeaderBGOnHover(heapItem, highlightedItems.value))
    }
    function heapArrayHeaderRow (heapArray: HeapVizHeapArray) {
      return DOT_PARTS.heapArrayHeaderRow
        .replaceAll('###TYPE###', heapItemHeaderType(heapArray))
        .replaceAll('###IDENTIFIER###', heapArray.identifier)
        .replaceAll('###BG_COLOR###', getHeapItemOrArrayHeaderBGOnHover(heapArray, highlightedItems.value))
    }
    function headerRow (heapItem: HeapVizHeapItem): string {
      if (heapItem.kind === 'HeapVizHeapArray') {
        return heapArrayHeaderRow(heapItem)
      } else {
        return heapObjectHeaderRow(heapItem)
      }
    }

    function heapReferenceArrayRow (arr: HeapVizHeapArray, index: number): string {
      const elem = arr.elements[index]

      return DOT_PARTS.referenceArrayRow
        .replaceAll('###INDEX###', elem.index.toString())
        .replaceAll('###IDENTIFIER###', elem.identifier)
        .replaceAll('###HIGHLIGHT_COLOR###', varColor(elem))
        .replaceAll('###HIGHLIGHT_TAG###', varTag(elem))
        .replaceAll('###VALUE###', varValue(elem))
        .replaceAll('###BG_COLOR###', getItemColorOnHover(elem, highlightedItems.value, currentHeapVizTraceState.value!))
      // .replaceAll('###TOOL_TIP###', vm.varTitle(elem))
    }
    function isCollapsedArray (arr: HeapVizHeapArray): boolean {
      return isLargeArray(arr) && !heapVizMetaStore.isFullyVisibleIdentifier(arr.identifier)
    }
    function heapItemContainsHiddenChangedElement (item: HeapVizHeapItem): boolean {
      if (item.kind === 'HeapVizHeapArray') {
        return item.elements.some((elem: HeapVizHeapArrayElementVar, index: number) => index >= MAX_ARRAY_ELEMENTS && elem.changed)
      } else if (item.kind === 'HeapVizHeapObject') {
        return item.fields.some((field: HeapVizVar, index: number) => index >= MAX_SHOWN_FIELDS && field.changed)
      } else {
        // must be string (or dragons :D), irrelevant
        return false
      }
    }
    function largeArrayRow (heapArray: HeapVizHeapArray): string {
      let moreLessText = ''

      if (isCollapsedArray(heapArray)) {
        moreLessText += heapItemContainsHiddenChangedElement(heapArray)
          ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`
          : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`
      } else {
        moreLessText += `<font color="black"><i>show less</i></font>`
      }
      return DOT_PARTS.largeArrayRow
        .replaceAll('###IDENTIFIER###', heapArray.identifier)
        .replaceAll('###TEXT###', moreLessText)
    }
    function heapArrayEmptyRow (heapArray: HeapVizHeapArray): string {
      return DOT_PARTS.arrayEmptyRow
        .replaceAll('###IDENTIFIER###', heapArray.identifier)
        .replaceAll('###BG_COLOR###', getItemColorOnHover(heapArray, highlightedItems.value, currentHeapVizTraceState.value!))
    }

    // Must be called with valid ID!!!
    function getHeapItemById (id: number): HeapVizHeapItem {
      return currentHeapVizTraceState.value!.heapAfterExecution.find(ho => ho.id === id)!
    }

    function numberOfVisibleArrayElements (arr: HeapVizHeapArray): number {
      return isLargeArray(arr) && !heapVizMetaStore.isFullyVisibleIdentifier(arr.identifier)
        ? MAX_ARRAY_ELEMENTS
        : arr.elements.length
    }
    function numberOfVisibleObjectFields (obj: HeapVizHeapObject): number {
      return isLargeObject(obj) && !heapVizMetaStore.isFullyVisibleIdentifier(obj.identifier)
        ? MAX_SHOWN_FIELDS
        : obj.fields.length
    }

    function calculateNodeVisibility (): void {
      const ids: number[] = []
      const toVisit: number[] = []

      if (!currentHeapVizTraceState.value) {
        return
      }

      currentHeapVizTraceState.value.heapAfterExecution.forEach(function (ho: HeapVizHeapItem) {
        ho.isVisible = ho.faked
      })

      for (const stackFrame of currentHeapVizTraceState.value.stackAfterExecution) {
        for (const localVar of stackFrame.localVariables) {
          if (localVar.value.kind === 'HeapVizReferenceVal') {
            if (isExpanded(localVar)) {
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

      for (const loadedClass of currentHeapVizTraceState.value.loadedClassesAfterExecution) {
        for (const staticVar of loadedClass.staticFields) {
          if (staticVar.value.kind === 'HeapVizReferenceVal') {
            if (isExpanded(staticVar)) {
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
        const nextItem = getHeapItemById(nextId)
        if (!nextItem) {
          console.error('could not find heap object with ID ' + nextId)
          console.error(currentHeapVizTraceState.value?.heapAfterExecution)
        }
        nextItem.isVisible = true

        if (nextItem.kind === 'HeapVizHeapObject') {
          for (let i = 0; i < numberOfVisibleObjectFields(nextItem); i++) {
            const field = nextItem.fields[i]
            if (field.value.kind === 'HeapVizReferenceVal') {
              if (isExpanded(field) && !ids.includes(field.value.reference)) {
                ids.push(field.value.reference)
                toVisit.push(field.value.reference)
              }
            } else {
              // PrimitiveVal or NullVal
            }
          }
        } else if (nextItem.kind === 'HeapVizHeapArray') {
          for (let i = 0; i < numberOfVisibleArrayElements(nextItem); i++) {
            const element = nextItem.elements[i]
            if (element.value.kind === 'HeapVizPrimitiveVal') {
              break // no need to iterate over the whole array
            }
            if (element.value.kind === 'HeapVizReferenceVal') {
              if (isExpanded(nextItem.elements[i]) && !ids.includes(element.value.reference)) {
                ids.push(element.value.reference)
                toVisit.push(element.value.reference)
              }
            }
          }
        }
      }
    }
    function getStaticsNode (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }

      let dotString = DOT_PARTS.rootsTableStart

      for (const loadedClass of currentHeapVizTraceState.value.loadedClassesAfterExecution) {
        if (loadedClass.staticFields.length > 0) {
          dotString += staticsTableClassHeaderRow(loadedClass.class)
          for (const staticVar of loadedClass.staticFields) {
            dotString += varRow(staticVar)
          }
        }
      }

      dotString += DOT_PARTS.rootsTableSeparator

      return dotString
    }
    function getStackNode (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }

      const stack = currentHeapVizTraceState.value.stackAfterExecution
      let dotString = DOT_PARTS.stackTableStart

      let aboveInternalStackFrame = false // only add a symbol (DOT_PARTS.internalStackFramesDots) for internal stack frames once for every continuous block of internal stack frames
      for (let stackFrameNr = 0; stackFrameNr < stack.length; stackFrameNr++) {
        if (stack[stackFrameNr].internal) {
          if (!aboveInternalStackFrame) {
            dotString += DOT_PARTS.internalStackFramesDots
          }
          aboveInternalStackFrame = true
        } else {
          dotString += stackTableFrameHeaderRow(stack[stackFrameNr])
          if (stack[stackFrameNr].this) {
            dotString += varRow(
              thisVar(stack[stackFrameNr], stackFrameNr, stackFrameNr === stack.length - 1 &&
                currentHeapVizTraceState.value.stackAfterExecution.length > currentHeapVizTraceState.value.stack.length))
          }
          for (const localVar of stack[stackFrameNr].localVariables) {
            dotString += varRow(localVar)
          }
          aboveInternalStackFrame = false
        }
      }

      dotString += DOT_PARTS.rootsTableEnd

      return dotString
    }
    function varTitle (variable: HeapVizVar | HeapVizHeapArrayElementVar): string {
      if (variable.value.kind === 'HeapVizPrimitiveVal') {
        return variable.value.title || ''
      }
      return ''
    }
    function isCollapsedObject (obj: HeapVizHeapObject): boolean {
      return isLargeObject(obj) && !heapVizMetaStore.isFullyVisibleIdentifier(obj.identifier)
    }
    function getNodeLabel (heapItem: HeapVizHeapItem): string {
      let dotString = DOT_PARTS.heapObjectLabelStart
      dotString += headerRow(heapItem)

      switch (heapItem.kind) {
        case 'HeapVizHeapString': {
          dotString += stringRow(heapItem)
          break
        }
        case 'HeapVizHeapArray': {
          const heapArray = heapItem
          if (heapArray.elements.length > 0) {
            const isRefArray = heapArray.elements[0].value.kind !== 'HeapVizPrimitiveVal'
            if (isRefArray) {
              for (let i = 0; i < numberOfVisibleArrayElements(heapArray); i++) {
                dotString += heapReferenceArrayRow(heapArray, i)
              }

              if (isLargeArray(heapArray)) {
                dotString += largeArrayRow(heapArray)
              }
            } else {
              // primitive array
              dotString += '<tr><td sides="R"></td>'
              const nVisibleElements = numberOfVisibleArrayElements(heapArray)
              for (let i = 0; i < nVisibleElements; i++) {
                const varValueColor = varColor(heapArray.elements[i])
                const itemColor = getItemColorOnHover(heapArray.elements[i], highlightedItems.value, currentHeapVizTraceState.value!)
                dotString += `<td width="${MIN_WIDTH}" bgcolor="${itemColor}"><font color="${varValueColor}">[${i}]</font></td>`
              }

              if (isLargeArray(heapArray)) {
                let moreLessText = ''

                if (isCollapsedArray(heapArray)) {
                  moreLessText += heapItemContainsHiddenChangedElement(heapArray)
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
                const bgcolor = getItemColorOnHover(heapArray.elements[i], highlightedItems.value, currentHeapVizTraceState.value!)
                dotString += `<td
                  width="${MIN_WIDTH}"
                  href = "${heapArray.identifier}:i_${i}"
                  tooltip="${varTitle(heapArray.elements[i])}"
                  pointer-events="none"
                  bgcolor="${bgcolor}"><font color="${varValueColor}">`
                dotString += varValue(heapArray.elements[i])
                dotString += `</font></td>`
              }

              dotString += '</tr>'
            }
          } else {
            dotString += heapArrayEmptyRow(heapArray)
          }
          break
        }
        case 'HeapVizHeapObject': {
          const nVisibleFields = numberOfVisibleObjectFields(heapItem)
          for (let i = 0; i < nVisibleFields; i++) {
            dotString += varRow(heapItem.fields[i])
          }

          if (isLargeObject(heapItem)) {
            let moreLessText = ''
            if (isCollapsedObject(heapItem)) {
              moreLessText += heapItemContainsHiddenChangedElement(heapItem)
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
    }
    function getNodeProperties (heapItem: HeapVizHeapItem): string {
      let htmlClass = heapItem.kind.toLowerCase()

      if (isLargeArray(heapItem) || isLargeObject(heapItem)) {
        htmlClass += ' large-heap-element'
      }

      return DOT_PARTS.heapObjectProperties
        .replaceAll('###LABEL###', getNodeLabel(heapItem))
        .replaceAll('###CLASS###', htmlClass)
    }
    function node (heapItem: HeapVizHeapItem): string {
      return heapItem.identifier + getNodeProperties(heapItem) + ';\n\n'
    }
    function getStackAndStaticsNodeCluster (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }
      let dotString = DOT_PARTS.rootsClusterStart
      dotString += getStaticsNode()
      dotString += getStackNode()
      dotString += DOT_PARTS.rootsClusterEnd
      return dotString
    }

    function getHeapNodeCluster (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }
      let dotString = DOT_PARTS.heapClusterStart

      for (const heapItem of currentHeapVizTraceState.value.heapAfterExecution) {
        if (heapItem.isVisible) {
          dotString += node(heapItem)
        }
      }

      dotString += DOT_PARTS.heapClusterEnd
      return dotString
    }
    function getNodes (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }

      const dotString = getStackAndStaticsNodeCluster() + getHeapNodeCluster()

      return dotString.replaceAll(/^\s+/gm, '')
    }
    function refTarget (v: HeapVizVar | HeapVizHeapArrayElementVar) {
      const referenceVal = v.value as unknown as HeapVizReferenceVal
      return `${getHeapItemById(referenceVal.reference).identifier}:heap_object_type`
    }

    function edge (v: HeapVizVar | HeapVizHeapArrayElementVar): string {
      let additionalProperties
      if (isHighlightedEdge(v.identifier, refTarget(v), highlightedItems.value, currentHeapVizTraceState.value!)) {
        additionalProperties = '[color="#eda167" penwidth="2.0"]'
      } else if (v.changed) {
        additionalProperties = '[color="red" penwidth="2.0"]'
      } else {
        additionalProperties = '[]'
      }
      return `${v.identifier}:e -> ${refTarget(v)}:w ${additionalProperties};`
    }

    function getStackEdges (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }

      let dotString = ''
      for (let stackFrameNr = 0; stackFrameNr < currentHeapVizTraceState.value.stackAfterExecution.length; stackFrameNr++) {
        const stackFrame = currentHeapVizTraceState.value.stackAfterExecution[stackFrameNr]
        for (const localVar of stackFrame.localVariables) {
          if (localVar.value.kind === 'HeapVizReferenceVal' && isExpanded(localVar)) {
            dotString += edge(localVar)
          }
        }

        if (stackFrame.this) {
          const thiz = thisVar(stackFrame, stackFrameNr, currentHeapVizTraceState.value.stackAfterExecution.length > currentHeapVizTraceState.value.stack.length)
          if (isExpanded(thiz)) {
            dotString += edge(thiz)
          }
        }
      }
      return dotString
    }

    function getStaticsEdges (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }

      let dotString = ''
      for (const loadedClass of currentHeapVizTraceState.value.loadedClassesAfterExecution) {
        for (const staticVar of loadedClass.staticFields) {
          if (staticVar.value.kind === 'HeapVizReferenceVal' && isExpanded(staticVar)) {
            dotString += edge(staticVar)
          }
        }
      }
      return dotString
    }
    function getEdgesForObject (heapItem: HeapVizHeapItem): string {
      let dotString = ''
      switch (heapItem.kind) {
        case 'HeapVizHeapString': {
          // no edges
          break
        }
        case 'HeapVizHeapArray': {
          for (let i = 0; i < numberOfVisibleArrayElements(heapItem); i++) {
            const element = heapItem.elements[i]
            if (element.value.kind === 'HeapVizReferenceVal' && isExpanded(element)) {
              dotString += edge(element)
            }
          }
          break
        }
        case 'HeapVizHeapObject': {
          for (let i = 0; i < numberOfVisibleObjectFields(heapItem); i++) {
            const field = heapItem.fields[i]
            if (field.value.kind === 'HeapVizReferenceVal' && isExpanded(field)) {
              dotString += edge(field)
            }
          }
          break
        }
      }
      return dotString
    }
    function getFieldEdges (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }

      let dotString = ''
      for (const heapObject of currentHeapVizTraceState.value.heapAfterExecution) {
        if (heapObject.isVisible) {
          dotString += getEdgesForObject(heapObject)
        }
      }
      return dotString
    }
    function getEdges (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }
      let dotString = ''

      dotString += getStackEdges()
      dotString += getStaticsEdges()
      dotString += getFieldEdges()

      return dotString
    }

    function heapToDotString (): string {
      if (!currentHeapVizTraceState.value) {
        return ''
      }
      return DOT_PARTS.digraphStart +
        getNodes() +
        getEdges() +
        DOT_PARTS.digraphEnd
    }
    function toggleExpandedIdentifier (identifier: string) {
      heapVizMetaStore.setExpandedIdentifier({ identifier, e: !heapVizMetaStore.isExpandedIdentifier(identifier) })
    }
    /*
    function toggleExpanded (variable: HeapVizVar) {
      toggleExpandedIdentifier(variable.identifier)
    }
    function setExpanded (variable: HeapVizVar, e: boolean) {
      heapVizMetaStore.setExpandedIdentifier({ identifier: variable.identifier, e })
    }
    function setExpandedIdentifier (identifier: string, e: boolean) {
      heapVizMetaStore.setExpandedIdentifier({ identifier, e })
    }
      */
    function toggleIsFullyVisibleIdentifier (identifier: string) {
      heapVizMetaStore.setIsFullyVisibleIdentifier({ identifier, e: !heapVizMetaStore.isFullyVisibleIdentifier(identifier) })
    }
    function redraw (hoverChanged: boolean = false) {
      if (!currentHeapVizTraceState.value) {
        try {
          graphviz('#heap-wrapper')
            .renderDot('')
        } catch (ex) {
          console.error(ex)
        }
        return
      }

      calculateNodeVisibility()

      const dotString = heapToDotString()

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

                toggleIsFullyVisibleIdentifier(d3.select(this).attr('href'))
                redraw()
              })

            d3.selectAll('g:not(large-heap-element) a')
              .on('click.other', function (event: any) {
                event.preventDefault() // to stop navigation

                toggleExpandedIdentifier(d3.select(this).attr('href'))

                // vm.viewBoxBeforeUpdate = d3.select('#heap-wrapper > svg').attr('viewBox')
                redraw()
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
                  hoverInfos = getHeapItemToHeapItemHoverInfos(identifier, currentHeapVizTraceState.value!)
                  // check if a stack or statics item is hovered
                } else if (identifier.search('l_') >= 0 || identifier.search('s_') >= 0 || identifier.search('localvar_') >= 0) {
                  hoverInfos = getLocalOrStaticsToHeapItemHoverInfos(identifier.split(':')[1], currentHeapVizTraceState.value!)
                } else { // otherwise a method is hovered
                  hoverInfos = getMethodHoverInfos(identifier, currentHeapVizTraceState.value!)
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
        redraw()
      }
    }
    function onHover (hoverInfos: HoverInfo[]) {
      if (relevantChange(highlightedItems.value, hoverInfos)) {
        highlightedItems.value = hoverInfos
        redraw(true)
      }
    }
    function zoomIn () {
      d3.transition().select('#heap-wrapper > svg')
        .duration(TRANSFORMATION_DURATION)
        .ease(TRANSFORMATION_EASE)
        .call(zoomBehaviour.value.scaleBy as any, BTN_ZOOM_FACTOR)
    }
    function zoomOut () {
      d3.transition().select('#heap-wrapper > svg')
        .duration(TRANSFORMATION_DURATION)
        .ease(TRANSFORMATION_EASE)
        .call(zoomBehaviour.value.scaleBy as any, 1 / BTN_ZOOM_FACTOR)
    }
    function zoomReset () {
      const svg = d3.select('#heap-wrapper svg')
      const viewBox = svg.attr('viewBox').split(' ')
      const graphHeight = +viewBox[3]

      const transform = zoomBehaviour.value.transform as any

      // Define which point should be centered, resetting zoom to 1
      // +4 and -4 are used since they seem to be the default d3-graphviz offsets
      svg.transition('translateTransition').duration(TRANSFORMATION_DURATION)
        .ease(TRANSFORMATION_EASE)
        .call(transform, d3.zoomIdentity.translate(4, graphHeight - 4))
    }
    /*
    function getHeapItemByRef (ref: HeapVizReferenceVal): HeapVizHeapItem {
      return getHeapItemById(ref.reference)
    }
    function clearHoverHighlighting () {
      HoverSynchronizer.clear()
    }
      */

    watch(currentHeapVizTraceState, () => {
      /*
      3 cases:
      - object is already in map (because isFullyVisible was accessed at some point) => don't touch
      - object is not in map, but one of its fields is already in map (because isExpanded was accessed) => don't touch
      - object is not in map and none of its fields have been accessed before => must be fresh large objs => set isExpanded for all fields to false
       */
      currentHeapVizTraceState.value!.heapAfterExecution
        .filter(heapItem => isLargeObject(heapItem) && !heapVizMetaStore.isIdentifierInMap(heapItem.identifier))
        .forEach(heapObject => {
          const fields = (heapObject as HeapVizHeapObject).fields
          if (fields.every(f => !heapVizMetaStore.isIdentifierInMap(f.identifier))) {
            fields.forEach(field => heapVizMetaStore.setExpandedIdentifier({ identifier: field.identifier, e: false }))
          }
        })
      redraw()
    })
    onMounted(() => {
      redraw()
      HoverSynchronizer.onHover(onHover)
    })
    onUnmounted(() => {
      HoverSynchronizer.removeOnHover(onHover)
    }
    )

    return {
      HEAP, zoomIn, zoomOut, zoomReset
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
