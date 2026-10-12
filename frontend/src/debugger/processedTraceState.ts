import { HeapItem, LoadedClass, ProcessedHeapItem } from '@/dto/TraceState'

export function linkHeapItemsToLoadedClasses (
  heapItems: HeapItem[],
  loadedClasses: LoadedClass[]
): ProcessedHeapItem[] {
  const loadedClassesByName = new Map(loadedClasses.map(loadedClass => [loadedClass.class, loadedClass]))
  return heapItems.map(heapItem => ({
    ...heapItem,
    loadedClass: loadedClassesByName.get(heapItem.type)
  }))
}
