import { HeapArrayElementVar } from '@/dto/TraceState';
import { NULL_VAL, OBJECT_BG_HOVER, REFERENCED_OBJECT_BG_HOVER, WHITE } from '../constants';
import { HeapVizElement } from './HeapVizElement';
import { HeapVizVal } from './HeapVizVal';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { heapArrayElementIdentifier } from '../identifiers'
import { type EdgeStyle, referenceEdgeStyle, renderReferenceEdge } from '../ReferenceEdge'

export class HeapVizHeapArrayElementVar extends HeapVizElement<HeapArrayElementVar> {
  public override get bgColor (): string {
    if (this.renderContext.hoverInfos().some(item => item.kind === 'ArrayCell' && item.objId === this.arrayId && item.index === this.index))
      return OBJECT_BG_HOVER
    if (this.renderContext.hoverInfos().some(item => item.kind === 'HeapObject' && item.objId === this.arrayId))
      return REFERENCED_OBJECT_BG_HOVER
    return WHITE
  }
  arrayId: any;
  index: number;
  private identifierValue: string
  public get identifier (): string {
    return this.identifierValue
  }

  readonly value: HeapVizVal;

  changed: boolean;

  constructor (model: HeapArrayElementVar, arrayId: number, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);

    this.arrayId = arrayId;
    this.index = model.index;
    this.changed = model.changed;
    this.identifierValue = heapArrayElementIdentifier({ ...model, arrayId });

    this.value = HeapVizVal.fromVal(model.value, this.identifier, model.type, renderContext);

  }

  public render (): string {
    return this.value?.render() ?? NULL_VAL;
  }

  public edges (): string {

    if (!(this.value instanceof HeapVizReferenceVal))
      throw new Error('Not supported for ' + this.value.kind);

    return renderReferenceEdge(this.identifier, `o_${this.value.reference}`, this.edgeStyle)

  }

  /** The reference arrow is highlighted when both this cell and the object it references are hovered. */
  private get edgeStyle (): EdgeStyle {
    const hoverInfos = this.renderContext.hoverInfos()
    const reference = (this.value as HeapVizReferenceVal).reference
    const highlighted = hoverInfos.some(item => item.kind === 'ArrayCell' && item.objId === this.arrayId && item.index === this.index) &&
      hoverInfos.some(item => item.kind === 'HeapObject' && item.objId === reference)
    return referenceEdgeStyle(highlighted, this.model.changed)
  }

  public getTotalBytes (): number {
    return this.value.getTotalBytes();
  }

}
