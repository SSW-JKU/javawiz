/**
 * The central frontend colors: four grays, four blues, and a few role colors used in several views.
 *
 * Every gray and blue in the frontend uses one of these entries. Pure white and black, the teaching-annotation
 * question colors, and colors of other hues, such as status greens and teal highlights, stay where they are used.
 *
 * TypeScript code imports the values directly, for example in Graphviz DOT strings or D3 `.attr()` calls,
 * where CSS variables do not work. Stylesheets use the CSS custom properties that `installColorVariables()`
 * creates from the same entries: `primaryBlue` becomes `var(--jw-primary-blue)`.
 */
export const colors = {
  /** Dark JavaWiz blue: toolbar, console header, splitters, window border, and dark buttons. */
  primaryBlue: '#163150',
  /**
   * Lighter dark blue: empty visualization pane (view chooser), pane navigation bar, hover of buttons, and the
   * memory view's main headers (Statics, Stack, Heap, and object headers).
   * Written in hex because the memory view puts it into Graphviz DOT, which does not understand CSS `rgb(...)`.
   */
  secondaryBlue: '#315277',
  /** Primary action buttons, focus borders, and highlighted labels and cells in visualizations. */
  actionBlue: '#007bff',
  /**
   * Pale blue of memory-view method and class headers, array indices and string values,
   * sequence-diagram boxes, and default stream marbles.
   */
  paleBlue: '#c8d8e8',

  /** Outline of teaching annotations and value overlays. */
  annotationStroke: '#ffc552',
  /** Background of teaching annotations and value overlays. */
  annotationFill: '#fff9e6',

  /** Accent for objects: arrows and outlines in the list, tree and sequence diagram views. */
  objectAccent: '#eda167',
  /** Background of a hovered object. */
  objectHover: '#ffe9d8',
  /** Accent for references: arrows in the sequence diagram view. */
  referenceAccent: '#a1c79d',
  /** Background of an object that a hovered reference points to. */
  referencedObjectHover: '#e3eee2',

  /** Shadow and border of popups such as tooltips and dropdowns. */
  popupShadow: 'rgba(0, 0, 0, 0.75)',
  /** Translucent black for soft shadows, for example below annotations, and for the flowchart's debug boxes. */
  softShadow: 'rgba(0, 0, 0, 0.2)',

  /** Light gray: backgrounds, hover backgrounds and fills. */
  lightGray: '#eeeeee',
  /** Light-medium gray: decorative dividers, table and box borders, disabled buttons, gentle hover fills. */
  lightMediumGray: '#cccccc',
  /** Medium gray: borders of inputs and controls, scrollbars, lines in diagrams, and dimmed hint text. */
  mediumGray: '#999999',
  /** Dark gray: text, including secondary content text, main StreamViz strokes and event markers. */
  darkGray: '#444444'
} as const

/**
 * Copies every entry of `colors` to a CSS custom property on `root`, so stylesheets can use the shared colors.
 * Each name is converted from camelCase to kebab-case with a `--jw-` prefix: `lightGray` becomes `--jw-light-gray`
 * and `primaryBlue` becomes `--jw-primary-blue`.
 *
 * Call it once before mounting the app, so the first rendered frame already has the colors.
 */
export function installColorVariables (root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(colors)) {
    const kebabName = name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
    root.style.setProperty(`--jw-${kebabName}`, value)
  }
}
