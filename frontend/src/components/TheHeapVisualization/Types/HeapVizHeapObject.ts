import { ProcessedHeapObject } from '@/dto/TraceState'
import { shouldShowObjectFields } from '../DataStructureVisibility'
import {
  CHANGED_VAR_COLOR,
  MAIN_HEADER_BG_COLOR,
  MAIN_HEADER_BG_COLOR_HOVER,
  MAX_FIELDS_THRESHOLD,
  MAX_SHOWN_FIELDS,
  MIN_WIDTH,
  NewLine,
  UNCHANGED_VAR_COLOR
} from '../constants'
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { alignBytes, OBJECT_HEADER_BYTES } from '../MemorySize'
import { HeapVizHeapItem } from './HeapVizHeapItem'
import { HeapVizReferenceVal } from './HeapVizReferenceVal'
import { HeapVizVar } from './HeapVizVar'
import { heapItemIdentifier, heapObjectFieldIdentifier, injectedTitleAttributes, SVG_CELL_SUFFIXES, svgCellIdentifier } from '../identifiers'

export class HeapVizHeapObject extends HeapVizHeapItem<ProcessedHeapObject> {
  public fields: HeapVizVar[] // does not include static fields
  public get heapItemContainsHiddenChangedElement (): boolean {
    return this.fields.slice(MAX_SHOWN_FIELDS).some(field => field.changed)
  }
  public get bgColor (): string {
    return this.renderContext.hoverInfos().some(item => item.kind === 'HeapObject' && item.objId === this.id)
      ? MAIN_HEADER_BG_COLOR_HOVER.toLowerCase()
      : MAIN_HEADER_BG_COLOR.toLowerCase()
  }
  /** Uses the same class-level policy for field rows, traversal, and reference edges. */
  public get fieldsAreVisible (): boolean {
    return shouldShowObjectFields(this.loadedClass, this.renderContext.dataStructureVisibilitySettings)
  }

  constructor (model: ProcessedHeapObject, renderContext: MemoryViewRenderContext) {
    super(model, renderContext)
    this.fields = model.fields.map(f => new HeapVizVar(f, heapObjectFieldIdentifier(model, f), renderContext))
    this.identifier = heapItemIdentifier(model)
  }

  public edges (): string {
    if (!this.fieldsAreVisible)
      return ''

    return this.fields.filter(e => e.value instanceof HeapVizReferenceVal && e.isExpanded)
      .slice(0, this.numberOfVisibleObjectFields())
      .map(e => e.edges())
      .join(NewLine)
  }

  public numberOfVisibleObjectFields (): number {
    return this.isCollapsedObject() ? MAX_SHOWN_FIELDS : this.fields.length
  }

  private isCollapsedObject (): boolean {
    return this.isLarge() && !this.heapVizMetaStore.isFullyVisibleIdentifier(this.identifier)
  }

  public render (): string {
    let dotString = this.renderMemoryHeaderRow()

    if (!this.fieldsAreVisible) {
      dotString += `<tr><td colspan="5" width="${MIN_WIDTH}"><font color="gray"><i>fields hidden</i></font></td></tr>`
      return dotString + this.renderMemoryTotalRow(this.getUnalignedBytes())
    }

    dotString += this.fields.slice(0, this.numberOfVisibleObjectFields())
      .map(field => field.render())
      .join('')

    if (this.isLarge()) {
      const moreLessText = this.isCollapsedObject()
        ? `<font color="${this.heapItemContainsHiddenChangedElement ? CHANGED_VAR_COLOR : UNCHANGED_VAR_COLOR}"><i>... ${this.fields.length - MAX_SHOWN_FIELDS} more</i></font>`
        : '<font color="black"><i>show less</i></font>'

      const title = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.moreLess) })
      dotString += `<tr>
                      <td colspan="5" width="${MIN_WIDTH}" title="${title}">${moreLessText}</td>
                    </tr>`
    }

    return dotString + this.renderMemoryTotalRow(this.getUnalignedBytes())
  }

  public isLarge (): boolean {
    return this.fields.length > MAX_FIELDS_THRESHOLD
  }

  public override getNodeProperties (): Record<string, string> {
    const properties = super.getNodeProperties()
    if (this.isLarge())
      properties.class += ' large-heap-element'
    return properties
  }

  public getTotalBytes (): number {
    return alignBytes(this.getUnalignedBytes())
  }

  private getUnalignedBytes (): number {
    return OBJECT_HEADER_BYTES + this.fields.reduce((sum, field) => sum + field.getTotalBytes(), 0)
  }
}
