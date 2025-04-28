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

<script setup lang="ts">
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import * as d3 from 'd3'
import { computed, defineComponent, onMounted, onUnmounted, watch } from 'vue'
import { useHoverStore } from '@/store/HoverStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { getModel } from '@/file-manager/FileManager'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'

const generalStore = useGeneralStore()

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

// @ts-expect-error MonacoEnvironment is initialized here
// glue code to initialize web worker https://github.com/vitejs/vite/discussions/1791
window.MonacoEnvironment = {
  getWorker(_: any, __: any) {
    // no need for specific workers (e.g. json or typescript), because we use regular editorWorker with java as language
    return new editorWorker()
  }
}

defineComponent({
  name: 'TheCodeEditor'
})

const hoverStore = useHoverStore()
const hoveredLine = computed(() => hoverStore.hoveredLine)
const hoveredLineUri = computed(() => hoverStore.hoveredLineUri ?? '')

function onHover (hoverInfos: HoverInfo[]) {
  hoverStore.hoveredLine = -1

  for (const hInfo of hoverInfos) {
    if (hInfo.kind === 'Line') {
      hoverStore.hoveredLine = hInfo.lineNr
      hoverStore.hoveredLineUri = hInfo.localUri
    }
  }
}

function getViewState () {
  if (editor) {
    return editor.saveViewState()
  }
  return null
}

function deleteFile (file: string) {
  generalStore.fileManager.deleteFile(file)
}

function addFile () {
  const fileName = window.prompt('Please enter the name of the file:', '.java')
  // should match a valid Java class name and should end with '.java'
  const validFileNamePattern = '^[a-zA-Z_$][a-zA-Z\\d_$/]*\\.java$'
  if (fileName) {
    if (fileName.match(validFileNamePattern)) {
      generalStore.fileManager.addFile(fileName)
    } else {
      generalStore.notifications.show({ kind: 'InvalidFileName' })
    }
  }
}

function highlightHoveredLineAndCurrentLine () {
  if (!editor) {
    return
  }

  if (generalStore.currentLine < 0) {
    decorations = editor.deltaDecorations(decorations, [])
    return
  }

  const noDecoration = { range: new monaco.Range(1, 1, 1, 1), options: {} }

  let hoveredDecoration = noDecoration
  if (hoveredLine.value >= 0 && hoveredLineUri.value === generalStore.fileManager.openFile) {
    hoveredDecoration = {
      range: new monaco.Range(hoveredLine.value, 1, hoveredLine.value, 1),
      options: {
        isWholeLine: true,
        className: 'editor-highlighted-hovered-line',
        zIndex: 1
      }
    }
  }

  let currentLineDecoration = noDecoration
  if (generalStore.currentFileUri === generalStore.fileManager.openFile) {
    currentLineDecoration = {
      range: new monaco.Range(generalStore.currentLine, 1, generalStore.currentLine, 1),
      options: {
        isWholeLine: true,
        className: 'editor-highlighted-line',
        zIndex: 0
      }
    }
  }

  decorations = editor.deltaDecorations(decorations, [hoveredDecoration, currentLineDecoration])
}

onMounted(() => {
  const editorDiv = document.getElementById('code-editor')!

  const initialUri = generalStore.fileManager.openFileAsUriObject
  if (initialUri) {
    editorOptions.model = monaco.editor.getModel(initialUri)
  }

  editor = monaco.editor.create(
    editorDiv,
    editorOptions
  )

  d3.select('#code-editor')
    .on('mouseenter', function () {
      hoverStore.hoversEditor = true
    })
    .on('mouseleave', function () {
      hoverStore.hoversEditor = false
      hoverStore.changeLine({ lineNr: -1, localUri: null })
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
      hoverStore.changeLine({
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

  HoverSynchronizer.onHover(onHover)
})

watch(() => generalStore.currentLine, () => {
  if (editor) {
    editor.revealLine(generalStore.currentLine)
    highlightHoveredLineAndCurrentLine()
  }
})

watch(() => generalStore.currentFileUri, () => {
  if (editor) {
    generalStore.fileManager.changeToFile(generalStore.currentFileUri, getViewState())
    editor.revealLine(generalStore.currentLine)
    highlightHoveredLineAndCurrentLine()
  }
})
watch(hoveredLine, highlightHoveredLineAndCurrentLine)
watch(hoveredLineUri, highlightHoveredLineAndCurrentLine)

watch(() => generalStore.fileManager.openFile, () => {
  if(editor) {
    editor.setModel(getModel(generalStore.fileManager.openFileAsUriObject))
    const previousViewState = generalStore.fileManager.previousViewState
    if (previousViewState) {
      editor.restoreViewState(previousViewState)
    }
  }
  highlightHoveredLineAndCurrentLine()
})
onUnmounted(() => {
  HoverSynchronizer.removeOnHover(onHover)
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
