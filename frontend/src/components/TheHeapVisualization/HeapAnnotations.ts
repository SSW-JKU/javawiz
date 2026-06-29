import type { TraceState } from '@/dto/TraceState'
import {
  PetAnnotationManager,
  type CalloutState,
  type PetQuestionAnswer,
  type PetQuestionOption,
  type SvgAnnotationTargetDescriptor
} from '@/components/PetAnnotations'
import { findHeapElements, heapLookupIdentifier, type HeapLookupTarget } from './HeapLookup'

export type HeapQuestionOption = PetQuestionOption
export type HeapQuestionAnswer = PetQuestionAnswer

type HeapAnnotationManagerOptions = {
  readonly getSvg: () => SVGSVGElement | null
  readonly getRootG: () => SVGGElement | null
  readonly getLookupRoot: () => Element | Document | null
}

export class HeapAnnotationManager {
  private readonly annotations = new PetAnnotationManager()
  private readonly targetIdentifiers = new Map<number, string>()

  public constructor (private readonly options: HeapAnnotationManagerOptions) {}

  public addSpeechBubble (target: HeapLookupTarget, traceState: TraceState, text: string): number {
    const id = this.annotations.addSvgSpeechBubble(this.svgTarget(target, traceState), text)
    this.targetIdentifiers.set(id, heapLookupIdentifier(target, traceState))
    return id
  }

  public addHighlight (
    target: HeapLookupTarget,
    traceState: TraceState,
    color = '#ffc552',
    opacity = 0.35,
    padding = 3
  ): number {
    const id = this.annotations.addSvgHighlight(this.svgTarget(target, traceState), color, opacity, padding)
    this.targetIdentifiers.set(id, heapLookupIdentifier(target, traceState))
    return id
  }

  public addQuestion (
    target: HeapLookupTarget,
    traceState: TraceState,
    text: string,
    options: readonly HeapQuestionOption[],
    onAnswer?: (answer: HeapQuestionAnswer) => void
  ): number {
    const id = this.annotations.addSvgQuestion(this.svgTarget(target, traceState), text, options, onAnswer)
    this.targetIdentifiers.set(id, heapLookupIdentifier(target, traceState))
    return id
  }

  public removeAnnotationById (id: number): void {
    this.targetIdentifiers.delete(id)
    this.annotations.removeAnnotationById(id)
  }

  public removeAnnotations (target: HeapLookupTarget, traceState: TraceState): number {
    const identifier = heapLookupIdentifier(target, traceState)
    const ids = [...this.targetIdentifiers]
      .filter(([, targetIdentifier]) => targetIdentifier === identifier)
      .map(([id]) => id)
    ids.forEach(id => this.removeAnnotationById(id))
    return ids.length
  }

  public clearAnnotations (): void {
    this.targetIdentifiers.clear()
    this.annotations.clearAnnotations()
  }

  public setCollapsed (id: number, collapsed: boolean): void {
    this.annotations.setCollapsed(id, collapsed)
  }

  public getCalloutState (id: number): CalloutState | undefined {
    return this.annotations.getCalloutState(id)
  }

  public getQuestionAnswer (id: number): HeapQuestionAnswer | undefined {
    return this.annotations.getQuestionAnswer(id)
  }

  public redraw (): void {
    this.annotations.redraw()
  }

  public destroy (): void {
    this.targetIdentifiers.clear()
    this.annotations.destroy()
  }

  private svgTarget (target: HeapLookupTarget, traceState: TraceState): SvgAnnotationTargetDescriptor {
    return {
      kind: 'svg',
      resolve: () => {
        const root = this.options.getLookupRoot()
        return root ? findHeapElements(target, root, traceState) : []
      },
      getSvg: this.options.getSvg,
      getRootG: this.options.getRootG
    }
  }
}
