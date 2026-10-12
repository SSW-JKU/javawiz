import { toPng } from 'html-to-image'

export type VisualizationExportFormat = 'html' | 'png' | 'svg'

const EXPORT_IGNORE_ATTRIBUTE = 'data-export-ignore'

function download (content: Blob | string, fileName: string): string {
  const link = document.createElement('a')
  link.download = fileName
  link.href = typeof content === 'string' ? content : URL.createObjectURL(content)
  link.click()

  if (content instanceof Blob) {
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
  }

  return fileName
}

function shouldExportNode (node: Node): boolean {
  return !(node instanceof Element && node.hasAttribute(EXPORT_IGNORE_ATTRIBUTE))
}

function copyRenderedStyles (source: Element, clone: Element) {
  if (source instanceof HTMLElement || source instanceof SVGElement) {
    const computedStyle = window.getComputedStyle(source)
    const inlineStyle = Array.from(computedStyle)
      .map(property => `${property}:${computedStyle.getPropertyValue(property)};`)
      .join('')
    clone.setAttribute('style', inlineStyle)
  }

  if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
    clone.setAttribute('value', source.value)
    if (source.checked) {
      clone.setAttribute('checked', '')
    } else {
      clone.removeAttribute('checked')
    }
  } else if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
    clone.textContent = source.value
  } else if (source instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
    Array.from(clone.options).forEach((option, index) => {
      option.selected = source.options[index]?.selected ?? false
    })
  }

  const sourceChildren = Array.from(source.children).filter(shouldExportNode)
  const cloneChildren = Array.from(clone.children)
  sourceChildren.forEach((child, index) => {
    const clonedChild = cloneChildren[index]
    if (clonedChild) {
      copyRenderedStyles(child, clonedChild)
    }
  })
}

function cloneRenderedElement<T extends Element> (source: T): T {
  const clone = source.cloneNode(true) as T
  clone.querySelectorAll(`[${EXPORT_IGNORE_ATTRIBUTE}]`).forEach(node => node.remove())
  copyRenderedStyles(source, clone)
  return clone
}

function exportHtml (target: HTMLElement, fileName: string): string {
  const clone = cloneRenderedElement(target)
  const bounds = target.getBoundingClientRect()
  clone.setAttribute(
    'style',
    `${clone.getAttribute('style') ?? ''};width:${bounds.width}px;height:${bounds.height}px;`
  )

  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${fileName}</title>`,
    '</head>',
    '<body style="margin:0">',
    clone.outerHTML,
    '</body>',
    '</html>'
  ].join('')

  return download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${fileName}.html`)
}

function exportSvg (target: HTMLElement, fileName: string): string {
  const svg = target.querySelector('svg')
  if (!svg) {
    throw new Error('The visualization does not contain an SVG element.')
  }

  const clone = cloneRenderedElement(svg)
  const bounds = svg.getBoundingClientRect()
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', `${bounds.width}`)
  clone.setAttribute('height', `${bounds.height}`)

  const serialized = new XMLSerializer().serializeToString(clone)
  return download(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }), `${fileName}.svg`)
}

async function exportPng (target: HTMLElement, fileName: string): Promise<string> {
  const backgroundColor = window.getComputedStyle(target).backgroundColor
  const dataUrl = await toPng(target, {
    backgroundColor: backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : backgroundColor,
    cacheBust: true,
    filter: shouldExportNode,
    pixelRatio: 2
  })
  return download(dataUrl, `${fileName}.png`)
}

export async function exportVisualization (
  target: HTMLElement,
  format: VisualizationExportFormat,
  fileName: string
): Promise<string> {
  if (format === 'html') {
    return exportHtml(target, fileName)
  } else if (format === 'svg') {
    return exportSvg(target, fileName)
  } else {
    return exportPng(target, fileName)
  }
}
