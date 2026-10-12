import { NullVal } from '@/dto/TraceState';
import { HeapVizElement } from './HeapVizElement';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { REFERENCE_BYTES } from '../MemorySize'

export class HeapVizNullVal extends HeapVizElement<NullVal> {
  identifierValue: string;
  public get identifier (): string {
    return this.identifierValue
  }

  constructor (model: NullVal, identifier:string, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.identifierValue = identifier;
  }

  public render (): string {
    return '<i>null</i>';
  }

  public getTotalBytes (): number {
    return REFERENCE_BYTES;
  }

}
