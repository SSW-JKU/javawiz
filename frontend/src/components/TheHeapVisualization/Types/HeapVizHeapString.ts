import { ProcessedHeapString } from '@/dto/TraceState';
import { MIN_WIDTH, FONT_FACE_VALUES, WHITE } from '../constants';
import { HeapVizHeapItem } from './HeapVizHeapItem';
import { HeapVizVar } from './HeapVizVar';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import { shouldShowDataStructureFields } from '../DataStructureVisibility'
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { STRING_OBJECT_BYTES, stringSize } from '../MemorySize'
import { heapItemIdentifier, heapObjectFieldIdentifier, injectedTitleAttributes, SVG_CELL_SUFFIXES, svgCellIdentifier } from '../identifiers'

export class HeapVizHeapString extends HeapVizHeapItem<ProcessedHeapString> {

  public charArr:HeapVizVar;
  public get fieldIsVisible (): boolean {
    return shouldShowDataStructureFields(this.renderContext.dataStructureVisibilitySettings)
  }

  public render (): string { // TODO: Show internal char array
    let dotString = this.renderMemoryHeaderRow()

    if (this.fieldIsVisible) {
      dotString += this.charArr.render()
      return dotString + this.renderMemoryTotalRow(STRING_OBJECT_BYTES)
    }

    const title = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.value) })
    const memory = this.renderContext.showMemory
      ? `<td width="${MIN_WIDTH}" align="right" bgcolor="${WHITE}">${this.getTotalBytes() - this.getHeaderBytes()}</td>`
      : ''
    const valueColumnSpan = this.renderContext.showMemory ? 4 : 5
    dotString += `    <tr>
           ${memory}
           <td width="${MIN_WIDTH}" colspan="${valueColumnSpan}" title="${title}" bgcolor="${this.bgColor}">
             <font color="${this.highlightColor}" face="${FONT_FACE_VALUES}">
               <${this.tag}>"${this.model.vizString}"</${this.tag}>
             </font>
           </td>
         </tr>
  `
    return dotString + this.renderMemoryTotalRow(this.getTotalBytes())
  }

  constructor (model: ProcessedHeapString, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.charArr = new HeapVizVar(model.charArr, heapObjectFieldIdentifier(model, model.charArr), renderContext)
    this.identifier = heapItemIdentifier(model)
  }

  public edges ():string {

    if (!this.fieldIsVisible || !(this.charArr.value instanceof HeapVizReferenceVal) || !this.charArr.isExpanded) {
      return ''
    }

    return this.charArr.edges()
  }
  public getTotalBytes (): number {
    return this.fieldIsVisible
      ? STRING_OBJECT_BYTES
      : stringSize(this.model.string, this.charArr.varType)
  }

  public get backingArrayId (): number | undefined {
    return this.charArr.value instanceof HeapVizReferenceVal ? this.charArr.value.reference : undefined
  }

}
