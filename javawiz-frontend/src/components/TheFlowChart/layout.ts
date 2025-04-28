import { hasActiveLine } from './meta-utils'
import { PositionContext } from './position'
import { BoundingBoxContext } from './size'
import { InlinedFnMap, FullHierarchyNode, NodeMeta, SizedHierarchyNode, CallSite } from './types'
import { FullWidthManager } from './FullWidthManager'
import { ELEMENT } from './Element'
import { AstElement } from '@/dto/AbstractSyntaxTree'

/**
 * Transforms a d3.js hierarchy to a renderable layout/hierarchy
 * @param root d3.js hierarchy root node
 * @param rootBox box in canvas coordinates
 * @param collapsed set of collapsed elements
 * @param inlinedMethods map of inline methods
 * @param activeLine active line of code
 * @param stackFrameLocations current call stack method names
 * @param fullWidthManager Full width manager
 * @returns full renderable layout
 */
export function createLayout (
  root: d3.HierarchyNode<AstElement>,
  rootBox: { posX: number},
  collapsed: Set<string>,
  inlinedMethods: InlinedFnMap,
  activeLine: number,
  stackFrameLocations: CallSite[],
  fullWidthManager: FullWidthManager
): FullHierarchyNode<AstElement> {
  const boundingBoxContext = new BoundingBoxContext(collapsed, inlinedMethods, fullWidthManager)
  const positionContext = new PositionContext(boundingBoxContext)

  const layoutedTree = root.copy()
  layoutedTree.each(d => {
    // calculate sizes
    const box = d.data === null ? ELEMENT.empty : boundingBoxContext.getBoundingBox(d.data)
    Object.assign(d, { box })

    // calculate positions
    Object.assign(d, { pos: positionContext.calculatePosition(d as SizedHierarchyNode<AstElement>, rootBox) })

    // assign meta data
    Object.assign(d, {
      meta: {
        collapsed: collapsed.has(d.data?.uuid),
        active: hasActiveLine(activeLine, d, stackFrameLocations)
      } as NodeMeta
    })
  })

  return layoutedTree as FullHierarchyNode<AstElement>
}
