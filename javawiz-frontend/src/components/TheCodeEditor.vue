<template>
  <div>
    <div id="tabs">
      <div v-for="file in generalStore.fileManager.fileUris" :key="file">
        <div class="file-button-container">
          <button
            :id="`${file.replace('.', '')}-btn`"
            class="tablinks"
            :class="generalStore.fileManager.openFile === file ? 'active' : ''"
            @click="generalStore.fileManager.changeToFile(file, getViewState())">
            {{ file }}
          </button>
          <button class="close-btn" @click="deleteFile(file)">
            x
          </button>
        </div>
      </div>
      <button id="add-file-btn" @click="addFile()">
        +
      </button>
    </div>
    <div id="code-editor" />
  </div>
</template>

// tabs impl from https://www.w3schools.com/howto/howto_js_tabs.asp

<script lang="ts">
// Import Monaco editor (relies on MonacoWebpackPlugin in vue.config.js)
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import * as d3 from 'd3'
import { defineComponent } from 'vue'
import { mapStores } from 'pinia'
import { useHoverStore } from '@/store/HoverStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { getModel } from '@/file-manager/FileManager'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'

// moved this outside the components properties, so it's not reactive
let editor: monaco.editor.IStandaloneCodeEditor | undefined
let decorations: string[] = []
const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  language: 'java',
  glyphMargin: false,
  theme: 'vs',
  readOnly: false,
  renderWhitespace: 'all',
  scrollBeyondLastLine: false,
  minimap: { enabled: false }
}

export default defineComponent({
  name: 'TheCodeEditor',
  data () {
    return {}
  },
  computed: {
    hoveredLine: function (): number {
      return this.hoverStore.hoveredLine
    },
    hoveredLineUri: function (): string {
      return this.hoverStore.hoveredLineUri ?? ''
    },
    ...mapStores(useGeneralStore, useHoverStore)
  },
  watch: {
    'generalStore.currentLine': function () {
      const vm = this
      if (editor) {
        editor.revealLine(vm.generalStore.currentLine)
        vm.highlightHoveredLineAndCurrentLine()
      }
    },
    'generalStore.currentFileUri': function () {
      const vm = this
      if (editor) {
        vm.generalStore.fileManager.changeToFile(vm.generalStore.currentFileUri, vm.getViewState())
        editor.revealLine(vm.generalStore.currentLine)
        vm.highlightHoveredLineAndCurrentLine()
      }
    },
    'hoveredLine': function () {
      const vm = this
      vm.highlightHoveredLineAndCurrentLine()
    },
    'hoveredLineUri': function () {
      const vm = this
      vm.highlightHoveredLineAndCurrentLine()
    },
    'generalStore.fileManager.openFile': function () {
      const vm = this
      editor?.setModel(getModel(vm.generalStore.fileManager.openFileAsUriObject))
      const previousViewState = vm.generalStore.fileManager.previousViewState
      if (previousViewState) {
        editor?.restoreViewState(previousViewState)
      }
      vm.highlightHoveredLineAndCurrentLine()
    }
  },
  mounted () {
    const vm = this

    const editorDiv = document.getElementById('code-editor')!

    const initialUri = vm.generalStore.fileManager.openFileAsUriObject
    if (initialUri) {
      editorOptions.model = monaco.editor.getModel(initialUri)
    }

    editor = monaco.editor.create(
      editorDiv,
      editorOptions
    )

    d3.select('#code-editor')
      .on('mouseenter', function () {
        vm.hoverStore.hoversEditor = true
      })
      .on('mouseleave', function () {
        vm.hoverStore.hoversEditor = false
        vm.hoverStore.changeLine({ lineNr: -1, localUri: null })
      })
      .on('mouseover', function (event) {
        // d3.pointer() retrieves the mouse position relative to the boundaries of the given DOM element
        // <body> is used on purpose, see explanation for getTargetAtClientPoint(x,y) below
        const x = d3.pointer(event, d3.select('body').node() as d3.ContainerElement)[0]
        const y = d3.pointer(event, d3.select('body').node() as d3.ContainerElement)[1]

        // getTargetAtClientPoint(x,y) returns the currently hovered position in the editor based
        // on given x/y relative to the viewport (that's why <body> is used above for retrieving the mouse position)
        const target = editor?.getTargetAtClientPoint(x, y)

        // the retrieved lineNumber is then committed to the global store, DeskTest has a watcher on the lineNumber and can update the row highlight accordingly
        vm.hoverStore.changeLine({
          lineNr: target && target.position ? target.position.lineNumber : -1,
          localUri: null
        })
      })

    const splitpane = editorDiv.parentElement!.parentElement!
    const tabs = document.getElementById('tabs')!

    const ro = new ResizeObserver(entries => {
      const width = entries[entries.length - 1].contentRect.width
      const height = entries[entries.length - 1].contentRect.height - tabs.offsetHeight
      editor?.layout({ width, height })
    })

    ro.observe(splitpane)

    HoverSynchronizer.onHover(vm.onHover)
  },
  unmounted () {
    const vm = this
    HoverSynchronizer.removeOnHover(vm.onHover)
  },
  methods: {
    onHover: function (hoverInfos: HoverInfo[]) {
      const vm = this
      vm.hoverStore.hoveredLine = -1

      for (const hInfo of hoverInfos) {
        if (hInfo.kind === 'Line') {
          vm.hoverStore.hoveredLine = hInfo.lineNr
          vm.hoverStore.hoveredLineUri = hInfo.localUri
        }
      }
    },
    highlightHoveredLineAndCurrentLine: function () {
      const vm = this

      if (!editor) {
        return
      }

      if (vm.generalStore.currentLine < 0) {
        decorations = editor.deltaDecorations(decorations, [])
        return
      }

      const noDecoration = { range: new monaco.Range(1, 1, 1, 1), options: {} }

      let hoveredDecoration = noDecoration
      if (vm.hoveredLine >= 0 && vm.hoveredLineUri === vm.generalStore.fileManager.openFile) {
        hoveredDecoration = {
          range: new monaco.Range(vm.hoveredLine, 1, vm.hoveredLine, 1),
          options: {
            isWholeLine: true,
            className: 'editor-highlighted-hovered-line',
            zIndex: 1
          }
        }
      }

      let currentLineDecoration = noDecoration
      if (vm.generalStore.currentFileUri === vm.generalStore.fileManager.openFile) {
        currentLineDecoration = {
          range: new monaco.Range(vm.generalStore.currentLine, 1, vm.generalStore.currentLine, 1),
          options: {
            isWholeLine: true,
            className: 'editor-highlighted-line',
            zIndex: 0
          }
        }
      }

      decorations = editor.deltaDecorations(decorations, [hoveredDecoration, currentLineDecoration])
    },
    addFile: function () {
      const vm = this

      const fileName = window.prompt('Please enter the name of the file:', '.java')
      // should match a valid Java class name and should end with '.java'
      const validFileNamePattern = '^[a-zA-Z_$][a-zA-Z\\d_$/]*\\.java$'
      if (fileName) {
        if (fileName.match(validFileNamePattern)) {
          vm.generalStore.fileManager.addFile(fileName)
        } else {
          this.generalStore.notifications.show({ kind: 'InvalidFileName' })
        }
      }
    },
    deleteFile: function (file: string) {
      const vm = this
      vm.generalStore.fileManager.deleteFile(file)
    },
    getViewState: function () {
      if (editor) {
        return editor.saveViewState()
      }
      return null
    }
  }
})
</script>

<!-- Do not use scoped, otherwise it does not work with deltaDecorations -->
<style>
#code-editor {
  width: 100%;
  height: 100%;
}

.editor-highlighted-line {
  background: rgba(114, 167, 178, 0.3);
}

.editor-highlighted-hovered-line {
  background: rgba(246, 216, 167, 0.3);
}

.file-button-container {
  display: flex;
}

#tabs {
  overflow: hidden;
  border: 1px solid #ccc;
  background-color: #f1f1f1;
  display: flex;
  flex-wrap: wrap;
}

/* Style the buttons that are used to open the tab content */
#tabs button {
  background-color: inherit;
  float: left;
  outline: none;
  cursor: pointer;
  transition: 0.3s;
}

#add-file-btn {
  float: right;
  border: none;
  padding: 6px 10px;
}

.close-btn {
  padding: 6px 10px;
  border: none;
  border-right: rgb(128, 128, 128) thin solid;
}

.tablinks {
  padding: 6px 10px;
  border: none;
}

/* Change background color of buttons on hover */
#tabs button:hover {
  background-color: #ddd;
}

/* Create an active/current tablink class */
#tabs button.active {
  background-color: #ccc;
}

/* Style the tab content */
.tab {
  display: none;
  padding: 6px 0px;
}

</style>
