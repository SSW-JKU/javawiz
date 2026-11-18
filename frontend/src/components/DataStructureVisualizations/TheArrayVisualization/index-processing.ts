import { REGEX } from './constants'
import { ParsedIndexLabelSetting, IndexLabelSetting } from './types'

// checks if the string of a settings index has the correct format
export function checkIndexString (index: string) {
  const match = index.match(REGEX.index)
  if (!match) {
    return undefined
  }
  if ((!match[2] || match[2] === REGEX.arrayWildcard) && !match[3]) {
    return undefined
  }
  return match
}

// parses the expression of an index label setting into the array name and the index variable names
export function parseIndexLabelSetting (indexLabelSetting: IndexLabelSetting): ParsedIndexLabelSetting {
  const match = checkIndexString(indexLabelSetting.expression)
  if (match) {
    const arrayName = match[1] ?? REGEX.arrayWildcard
    const variableNames: string[] = []
    if (match[2]) {
      variableNames.push(match[2])
    }
    if (match[3]) {
      if (variableNames.length === 0) {
        variableNames.push(REGEX.arrayWildcard)
      }
      variableNames.push(match[3])
    }
    return { ...indexLabelSetting, arrayName, variableNames, isValid: true }
  }
  return { ...indexLabelSetting, isValid: false }
}

// builds the index label expression shown for an array access, e.g. `arr[i]`
export function formatIndexLabelExpression (arrayName: string, variableName: string, index: number) {
  if (index === 0) {
    return `${arrayName}[${variableName}]`
  } else {
    return `${arrayName}[*][${variableName}]`
  }
}

// checks if the settings index covers the test index
export function checkIndexCoverage (
  settingsIndex: { arrayName: string, variableNames: string[] },
  testIndex: { arrayName: string, variableNames: string[] }
) {
  if (!(settingsIndex.arrayName === testIndex.arrayName || settingsIndex.arrayName === REGEX.arrayWildcard || testIndex.arrayName === REGEX.arrayWildcard)) {
    // return false if array names are not equal, when none of them is REGEX.arrayWildcard
    return false
  }
  if ((settingsIndex.variableNames[0] === REGEX.arrayWildcard || testIndex.variableNames[0] === REGEX.arrayWildcard) &&
    settingsIndex.variableNames.length !== testIndex.variableNames.length) {
    // return false in cases of testing coverage with arr[*][j] and arr[i]
    return false
  }
  for (let i = 0; i < settingsIndex.variableNames.length && i < testIndex.variableNames.length; i++) {
    if (!(settingsIndex.variableNames[i] === testIndex.variableNames[i] || settingsIndex.variableNames[i] === '*' || testIndex.variableNames[i] === '*')) {
      return false
    }
  }
  return true
}

/**
 * Reads the index label settings that `TheArrayVisualization` saved in localStorage (`null` if nothing is saved).
 * Older versions saved the expression as `displayString`; such entries are converted to `expression`, so users
 * keep their saved labels.
 */
export function parseSavedIndexLabelSettings (json: string | null): IndexLabelSetting[] {
  if (!json) {
    return []
  }
  const saved = JSON.parse(json) as (IndexLabelSetting & { displayString?: string })[]
  return saved.map(({ displayString, ...setting }) => ({ ...setting, expression: setting.expression ?? displayString ?? '' }))
}
