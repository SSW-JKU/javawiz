<template>
  <div id="heap-wrapper">
    <NavigationBarWithSettings :zoom-in="zoomIn" :zoom-out="zoomOut" :zoom-reset="zoomReset" :viz-id="visualizationStore.MEMORY.id">
      <HeapVisualizationSettings v-model:show-internal-class-fields="showInternalClassFields" />
    </NavigationBarWithSettings>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import { graphviz } from 'd3-graphviz'
import 'd3-transition'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
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
import { useVisualizationStore } from '@/store/VisualizationStore'
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
import HeapVisualizationSettings from './HeapVisualizationSettings.vue'
import {
  processInjectedTitles
} from './HeapLookup'
import { HeapAnnotationManager, type HeapQuestionOption, type HeapQuestionAnswer } from './HeapAnnotations'
import { parsePetQuestionPayload } from '@/components/PetAnnotations'
import { usePetStore } from '@/store/PetStore'

const showInternalClassFields = ref(false)
watch(showInternalClassFields, () => {
  redraw()
})

const TRANSFORMATION_EASE = d3.easeCubic
const SVG_ID_SUFFIXES = {
  methodHeader: ':method',
  header: ':header',
  typeAndName: ':typeandname',
  index: ':index',
  pseudo: ':pseudo',
  value: ':value',
  moreLess: ':moreless',
  empty: ':empty'
} as const

const SVG_ID_SUFFIX_VALUES = Object.values(SVG_ID_SUFFIXES)

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
                   <td bgcolor="###BG_COLOR###" colspan="5" title="id=&quot;###IDENTIFIER###&quot;">
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
    '[label=###LABEL###, class="###CSSCLASS###"]',

  heapObjectLabelStart:
    `<<font face="${FONT_FACE_TABLES}" point-size="${CONTENT_FONT_SIZE}">
       <table ${TABLE_FORMAT}>
    `,

  heapObjectHeaderRow:
    `    <tr>
           <td bgcolor="###BG_COLOR###" sides="TBL" port="heap_object_header"></td>
           <td align="center" colspan="3" title="id=&quot;###IDENTIFIER###&quot;" bgcolor="###BG_COLOR###" sides="TB">
             <b>###TYPE###</b>
           </td>
           <td align="right" bgcolor="###BG_COLOR###" sides="TBR">
           </td>
         </tr>
    `,
  heapArrayHeaderRow:
    `    <tr>
           <td bgcolor="###BG_COLOR###" sides="TBL" port="heap_object_header"></td>
           <td align="center" colspan="3" title="id=&quot;###IDENTIFIER###&quot;" bgcolor="###BG_COLOR###" sides="TB">
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
           <td width="${MIN_WIDTH}" align="right" title="id=&quot;###TYPE_NAME_IDENTIFIER###&quot;" bgcolor="###BG_COLOR###">
             <font color="${TYPE_FONT_COLOR}">
               <###HIGHLIGHT_TAG###>###TYPE###</###HIGHLIGHT_TAG###>
             </font>
             <font color="###HIGHLIGHT_COLOR###">
               <###HIGHLIGHT_TAG###>&nbsp;###NAME###</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;###PSEUDO_IDENTIFIER###&quot;" port="###PORT###" sides="LTB" bgcolor="###BG_COLOR###">
             <font color="###BG_COLOR###">xx</font>
           </td>
           <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;###VALUE_IDENTIFIER###&quot;" sides="RTB" bgcolor="###BG_COLOR###">
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
  primitiveVarRow:
    `    <tr>
           <td sides="R"></td>
           <td width="${MIN_WIDTH}" align="right" title="id=&quot;###TYPE_NAME_IDENTIFIER###&quot;" bgcolor="###BG_COLOR###">
             <font color="${TYPE_FONT_COLOR}">
               <###HIGHLIGHT_TAG###>###TYPE###</###HIGHLIGHT_TAG###>
             </font>
             <font color="###HIGHLIGHT_COLOR###">
               <###HIGHLIGHT_TAG###>&nbsp;###NAME###</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td align="right" cellpadding="0" cellspacing="0" sides="LTB" bgcolor="###BG_COLOR###">
           </td>
           <td align="left" cellpadding="0" cellspacing="0" sides="RTB"
               title="###VALUE_TITLE_ATTRIBUTES###"
               bgcolor="###BG_COLOR###">
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
           <td width="${MIN_WIDTH}" colspan="3" title="id=&quot;###IDENTIFIER###&quot;" bgcolor="###BG_COLOR###">
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
           <td width="${MIN_WIDTH}" title="id=&quot;###INDEX_IDENTIFIER###&quot;" bgcolor="###BG_COLOR###">
             <font color="###HIGHLIGHT_COLOR###">
               <###HIGHLIGHT_TAG###>[###INDEX###]</###HIGHLIGHT_TAG###>
             </font>
           </td>
           <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;###PSEUDO_IDENTIFIER###&quot;" port="i_###INDEX###" sides="LTB" bgcolor="###BG_COLOR###">
             <font color="white">--</font>
           </td>
           <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;###VALUE_IDENTIFIER###&quot;" sides="RTB" bgcolor="###BG_COLOR###">
             <###HIGHLIGHT_TAG###>###VALUE###</###HIGHLIGHT_TAG###>
           </td>
           <td sides="L"></td>
         </tr>
  `,
  largeArrayRow:
    `    <tr>
           <td sides="R"></td>
           <td colspan="3" title="id=&quot;###IDENTIFIER###&quot;">
             ###TEXT###
           </td>
           <td sides="L"></td>
         </tr>
  `,
  arrayEmptyRow:
    `    <tr>
           <td sides="R"></td>
           <td colspan="3" title="id=&quot;###IDENTIFIER###&quot;" bgcolor="###BG_COLOR###">
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

function getHeapSvg (): SVGSVGElement | null {
  return document.querySelector('#heap-wrapper > svg')
}

function getHeapRootG (): SVGGElement | null {
  return getHeapSvg()?.querySelector('g') ?? null
}

const annotationManager = new HeapAnnotationManager({
  getSvg: getHeapSvg,
  getRootG: getHeapRootG,
  getLookupRoot: () => document.querySelector('#heap-wrapper')
})
let annotationIds: number[] = []

defineExpose({
  addSpeechBubble: annotationManager.addSpeechBubble.bind(annotationManager),
  addHighlight: annotationManager.addHighlight.bind(annotationManager),
  addQuestion: annotationManager.addQuestion.bind(annotationManager) as (
    target: Parameters<HeapAnnotationManager['addQuestion']>[0],
    traceState: Parameters<HeapAnnotationManager['addQuestion']>[1],
    text: string,
    options: HeapQuestionOption[],
    onAnswer?: (answer: HeapQuestionAnswer) => void
  ) => number,
  removeAnnotationById: annotationManager.removeAnnotationById.bind(annotationManager),
  removeAnnotations: annotationManager.removeAnnotations.bind(annotationManager),
  clearAnnotations: annotationManager.clearAnnotations.bind(annotationManager),
  setAnnotationCollapsed: annotationManager.setCollapsed.bind(annotationManager),
  getAnnotationCalloutState: annotationManager.getCalloutState.bind(annotationManager),
  getQuestionAnswer: annotationManager.getQuestionAnswer.bind(annotationManager),
  redrawAnnotations: annotationManager.redraw.bind(annotationManager)
})

function removeAnnotations (): void {
  annotationIds.forEach(id => annotationManager.removeAnnotationById(id))
  annotationIds = []
}

function installAnnotations (): void {
  removeAnnotations()

  for (const pet of memoryPets.value) {
    switch (pet.pet.action) {
      case 'Say':
        annotationIds.push(
          annotationManager.addSpeechBubble(
            pet.translated,
            pet.traceState,
            pet.pet.payload
          )
        )
        break

      case 'Highlight':
        annotationIds.push(
          annotationManager.addHighlight(
            pet.translated,
            pet.traceState
          )
        )
        break

      case 'AskSingle':
      case 'AskMultiple': {
        const question = parsePetQuestionPayload(
          pet.pet.payload
        )

        if (!question) {
          break
        }

        annotationIds.push(
          annotationManager.addQuestion(
            pet.translated,
            pet.traceState,
            question.text,
            question.options
          )
        )

        break
      }
    }
  }
}

function thisVar (stackFrame: HeapVizStackFrame, stackFrameNr: number, newlyEnteredStackframe: boolean): HeapVizVar {
  return {
    type: stackFrame.class,
    name: 'this',
    port: `l_${stackFrameNr}_this`,
    identifier: `roots:l_${stackFrameNr}_this`,
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

function svgCellId (identifier: string, suffix: typeof SVG_ID_SUFFIX_VALUES[number]): string {
  return `${identifier}${suffix}`
}

function injectedTitleAttributes (attrs: Record<string, string | undefined>): string {
  return Object.entries(attrs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([name, value]) => `${name}=&quot;${escapeInjectedTitleAttributeValue(value)}&quot;`)
    .join(' ')
}

function escapeInjectedTitleAttributeValue (value: string): string {
  return value
    .replaceAll(/&/g, '&amp;')
    .replaceAll(/</g, '&lt;')
    .replaceAll(/>/g, '&gt;')
    .replaceAll(/"/g, '&amp;quot;')
    .replaceAll(/'/g, '&#039;')
}

function methodHeaderId (stackFrameNr: number): string {
  return `stackframe_${stackFrameNr}${SVG_ID_SUFFIXES.methodHeader}`
}

function identifierFromSvgCellId (identifier: string): string {
  const suffix = SVG_ID_SUFFIX_VALUES.find(suffix => identifier.endsWith(suffix))
  return suffix
    ? identifier.slice(0, -suffix.length)
    : identifier
}

function isReferenceIdentifier (identifier: string): boolean {
  return identifier.startsWith('roots:') || /^o_\d+:/.test(identifier)
}

function findVariableByIdentifier (identifier: string): HeapVizVar | HeapVizHeapArrayElementVar | undefined {
  const state = currentHeapVizTraceState.value
  if (!state) return undefined

  const thisMatch = identifier.match(/^roots:l_(\d+)_this$/)
  if (thisMatch) {
    const stackFrameNr = Number(thisMatch[1])
    const thiz = state.stackAfterExecution[stackFrameNr]?.this
    return thiz ? thisVar(state.stackAfterExecution[stackFrameNr], stackFrameNr, false) : undefined
  }

  for (const stackFrame of state.stackAfterExecution) {
    const localVar = stackFrame.localVariables.find(v => v.identifier === identifier)
    if (localVar) return localVar
  }

  for (const loadedClass of state.loadedClassesAfterExecution) {
    const staticField = loadedClass.staticFields.find(v => v.identifier === identifier)
    if (staticField) return staticField
  }

  for (const heapItem of state.heapAfterExecution) {
    if (heapItem.kind === 'HeapVizHeapObject') {
      const field = heapItem.fields.find(v => v.identifier === identifier)
      if (field) return field
    } else if (heapItem.kind === 'HeapVizHeapArray') {
      const element = heapItem.elements.find(v => v.identifier === identifier)
      if (element) return element
    }
  }

  return undefined
}

function isExpandableReferenceIdentifier (identifier: string): boolean {
  return isReferenceIdentifier(identifier) && findVariableByIdentifier(identifier)?.value.kind === 'HeapVizReferenceVal'
}

const zoomBehaviour = ref(d3
  .zoom()
  .scaleExtent([MAX_ZOOM_OUT_FACTOR, MAX_ZOOM_IN_FACTOR])
  .on('zoom', (e: any) => { // e is a ZoomEvent, although d3 typings do not seem to know that
    d3.select('#heap-wrapper > svg g').attr('transform', e.transform)
  }))
let graphvizInstance: ReturnType<typeof graphviz> | null = null
let isInitialized = false
let rendering = false
let pendingUpdate: { needed: boolean, hoverChanged: boolean } = { needed: false, hoverChanged: false }
let lastRenderedDotString: string | null = null
const highlightedItems = ref<HoverInfo[]>([])
const generalStore = useGeneralStore()
const { memoryPets } = storeToRefs(usePetStore())
const heapVizMetaStore = useHeapVizMetaStore()
const visualizationStore = useVisualizationStore()
const currentHeapVizTraceState = ref<HeapVizTraceState>()

watch(memoryPets, installAnnotations, { immediate: true, flush: 'post' })

watch(() => generalStore.currentTraceData, (newData) => {
  if (newData?.processedTraceState) {
    currentHeapVizTraceState.value = fromProcessedTraceState(newData.processedTraceState)
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

    currentHeapVizTraceState.value = fromProcessedTraceState(processedState)
  }
}, { immediate: true })

function stackTableFrameHeaderRow (stackFrame: HeapVizStackFrame, stackFrameNr: number): string {
  const title = sanitizer.escapeHtml(stackFrame.displayText)
  return DOT_PARTS.stackTableMethodHeaderRow
    .replaceAll('###TITLE###', title)
    .replaceAll('###IDENTIFIER###', methodHeaderId(stackFrameNr))
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

function primitiveTooltip (variable: HeapVizVar | HeapVizHeapArrayElementVar): string | undefined {
  return variable.value.kind === 'HeapVizPrimitiveVal'
    ? variable.value.title
    : undefined
}

function varRow (v: HeapVizVar): string {
  const value = varValue(v)

  if (v.value.kind === 'HeapVizPrimitiveVal') {
    return DOT_PARTS.primitiveVarRow
      .replaceAll('###TYPE###', shortTypeName(v.type))
      .replaceAll('###NAME###', v.name)
      .replaceAll('###TYPE_NAME_IDENTIFIER###', svgCellId(v.identifier, SVG_ID_SUFFIXES.typeAndName))
      .replaceAll('###VALUE_TITLE_ATTRIBUTES###', injectedTitleAttributes({
        id: svgCellId(v.identifier, SVG_ID_SUFFIXES.value),
        'data-tooltip': primitiveTooltip(v)
      }))
      .replaceAll('###HIGHLIGHT_COLOR###', varColor(v))
      .replaceAll('###HIGHLIGHT_TAG###', varTag(v))
      .replaceAll('###VALUE###', v.type === 'char' ? `'${value}'` : value)
      .replaceAll('###BG_COLOR###', () => getItemColorOnHover(v, highlightedItems.value, currentHeapVizTraceState.value!))
  }
  return DOT_PARTS.referenceVarRow
    .replaceAll('###TYPE###', shortTypeName(v.type))
    .replaceAll('###NAME###', v.name)
    .replaceAll('###PORT###', v.port)
    .replaceAll('###TYPE_NAME_IDENTIFIER###', svgCellId(v.identifier, SVG_ID_SUFFIXES.typeAndName))
    .replaceAll('###PSEUDO_IDENTIFIER###', svgCellId(v.identifier, SVG_ID_SUFFIXES.pseudo))
    .replaceAll('###VALUE_IDENTIFIER###', svgCellId(v.identifier, SVG_ID_SUFFIXES.value))
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
    .replaceAll('###IDENTIFIER###', svgCellId(s.identifier, SVG_ID_SUFFIXES.value))
    .replaceAll('###BG_COLOR###', getItemColorOnHover(s, highlightedItems.value, currentHeapVizTraceState.value!))
}
function staticsTableClassHeaderRow (clazz: string): string {
  return DOT_PARTS.staticsTableClassHeaderRow.replaceAll('###CLASS###', sanitizer.escapeHtml(shortTypeName(clazz)))
}
function heapObjectHeaderRow (heapItem: HeapVizHeapItem): string {
  return DOT_PARTS.heapObjectHeaderRow
    .replaceAll('###TYPE###', heapItemHeaderType(heapItem))
    .replaceAll('###IDENTIFIER###', svgCellId(heapItem.identifier, SVG_ID_SUFFIXES.header))
    .replaceAll('###BG_COLOR###', getHeapItemOrArrayHeaderBGOnHover(heapItem, highlightedItems.value))
}
function heapArrayHeaderRow (heapArray: HeapVizHeapArray) {
  return DOT_PARTS.heapArrayHeaderRow
    .replaceAll('###TYPE###', heapItemHeaderType(heapArray))
    .replaceAll('###IDENTIFIER###', svgCellId(heapArray.identifier, SVG_ID_SUFFIXES.header))
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
    .replaceAll('###INDEX_IDENTIFIER###', svgCellId(elem.identifier, SVG_ID_SUFFIXES.index))
    .replaceAll('###PSEUDO_IDENTIFIER###', svgCellId(elem.identifier, SVG_ID_SUFFIXES.pseudo))
    .replaceAll('###VALUE_IDENTIFIER###', svgCellId(elem.identifier, SVG_ID_SUFFIXES.value))
    .replaceAll('###HIGHLIGHT_COLOR###', varColor(elem))
    .replaceAll('###HIGHLIGHT_TAG###', varTag(elem))
    .replaceAll('###VALUE###', varValue(elem))
    .replaceAll('###BG_COLOR###', getItemColorOnHover(elem, highlightedItems.value, currentHeapVizTraceState.value!))
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
      ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS} more ...</i></font>`
      : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS} more ...</i></font>`
  } else {
    moreLessText += '<font color="black"><i>show less</i></font>'
  }
  return DOT_PARTS.largeArrayRow
    .replaceAll('###IDENTIFIER###', svgCellId(heapArray.identifier, SVG_ID_SUFFIXES.moreLess))
    .replaceAll('###TEXT###', moreLessText)
}
function heapArrayEmptyRow (heapArray: HeapVizHeapArray): string {
  return DOT_PARTS.arrayEmptyRow
    .replaceAll('###IDENTIFIER###', svgCellId(heapArray.identifier, SVG_ID_SUFFIXES.empty))
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

  currentHeapVizTraceState.value.heapAfterExecution.forEach(function(ho: HeapVizHeapItem) {
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
    if (loadedClass.detailedFieldsOnly && !showInternalClassFields.value) continue
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
      if (!nextItem.detailedFieldsOnly || showInternalClassFields.value) {
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
    if (loadedClass.detailedFieldsOnly && !showInternalClassFields.value) continue
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
      dotString += stackTableFrameHeaderRow(stack[stackFrameNr], stackFrameNr)
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
            dotString +=
              `<td width="${MIN_WIDTH}" bgcolor="${itemColor}" title="id=&quot;${svgCellId(heapArray.elements[i].identifier, SVG_ID_SUFFIXES.index)}&quot;"><font color="${varValueColor}">[${i}]</font></td>`
          }

          if (isLargeArray(heapArray)) {
            let moreLessText = ''

            if (isCollapsedArray(heapArray)) {
              moreLessText += heapItemContainsHiddenChangedElement(heapArray)
                ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS}<br/>more ...</i></font>`
                : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapArray.elements.length - MAX_ARRAY_ELEMENTS}<br/>more ...</i></font>`
            } else {
              moreLessText += '<font color="black"><i>show<br/>less</i></font>'
            }
            dotString += `<td rowspan="2" width="${MIN_WIDTH}" title="id=&quot;${svgCellId(heapArray.identifier, SVG_ID_SUFFIXES.moreLess)}&quot;">${moreLessText}</td>`
          }

          dotString += '</tr>'
          dotString += '<tr><td sides="R"></td>'
          for (let i = 0; i < nVisibleElements; i++) {
            const varValueColor = varColor(heapArray.elements[i])
            const bgcolor = getItemColorOnHover(heapArray.elements[i], highlightedItems.value, currentHeapVizTraceState.value!)
            const valueTitleAttributes = injectedTitleAttributes({
              id: svgCellId(heapArray.elements[i].identifier, SVG_ID_SUFFIXES.value),
              'data-tooltip': primitiveTooltip(heapArray.elements[i])
            })
            dotString += `<td
                  width="${MIN_WIDTH}"
                  title="${valueTitleAttributes}"
                  bgcolor="${bgcolor}"><font color="${varValueColor}">`
            dotString += varValue(heapArray.elements[i])
            dotString += '</font></td>'
          }

          dotString += '</tr>'
        }
      } else {
        dotString += heapArrayEmptyRow(heapArray)
      }
      break
    }
    case 'HeapVizHeapObject': {
      if (heapItem.detailedFieldsOnly && !showInternalClassFields.value) {
        dotString += `<tr><td colspan="4" width="${MIN_WIDTH}"><font color="gray"><i>fields hidden</i></font></td></tr>`
      } else {
        const nVisibleFields = numberOfVisibleObjectFields(heapItem)
        for (let i = 0; i < nVisibleFields; i++) {
          dotString += varRow(heapItem.fields[i])
        }

        if (isLargeObject(heapItem)) {
          let moreLessText = ''
          if (isCollapsedObject(heapItem)) {
            moreLessText += heapItemContainsHiddenChangedElement(heapItem)
              ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${heapItem.fields.length - MAX_SHOWN_FIELDS} more ...</i></font>`
              : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${heapItem.fields.length - MAX_SHOWN_FIELDS} more ...</i></font>`
          } else {
            moreLessText += '<font color="black"><i>show less</i></font>'
          }

          dotString += `<tr>
                              <td sides="R"></td>
                              <td colspan="3" width="${MIN_WIDTH}" title="id=&quot;${svgCellId(heapItem.identifier, SVG_ID_SUFFIXES.moreLess)}&quot;">${moreLessText}</td>
                              <td sides="L"></td>
                            </tr>`
        }
      }
      break
    }
  }
  dotString += DOT_PARTS.heapObjectLabelEnd
  return dotString
}
function getNodeProperties (heapItem: HeapVizHeapItem): string {
  let cssClass = heapItem.kind.toLowerCase()

  if (isLargeArray(heapItem) || isLargeObject(heapItem)) {
    cssClass += ' large-heap-element'
  }

  return DOT_PARTS.heapObjectProperties
    .replaceAll('###LABEL###', getNodeLabel(heapItem))
    .replaceAll('###CSSCLASS###', cssClass)
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
  return `${getHeapItemById(referenceVal.reference).identifier}:heap_object_header`
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
    if (loadedClass.detailedFieldsOnly && !showInternalClassFields.value) continue
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
      if (!heapItem.detailedFieldsOnly || showInternalClassFields.value) {
        for (let i = 0; i < numberOfVisibleObjectFields(heapItem); i++) {
          const field = heapItem.fields[i]
          if (field.value.kind === 'HeapVizReferenceVal' && isExpanded(field)) {
            dotString += edge(field)
          }
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
  console.log('toggled expanded for ' + identifier + ' to ' + heapVizMetaStore.isExpandedIdentifier(identifier))
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
  console.log('toggled fully visible for ' + identifier + ' to ' + heapVizMetaStore.isFullyVisibleIdentifier(identifier))
}

function installClickListeners () {
  d3.select('#heap-wrapper')
    .on('click', (event) => {
      // Walk up from the click target to find the nearest SVGElement with an id attribute
      let node: EventTarget | null = event.target
      let identifierElement: SVGElement | null = null
      let identifier: string | null = null
      while (node instanceof Node && !(node instanceof SVGSVGElement)) {
        if (node instanceof SVGElement) {
          const id = node.getAttribute('id')
          if (id != null) {
            identifier = id
            identifierElement = node
            break
          }
        }
        node = (node as Node).parentElement
      }
      if (identifier == null) return

      const svgIdentifier = identifier
      const vizIdentifier = identifierFromSvgCellId(svgIdentifier)

      if (isExpandableReferenceIdentifier(vizIdentifier)) {
        // reference variable cell or field/array-element cell → toggle expansion
        toggleExpandedIdentifier(vizIdentifier)
        redraw()
      } else if (svgIdentifier.endsWith(SVG_ID_SUFFIXES.moreLess) && identifierElement?.closest('g.large-heap-element') != null) {
        // show-more / show-less cell inside a large heap element → toggle full visibility
        toggleIsFullyVisibleIdentifier(vizIdentifier)
        redraw()
      }
      // type-header cells and method-header cells: no action
    })
}

function installMouseMoveListenersForHover () {
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
        const id = node.getAttribute('id')
        if (id != null) {
          identifier = id
          break
        }
      }
      if (identifier == null) {
        HoverSynchronizer.hover([])
        return
      }
      let hoverInfos: HoverInfo[]
      const vizIdentifier = identifierFromSvgCellId(identifier)
      // check if a heap object is hovered
      if (vizIdentifier.charAt(0) === 'o') {
        hoverInfos = getHeapItemToHeapItemHoverInfos(vizIdentifier, currentHeapVizTraceState.value!)
        // check if a stack or statics item is hovered
      } else if (vizIdentifier.search('l_') >= 0 || vizIdentifier.search('s_') >= 0) {
        hoverInfos = getLocalOrStaticsToHeapItemHoverInfos(vizIdentifier.split(':')[1], currentHeapVizTraceState.value!)
      } else { // otherwise a method is hovered
        hoverInfos = getMethodHoverInfos(vizIdentifier, currentHeapVizTraceState.value!)
      }
      HoverSynchronizer.hover(hoverInfos)
    })
}

function redraw (hoverChanged: boolean = false) {
  if (!graphvizInstance || !isInitialized) return

  if (rendering) {
    pendingUpdate = { needed: true, hoverChanged: hoverChanged || pendingUpdate.hoverChanged }
    return
  }

  if (!currentHeapVizTraceState.value) {
    if (lastRenderedDotString !== '') {
      lastRenderedDotString = ''
      graphvizInstance.renderDot('')
    }
    return
  }

  calculateNodeVisibility()

  const dotString = heapToDotString()

  console.log(dotString)

  if (dotString === lastRenderedDotString) return

  if (!d3.select('#heap-wrapper').node()) {
    console.warn('Cannot render heap because the div is not present.')
    return
  }

  // d3-graphviz transition animations are broken for HTML-like labels; changing the following
  // settings does NOT have the expected result / no result at all:
  // graphvizInstance.fade(true) // default
  // graphvizInstance.growEnteringEdges(true)
  // graphvizInstance.tweenPaths(false)
  // graphvizInstance.logEvents(false) // default
  // graphvizInstance.tweenPrecision('5%')
  // graphvizInstance.tweenShapes(false)
  // if (diffSinceLast < 1.1 * DEFAULT_TRANSITION_TIME) {
  //  duration = 100
  // }
  const duration = hoverChanged ? 0 : DEFAULT_TRANSITION_TIME
  lastRenderedDotString = dotString
  rendering = true

  graphvizInstance
    // Per d3-graphviz docs: (a) use a factory so the transition is scheduled *after* layout,
    // not before; (b) the transition must be named when zoom is enabled, otherwise the zoom
    // behavior interrupts it and the graph renders incorrectly.
    .transition(() => d3.transition('heapviz-transition').duration(duration) as any)
    .renderDot(dotString, function() {
      // using the callback of renderDot ensures that the listeners are only attached after the rendering has finished
      processInjectedTitles(d3.select('#heap-wrapper').node() as Element)
      installClickListeners()
      installMouseMoveListenersForHover()
      annotationManager.redraw()

      rendering = false
      if (pendingUpdate.needed) {
        const nextHoverChanged = pendingUpdate.hoverChanged
        pendingUpdate = { needed: false, hoverChanged: false }
        redraw(nextHoverChanged)
      }
    })
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
  graphvizInstance = graphviz('#heap-wrapper')
    //.logEvents(true) // -> for large graphs, dataProcessPass1End is the event that takes the longest by far
    .onerror((msg: string) => console.error(msg))
    .on('initEnd', () => {
      isInitialized = true
      redraw()
      HoverSynchronizer.onHover(onHover)
    })
})
onUnmounted(() => {
  HoverSynchronizer.removeOnHover(onHover)
  annotationManager.destroy()
  graphvizInstance = null
  isInitialized = false
  rendering = false
  pendingUpdate = { needed: false, hoverChanged: false }
  lastRenderedDotString = null
}
)
</script>

<style>
#heap-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

#heap-wrapper>svg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

/* Cursor pointer for clickable cells.
   After processInjectedTitles the injected id lives on the <g> wrapper.
   Clickable: reference-var / field / array-element cells (id contains ":"),
   and show-more/show-less + type-header cells inside large-heap-element. */
#heap-wrapper g[id^="roots:"],
#heap-wrapper g[id*=":"],
#heap-wrapper .large-heap-element g[id] {
  cursor: pointer;
}

#heap-wrapper g[id$=":header"],
#heap-wrapper g[id$=":method"],
#heap-wrapper g[id$=":empty"] {
  cursor: default;
}

</style>
