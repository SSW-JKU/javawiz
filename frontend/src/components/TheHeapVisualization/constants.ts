export const DEFAULT_TRANSITION_TIME = 1250

export const MIN_WIDTH = 30

export const CLUSTER_TITLE_FONT_SIZE = 12
export const CONTENT_FONT_SIZE = 9

export const MAX_ARRAY_ELEMENTS = 5

export const MAX_FIELDS_THRESHOLD = 7
export const MAX_SHOWN_FIELDS = 4 // actually shown object fields if above threshold was reached

export const MAIN_HEADER_BG_COLOR = '#A3C2DB'
export const MAIN_HEADER_BG_COLOR_HOVER = '#b0d1ae'
export const METHOD_HEADER_BG_COLOR_HOVER = '#ffd9bb'

export const OBJECT_BG_HOVER = '#ffe9d8'
export const REFERENCED_OBJECT_BG_HOVER = '#e3eee2'
export const WHITE = '#ffffff'

export const SUB_HEADER_BG_COLOR = '#e3ecf4'
// const ROW_BG_COLOR = '#FAFAFA'
export const TYPE_FONT_COLOR = '#0000ff'

export const TABLE_FORMAT = 'border="0" cellborder="1" cellspacing="0"'

// note KK: the font face set in the graph attributes does not apply to the "HTML-like" labels..
// viz.js says: "When used in Viz.js, Graphviz only knows about font metrics for Courier, Times, Helvetica, and Arial", this is most probably also true for d3-graphviz
export const FONT_FACE_TABLES = 'Courier'
export const FONT_FACE_CLUSTER_TITLE = 'Arial'
export const FONT_FACE_VALUES = 'Arial'

// const NULL_VAL = '&#9679;'
export const NULL_VAL = `<font face="${FONT_FACE_VALUES}"><i>null&nbsp;&nbsp;</i></font>`

export const MAX_ZOOM_IN_FACTOR = 5
export const MAX_ZOOM_OUT_FACTOR = 0.4
// const DEFAULT_ZOOM_FACTOR = 0.7
export const BTN_ZOOM_FACTOR = 1.3

export const TRANSFORMATION_DURATION = 1200

export const CHANGED_VAR_COLOR = '#ff0000'
export const UNCHANGED_VAR_COLOR = '#000000'
export const CHANGED_VAR_TAG = 'b'
export const UNCHANGED_VAR_TAG = 'font'
