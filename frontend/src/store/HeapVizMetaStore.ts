import { defineStore } from 'pinia'
import { HeapVizMeta } from '@/components/TheHeapVisualization/types'

export const useHeapVizMetaStore = defineStore('heapVizMeta', {
  state: () => {
    return {
      metaMap: {} as { [key: string]: HeapVizMeta }
    }
  },
  actions: {
    isExpandedIdentifier (identifier: string): boolean {
      if (!this.isIdentifierInMap(identifier)) {
        // first time that we access the given key
        this.metaMap[identifier] = this._getDefaultMeta()
      }
      return this.metaMap[identifier].isExpanded!
    },
    isFullyVisibleIdentifier (identifier: string): boolean {
      if (!this.isIdentifierInMap(identifier)) {
        // first time that we access the given key
        this.metaMap[identifier] = this._getDefaultMeta()
      }
      return this.metaMap[identifier].isFullyVisible!
    },
    isIdentifierInMap (identifier: string): boolean {
      return identifier in this.metaMap
    },

    setExpandedIdentifier (idAndE: { identifier: string, e: boolean}) {
      if (!this.isIdentifierInMap(idAndE.identifier)) {
        // first time that we access the given key
        this.metaMap[idAndE.identifier] = this._getDefaultMeta()
      }
      this.metaMap[idAndE.identifier].isExpanded = idAndE.e
    },
    setIsFullyVisibleIdentifier (idAndE: { identifier: string, e: boolean}) {
      if (!this.isIdentifierInMap(idAndE.identifier)) {
        // first time that we access the given key
        this.metaMap[idAndE.identifier] = this._getDefaultMeta()
      }
      this.metaMap[idAndE.identifier].isFullyVisible = idAndE.e
    },
    reset () {
      this.metaMap = {} as { [key: string]: HeapVizMeta }
    },

    _getDefaultMeta () {
      return {
        isExpanded: true,
        isFullyVisible: false
      }
    }
  }
})
