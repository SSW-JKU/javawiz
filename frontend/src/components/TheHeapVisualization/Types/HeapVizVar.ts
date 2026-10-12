import { IVar } from '@/dto/TraceState';
import { MIN_WIDTH, OBJECT_BG_HOVER, REFERENCED_OBJECT_BG_HOVER, TYPE_FONT_COLOR, WHITE } from '../constants';
import { HeapVizElement } from './HeapVizElement';
import { HeapVizVal } from './HeapVizVal';
import { shortTypeName } from '@/helpers/Common';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { injectedTitleAttributes, SVG_CELL_SUFFIXES, svgCellIdentifier } from '../identifiers'

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
      if (hoverInfo.kind === 'Field' && this.heapObjectId === hoverInfo.objId && this.name === hoverInfo.name)
        return OBJECT_BG_HOVER
      if (hoverInfo.kind === 'ThisVar' && this.name === 'this' && this.value instanceof HeapVizReferenceVal && this.value.reference === hoverInfo.reference)
        return OBJECT_BG_HOVER
      if (hoverInfo.kind === 'Static' && 'class' in this.model && this.model.class === hoverInfo.class && this.name === hoverInfo.name)
        return OBJECT_BG_HOVER
      if (hoverInfo.kind === 'Local' &&
        'class' in this.model &&
        'method' in this.model &&
        this.model.class === hoverInfo.class &&
        this.model.method === hoverInfo.method &&
        this.name === hoverInfo.name)
        return OBJECT_BG_HOVER
      if (hoverInfo.kind === 'HeapObject' && this.value instanceof HeapVizReferenceVal && this.value.reference === hoverInfo.objId)
        return REFERENCED_OBJECT_BG_HOVER
    }
    return WHITE.toLowerCase()
  }

  constructor (model: IVar, identifier: string, renderContext: MemoryViewRenderContext) {
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

    let additionalProperties = '[]'
    const ref1 = (this.value as HeapVizReferenceVal).reference

    if (this.model.changed) {
      additionalProperties = '[color="red" penwidth="2.0"]'
    }

    return `${this.identifier}:e -> o_${ref1}:heap_object_header:w ${additionalProperties};`

  }

  public render (): string {

    const typeAndNameTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.typeAndName) })
    const pseudoTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.pseudo) })
    const valueTitle = injectedTitleAttributes({ id: svgCellIdentifier(this.identifier, SVG_CELL_SUFFIXES.value) })

    const memoryDetails = this.renderContext.showMemory
      ? `<td width="${MIN_WIDTH}" align="right"  bgcolor="${this.bgColor}" ><b>${this.renderDetails()}</b></td>`
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
