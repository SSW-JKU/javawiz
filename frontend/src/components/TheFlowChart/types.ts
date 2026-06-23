import { Method } from '@/dto/AbstractSyntaxTree'
import { Position } from './position'
import { BoundingBox } from './size'
import * as d3 from 'd3'

// END Ast types

// Misc types
export type DockingPosition = 'top' | 'left' | 'right' | 'bottom'

export type CallSite = {
  readonly method: string
  readonly class: string
  readonly line: number
}

export type OverlayVar = {
  readonly name: string
  readonly displayValue: string
  readonly changed: boolean
}

export type InlinedFnMap = Map<string, Method> // key .. method call expression uuid
// END Misc types

// Types for D3
export interface NodeMeta {
  collapsed: boolean
  active: boolean
}

export type SizedHierarchyNode<T> = d3.HierarchyNode<T> & { box: BoundingBox }
export type PositionedSizedHierarchyNode<T> = SizedHierarchyNode<T> & { pos: Position }
export type FullHierarchyNode<T> = PositionedSizedHierarchyNode<T> & { meta: NodeMeta }

export function isSizedHierarchyNode<T> (node: any): node is SizedHierarchyNode<T> {
  return 'box' in node
}

export function isPositionedSizedHierarchyNode<T> (node: any): node is PositionedSizedHierarchyNode<T> {
  return 'pos' in node && isSizedHierarchyNode<T>(node)
}
