import { defineStore } from 'pinia'
import { ExtensionCommunication } from '@/helpers/ExtensionCommunication'

export const useHoverStore = defineStore('hover', {
  state: () => {
    return {
      hoveredLine: 0, // used by CodeEditor and DeskTest for highlighting a hovered line
      hoveredLineUri: '' as (string | null),
      hoversEditor: false // editor lines are only highlighted if this is false (= user hovers DeskTest) - otherwise faulty behaviour of the editor
    }
  },
  actions: {
    changeLine (lineProperties: {lineNr: number, localUri: string | null}) {
      this.hoveredLine = lineProperties.lineNr
      this.hoveredLineUri = lineProperties.localUri
      if (ExtensionCommunication.active()) {
        ExtensionCommunication.sendHoverLine(lineProperties.lineNr, lineProperties.localUri ?? '') // for highlighting a hovered line in the vscode extension editor
      }
    }
  }
})
