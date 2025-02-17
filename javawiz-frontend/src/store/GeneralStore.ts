import { defineStore } from 'pinia'
import { Debugger } from '@/debugger/Debugger'
import { Notifications } from '@/components/TheNotifications/Notifications'
import { FileManager } from '@/file-manager/FileManager'
import { TraceData } from '@/debugger/TraceData'
import { ConsoleLine } from '@Shared/Protocol'
import { AbstractSyntaxTree } from '@/dto/AbstractSyntaxTree'

export const useGeneralStore = defineStore('general', {
  state: () => {
    return {
      inputValue: '',
      notifications: new Notifications(),
      debugger: new Debugger(),
      asts: [] as AbstractSyntaxTree[],
      openEditorLocalUri: undefined as string | undefined,
      vscExtensionMode: false,
      fileManager: new FileManager()
    }
  },
  getters: {
    currentFileUri: function (): string {
      return this.debugger.latestTraceState?.sourceFileUri ?? ''
    },
    currentLine: function (): number {
      return this.debugger.latestTraceState?.line ?? -1
    },
    currentTraceData: function (): TraceData | undefined {
      return this.debugger.currentTraceData
    },
    consoleLines: function (): ConsoleLine[] {
      return this.currentTraceData?.consoleLines ?? []
    }
  },
  actions: {
    sendInput () {
      this.debugger.sendInput(this.inputValue)
    }
  }
})
