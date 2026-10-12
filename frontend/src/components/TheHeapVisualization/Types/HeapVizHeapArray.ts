import { ProcessedHeapArray } from '@/dto/TraceState';
import { MAX_ARRAY_ELEMENTS, FONT_FACE_VALUES, MIN_WIDTH, CHANGED_VAR_COLOR, UNCHANGED_VAR_COLOR, WHITE, SUB_HEADER_BG_COLOR } from '../constants';
import { HeapVizHeapItem } from './HeapVizHeapItem';
import { HeapVizHeapArrayElementVar } from './HeapVizHeapArrayElementVar';
import { HeapVizPrimitiveVal } from './HeapVizPrimitiveVal';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { ARRAY_LENGTH_BYTES, OBJECT_HEADER_BYTES, alignBytes } from '../MemorySize'
import { heapItemIdentifier, injectedTitleAttributes, SVG_CELL_SUFFIXES, svgCellIdentifier } from '../identifiers'

export class HeapVizHeapArray extends HeapVizHeapItem<ProcessedHeapArray> {

  elements: HeapVizHeapArrayElementVar[];

  private static readonly primitiveComponentTypes = new Set([
    'boolean', 'byte', 'short', 'char', 'int', 'long', 'float', 'double'
  ])

  public get isRefArray (): boolean {
    if (this.elements.length > 0)
      return !(this.elements[0].value instanceof HeapVizPrimitiveVal)

    return !HeapVizHeapArray.primitiveComponentTypes.has(this.varType.replace(/\[\]$/, ''))
  }
  override get bgColor (): string {      return WHITE  }

  constructor (model: ProcessedHeapArray, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.elements = model.elements.map(e => new HeapVizHeapArrayElementVar(e, model.id, renderContext));
    this.identifier = heapItemIdentifier(model)

  }

  public edges ():string {

    return this.elements.filter(e => e.value instanceof HeapVizReferenceVal && e.isExpanded)
      .slice(0,this.numberOfVisibleArrayElements())
      .map(e => e.edges())
      .join('\n');

  }

  public numberOfVisibleArrayElements (): number {
    return this.isCollapsed() ? MAX_ARRAY_ELEMENTS : this.elements.length;
  }

  public isLarge (): boolean {
    return this.elements.length > MAX_ARRAY_ELEMENTS;
  }

  public override getNodeProperties (): Record<string,string> {

    const base = super.getNodeProperties();

    if (this.isLarge())
      base['class'] = base['class'] + ' large-heap-element'

    return base;
  }

  public heapArrayEmptyRow (): string {
    const title = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.empty) })
    return `<tr>
           <td colspan="5" title="${title}" bgcolor="${this.bgColor}">
             <font face="${FONT_FACE_VALUES}">
               <i>
                 empty
               </i>
             </font>
           </td>
         </tr>`;
  }

  private renderLengthRow (): string {
    if (!this.renderContext.showMemory)
      return ''

    return `<tr>
              <td width="${MIN_WIDTH}" align="right"><b>${ARRAY_LENGTH_BYTES}</b></td>
              <td colspan="4" width="${MIN_WIDTH}">Length</td>
            </tr>`
  }

  private renderReferenceArrayRow (index: number): string {
    const elem = this.elements[index];
    const indexTitle = injectedTitleAttributes({ id: svgCellIdentifier(elem.identifier, SVG_CELL_SUFFIXES.index) })
    const pseudoTitle = injectedTitleAttributes({ id: svgCellIdentifier(elem.identifier, SVG_CELL_SUFFIXES.pseudo) })
    const valueTitle = injectedTitleAttributes({ id: svgCellIdentifier(elem.identifier, SVG_CELL_SUFFIXES.value) })

    const memoryDetails = this.renderContext.showMemory
      ? `<td width="${MIN_WIDTH}" align="right" bgcolor="${WHITE}"><b>${this.elements[index].getTotalBytes()}</b></td>`
      : ''
    const indexColumnSpan = this.renderContext.showMemory ? ' colspan="2"' : ' colspan="3"'

    return `<tr>
              ${memoryDetails}
              <td${indexColumnSpan} width="${MIN_WIDTH}" title="${indexTitle}" bgcolor="${SUB_HEADER_BG_COLOR}">
                <font color="${this.highlightColor}">
                  <${this.tag}>[${index}]</${this.tag}>
                </font>
              </td>
              <td align="right" cellpadding="0" cellspacing="0" title="${pseudoTitle}" port="i_${index}" sides="LTB" bgcolor="${elem.bgColor}">
                <font color="white">&nbsp;</font>
              </td>
              <td align="left" cellpadding="0" cellspacing="0" title="${valueTitle}" sides="RTB" bgcolor="${elem.bgColor}">
                <${this.tag}>${elem.render()}</${this.tag}>
              </td>
            </tr>`;

  }

  private heapItemContainsHiddenChangedElement (): boolean {
    return this.elements.some((elem: HeapVizHeapArrayElementVar, index: number) => index >= MAX_ARRAY_ELEMENTS && elem.changed);
  }

  public renderReferenceLargeArrayRowPostfix (): string {
    let moreLessText = '';

    if (this.isCollapsed()) {
      moreLessText += this.heapItemContainsHiddenChangedElement()
        ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${this.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`
        : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${this.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`;
    }
    else {
      moreLessText += '<font color="black"><i>show less</i></font>';
    }

    const title = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.moreLess) })
    return  `<tr>
           <td colspan="5" title="${title}">${moreLessText}</td>
         </tr>
  `
  }

  public renderPrimitiveLargeArrayRowPostfix (rowSpan: number = 2): string {
    let moreLessText = '';

    if (this.isCollapsed()) {
      moreLessText += this.heapItemContainsHiddenChangedElement()
        ? `<font color="${CHANGED_VAR_COLOR}"><i>... ${this.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`
        : `<font color="${UNCHANGED_VAR_COLOR}"><i>... ${this.elements.length - MAX_ARRAY_ELEMENTS} more</i></font>`;
    }
    else {
      moreLessText += '<font color="black"><i>show less</i></font>';
    }

    const title = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.moreLess) })
    return `<td rowspan="${rowSpan}" width="${MIN_WIDTH}" title="${title}">${moreLessText}</td>`;
  }

  public isCollapsed (): boolean {
    return this.isLarge() && !this.heapVizMetaStore.isFullyVisibleIdentifier(this.identifier)
  }

  public render (): string {

    if (this.elements.length === 0)
      return this.renderContext.showMemory
        ? this.renderMemoryHeaderRow() + this.renderLengthRow() + this.renderMemoryTotalRow(this.getUnalignedBytes())
        : this.heapArrayEmptyRow()

    if (this.isRefArray)
      return this.renderMemoryHeaderRow() + this.renderLengthRow() + this.renderRefRows() + this.renderMemoryTotalRow(this.getUnalignedBytes())

    return this.renderMemoryHeaderRow() + this.renderLengthRow() + this.renderPrimitiveRows() + this.renderMemoryTotalRow(this.getUnalignedBytes())
  }

  private renderRefRows () {
    let dotString = '';

    const visibleElementCount = this.numberOfVisibleArrayElements()
    for (let i = 0; i < visibleElementCount; i++) {
      dotString += this.renderReferenceArrayRow(i);
    }

    if (this.isLarge())
      dotString += this.renderReferenceLargeArrayRowPostfix();

    return dotString;
  }

  private renderPrimitiveRows () {

    // Primitive arrays stay horizontal, but the nested table prevents their element count
    // from changing the five-column geometry of the surrounding heap-item table.
    const memoryMode = this.renderContext.showMemory
    let dotString = '<tr><td colspan="5" border="0" cellpadding="0" cellspacing="0"><table border="0" cellborder="1" cellspacing="0"><tr>';
    const nVisibleElements = this.numberOfVisibleArrayElements();

    for (let i = 0; i < nVisibleElements; i++) {
      const itemColor = this.elements[i].bgColor;
      const title = injectedTitleAttributes({ id: svgCellIdentifier(this.elements[i].identifier, SVG_CELL_SUFFIXES.index) })
      dotString += `<td width="${MIN_WIDTH}" title="${title}" bgcolor="${itemColor}"><font color="${this.highlightColor}">[${i}]</font></td>`;
    }

    if (this.isLarge()) {
      dotString += this.renderPrimitiveLargeArrayRowPostfix(memoryMode ? 3 : 2);
    }

    dotString += '</tr><tr>';

    for (let i = 0; i < nVisibleElements; i++) {
      const varValueColor = this.bgColor;
      const bgcolor = this.elements[i].bgColor;
      const title = injectedTitleAttributes({
        id: svgCellIdentifier(this.elements[i].identifier, SVG_CELL_SUFFIXES.value),
        'data-tooltip': this.tooltip
      })
      dotString += `<td width="${MIN_WIDTH}" title="${title}" pointer-events="none" bgcolor="${bgcolor}"><font color="${varValueColor}">`;
      dotString += this.elements[i].value.render();
      dotString += '</font></td>';
    }
    dotString += '</tr>';

    if (memoryMode) {
      dotString += '<tr>'
      for (let i = 0; i < nVisibleElements; i++) {
        dotString += `<td width="${MIN_WIDTH}" align="right" bgcolor="${this.bgColor}"><font color="${this.highlightColor}">`
        dotString += `<b>${this.elements[i].value.getTotalBytes()}</b>`
        dotString += '</font></td>'
      }
      dotString += '</tr>';
    }

    dotString += '</table></td></tr>';

    return dotString;

  }

  private getTotalItemsBytes ():number {
    let sum = 0;
    for (const e of this.elements) {
      sum += e.getTotalBytes();
    }
    return sum
  }

  public getTotalBytes (): number {
    return alignBytes(this.getUnalignedBytes())

  }

  private getUnalignedBytes (): number {
    return OBJECT_HEADER_BYTES + ARRAY_LENGTH_BYTES + this.getTotalItemsBytes()
  }

}
