import { REGEX } from './constants'
import { ProcessedIndex, SettingsIndex } from './types'

// checks if the string of a settings index has the correct format
export function checkIndexString (index: String) {
  const match = index.match(REGEX.index)
  if (!match) {
    return undefined
  }
  if ((!match[2] || match[2] === REGEX.arrayWildcard) && !match[3]) {
    return undefined
  }
  return match
}

// tries to extract arrayName and variableNames from the displayed string and returns a processedIndex
export function processIndex (index: SettingsIndex): ProcessedIndex {
  const match = checkIndexString(index.displayString)
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
    return { ...index, arrayName, variableNames, isValid: true }
  }
  return { ...index, isValid: false }
}

// returns a displayable string for an settings index
export function getDisplayString (arrayName: string, variableName: string, index: number) {
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
