import { LoadedClass, ProcessedHeapItem } from '@/dto/TraceState';
import { HeapVizElement } from './HeapVizElement';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { OBJECT_HEADER_BYTES } from '../MemorySize'
import { shortTypeName } from '@/helpers/Common'
import {
  CHANGED_VAR_COLOR,
  CONTENT_FONT_SIZE,
  FONT_FACE_TABLES,
  MAIN_HEADER_BG_COLOR,
  MAIN_HEADER_BG_COLOR_HOVER,
  MAIN_HEADER_FONT_COLOR,
  MIN_WIDTH,
  NEW_HEAP_ITEM_HEADER_FONT_COLOR,
  TABLE_FORMAT,
  UNCHANGED_VAR_COLOR
} from '../constants'
import { injectedTitleAttributes, SVG_CELL_SUFFIXES, svgCellIdentifier } from '@/identifiers/trace-identifiers'

export interface IHeapVizHeapItem {
  getCssClasses(): unknown;

  id: number;
  varType: string
  readonly loadedClass: LoadedClass | undefined;
  faked: boolean;
  isVisible: boolean;
  identifier: string;
  kind: string;
  bgColor: string

  render(): string
  renderNode(): string
  renderDetails():string
  edges():string
  getTotalBytes():number
  getHeaderBytes():number

}

export abstract class HeapVizHeapItem<T extends ProcessedHeapItem> extends HeapVizElement<T> implements IHeapVizHeapItem {
  id: number;
  varType: string
  public get loadedClass (): LoadedClass | undefined { return this.model.loadedClass; }
  faked: boolean;

  identifier: string;

  constructor (model: T, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.id = model.id;
    this.faked = model.faked ?? false;
    this.isVisible = false
    this.identifier = (model as any).identifier;
    this.varType = model.type ?? '[Unknown]'
  }

  abstract render():string;
  abstract edges():string;

  public getHeaderBytes (): number {
    return OBJECT_HEADER_BYTES
  }

  /** Renders the shared first memory row used by ordinary heap-item layouts. */
  protected renderMemoryHeaderRow (headerBytes: number = this.getHeaderBytes()): string {
    if (!this.renderContext.showMemory)
      return ''

    return `<tr>
              <td width="${MIN_WIDTH}" align="right"><b>${headerBytes}</b></td>
              <td colspan="4" width="${MIN_WIDTH}">Header</td>
            </tr>`
  }

  /** Renders subtotal, padding, and aligned total on the common five-column grid. */
  protected renderMemoryTotalRow (unalignedBytes: number): string {
    if (!this.renderContext.showMemory)
      return ''

    const totalBytes = this.getTotalBytes()
    return `<tr>
              <td width="${MIN_WIDTH}" align="right"><b>${unalignedBytes}</b>&nbsp;(+${totalBytes - unalignedBytes})</td>
              <td colspan="4" width="${MIN_WIDTH}" align="right"><b>${totalBytes}</b></td>
            </tr>`
  }

  /** True if this item did not exist in the state shown before; it is then drawn with a red frame and header text. */
  public get isNew (): boolean { return this.model.isNew ?? false }

  /**
   * Renders the shared Graphviz node wrapper and title row around this item's body rows.
   * Subclasses continue to provide only their item-specific rows through `render()`.
   * A new item (see `isNew`) gets a red frame and light red header text in every mode.
   */
  public renderNode (): string {
    const headerBgColor = this.renderContext.hoverInfos().some(item => item.kind === 'HeapObject' && item.objId === this.id)
      ? MAIN_HEADER_BG_COLOR_HOVER
      : MAIN_HEADER_BG_COLOR
    const headerTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.header) })
    const headerFontColor = this.isNew ? NEW_HEAP_ITEM_HEADER_FONT_COLOR : MAIN_HEADER_FONT_COLOR
    // Graphviz passes a table's color on to its cells and nested tables. The red frame of a new item is therefore
    // a separate outer table, and the item's table sets the color of its cell borders back to black.
    const frameStart = this.isNew
      ? `<table border="2" color="${CHANGED_VAR_COLOR}" cellborder="0" cellspacing="0" cellpadding="0"><tr><td>`
      : ''
    const frameEnd = this.isNew ? '</td></tr></table>' : ''
    const tableColor = this.isNew ? ` color="${UNCHANGED_VAR_COLOR}"` : ''

    return `${this.identifier}[label=<<font face="${FONT_FACE_TABLES}" point-size="${CONTENT_FONT_SIZE}">
                              ${frameStart}<table ${TABLE_FORMAT}${tableColor}><tr>
                            <td align="center" colspan="5" title="${headerTitle}" bgcolor="${headerBgColor}" port="heap_object_header">
                              <font color="${headerFontColor}"><b>${shortTypeName(this.varType.replace('-',''))}</b></font>
                            </td>
                          </tr>   ${this.render()}\n\n  </table>${frameEnd}  </font>> , class="${this.getCssClasses()}"];\n`
  }

}
