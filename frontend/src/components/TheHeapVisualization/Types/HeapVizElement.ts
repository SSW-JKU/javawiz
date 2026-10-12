import { UNCHANGED_VAR_TAG, SUB_HEADER_BG_COLOR, UNCHANGED_VAR_COLOR } from '../constants';
import { useHeapVizMetaStore } from '@/store/HeapVizMetaStore';
import type { MemoryViewRenderContext } from '../MemoryViewRenderContext'
import { OBJECT_HEADER_BYTES } from '../MemorySize'

export interface HeapVizMeta {
  isExpanded: boolean
  isFullyVisible: boolean
}

export abstract class HeapVizRenderableElement<T> {
  public showFieldDetails: boolean = true;

  public abstract getTotalBytes(): number

  public getHeaderBytes (): number {
    return OBJECT_HEADER_BYTES
  }

  public isHighlighted: boolean = false;
  private _isVisible: boolean = true;
  protected heapVizMetaStore = useHeapVizMetaStore()

  public get isVisible (): boolean { return this._isVisible; }
  public set isVisible (value: boolean) { this._isVisible = value; }
  public get kind (): string { return this.constructor.name; }
  public get highlightColor (): string { return UNCHANGED_VAR_COLOR.toLowerCase(); } // TODO
  public get tag (): string { return UNCHANGED_VAR_TAG; }
  public get tooltip (): string { return this.constructor.name; }
  public get bgColor (): string { return SUB_HEADER_BG_COLOR.toLowerCase(); }
  public renderDetails (): string {
    return `${this.getTotalBytes()}`
  }

  constructor (protected model: T, protected readonly renderContext: MemoryViewRenderContext) {}

  public abstract render(): string;

  public getCssClasses (): string {
    return this.getNodeProperties()['class'];
  }

  public getNodeProperties (): Record<string,string> {
    return { class: this.kind.toLowerCase() };
  }

}

/** Base class for elements that have a stable DOT identifier and expansion state. */
export abstract class HeapVizElement<T> extends HeapVizRenderableElement<T> {
  public abstract get identifier(): string;
  public get isExpanded (): boolean { return this.heapVizMetaStore.isExpandedIdentifier(this.identifier); }
}
