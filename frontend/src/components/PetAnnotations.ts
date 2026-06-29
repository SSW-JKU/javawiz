import * as d3 from 'd3'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const DEFAULT_CALLOUT_GAP = 16
const CALLOUT_MARGIN = 8
const CALLOUT_MIN_WIDTH = 96
const CALLOUT_MAX_CONTENT_WIDTH = 240
const COLLAPSED_CALLOUT_SIZE = 26
const CALLOUT_TEXT_FALLBACK_CHAR_WIDTH = 7
const TARGET_POINTER_MARGIN = 2

export type PetQuestionOption = {
  readonly label: string
  readonly value?: string
}

export type PetQuestionAnswer = {
  readonly questionId: number
  readonly option: PetQuestionOption
}

export function parsePetQuestionPayload (payload: string): { text: string, options: PetQuestionOption[] } | undefined {
  const start = payload.indexOf('(*')
  const end = payload.lastIndexOf(')')
  if (start < 0 || end < start) return undefined

  return {
    text: payload.substring(0, start).trim(),
    options: payload
      .substring(start + 2, end)
      .trim()
      .split('|')
      .map(option => ({ label: option.trim() }))
  }
}

export type AnnotationElementResolver = () => Element | readonly Element[] | null

export type HtmlAnnotationTargetDescriptor = {
  readonly kind: 'html'
  readonly resolve: AnnotationElementResolver
}

export type SvgAnnotationTargetDescriptor = {
  readonly kind: 'svg'
  readonly resolve: AnnotationElementResolver
  readonly getSvg?: () => SVGSVGElement | null
  readonly getRootG?: () => SVGGElement | null
}

export type HtmlAnnotationTarget = HTMLElement | HtmlAnnotationTargetDescriptor
export type SvgAnnotationTarget = SVGElement | SvgAnnotationTargetDescriptor
export type AnnotationTarget = HtmlAnnotationTarget | SvgAnnotationTarget

export type CalloutState = {
  readonly position: Readonly<Point>
  readonly collapsed: boolean
}

export type PetAnnotationManagerOptions = {
  readonly getHtmlContainer?: () => HTMLElement | null
}

type Point = {
  x: number
  y: number
}

type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

type AnnotationBase = {
  readonly id: number
  readonly target: AnnotationTarget
  readonly surface: 'html' | 'svg'
}

type CalloutBase = AnnotationBase & {
  readonly text: string
  position?: Point
  collapsed: boolean
  dragging: boolean
  suppressClick: boolean
}

type SpeechBubble = CalloutBase & {
  readonly kind: 'speech'
}

type Highlight = AnnotationBase & {
  readonly kind: 'highlight'
  readonly color: string
  readonly opacity: number
  readonly padding: number
}

type Question = CalloutBase & {
  readonly kind: 'question'
  readonly options: readonly PetQuestionOption[]
  readonly onAnswer?: (answer: PetQuestionAnswer) => void
  selectedOptionIndex?: number
}

type Annotation = SpeechBubble | Highlight | Question
type Callout = SpeechBubble | Question

type SvgContext = {
  readonly svg: SVGSVGElement
  readonly rootG: SVGGElement
  readonly elements: Element[]
}

type WrappedTextMetrics = {
  readonly lineCount: number
  readonly width: number
}

let nextManagerId = 0

export class PetAnnotationManager {
  private readonly annotations: Annotation[] = []
  private readonly managerId = nextManagerId++
  private readonly knownSvgRoots = new Set<SVGGElement>()
  private nextAnnotationId = 0
  private htmlRoot: HTMLDivElement | null = null
  private destroyed = false

  public constructor (private readonly options: PetAnnotationManagerOptions = {}) {
    window.addEventListener('resize', this.handleViewportChange)
    window.addEventListener('scroll', this.handleViewportChange, true)
  }

  public addSpeechBubble (target: AnnotationTarget, text: string): number {
    return isSvgTarget(target)
      ? this.addSvgSpeechBubble(target, text)
      : this.addHtmlSpeechBubble(target, text)
  }

  public addSvgSpeechBubble (target: SvgAnnotationTarget, text: string): number {
    return this.addCallout('svg', 'speech', target, text)
  }

  public addHtmlSpeechBubble (target: HtmlAnnotationTarget, text: string): number {
    return this.addCallout('html', 'speech', target, text)
  }

  public addHighlight (
    target: AnnotationTarget,
    color = '#ffc552',
    opacity = 0.35,
    padding = 3
  ): number {
    return isSvgTarget(target)
      ? this.addSvgHighlight(target, color, opacity, padding)
      : this.addHtmlHighlight(target, color, opacity, padding)
  }

  public addSvgHighlight (
    target: SvgAnnotationTarget,
    color = '#ffc552',
    opacity = 0.35,
    padding = 3
  ): number {
    return this.addHighlightForSurface('svg', target, color, opacity, padding)
  }

  public addHtmlHighlight (
    target: HtmlAnnotationTarget,
    color = '#ffc552',
    opacity = 0.35,
    padding = 3
  ): number {
    return this.addHighlightForSurface('html', target, color, opacity, padding)
  }

  public addQuestion (
    target: AnnotationTarget,
    text: string,
    options: readonly PetQuestionOption[],
    onAnswer?: (answer: PetQuestionAnswer) => void
  ): number {
    return isSvgTarget(target)
      ? this.addSvgQuestion(target, text, options, onAnswer)
      : this.addHtmlQuestion(target, text, options, onAnswer)
  }

  public addSvgQuestion (
    target: SvgAnnotationTarget,
    text: string,
    options: readonly PetQuestionOption[],
    onAnswer?: (answer: PetQuestionAnswer) => void
  ): number {
    return this.addQuestionForSurface('svg', target, text, options, onAnswer)
  }

  public addHtmlQuestion (
    target: HtmlAnnotationTarget,
    text: string,
    options: readonly PetQuestionOption[],
    onAnswer?: (answer: PetQuestionAnswer) => void
  ): number {
    return this.addQuestionForSurface('html', target, text, options, onAnswer)
  }

  public removeAnnotationById (id: number): void {
    const index = this.annotations.findIndex(annotation => annotation.id === id)
    if (index < 0) return

    this.annotations.splice(index, 1)
    this.redraw()
  }

  public clearAnnotations (): void {
    this.annotations.splice(0)
    this.redraw()
  }

  public setCollapsed (id: number, collapsed: boolean): void {
    const annotation = this.calloutById(id)
    if (!annotation || annotation.collapsed === collapsed) return

    annotation.collapsed = collapsed
    this.redraw()
  }

  public getCalloutState (id: number): CalloutState | undefined {
    const annotation = this.calloutById(id)
    if (!annotation?.position) return undefined

    return {
      position: { ...annotation.position },
      collapsed: annotation.collapsed
    }
  }

  public getQuestionAnswer (id: number): PetQuestionAnswer | undefined {
    const annotation = this.annotations.find((candidate): candidate is Question =>
      candidate.id === id && candidate.kind === 'question'
    )
    if (!annotation || annotation.selectedOptionIndex === undefined) return undefined

    return {
      questionId: annotation.id,
      option: annotation.options[annotation.selectedOptionIndex]
    }
  }

  public redraw (): void {
    if (this.destroyed) return

    this.clearRenderedAnnotations()

    for (const annotation of this.annotations) {
      if (annotation.kind === 'highlight') {
        this.drawHighlight(annotation)
      }
    }

    for (const annotation of this.annotations) {
      if (annotation.kind !== 'highlight') {
        this.drawCallout(annotation)
      }
    }
  }

  public destroy (): void {
    if (this.destroyed) return

    window.removeEventListener('resize', this.handleViewportChange)
    window.removeEventListener('scroll', this.handleViewportChange, true)
    this.clearRenderedAnnotations()
    this.htmlRoot?.remove()
    this.htmlRoot = null
    this.destroyed = true
  }

  private readonly handleViewportChange = (): void => {
    this.redraw()
  }

  private addCallout (
    surface: 'html' | 'svg',
    kind: 'speech',
    target: HtmlAnnotationTarget | SvgAnnotationTarget,
    text: string
  ): number {
    const id = this.nextAnnotationId++
    this.annotations.push({
      id,
      kind,
      target,
      surface,
      text,
      collapsed: false,
      dragging: false,
      suppressClick: false
    })
    this.redraw()
    return id
  }

  private addHighlightForSurface (
    surface: 'html' | 'svg',
    target: HtmlAnnotationTarget | SvgAnnotationTarget,
    color: string,
    opacity: number,
    padding: number
  ): number {
    const id = this.nextAnnotationId++
    this.annotations.push({
      id,
      kind: 'highlight',
      target,
      surface,
      color,
      opacity,
      padding
    })
    this.redraw()
    return id
  }

  private addQuestionForSurface (
    surface: 'html' | 'svg',
    target: HtmlAnnotationTarget | SvgAnnotationTarget,
    text: string,
    options: readonly PetQuestionOption[],
    onAnswer?: (answer: PetQuestionAnswer) => void
  ): number {
    const id = this.nextAnnotationId++
    this.annotations.push({
      id,
      kind: 'question',
      target,
      surface,
      text,
      options,
      onAnswer,
      collapsed: false,
      dragging: false,
      suppressClick: false
    })
    this.redraw()
    return id
  }

  private calloutById (id: number): Callout | undefined {
    return this.annotations.find((annotation): annotation is Callout =>
      annotation.id === id && annotation.kind !== 'highlight'
    )
  }

  private clearRenderedAnnotations (): void {
    for (const root of this.knownSvgRoots) {
      d3.select(root)
        .selectAll(`g.pet-annotation[data-pet-manager-id="${this.managerId}"]`)
        .remove()
    }
    this.knownSvgRoots.clear()

    if (this.htmlRoot) {
      this.htmlRoot.replaceChildren()
    }
  }

  private drawHighlight (annotation: Highlight): void {
    if (annotation.surface === 'svg') {
      this.drawSvgHighlight(annotation)
    } else {
      this.drawHtmlHighlight(annotation)
    }
  }

  private drawCallout (annotation: Callout): void {
    if (annotation.surface === 'svg') {
      this.drawSvgCallout(annotation)
    } else {
      this.drawHtmlCallout(annotation)
    }
  }

  private drawSvgHighlight (annotation: Highlight): void {
    const context = svgContext(annotation.target as SvgAnnotationTarget)
    if (!context) return

    const box = viewportBoxToSvgBox(unionViewportBox(context.elements), context.svg, context.rootG)
    if (!box) return

    this.knownSvgRoots.add(context.rootG)
    d3.select(context.rootG)
      .append('g')
      .attr('class', 'pet-annotation pet-highlight')
      .attr('data-pet-manager-id', this.managerId)
      .attr('data-pet-id', annotation.id)
      .append('rect')
      .attr('x', box.x - annotation.padding)
      .attr('y', box.y - annotation.padding)
      .attr('width', box.width + annotation.padding * 2)
      .attr('height', box.height + annotation.padding * 2)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', annotation.color)
      .attr('opacity', annotation.opacity)
  }

  private drawSvgCallout (annotation: Callout): void {
    const context = svgContext(annotation.target as SvgAnnotationTarget)
    if (!context) return

    const targetBox = viewportBoxToSvgBox(unionViewportBox(context.elements), context.svg, context.rootG)
    const visibleBounds = viewportBoxToSvgBox(boxForRect(context.svg.getBoundingClientRect()), context.svg, context.rootG)
    if (!targetBox || !visibleBounds) return

    this.knownSvgRoots.add(context.rootG)
    const className = annotation.kind === 'speech' ? 'pet-speech-bubble' : 'pet-question'
    const group = d3.select(context.rootG)
      .append('g')
      .attr('class', `pet-annotation ${className}${annotation.dragging ? ' dragging' : ''}${annotation.collapsed ? ' collapsed' : ''}`)
      .attr('data-pet-manager-id', this.managerId)
      .attr('data-pet-id', annotation.id)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-expanded', String(!annotation.collapsed))

    const paddingX = 10
    const paddingY = 8
    const lineHeight = 16
    const buttonHeight = 24
    const buttonGap = 6
    const buttonPaddingX = 16

    let textMetrics: WrappedTextMetrics = { lineCount: 0, width: 0 }
    let widestOption = 0
    let text: d3.Selection<SVGTextElement, unknown, null, undefined> | undefined

    if (!annotation.collapsed) {
      text = group.append('text')
        .attr('class', `${className}-text`)
        .attr('x', 0)
        .attr('y', 0)
      textMetrics = wrapText(text, annotation.text, CALLOUT_MAX_CONTENT_WIDTH, lineHeight)
      widestOption = annotation.kind === 'question' && annotation.options.length > 0
        ? Math.max(...annotation.options.map(option => measureText(group, 'pet-question-option-text', option.label) + buttonPaddingX))
        : 0
    }

    const contentWidth = annotation.collapsed
      ? COLLAPSED_CALLOUT_SIZE
      : Math.min(CALLOUT_MAX_CONTENT_WIDTH, Math.max(CALLOUT_MIN_WIDTH, textMetrics.width, widestOption))
    const buttonBlockHeight = !annotation.collapsed && annotation.kind === 'question' && annotation.options.length > 0
      ? buttonGap + annotation.options.length * buttonHeight + (annotation.options.length - 1) * 4
      : 0
    const rectWidth = annotation.collapsed ? COLLAPSED_CALLOUT_SIZE : contentWidth + paddingX * 2
    const rectHeight = annotation.collapsed
      ? COLLAPSED_CALLOUT_SIZE
      : textMetrics.lineCount * lineHeight + paddingY * 2 + buttonBlockHeight
    const position = calloutPosition(annotation, targetBox, rectWidth, rectHeight, visibleBounds)
    const calloutBox = { ...position, width: rectWidth, height: rectHeight }

    const pointer = group.append('path')
      .attr('class', `${className}-pointer`)
      .attr('d', pointerPath(targetBox, calloutBox, annotation.collapsed))

    const box = group.append('rect')
      .attr('class', `${className}-box`)
      .attr('x', position.x)
      .attr('y', position.y)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('rx', 6)
      .attr('ry', 6)

    box.lower()
    pointer.lower()

    if (annotation.collapsed) {
      group.append('text')
        .attr('class', `${className}-collapsed-text`)
        .attr('x', position.x + rectWidth / 2)
        .attr('y', position.y + rectHeight / 2 + 4)
        .attr('text-anchor', 'middle')
        .text('…')
    } else {
      text?.attr('transform', `translate(${position.x + paddingX}, ${position.y + paddingY + 11})`)
      if (annotation.kind === 'question' && annotation.options.length > 0) {
        this.drawSvgQuestionButtons(
          group,
          annotation,
          position.x + paddingX,
          position.y + paddingY + textMetrics.lineCount * lineHeight + buttonGap,
          contentWidth
        )
      }
    }

    group.on('pointerdown', (event: PointerEvent) => {
      this.beginDrag(annotation, event, (from, to) => svgDelta(from, to, context.rootG))
    })
    group.on('click', (event: MouseEvent) => {
      event.stopPropagation()
      this.toggleCallout(annotation)
    })
    group.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        annotation.collapsed = !annotation.collapsed
        this.redraw()
      }
    })
  }

  private drawSvgQuestionButtons (
    group: d3.Selection<SVGGElement, unknown, null, undefined>,
    annotation: Question,
    x: number,
    y: number,
    width: number
  ): void {
    const buttonHeight = 24

    annotation.options.forEach((option, index) => {
      const selected = annotation.selectedOptionIndex === index
      const button = group.append('g')
        .attr('class', `pet-question-option${selected ? ' selected' : ''}`)
        .attr('transform', `translate(${x}, ${y + index * (buttonHeight + 4)})`)
        .attr('role', 'button')
        .attr('tabindex', 0)
        .attr('aria-pressed', String(selected))
        .on('pointerdown', (event: PointerEvent) => {
          event.stopPropagation()
        })
        .on('click', (event: MouseEvent) => {
          event.stopPropagation()
          this.selectQuestionOption(annotation, index)
        })
        .on('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            this.selectQuestionOption(annotation, index)
          }
        })

      button.append('rect')
        .attr('width', width)
        .attr('height', buttonHeight)
        .attr('rx', 4)
        .attr('ry', 4)

      button.append('text')
        .attr('class', 'pet-question-option-text')
        .attr('x', 8)
        .attr('y', 16)
        .text(option.label)
    })
  }

  private drawHtmlHighlight (annotation: Highlight): void {
    const box = unionViewportBox(resolveTargetElements(annotation.target))
    const root = this.ensureHtmlRoot()
    if (!box || !root) return

    const highlight = document.createElement('div')
    highlight.className = 'pet-annotation pet-html-highlight'
    highlight.dataset.petManagerId = String(this.managerId)
    highlight.dataset.petId = String(annotation.id)
    highlight.style.left = `${box.x - annotation.padding}px`
    highlight.style.top = `${box.y - annotation.padding}px`
    highlight.style.width = `${box.width + annotation.padding * 2}px`
    highlight.style.height = `${box.height + annotation.padding * 2}px`
    highlight.style.backgroundColor = annotation.color
    highlight.style.opacity = String(annotation.opacity)
    root.append(highlight)
  }

  private drawHtmlCallout (annotation: Callout): void {
    const targetBox = unionViewportBox(resolveTargetElements(annotation.target))
    const root = this.ensureHtmlRoot()
    if (!targetBox || !root) return

    const className = annotation.kind === 'speech' ? 'pet-speech-bubble' : 'pet-question'
    const callout = document.createElement('div')
    callout.className = `pet-annotation pet-html-callout ${className}${annotation.dragging ? ' dragging' : ''}${annotation.collapsed ? ' collapsed' : ''}`
    callout.dataset.petManagerId = String(this.managerId)
    callout.dataset.petId = String(annotation.id)
    callout.tabIndex = 0
    callout.setAttribute('role', 'button')
    callout.setAttribute('aria-expanded', String(!annotation.collapsed))
    callout.title = annotation.collapsed ? annotation.text : ''

    if (annotation.collapsed) {
      const collapsedText = document.createElement('span')
      collapsedText.className = `${className}-collapsed-text`
      collapsedText.textContent = '…'
      callout.append(collapsedText)
    } else {
      const text = document.createElement('div')
      text.className = `${className}-text`
      text.textContent = annotation.text
      callout.append(text)

      if (annotation.kind === 'question') {
        const options = document.createElement('div')
        options.className = 'pet-question-options'
        annotation.options.forEach((option, index) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = `pet-question-option${annotation.selectedOptionIndex === index ? ' selected' : ''}`
          button.textContent = option.label
          button.setAttribute('aria-pressed', String(annotation.selectedOptionIndex === index))
          button.addEventListener('pointerdown', event => event.stopPropagation())
          button.addEventListener('click', event => {
            event.stopPropagation()
            this.selectQuestionOption(annotation, index)
          })
          options.append(button)
        })
        callout.append(options)
      }
    }

    root.append(callout)
    const rectWidth = callout.offsetWidth
    const rectHeight = callout.offsetHeight
    const position = calloutPosition(
      annotation,
      targetBox,
      rectWidth,
      rectHeight,
      { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
    )
    const calloutBox = { ...position, width: rectWidth, height: rectHeight }
    callout.style.left = `${position.x}px`
    callout.style.top = `${position.y}px`

    const pointer = document.createElementNS(SVG_NAMESPACE, 'svg')
    pointer.setAttribute('class', `pet-html-pointer ${className}-pointer${annotation.collapsed ? ' collapsed' : ''}`)
    pointer.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(SVG_NAMESPACE, 'path')
    path.setAttribute('d', pointerPath(targetBox, calloutBox, annotation.collapsed))
    pointer.append(path)
    root.insertBefore(pointer, callout)

    callout.addEventListener('pointerdown', event => {
      this.beginDrag(annotation, event, (from, to) => ({ x: to.x - from.x, y: to.y - from.y }))
    })
    callout.addEventListener('click', event => {
      event.stopPropagation()
      this.toggleCallout(annotation)
    })
    callout.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        annotation.collapsed = !annotation.collapsed
        this.redraw()
      }
    })
  }

  private selectQuestionOption (annotation: Question, index: number): void {
    annotation.selectedOptionIndex = index
    const answer = {
      questionId: annotation.id,
      option: annotation.options[index]
    }
    annotation.onAnswer?.(answer)
    this.redraw()
  }

  private toggleCallout (annotation: Callout): void {
    if (annotation.suppressClick) return

    annotation.collapsed = !annotation.collapsed
    this.redraw()
  }

  private beginDrag (
    annotation: Callout,
    event: PointerEvent,
    delta: (from: Point, to: Point) => Point | null
  ): void {
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    let previous = { x: event.clientX, y: event.clientY }
    let moved = false
    annotation.dragging = true

    const move = (moveEvent: PointerEvent): void => {
      const next = { x: moveEvent.clientX, y: moveEvent.clientY }
      const movement = delta(previous, next)
      previous = next
      if (!movement) return

      if (Math.abs(movement.x) > 0.5 || Math.abs(movement.y) > 0.5) {
        moved = true
      }
      const position = annotation.position ?? { x: 0, y: 0 }
      annotation.position = {
        x: position.x + movement.x,
        y: position.y + movement.y
      }
      this.redraw()
    }

    const end = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      annotation.dragging = false
      if (moved) {
        annotation.suppressClick = true
        window.setTimeout(() => {
          annotation.suppressClick = false
        }, 0)
        this.redraw()
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  private ensureHtmlRoot (): HTMLDivElement | null {
    const container = this.options.getHtmlContainer?.() ?? document.body
    if (!container) return null

    if (!this.htmlRoot || this.htmlRoot.parentElement !== container) {
      this.htmlRoot?.remove()
      this.htmlRoot = document.createElement('div')
      this.htmlRoot.className = 'pet-html-annotation-layer'
      this.htmlRoot.dataset.petManagerId = String(this.managerId)
      container.append(this.htmlRoot)
    }
    return this.htmlRoot
  }
}

function isTargetDescriptor (target: AnnotationTarget): target is HtmlAnnotationTargetDescriptor | SvgAnnotationTargetDescriptor {
  return 'resolve' in target && typeof target.resolve === 'function'
}

function isSvgTarget (target: AnnotationTarget): target is SvgAnnotationTarget {
  return isTargetDescriptor(target)
    ? target.kind === 'svg'
    : target.namespaceURI === SVG_NAMESPACE
}

function resolveTargetElements (target: AnnotationTarget): Element[] {
  const resolved = isTargetDescriptor(target) ? target.resolve() : target
  if (!resolved) return []
  return Array.isArray(resolved) ? [...resolved] : [resolved as Element]
}

function svgContext (target: SvgAnnotationTarget): SvgContext | null {
  const elements = resolveTargetElements(target)
    .filter(element => element.namespaceURI === SVG_NAMESPACE)
  const firstElement = elements[0] as SVGElement | undefined
  if (!firstElement) return null

  const descriptor = isTargetDescriptor(target) && target.kind === 'svg' ? target : undefined
  const svg = descriptor?.getSvg?.() ?? (
    firstElement instanceof SVGSVGElement
      ? firstElement
      : firstElement.ownerSVGElement
  )
  const rootG = descriptor?.getRootG?.() ?? (svg ? topLevelGroup(firstElement, svg) : null)
  return svg && rootG ? { svg, rootG, elements } : null
}

function topLevelGroup (element: SVGElement, svg: SVGSVGElement): SVGGElement | null {
  let current: Element | null = element
  while (current?.parentNode instanceof SVGElement && current.parentNode !== svg) {
    current = current.parentNode
  }
  if (current instanceof SVGGElement) return current
  return svg.querySelector('g')
}

function unionViewportBox (elements: readonly Element[]): Box | null {
  const boxes = elements
    .filter(element => element.isConnected)
    .map(element => boxForRect(element.getBoundingClientRect()))
    .filter(box => box.width !== 0 || box.height !== 0)
  if (boxes.length === 0) return null

  const left = Math.min(...boxes.map(box => box.x))
  const top = Math.min(...boxes.map(box => box.y))
  const right = Math.max(...boxes.map(box => box.x + box.width))
  const bottom = Math.max(...boxes.map(box => box.y + box.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function boxForRect (rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>): Box {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width || rect.right - rect.left,
    height: rect.height || rect.bottom - rect.top
  }
}

function viewportBoxToSvgBox (
  box: Box | null,
  svg: SVGSVGElement,
  rootG: SVGGElement
): Box | null {
  const screenCtm = rootG.getScreenCTM()
  if (!box || !screenCtm) return null

  const topLeft = svg.createSVGPoint()
  topLeft.x = box.x
  topLeft.y = box.y
  const bottomRight = svg.createSVGPoint()
  bottomRight.x = box.x + box.width
  bottomRight.y = box.y + box.height
  const localTopLeft = topLeft.matrixTransform(screenCtm.inverse())
  const localBottomRight = bottomRight.matrixTransform(screenCtm.inverse())
  return {
    x: Math.min(localTopLeft.x, localBottomRight.x),
    y: Math.min(localTopLeft.y, localBottomRight.y),
    width: Math.abs(localBottomRight.x - localTopLeft.x),
    height: Math.abs(localBottomRight.y - localTopLeft.y)
  }
}

function svgDelta (from: Point, to: Point, rootG: SVGGElement): Point | null {
  const ctm = rootG.getScreenCTM()
  if (!ctm) return null

  const inverse = ctm.inverse()
  const localFrom = new DOMPoint(from.x, from.y).matrixTransform(inverse)
  const localTo = new DOMPoint(to.x, to.y).matrixTransform(inverse)
  return {
    x: localTo.x - localFrom.x,
    y: localTo.y - localFrom.y
  }
}

function calloutPosition (
  annotation: Callout,
  targetBox: Box,
  width: number,
  height: number,
  bounds: Box
): Point {
  const targetCenter = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2
  }

  if (!annotation.position) {
    let x = targetBox.x + targetBox.width + DEFAULT_CALLOUT_GAP
    let y = targetBox.y - height - DEFAULT_CALLOUT_GAP
    if (x + width > bounds.x + bounds.width - CALLOUT_MARGIN) {
      x = targetBox.x - width - DEFAULT_CALLOUT_GAP
    }
    if (y < bounds.y + CALLOUT_MARGIN) {
      y = targetBox.y + targetBox.height + DEFAULT_CALLOUT_GAP
    }
    annotation.position = {
      x: x - targetCenter.x,
      y: y - targetCenter.y
    }
  }

  const minX = bounds.x + CALLOUT_MARGIN
  const minY = bounds.y + CALLOUT_MARGIN
  const maxX = Math.max(minX, bounds.x + bounds.width - width - CALLOUT_MARGIN)
  const maxY = Math.max(minY, bounds.y + bounds.height - height - CALLOUT_MARGIN)
  const x = Math.min(Math.max(targetCenter.x + annotation.position.x, minX), maxX)
  const y = Math.min(Math.max(targetCenter.y + annotation.position.y, minY), maxY)
  annotation.position = {
    x: x - targetCenter.x,
    y: y - targetCenter.y
  }
  return { x, y }
}

function pointerPath (targetBox: Box, calloutBox: Box, collapsed: boolean): string {
  const targetCenter = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2
  }
  const calloutCenter = {
    x: calloutBox.x + calloutBox.width / 2,
    y: calloutBox.y + calloutBox.height / 2
  }
  const calloutIsRight = calloutCenter.x >= targetCenter.x
  const calloutIsBelow = calloutCenter.y >= targetCenter.y
  const anchor = {
    x: calloutIsRight
      ? targetBox.x + targetBox.width + TARGET_POINTER_MARGIN
      : targetBox.x - TARGET_POINTER_MARGIN,
    y: calloutIsBelow
      ? targetBox.y + targetBox.height + TARGET_POINTER_MARGIN
      : targetBox.y - TARGET_POINTER_MARGIN
  }
  const margin = Math.min(CALLOUT_MARGIN, calloutBox.width / 3, calloutBox.height / 3)
  const calloutCorner = {
    x: calloutIsRight ? calloutBox.x : calloutBox.x + calloutBox.width,
    y: calloutIsBelow ? calloutBox.y : calloutBox.y + calloutBox.height
  }

  if (collapsed) {
    return `M${anchor.x},${anchor.y} L${calloutCorner.x},${calloutCorner.y}`
  }

  let first: Point
  let second: Point
  if (calloutIsRight && calloutIsBelow) {
    first = { x: calloutBox.x + margin, y: calloutBox.y }
    second = { x: calloutBox.x, y: calloutBox.y + margin }
  } else if (calloutIsRight) {
    first = { x: calloutBox.x, y: calloutBox.y + calloutBox.height - margin }
    second = { x: calloutBox.x + margin, y: calloutBox.y + calloutBox.height }
  } else if (calloutIsBelow) {
    first = { x: calloutBox.x + calloutBox.width - margin, y: calloutBox.y }
    second = { x: calloutBox.x + calloutBox.width, y: calloutBox.y + margin }
  } else {
    first = { x: calloutBox.x + calloutBox.width, y: calloutBox.y + calloutBox.height - margin }
    second = { x: calloutBox.x + calloutBox.width - margin, y: calloutBox.y + calloutBox.height }
  }

  return `M${anchor.x},${anchor.y} L${first.x},${first.y} L${second.x},${second.y} Z`
}

function wrapText (
  text: d3.Selection<SVGTextElement, unknown, null, undefined>,
  value: string,
  maxWidth: number,
  lineHeight: number
): WrappedTextMetrics {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  const probe = text.append('tspan').attr('x', 0)

  for (const word of words) {
    const nextLine = line.length === 0 ? word : `${line} ${word}`
    probe.text(nextLine)
    if (measureTextNode(probe.node(), nextLine) > maxWidth && line.length > 0) {
      lines.push(line)
      line = word
    } else {
      line = nextLine
    }
  }
  if (line.length > 0) lines.push(line)
  if (lines.length === 0) lines.push('')
  probe.remove()

  const tspans = text.selectAll<SVGTSpanElement, string>('tspan')
    .data(lines)
    .join('tspan')
    .attr('x', 0)
    .attr('dy', (_line, index) => index === 0 ? 0 : lineHeight)
    .text(textLine => textLine)
  const width = Math.max(...tspans.nodes().map(node => measureTextNode(node, node.textContent ?? '')))
  return { lineCount: lines.length, width }
}

function measureText (
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  className: string,
  value: string
): number {
  const text = group.append('text')
    .attr('class', className)
    .attr('opacity', 0)
    .text(value)
  const width = measureTextNode(text.node(), value)
  text.remove()
  return width
}

function measureTextNode (node: SVGTextContentElement | null, fallbackText: string): number {
  try {
    return node?.getComputedTextLength() ?? fallbackText.length * CALLOUT_TEXT_FALLBACK_CHAR_WIDTH
  } catch {
    return fallbackText.length * CALLOUT_TEXT_FALLBACK_CHAR_WIDTH
  }
}
