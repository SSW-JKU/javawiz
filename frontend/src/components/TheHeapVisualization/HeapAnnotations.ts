import * as d3 from 'd3'
import { getBoundingBoxCorners, heapLookupIdentifier, type HeapLookupTarget, type Point } from './HeapLookup'

export type HeapQuestionOption = {
  readonly label: string
  readonly value?: string
}

export type HeapQuestionAnswer = {
  readonly questionId: number
  readonly option: HeapQuestionOption
}

type HeapAnnotationBase = {
  readonly id: number
  readonly target: HeapLookupTarget
}

type HeapSpeechBubble = HeapAnnotationBase & {
  readonly kind: 'speech'
  readonly text: string
  offsetX: number
  offsetY: number
}

type HeapHighlight = HeapAnnotationBase & {
  readonly kind: 'highlight'
  readonly color: string
  readonly opacity: number
  readonly padding: number
}

type HeapQuestion = HeapAnnotationBase & {
  readonly kind: 'question'
  readonly text: string
  readonly options: HeapQuestionOption[]
  readonly onAnswer?: (answer: HeapQuestionAnswer) => void
  offsetX: number
  offsetY: number
}

type HeapAnnotation = HeapSpeechBubble | HeapHighlight | HeapQuestion

type HeapAnnotationManagerOptions = {
  readonly getSvg: () => SVGSVGElement | null
  readonly getRootG: () => SVGGElement | null
  readonly getLookupRoot: () => Element | Document | null
}

type LocalBox = {
  readonly topLeft: Point
  readonly bottomRight: Point
}

type WrappedTextMetrics = {
  readonly lineCount: number
  readonly width: number
}

const DEFAULT_BUBBLE_OFFSET = {
  x: 16,
  y: -34
}

const CALLOUT_MIN_WIDTH = 96
const CALLOUT_MAX_CONTENT_WIDTH = 240
const CALLOUT_TEXT_FALLBACK_CHAR_WIDTH = 7

export class HeapAnnotationManager {
  private readonly annotations: HeapAnnotation[] = []
  private nextId = 0

  public constructor (private readonly options: HeapAnnotationManagerOptions) {}

  public addSpeechBubble (target: HeapLookupTarget, text: string): number {
    const id = this.nextId++
    this.annotations.push({
      id,
      kind: 'speech',
      target,
      text,
      offsetX: DEFAULT_BUBBLE_OFFSET.x,
      offsetY: DEFAULT_BUBBLE_OFFSET.y
    })
    this.redraw()
    return id
  }

  public addHighlight (target: HeapLookupTarget, color = '#ffc552', opacity = 0.35, padding = 3): number {
    const id = this.nextId++
    this.annotations.push({
      id,
      kind: 'highlight',
      target,
      color,
      opacity,
      padding
    })
    this.redraw()
    return id
  }

  public addQuestion (
    target: HeapLookupTarget,
    text: string,
    options: HeapQuestionOption[],
    onAnswer?: (answer: HeapQuestionAnswer) => void
  ): number {
    const id = this.nextId++
    this.annotations.push({
      id,
      kind: 'question',
      target,
      text,
      options,
      onAnswer,
      offsetX: DEFAULT_BUBBLE_OFFSET.x,
      offsetY: DEFAULT_BUBBLE_OFFSET.y
    })
    this.redraw()
    return id
  }

  public removeAnnotationById (id: number): void {
    const index = this.annotations.findIndex(annotation => annotation.id === id)
    if (index >= 0) {
      this.annotations.splice(index, 1)
      this.redraw()
    }
  }

  public removeAnnotations (target: HeapLookupTarget): number {
    const identifier = heapLookupIdentifier(target)
    const initialLength = this.annotations.length

    for (let index = this.annotations.length - 1; index >= 0; index--) {
      if (heapLookupIdentifier(this.annotations[index].target) === identifier) {
        this.annotations.splice(index, 1)
      }
    }

    const removedCount = initialLength - this.annotations.length
    if (removedCount > 0) {
      this.redraw()
    }
    return removedCount
  }

  public clearAnnotations (): void {
    this.annotations.splice(0)
    this.redraw()
  }

  public redraw (): void {
    const rootG = this.options.getRootG()
    if (!rootG) return

    const layer = d3.select(rootG)
    layer.selectAll('g.heap-annotation').remove()

    for (const annotation of this.annotations) {
      if (annotation.kind === 'highlight') {
        this.drawHighlight(layer, annotation)
      }
    }

    for (const annotation of this.annotations) {
      if (annotation.kind === 'speech') {
        this.drawBubble(layer, annotation)
      } else if (annotation.kind === 'question') {
        this.drawQuestion(layer, annotation)
      }
    }
  }

  private drawHighlight (layer: d3.Selection<SVGGElement, unknown, null, undefined>, annotation: HeapHighlight): void {
    const box = this.targetLocalBox(annotation.target)
    if (!box) return

    const x = Math.min(box.topLeft.x, box.bottomRight.x) - annotation.padding
    const y = Math.min(box.topLeft.y, box.bottomRight.y) - annotation.padding
    const width = Math.abs(box.bottomRight.x - box.topLeft.x) + annotation.padding * 2
    const height = Math.abs(box.bottomRight.y - box.topLeft.y) + annotation.padding * 2

    layer.append('g')
      .attr('class', 'heap-annotation heap-highlight')
      .attr('data-id', annotation.id)
      .append('rect')
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', annotation.color)
      .attr('opacity', annotation.opacity)
  }

  private drawBubble (
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    annotation: HeapSpeechBubble
  ): void {
    this.drawCallout(layer, annotation, 'heap-speech-bubble', annotation.text)
  }

  private drawQuestion (
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    annotation: HeapQuestion
  ): void {
    this.drawCallout(layer, annotation, 'heap-question', annotation.text, annotation.options, (option) => {
      annotation.onAnswer?.({ questionId: annotation.id, option })
    })
  }

  private drawCallout (
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    annotation: HeapSpeechBubble | HeapQuestion,
    className: string,
    textValue: string,
    options?: HeapQuestionOption[],
    onAnswer?: (option: HeapQuestionOption) => void
  ): void {
    const anchor = this.targetAnchor(annotation.target)
    if (!anchor) return

    const group = layer.append('g')
      .attr('class', `heap-annotation ${className}`)
      .attr('data-id', annotation.id)

    const paddingX = 10
    const paddingY = 8
    const lineHeight = 16
    const buttonHeight = 24
    const buttonGap = 6
    const buttonPaddingX = 16

    const text = group.append('text')
      .attr('class', `${className}-text`)
      .attr('x', 0)
      .attr('y', 0)

    const textMetrics = wrapText(text, textValue, CALLOUT_MAX_CONTENT_WIDTH, lineHeight)
    const widestOption = options && options.length > 0
      ? Math.max(...options.map(option => measureText(group, 'heap-question-option-text', option.label) + buttonPaddingX))
      : 0
    const contentWidth = Math.min(
      CALLOUT_MAX_CONTENT_WIDTH,
      Math.max(CALLOUT_MIN_WIDTH, textMetrics.width, widestOption)
    )
    const rectWidth = contentWidth + paddingX * 2
    const buttonBlockHeight = options && options.length > 0
      ? buttonGap + options.length * buttonHeight + (options.length - 1) * 4
      : 0
    const rectHeight = textMetrics.lineCount * lineHeight + paddingY * 2 + buttonBlockHeight
    const rectX = anchor.x + annotation.offsetX
    const rectY = anchor.y + annotation.offsetY

    group.insert('path', 'text')
      .attr('class', `${className}-pointer`)
      .attr('d', pointerPath(anchor, rectX, rectY, rectHeight))

    group.insert('rect', 'text')
      .attr('class', `${className}-box`)
      .attr('x', rectX)
      .attr('y', rectY)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('rx', 6)
      .attr('ry', 6)

    text.attr('transform', `translate(${rectX + paddingX}, ${rectY + paddingY + 11})`)

    if (options && options.length > 0) {
      this.drawQuestionButtons(group, options, rectX + paddingX, rectY + paddingY + textMetrics.lineCount * lineHeight + buttonGap, contentWidth, onAnswer)
    }

    group.call(
      d3.drag<SVGGElement, unknown>()
        .on('drag', (event) => {
          const scale = this.graphScale()
          annotation.offsetX += event.dx / scale
          annotation.offsetY += event.dy / scale
          this.redraw()
        })
    )
  }

  private drawQuestionButtons (
    group: d3.Selection<SVGGElement, unknown, null, undefined>,
    options: HeapQuestionOption[],
    x: number,
    y: number,
    width: number,
    onAnswer?: (option: HeapQuestionOption) => void
  ): void {
    const buttonHeight = 24

    options.forEach((option, index) => {
      const buttonGroup = group.append('g')
        .attr('class', 'heap-question-option')
        .attr('transform', `translate(${x}, ${y + index * (buttonHeight + 4)})`)
        .on('click', (event) => {
          event.stopPropagation()
          onAnswer?.(option)
        })

      buttonGroup.append('rect')
        .attr('width', width)
        .attr('height', buttonHeight)
        .attr('rx', 4)
        .attr('ry', 4)

      buttonGroup.append('text')
        .attr('x', 8)
        .attr('y', 16)
        .text(option.label)
    })
  }

  private targetAnchor (target: HeapLookupTarget): Point | null {
    const box = this.targetViewportBox(target)
    return box ? this.pointInGraphCoordinates(box.topRight) : null
  }

  private targetLocalBox (target: HeapLookupTarget): LocalBox | null {
    const box = this.targetViewportBox(target)
    if (!box) return null

    const topLeft = this.pointInGraphCoordinates(box.topLeft)
    const bottomRight = this.pointInGraphCoordinates(box.bottomRight)
    return topLeft && bottomRight ? { topLeft, bottomRight } : null
  }

  private targetViewportBox (target: HeapLookupTarget) {
    const lookupRoot = this.options.getLookupRoot()
    return lookupRoot ? getBoundingBoxCorners(target, lookupRoot) : null
  }

  private pointInGraphCoordinates (point: Point): Point | null {
    const svg = this.options.getSvg()
    const rootG = this.options.getRootG()
    const screenCtm = rootG?.getScreenCTM()
    if (!svg || !screenCtm) return null

    const svgPoint = svg.createSVGPoint()
    svgPoint.x = point.x
    svgPoint.y = point.y

    const localPoint = svgPoint.matrixTransform(screenCtm.inverse())
    return { x: localPoint.x, y: localPoint.y }
  }

  private graphScale (): number {
    const svg = this.options.getSvg()
    return svg ? d3.zoomTransform(svg).k || 1 : 1
  }
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
    .text(line => line)

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

function pointerPath (anchor: Point, rectX: number, rectY: number, rectHeight: number): string {
  const attachX = rectX
  const attachY = Math.min(Math.max(anchor.y, rectY + 12), rectY + rectHeight - 12)
  const halfBase = 7
  return `M${anchor.x},${anchor.y} L${attachX},${attachY - halfBase} L${attachX},${attachY + halfBase} Z`
}
