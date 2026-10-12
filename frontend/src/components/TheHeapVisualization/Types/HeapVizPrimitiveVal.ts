import { PrimitiveVal } from '@/dto/TraceState';
import { FONT_FACE_VALUES } from '../constants';
import { HeapVizElement } from './HeapVizElement';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { BYTE_BYTES, CHAR_BYTES, DOUBLE_BYTES, FLOAT_BYTES, INT_BYTES, LONG_BYTES, SHORT_BYTES } from '../MemorySize'

export class HeapVizPrimitiveVal extends HeapVizElement<PrimitiveVal> {

  //  readonly vizValue: string
  readonly value?: string;
  readonly type: string
  identifierValue: string;

  public get identifier (): string {

    return this.identifierValue

  }

  constructor (model: PrimitiveVal, identifier:string, type:string, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.identifierValue = identifier;
    this.value = model.vizValue;
    this.type = type
  }

  public render (): string {

    return `<font color="${this.highlightColor}" face="${FONT_FACE_VALUES}">&nbsp;${this.value}&nbsp;</font>`; // &nbsp; is needed as dot does not support empty font tags
  }

  public getTotalBytes (): number {
    const t = this.type.toLowerCase()

    if (t.includes('boolean') || t.includes('byte')) return BYTE_BYTES;
    if (t.includes('char')) return CHAR_BYTES;
    if (t.includes('short')) return SHORT_BYTES;
    if (t.includes('int')) return INT_BYTES;
    if (t.includes('float')) return FLOAT_BYTES;
    if (t.includes('long')) return LONG_BYTES;
    if (t.includes('double')) return DOUBLE_BYTES;

    // Unknown synthetic primitive types do not contribute to the memory estimate.
    return 0
  }

}
