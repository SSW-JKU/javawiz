import type { HeapTreeNode } from './heapBFS'
import type { HeapObject, Var } from '../../dto/TraceState'

/**
 * Returns heap objects whose exact runtime type is selected, ordered by object ID.
 * @param heapNodes nodes to filter
 * @param selectedTypes exact runtime types to include
 */
export function getNodesOfTypes (heapNodes: HeapTreeNode[], selectedTypes: ReadonlySet<string>) {
  return heapNodes.filter(heapNode => heapNode.element?.kind === 'HeapObject' && selectedTypes.has(heapNode.element.type)).sort((a, b) =>
    (a.element as HeapObject).id - (b.element as HeapObject).id)
}

/**
 * Returns root variables that point to selected runtime node types, plus selected null variables.
 * @param heapTree heapNodes to filter
 * @param selectedTypes exact node types to include
 */
export function getVariablePointers (heapTree: HeapTreeNode, selectedTypes: ReadonlySet<string>) {
  return heapTree
    .children
    .filter(child => {
      if (child.element?.kind !== 'Var') {
        return false
      }
      const variable = child.element as Var
      if (variable.value.kind === 'NullVal') {
        return selectedTypes.has(variable.type)
      }
      return variable.value.kind === 'ReferenceVal' &&
        child.children[0]?.element?.kind === 'HeapObject' &&
        selectedTypes.has(child.children[0].element.type)
    })
}

export interface MissingFieldsByClass {
  className: string
  fieldNames: string[]
}

/** Finds required fields missing from any participating heap-object class. */
export function findMissingFieldsByClass (
  heapNodes: readonly HeapTreeNode[],
  requiredFieldNames: readonly string[]
): MissingFieldsByClass[] {
  const missingByClass = new Map<string, Set<string>>()

  heapNodes.forEach(heapNode => {
    if (heapNode.element?.kind !== 'HeapObject') {
      return
    }
    const availableFields = new Set(heapNode.element.fields.map(field => field.name))
    const missingFields = requiredFieldNames.filter(fieldName => !availableFields.has(fieldName))
    if (missingFields.length === 0) {
      return
    }
    const classMissingFields = missingByClass.get(heapNode.element.type) ?? new Set<string>()
    missingFields.forEach(fieldName => classMissingFields.add(fieldName))
    missingByClass.set(heapNode.element.type, classMissingFields)
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
