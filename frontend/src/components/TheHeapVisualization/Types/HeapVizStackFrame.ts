import { IVar, ReferenceVal, StackFrame } from '@/dto/TraceState';
import sanitizer from '@/helpers/sanitizer';
import { FONT_FACE_CLUSTER_TITLE, METHOD_HEADER_BG_COLOR_HOVER, SUB_HEADER_BG_COLOR } from '../constants';
import { HeapVizElement } from './HeapVizElement';
import { HeapVizVar } from './HeapVizVar';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { alignBytes } from '../MemorySize'
import { injectedTitleAttributes, methodHeaderIdentifier, stackLocalIdentifier } from '../identifiers'

export class HeapVizStackFrame extends HeapVizElement<StackFrame> {
  public override get bgColor (): string {
    return this.renderContext.hoverInfos().some(item => item.kind === 'Method' && item.class === this.class && item.method === this.method)
      ? METHOD_HEADER_BG_COLOR_HOVER
      : SUB_HEADER_BG_COLOR
  }
  public get identifier (): string {
    return `roots:l_${this.stackFrameNr}_this`
  }
  stackFrameNr: number;
  class: string;
  method: string;
  signature: string;
  genericSignature?: string;
  localVariables: HeapVizVar[];
  this?: HeapVizVar;
  displayText: string;
  internal: boolean;

  constructor (model: StackFrame, stackFrameNr: number, renderContext: MemoryViewRenderContext, changed: boolean = false) {
    super(model, renderContext);
    this.stackFrameNr = stackFrameNr
    this.class = model.class;
    this.method = model.method;
    this.signature = model.signature;
    this.genericSignature = model.genericSignature;
    this.localVariables = model.localVariables?.map(v => new HeapVizVar(v, stackLocalIdentifier(stackFrameNr, v), renderContext));
    if (stackFrameNr === 0 && model.method === 'main' && model.signature === '([Ljava/lang/String;)V' && !model.this) {
      // The JVM descriptor identifies main(String[]); the backend's display signature
      // supplies its parameter name, so unrelated locals named args stay expanded.
      const parameterName = /^void main \(String\[\] ([^\s()]+)\)$/.exec(model.displaySignature)?.[1]
      const parameter = this.localVariables.find(v => v.name === parameterName && v.varType === 'java.lang.String[]')
      if (parameter && !this.heapVizMetaStore.isIdentifierInMap(parameter.identifier)) {
        // Initialize once: reconstructing frames while stepping must preserve user choices.
        this.heapVizMetaStore.setExpandedIdentifier({ identifier: parameter.identifier, e: false })
      }
    }
    this.displayText = model.displayText;
    this.internal = model.internal;

    this.this = model.this ? this.thisVar(changed) : undefined;
  }

  private thisVar (newlyEnteredStackframe: boolean): HeapVizVar {

    const refValue:IVar = {
      type: this.class,
      name: 'this',
      changed: newlyEnteredStackframe,
      value: this.model.this as ReferenceVal,
      kind: 'Var'
    }
    return new HeapVizVar(refValue,  `roots:l_${this.stackFrameNr}_this`, this.renderContext)
  }

  public render (): string {

    const title = sanitizer.escapeHtml(this.displayText);
    const methodAttributes = injectedTitleAttributes({ id: methodHeaderIdentifier(this.stackFrameNr) })

    let dotString = `<tr>
                   <td bgcolor="${this.bgColor}" colspan="5" title="${methodAttributes}">
                     <font face="${FONT_FACE_CLUSTER_TITLE}">
                       <b>${title}</b>
                     </font>
                   </td>
                 </tr>
  `;

    if (this.this)
      dotString += this.this.render()

    this.localVariables.forEach(e => dotString += e.render())

    if (this.renderContext.showMemory) {
      dotString += `<tr><td sides="BL" align="right"><font><b align="right">${this.getTotalBytes()}</b></font></td><td sides="BR" colspan="4"></td></tr>`;
    }

    return dotString

  }

  public getTotalBytes (): number {
    let sum = 0

    if (this.this) {
      sum += this.this.getTotalBytes();
    }

    for (const v of this.localVariables) {
      sum += v.getTotalBytes();
    }

    return alignBytes(sum);
  }

}
