import { Val } from '@/dto/TraceState';
import { HeapVizElement } from './HeapVizElement';
import { HeapVizNullVal } from './HeapVizNullVal';
import { HeapVizPrimitiveVal } from './HeapVizPrimitiveVal';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'

export abstract class HeapVizVal extends HeapVizElement<Val> {

  constructor (model: Val, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
  }

  public static fromVal (val: Val, identifier:string, type:string, renderContext: MemoryViewRenderContext): HeapVizVal {

    switch (val.kind) {
      case 'ReferenceVal':
        return new HeapVizReferenceVal(val, identifier, renderContext);

      case 'PrimitiveVal':
        return new HeapVizPrimitiveVal(val, identifier, type, renderContext);

      case 'NullVal':
        return new HeapVizNullVal(val, identifier, renderContext);
    }
  }
}
