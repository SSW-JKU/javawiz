import { LoadedClass } from '@/dto/TraceState';
import sanitizer from '@/helpers/sanitizer';
import { FONT_FACE_CLUSTER_TITLE, SUB_HEADER_BG_COLOR } from '../constants';
import { HeapVizRenderableElement } from './HeapVizElement';
import { HeapVizVar } from './HeapVizVar';
import { shouldShowClassStatics } from '../DataStructureVisibility'
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { CLASS_BYTES } from '../MemorySize'
import { staticFieldIdentifier } from '../identifiers'

export class HeapVizLoadedClass extends HeapVizRenderableElement<LoadedClass> {
  class: string;
  staticFields: HeapVizVar[];
  readonly isHeapTraversalStop: boolean;
  readonly isJavaDataStructure: boolean;
  readonly hasCollectedFields: boolean;
  override get bgColor (): string { return SUB_HEADER_BG_COLOR }

  constructor (model: LoadedClass, renderContext: MemoryViewRenderContext) {
    super(model, renderContext);
    this.class = model.class;
    this.staticFields = model.staticFields.map(f => new HeapVizVar(f, staticFieldIdentifier(model, f), renderContext));
    this.isHeapTraversalStop = model.isHeapTraversalStop;
    this.isJavaDataStructure = model.isJavaDataStructure;
    this.hasCollectedFields = model.hasCollectedFields;
    this.updateVisibility();
  }

  public updateVisibility (): void {
    this.isVisible = shouldShowClassStatics(this, this.renderContext.dataStructureVisibilitySettings)
  }

  public render (): string {

    let dotString = '';

    if (this.staticFields.length > 0) {
      dotString += `<tr><td bgcolor="${this.bgColor}" colspan="5"><font face="${FONT_FACE_CLUSTER_TITLE}"><b>${sanitizer.escapeHtml(this.class)} </b></font></td></tr>`;

      for (const staticVar of this.staticFields) {
        dotString += staticVar.render();
      }

      if (this.renderContext.showMemory) {
        dotString += `<tr><td align="right"><font><b align="right">${this.getTotalBytes()}</b></font></td><td colspan="4"></td></tr>`;
      }

    }

    return dotString;

  }

  public getTotalBytes (): number {
    let sum = CLASS_BYTES;

    for (const f of this.staticFields) {
      sum += f.getTotalBytes();
    }

    return sum
  }

}
