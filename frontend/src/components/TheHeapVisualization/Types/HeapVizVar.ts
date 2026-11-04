import { IVar } from '@/dto/TraceState';
import { MIN_WIDTH, OBJECT_BG_HOVER, REFERENCED_OBJECT_BG_HOVER, TYPE_FONT_COLOR, WHITE } from '../constants';
import { HeapVizElement } from './HeapVizElement';
import { HeapVizVal } from './HeapVizVal';
import { shortTypeName } from '@/helpers/Common';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { injectedTitleAttributes, SVG_CELL_SUFFIXES, svgCellIdentifier } from '../identifiers'
import type { HoverInfo } from '@/hover/types'
import { type EdgeStyle, referenceEdgeStyle, renderReferenceEdge } from '../ReferenceEdge'

export class HeapVizVar extends HeapVizElement<IVar> {

  name: string;
  value: HeapVizVal;
  changed: boolean;
  heapObjectId?: number;
  public get port (): string { return this.identifier.split(':')[1]}
  identifier: string;

  public get varType (): string { return (this.model as IVar).type; }
  public override get bgColor (): string {
    for (const hoverInfo of this.renderContext.hoverInfos()) {
      if (this.isHoveredBy(hoverInfo))
        return OBJECT_BG_HOVER
      if (hoverInfo.kind === 'HeapObject' && this.value instanceof HeapVizReferenceVal && this.value.reference === hoverInfo.objId)
        return REFERENCED_OBJECT_BG_HOVER
    }
    return WHITE.toLowerCase()
  }

  /** True when `hoverInfo` names this variable itself, not only the object that it references. */
  private isHoveredBy (hoverInfo: HoverInfo): boolean {
    switch (hoverInfo.kind) {
      case 'Field':
        return this.heapObjectId === hoverInfo.objId && this.name === hoverInfo.name
      case 'ThisVar':
        return this.name === 'this' && this.value instanceof HeapVizReferenceVal && this.value.reference === hoverInfo.reference
      case 'Static':
        return 'class' in this.model && this.model.class === hoverInfo.class && this.name === hoverInfo.name
      case 'Local':
        return 'class' in this.model &&
          'method' in this.model &&
          typeof this.model.method === 'string' &&
          this.model.class === hoverInfo.class &&
          // The backend names a local's method `visit(...)`, while stack frames and hovers use `visit`.
          this.model.method.split('(')[0] === hoverInfo.method &&
          this.name === hoverInfo.name &&
          (hoverInfo.stackFrameNr === undefined || hoverInfo.stackFrameNr === this.stackFrameNr)
      default:
        return false
    }
  }

  /** The reference arrow is highlighted when both this variable and the object it references are hovered. */
  private get edgeStyle (): EdgeStyle {
    const hoverInfos = this.renderContext.hoverInfos()
    const reference = (this.value as HeapVizReferenceVal).reference
    const highlighted = hoverInfos.some(hoverInfo => this.isHoveredBy(hoverInfo)) &&
      hoverInfos.some(hoverInfo => hoverInfo.kind === 'HeapObject' && hoverInfo.objId === reference)
    return referenceEdgeStyle(highlighted, this.model.changed)
  }

  /**
   * @param stackFrameNr the memory view's frame number for a local variable (main is 0), so that a hover
   *   of a recursive method's local highlights only its own frame; unset for fields and statics
   */
  constructor (model: IVar, identifier: string, renderContext: MemoryViewRenderContext, readonly stackFrameNr?: number) {
    super(model, renderContext);
    this.name = model.name;
    this.changed = model.changed;
    this.heapObjectId = model.heapObjectId;
    this.identifier = identifier
    this.value = HeapVizVal.fromVal(model.value, identifier, model.type, renderContext);

  }

  public edges (): string {

    if (!(this.value instanceof HeapVizReferenceVal))
      throw new Error('Not supported for ' + this.value.kind);

    return renderReferenceEdge(this.identifier, `o_${this.value.reference}`, this.edgeStyle)

  }

  public render (): string {

    const typeAndNameTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.typeAndName) })
    const pseudoTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.pseudo) })
    const valueTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.value) })
    const bytesTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.bytes) })

    const memoryDetails = this.renderContext.showMemory
      ? `<td width="${MIN_WIDTH}" align="right" title="${bytesTitle}" bgcolor="${this.bgColor}" ><b>${this.renderDetails()}</b></td>`
      : ''
    const variableColumnSpan = this.renderContext.showMemory ? ' colspan="2"' : ' colspan="3"'

    return `<tr>
           ${memoryDetails}
           <td${variableColumnSpan} width="${MIN_WIDTH}" align="right" title="${typeAndNameTitle}" bgcolor="${this.bgColor}">
             <font color="${TYPE_FONT_COLOR}">
               <b>&nbsp;${shortTypeName(this.varType.replace('-','UNKNOWN'))}</b>
             </font>
             <font color="${this.highlightColor}">${this.name}</font>
           </td>

           <td align="right" cellpadding="0" cellspacing="0" title="${pseudoTitle}" port="${this.port}" sides="LTB" bgcolor="${this.bgColor}">
             <font color="${WHITE}">xx</font>
           </td>

           <td align="left" cellpadding="0" cellspacing="0" title="${valueTitle}" sides="RTB" bgcolor="${this.bgColor}">
             <b>${this.value.render()}</b>
           </td>

         </tr>`;
  }

  public getTotalBytes (): number {
    return this.value.getTotalBytes();
  }

}
