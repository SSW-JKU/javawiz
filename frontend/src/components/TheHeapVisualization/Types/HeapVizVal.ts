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

  /**
   * Creates the value object that matches the kind of `val`.
   *
   * @param changed true if the variable that holds the value changed in the last step. Only a primitive value
   *   uses it, because it writes its own text color; `null` and reference symbols always stay black.
   */
  public static fromVal (val: Val, identifier:string, type:string, renderContext: MemoryViewRenderContext, changed: boolean): HeapVizVal {

    switch (val.kind) {
      case 'ReferenceVal':
        return new HeapVizReferenceVal(val, identifier, renderContext);

      case 'PrimitiveVal':
        return new HeapVizPrimitiveVal(val, identifier, type, renderContext, changed);

      case 'NullVal':
        return new HeapVizNullVal(val, identifier, renderContext);
    }
  }
}
