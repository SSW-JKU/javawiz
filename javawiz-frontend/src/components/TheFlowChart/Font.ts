import { ELEMENT } from '@/components/TheFlowChart/Element'

export const FONT_FAMILY = `"Droid Sans Mono", "monospace", monospace, "Droid Sans Fallback"`

export function textSize (text: string, fontSize: string = `${ELEMENT.Statement.fontSize}px`): {width: number, height: number} {
  const span = document.createElement('span')
  span.style.fontSize = fontSize
  span.style.fontFamily = FONT_FAMILY
  span.textContent = text
  document.body.appendChild(span)
  const rect = span.getBoundingClientRect()
  const width = rect.width
  const height = rect.height
  document.body.removeChild(span)
  return { width, height }
}
export function textWidth (text: string, fontSize: string = `${ELEMENT.Statement.fontSize}px`): number {
  return textSize(text, fontSize).width
}

export function textHeight (text: string, fontSize: string = `${ELEMENT.Statement.fontSize}px`): number {
  return textSize(text, fontSize).height
}

export function fitText (text: string, width: number, postfix?: string): string {
  let result = text
  while (textWidth(result + (postfix || '')) > width) {
    result = result.substring(0, result.length - 1)
  }
  return result
}
