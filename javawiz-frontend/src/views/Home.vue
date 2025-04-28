<template>
  <div class="app">
    <TheFileHandler ref="fileHandler" />
    <TheNotifications />
    <TheHelpOverlay />
    <TheAboutOverlay />
    <TheToolbar
      @connect="connect"
      @start-compilation="startCompilation"
      @open-file="openFile"
      @download="download" />
    <!--    main part of the front end -->
    <div class="main-row">
      <splitpanes :push-other-panes="false">
        <!--        LEFT COLUMN (editor, console) -->
        <pane v-if="paneVisibilityStore.isEditorPaneShown" size="40">
          <splitpanes id="editor-pane" horizontal>
            <pane :size="70">
              <the-code-editor />
            </pane>
            <pane v-if="!generalStore.vscExtensionMode">
              <the-console />
            </pane>
          </splitpanes>
        </pane>
        <!--        RIGHT COLUMN (visualizations) -->
        <pane>
          <four-viz />
        </pane>
      </splitpanes>
    </div>
  </div>
</template>

<script setup lang='ts'>
import TheCodeEditor from '@/components/TheCodeEditor.vue'
import TheConsole from '@/components/TheConsole.vue'
import TheHelpOverlay from '@/components/Overlays/TheHelpOverlay.vue'
import TheAboutOverlay from '@/components/Overlays/TheAboutOverlay.vue'
import TheNotifications from '@/components/TheNotifications/TheNotifications.vue'
import TheFileHandler from '@/components/TheFileHandler.vue'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import * as d3 from 'd3'
import { ExtensionCommunication } from '@/helpers/ExtensionCommunication'
import { defineComponent, onMounted, ref } from 'vue'
import shared from '@Shared/Shared'
import {
  DEFAULT_FILE_NAME,
  DEFAULT_EDITOR_TEXT
} from '@/helpers/constants'
import TheToolbar from '@/components/TheToolbar/TheToolbar.vue'
import FourViz from '@/components/VizLayouts/FourViz.vue'
import { usePaneVisibilityStore } from '@/store/PaneVisibilityStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { useRoute } from 'vue-router'

defineComponent({
  name: 'Home',
  components: {
    FourViz,
    TheToolbar,
    TheFileHandler,
    TheCodeEditor,
    TheConsole,
    Splitpanes,
    Pane,
    TheHelpOverlay,
    TheAboutOverlay,
    TheNotifications
  }
})

const vscCommunicationPort = ref(-1)
const generalStore = useGeneralStore()
const paneVisibilityStore = usePaneVisibilityStore()

const fileHandler = ref<InstanceType<typeof TheFileHandler> | null>(null)

function openFile () {
  fileHandler.value?.openFileDialogue()
}
function download () {
  fileHandler.value?.download()
}

function isInputFieldOrEditorFocused () {
  const editor = d3.select('.monaco-editor')
  const inputField = d3.select('#console-input-field')
  const focusedInputs = d3.selectAll('.settings').selectAll('input:focus')

  return (!editor.empty() && (editor.classed('focused') || inputField.node() === document.activeElement)) ||
    !focusedInputs.empty()
}

async function startCompilation () {
  let internalClassPatterns
  const classContents = Array.from(generalStore.fileManager.fileContents, ([localUri, content]) => ({ localUri, content }))

  if (generalStore.vscExtensionMode) {
    // extension version
    const contents = await ExtensionCommunication.sendGetFileContents()
    internalClassPatterns = contents.internalClassPatterns
    generalStore.openEditorLocalUri = contents.openEditorLocalUri

    shared.logDebug(`file contents: ${contents}`)
  }

  generalStore.debugger.startCompilation(classContents, internalClassPatterns)
}

function handleKeyboardInput (event: KeyboardEvent) {
  /*  only call next/previous if editor or input field are not focused - would step through the program while navigating the code or the input field otherwise */
  if (generalStore.debugger.compiled && !isInputFieldOrEditorFocused()) {
    event.preventDefault()
    switch (event.code) {
      case 'ArrowRight':
        generalStore.debugger.stepOver()
        break
      case 'ArrowLeft':
        generalStore.debugger.stepBack()
        break
      case 'ArrowUp':
        generalStore.debugger.stepOut()
        break
      case 'ArrowDown':
        generalStore.debugger.stepInto()
        break
    }
  }

  if (event.altKey) {
    switch (event.code) {
      case 'KeyO':
        if (!generalStore.vscExtensionMode) {
          openFile()
        }
        break
      case 'KeyS':
        if (!generalStore.vscExtensionMode) {
          download()
        }
        break
      case 'KeyC':
        startCompilation()
        break
      default:
        break
    }
  }
}

async function connect () {
  try {
    const connected = await generalStore.debugger.connect()
    if (connected) {
      if (generalStore.vscExtensionMode) {
        startCompilation()
      }
    }
  } catch (ex) {
    console.error(ex)
    console.log('Retrying connection in 5 seconds...')
    setTimeout(() => connect(), 5000)
  }
}

const route = useRoute()

onMounted(async () => {
  if (route.name === 'Extension') {
    vscCommunicationPort.value = parseInt(String(route.params.vscExtensionPort))
    generalStore.debugger.setPort(parseInt(String(route.params.debuggerPort)))
    generalStore.vscExtensionMode = true
    paneVisibilityStore.hideEditorPane()
    paneVisibilityStore.hideConsolePane()

    await ExtensionCommunication.connectToExtension(
      () => generalStore.debugger.sendInput(generalStore.inputValue),
      vscCommunicationPort.value
    )

    generalStore.debugger.shareInitialState()

    const contents = await ExtensionCommunication.sendGetFileContents()
    console.log(contents)
    generalStore.fileManager.setFileContents(contents.fileContents)

    shared.logDebug(`file contents: ${contents.fileContents}`)
  } else {
    paneVisibilityStore.showEditorPane()
    paneVisibilityStore.showConsolePane()

    if (route.name === 'Example') {
      const dirName = route.params.dirName // filename of example in public/examples
      if (dirName && typeof dirName === 'string') {
        const success = await generalStore.fileManager.openExample(dirName)
        if (!success) {
          generalStore.notifications.show({ kind: 'ExampleLoadingError' })
        }
      }
    } else {
      const oldEditorText = localStorage.getItem('EDITOR_TEXT')
      if (oldEditorText) {
        try {
          const editorTextArray = JSON.parse(localStorage.getItem('EDITOR_TEXT')!) as Array<[string, string]>
          generalStore.fileManager.setFileContents(editorTextArray.map(([localUri, content]) => ({ localUri, content })))
        } catch (_) {
          generalStore.notifications.show({ kind: 'LocalStorageLoadingError' })
        }
      }
    }
  }

  if (generalStore.fileManager.fileContents.size === 0) {
    generalStore.fileManager.addFile(DEFAULT_FILE_NAME, DEFAULT_EDITOR_TEXT, 'java')
  }

  generalStore.fileManager.addListener(_ => {
    generalStore.debugger.resetTrace()
    if (!generalStore.vscExtensionMode) {
      localStorage.setItem('EDITOR_TEXT', JSON.stringify([...generalStore.fileManager.fileContents]))
    }
  })

  // reset event listeners to prevent adding multiple ones (e.g. after recompiling during development)
  document.body.onkeydown = null
  document.body.onkeyup = null
  d3.select('body').on('keydown', null)
  d3.select('body').on('keyup', null)

  d3.select('body').on('keydown', function (event) {
    if (!isInputFieldOrEditorFocused() && (event.code === 'ArrowRight' || event.code === 'ArrowLeft')) {
      event.preventDefault()
    }
  })

  d3.select('body').on('keyup', function (event) {
    handleKeyboardInput(event)
  })

  await connect()
}
)
</script>

<style>

/* ============================== */
/* General */
/* ============================== */

@font-face {
  font-family: "Unica One";
  src: url("../assets/fonts/Unica_One/UnicaOne-Regular.ttf");
}

html {
  background: url("../assets/backgrounds/bg12.jpg") no-repeat center center fixed;
  -webkit-background-size: cover;
  -moz-background-size: cover;
  -o-background-size: cover;
  background-size: cover;
}

body {
  height: 100%;
  width: 100%;
  margin: 0;
  font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  color: #212529;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-left: 4px solid #163150;
  border-right: 4px solid #163150;
  border-bottom: 4px solid #163150;
}

a {
  -webkit-user-select: none;
  user-select: none;
}

.btn {
  display: inline-block;
  font-family: inherit;
  padding: 10px 20px;
  font-size: 16px;
  text-align: center;
  text-decoration: none;
  vertical-align: middle;

  transition: background-color 0.3s ease;
  line-height: 1.5;
  text-decoration: none;
  border-radius: 0.2rem;
  margin: 0;
  border: 1px solid transparent;
}

.btn-primary {
  background-color: #007bff;
  border-color: #007bff;
  color: #fff;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 14px;
}

.btn:enabled {
  cursor: pointer;
}

.btn:disabled {
  opacity: .65;
}

*, ::after, ::before {
  box-sizing: border-box;
}

.no-break {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* Optional: Adds ellipsis (...) if the text overflows */
}

.float-container-start-aligned {
  display: flex;
  gap: 2px;
  align-items: flex-start;
}

.float-container-end-aligned {
  display: flex;
  gap: 2px;
  align-items: flex-end;
}

.float-container-center-aligned {
  display: flex;
  gap: 2px;
  align-items: center;
}

.no-gap {
  gap: 0px !important;
}

.divider {
  height: 1px;
  border-bottom: 1px dashed grey;
  margin-top: 10px;
}

/* ============================== */
/* Panes */
/* ============================== */

.main-row {
  flex: 1;
  min-height: 0;
  max-height: 100vh;
}

.splitpanes--vertical > .splitpanes__splitter {
  min-width: 8px;
  background-color: #163150;
}

.splitpanes--horizontal > .splitpanes__splitter {
  min-height: 8px;
  background-color: #163150;
}

#desktest-pane {
  overflow: auto;
  position: relative;
  height: 100%;
}

.default-text-icon {
  width: 14px;
  height: 14px;
  margin-bottom: 2px;
}

/* z-index */
:root {
  --visualization-bottom:0;
  --visualization-layer1:1;
  --visualization-layer2:2;
  --visualization-layer3:3;
  --visualization-buttons: 30;
  --global-notification: 40;
  --global-tooltip: 50;
  --global-selector: 60;
}

</style>
