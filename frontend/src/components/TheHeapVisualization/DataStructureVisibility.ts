import type { LoadedClass } from '@/dto/TraceState'

export interface DataStructureVisibilitySettings {
  showDataStructureDetails: boolean
  showDataStructureStatics: boolean
  showDataStructureFields: boolean
}

export const DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS: DataStructureVisibilitySettings = {
  showDataStructureDetails: false,
  showDataStructureStatics: false,
  showDataStructureFields: true
}

type LoadedClassClassification = Pick<LoadedClass, 'isHeapTraversalStop' | 'isJavaDataStructure'>

export function shouldShowClassStatics (
  loadedClass: LoadedClassClassification,
  settings: DataStructureVisibilitySettings
): boolean {
  if (loadedClass.isJavaDataStructure) {
    return settings.showDataStructureDetails && settings.showDataStructureStatics
  }
  return !loadedClass.isHeapTraversalStop
}

export function shouldShowObjectFields (
  loadedClass: LoadedClassClassification | undefined,
  settings: DataStructureVisibilitySettings
): boolean {
  if (!loadedClass) {
    return false
  }
  if (loadedClass.isJavaDataStructure) {
    return settings.showDataStructureDetails && settings.showDataStructureFields
  }
  return !loadedClass.isHeapTraversalStop
}

export function shouldShowDataStructureFields (settings: DataStructureVisibilitySettings): boolean {
  return settings.showDataStructureDetails && settings.showDataStructureFields
}
