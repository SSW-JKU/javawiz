import {
  CLUSTER_TITLE_FONT_SIZE,
  CONTENT_FONT_SIZE,
  FONT_FACE_CLUSTER_TITLE,
  FONT_FACE_TABLES,
  MAIN_HEADER_BG_COLOR,
  TABLE_FORMAT
} from './constants'
import type { HeapVizTraceState } from './Types/HeapVizTraceState'

type RootsTraceState = Pick<HeapVizTraceState, 'loadedClassesAfterExecution' | 'stackAfterExecution'>

/** Renders the complete shared five-column Statics/Stack table. */
export function renderRootsNode (traceState: RootsTraceState): string {
  let dotString = `subgraph cluster_roots {
     shape="box";
     style="invis";
  `
  dotString += `roots[shape="plaintext";
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
    `
  dotString += traceState.loadedClassesAfterExecution.filter(e => e.isVisible).map(loadedClass => loadedClass.render())
    .join('')
  dotString += `<tr>
                    <td colspan="5" border="0" height="15"></td>
                    </tr>
                  <tr>
                   <td colspan="5" bgcolor="${MAIN_HEADER_BG_COLOR}" id="stackHeader">
                     <font face="${FONT_FACE_CLUSTER_TITLE}" point-size="${CLUSTER_TITLE_FONT_SIZE}">
                      <b>Stack</b>
                     </font>
                   </td>
                 </tr>
    `
  let aboveInternalStackFrame = false
  traceState.stackAfterExecution.forEach(stackFrame => {
    if (stackFrame.internal) {
      if (!aboveInternalStackFrame) {
        dotString += `<tr>
                   <td bgcolor="red" colspan="5">
                     <font face="${FONT_FACE_CLUSTER_TITLE}">
                       <b>…</b>
                     </font>
                   </td>
                 </tr>`
      }
      aboveInternalStackFrame = true
    } else {
      dotString += stackFrame.render()
      aboveInternalStackFrame = false
    }
  })
  dotString += '</table></font>\n>\n]'
  dotString += '\n}\n'
  return dotString
}
