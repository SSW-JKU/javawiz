export type DataStructureClassRole = 'list' | 'tree' | 'node'

/**
 * Returns compiled class names that match a data-structure role, ordered by suitability.
 *
 * Classification uses the innermost simple name while preserving the original name for
 * heap matching. Node names take precedence over wrapper roles, and exact role names are
 * ranked before containing matches. Returning every candidate also lets multi-selectors,
 * such as the one planned in JW-94, reuse the same policy.
 */
export function findClassCandidates (
  compiledClasses: readonly string[],
  role: DataStructureClassRole
): string[] {
  const roleName = role.toLowerCase()
  const exactMatches: string[] = []
  const containingMatches: string[] = []

  for (const compiledClass of compiledClasses) {
    const simpleName = getInnermostSimpleName(compiledClass).toLowerCase()
    const containsNode = simpleName.includes('node')
    const eligible = role === 'node'
      ? containsNode
      : !containsNode && simpleName.includes(roleName)

    if (!eligible) {
      continue
    }

    if (simpleName === roleName) {
      exactMatches.push(compiledClass)
    } else {
      containingMatches.push(compiledClass)
    }
  }

  return [...exactMatches, ...containingMatches]
}

/**
 * Keeps a current class selection when it is still available, or chooses the best default.
 */
export function reconcileClassSelection (
  selectedClass: string,
  compiledClasses: readonly string[],
  role: DataStructureClassRole
): string {
  if (compiledClasses.includes(selectedClass)) {
    return selectedClass
  }

  return findClassCandidates(compiledClasses, role)[0] ?? ''
}

/**
 * Preserves every still-compiled selection, or selects all suitable role defaults.
 *
 * Call this only when the compiled class list changes. This keeps a deliberate empty
 * checkbox selection empty during the current compilation.
 */
export function reconcileClassSelections (
  selectedClasses: readonly string[],
  compiledClasses: readonly string[],
  role: DataStructureClassRole
): string[] {
  const selectedClassSet = new Set(selectedClasses)
  const survivingSelections = compiledClasses.filter(compiledClass => selectedClassSet.has(compiledClass))

  return survivingSelections.length > 0
    ? survivingSelections
    : findClassCandidates(compiledClasses, role)
}

/** Extracts the class name after the final package or nested-class separator. */
function getInnermostSimpleName (compiledClass: string): string {
  return compiledClass.split(/[.$]/).at(-1) ?? ''
}
