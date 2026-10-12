import { ReferenceVal } from '@/dto/TraceState';
import { HeapVizElement } from './HeapVizElement';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { REFERENCE_BYTES } from '../MemorySize'

export class HeapVizReferenceVal extends HeapVizElement<ReferenceVal> {

  private identifierValue: string;

  public get identifier (): string {
    return  this.identifierValue
  }

  public readonly reference: number;

  constructor (model: ReferenceVal, identifier:string, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.identifierValue = identifier;
    this.reference = model.reference;
  }

  public render (): string {
    const refVarString = '<font color="white">';

    if (this.isExpanded) {
      return refVarString + 'xx</font>';
    }

    return refVarString + '➕</font>';
    // TODO center/make smaller // Remark: The + symbol is always black. The white font color is on purpose to ensure that the collapsed and the expanded version have the same number of SVG elements, which is needed to ensure correct transition animations
  }

  public getTotalBytes (): number {
    return REFERENCE_BYTES;
  }

}
