// =========================
// LIFELINE INTERFACE
// =========================

import { ReferenceVal } from '@/dto/TraceState'

/**
 * 'collapsed' if the user has clicked on an element to collapse it
 * 'expanded' if the element is visible normally
 * 'hidden' if the element is hidden (e.g. because one of its parents is collapsed)
 */
type VisibilityState = 'collapsed' | 'expanded' | 'hidden'

/**
 * interface for a static or object lifeline
 * start: starting time index when the lifeline is first created
 * end: ending time index when the lifeline does not exist anymore
 * label: name of the lifeline
 * heapId: if the lifeline is created for an object, then it has a heap id for identification
 * index: lifeline index for unique identification
 * className: name of the class of the lifeline
 * programEnd: flag is set to true when the program ended
 * currState: a lifeline can be expanded, collapsed or hidden
 * prevState: a lifeline was previously expanded, collapsed or hidden
 * isDrawn: a lifeline is either visible or not
 * wasDrawn: a lifeline was either visible or not
 * changed: lifeline has been changed or not
 */
export type LifeLine = {
  readonly start: number
  end?: number
  readonly label: string
  readonly heapId?: number | undefined
  readonly index: number
  readonly className: string
  programEnd: boolean
  currState: VisibilityState
  prevState: VisibilityState
  isDrawn: boolean
  wasDrawn: boolean
  changed: boolean
}

// =========================
// ARROW INTERFACE
// =========================

/**
 * interface for a constructor, call or return method arrow
 * from: lifeline where method is called
 * to: lifeline object whose method is called
 * fromBoxIndex: index of the fromBox
 * toBoxIndex: index of the toBox
 * label: method signature or return string belonging to the arrow
 * time: time index when the method is called
 * kind: kind of the arrow which can be Call, Return, CallMain or Constructor
 * this: the this-object created by constructor arrow
 * reference: the heap id of this-object
 * methodCallId: unique id that identifies a method call
 * fromDepth: counter that contains the number of nesting levels of the fromBox
 * toDepth: counter that contains the number of nesting levels of the toBox
 * direction: direction of the arrow that can be Left, Right or Neither
 * isHidden: arrow is visible or not
 * wasHidden: arrow was previously visible or not
 * changed: arrow has been changed or not
 * line: code line in which the arrow was created
 */
export type Arrow = {
  from?: LifeLine
  to?: LifeLine
  readonly fromBoxIndex?: number
  readonly toBoxIndex?: number
  label: string
  time?: number
  readonly kind: 'Call' | 'Return' | 'CallMain' | 'Constructor'
  readonly this?: ReferenceVal
  readonly reference?: number
  readonly methodCallId: number
  fromDepth: number
  toDepth: number
  readonly direction: 'Left' | 'Right' | 'Neither'
  isHidden: boolean
  wasHidden?: boolean
  changed: boolean
  line: number
}

// =========================
// BOX INTERFACE
// =========================

/**
 * interface for a method call box
 * lifeLine: lifeline containing the box
 * index: box index for unique identification
 * start: starting time index when the box is first created
 * end: ending time index when the box is closed
 * methodCallId: unique id that identifies a method call
 * callArrow: method call arrow that belongs to the box
 * returnArrow: return arrow that belongs to the box
 * depth: counter that contains the number of nesting levels
 * isDrawn: when box is collapsed it can be visible or not visible
 * currState: a box can be expanded, collapsed or hidden
 * prevState: a box was expanded, collapsed or hidden
 * wasDrawn: a box was drawn previously
 * stepOver: the box was stepped over or not (stepped into)
 * changed: box has been changed or not
 */
export type Box = {
  readonly lifeLine: LifeLine
  readonly index: number
  start: number
  end?: number | undefined
  readonly methodCallId: number
  readonly callArrow?: Arrow
  returnArrow?: Arrow
  readonly depth: number
  isDrawn: boolean
  wasDrawn: boolean
  currState: VisibilityState
  prevState: VisibilityState
  stepOver: boolean
  changed: boolean
}

export type Elements = {
  boxes: Box[],
  arrows: Arrow[],
  lifeLines: LifeLine[]
}
