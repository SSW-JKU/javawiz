import type { DataStructureGraphNode } from './dataStructureGraph'
import type { HeapObject, Var } from '../../dto/TraceState'

/**
 * Returns heap objects whose exact runtime type is selected, ordered by object ID.
 * @param heapContentDataStructureGraphNodes data-structure graph nodes to filter
 * @param selectedTypes exact runtime types to include
 */
export function getNodesOfTypes (heapContentDataStructureGraphNodes: DataStructureGraphNode[], selectedTypes: ReadonlySet<string>) {
  return heapContentDataStructureGraphNodes.filter(heapNode => heapNode.traceElement?.kind === 'HeapObject' && selectedTypes.has(heapNode.traceElement.type)).sort((a, b) =>
    (a.traceElement as HeapObject).id - (b.traceElement as HeapObject).id)
}

/**
 * Returns root variables that point to selected runtime node types, plus selected null variables.
 * @param rootDataStructureGraphNode root of the data-structure graph, whose children are the root variables
 * @param selectedTypes exact node types to include
 */
export function getVariablePointers (rootDataStructureGraphNode: DataStructureGraphNode, selectedTypes: ReadonlySet<string>) {
  return rootDataStructureGraphNode
    .childDataStructureGraphNodes
    .filter(child => {
      if (child.traceElement?.kind !== 'Var') {
        return false
      }
      const variable = child.traceElement as Var
      if (variable.value.kind === 'NullVal') {
        return selectedTypes.has(variable.type)
      }
      return variable.value.kind === 'ReferenceVal' &&
        child.childDataStructureGraphNodes[0]?.traceElement?.kind === 'HeapObject' &&
        selectedTypes.has(child.childDataStructureGraphNodes[0].traceElement.type)
    })
}

export interface MissingFieldsByClass {
  className: string
  fieldNames: string[]
}

/** Finds required fields missing from the classes of the given list or tree node objects. */
export function findMissingFieldsByClass (
  nodeObjectDataStructureGraphNodes: readonly DataStructureGraphNode[],
  requiredFieldNames: readonly string[]
): MissingFieldsByClass[] {
  const missingByClass = new Map<string, Set<string>>()

  nodeObjectDataStructureGraphNodes.forEach(heapNode => {
    if (heapNode.traceElement?.kind !== 'HeapObject') {
      return
    }
    const availableFields = new Set(heapNode.traceElement.fields.map(field => field.name))
    const missingFields = requiredFieldNames.filter(fieldName => !availableFields.has(fieldName))
    if (missingFields.length === 0) {
      return
    }
    const classMissingFields = missingByClass.get(heapNode.traceElement.type) ?? new Set<string>()
    missingFields.forEach(fieldName => classMissingFields.add(fieldName))
    missingByClass.set(heapNode.traceElement.type, classMissingFields)
  })

  return [...missingByClass].map(([className, fieldNames]) => ({
    className,
    fieldNames: [...fieldNames]
  }))
}

/** Formats missing-field diagnostics for display in a visualization pane. */
export function formatMissingFields (missingFields: readonly MissingFieldsByClass[]): string {
  if (missingFields.length === 0) {
    return ''
  }
  const details = missingFields
    .map(({ className, fieldNames }) => `${className}: ${fieldNames.join(', ')}`)
    .join('; ')
  return `Cannot visualize classes with missing fields (${details}). Check the configured field names.`
}
