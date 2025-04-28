<template>
  <div id="console-div">
    <div id="console-header">
      <img
        v-if="isLive"
        class="state-icon"
        src="../assets/icons/status/live.svg"
        alt="Live icon"
        title="Live">
      <img
        v-else class="state-icon"
        src="../assets/icons/status/replay.svg"
        alt="Replay icon"
        title="Replay">
      &nbsp;Console
    </div>
    <div id="console-output">
      <p v-if="!consoleText && !compileError">
        Program output is displayed here.
      </p>
      <pre v-if="compileError" style="color: red"> {{ compileError }} </pre>
      <pre>{{ consoleText }}</pre>
    </div>
    <div id="console-input">
      <input id="console-input-field" v-model="generalStore.inputValue" type="text">
      <button
        id="console-input-button"
        class="btn btn-sm btn-primary"
        :disabled="!isInputExpected"
        @click="() => {
          blur()
          generalStore.sendInput()
        }">
        Send
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3'
import { computed, defineComponent, onMounted, watch } from 'vue'
import { useGeneralStore } from '@/store/GeneralStore'

defineComponent({ name: 'TheConsole' })
const generalStore = useGeneralStore()
const compileError = computed(() => generalStore.debugger.getCompileErrorMessage())
const isInputExpected = computed(() => generalStore.debugger.inputExpected)
const isLive = computed(() => generalStore.debugger.isLive || !generalStore.debugger.compiled)
const consoleText = computed(() => generalStore.consoleLines.map(line => line.output + line.input + line.error).join(''))

watch(isInputExpected, () => {
  if (isInputExpected.value) {
    document.getElementById('console-input-field')?.focus()
  }
})

watch(consoleText, () => {
  const console = document.getElementById('console-output')
  if (console) console.scrollTop = console.scrollHeight
})

onMounted(() => {
  d3.select('#console-input-field')
    .on('keyup', function (event) {
      event.preventDefault()
      if (event.key === 'Enter') {
        d3.select('#console-input-button').dispatch('click')
      }
    })
})

function blur () {
  (document.activeElement as HTMLElement).blur()
}
</script>

<style scoped>
#console-div {
  width: 100%;
  height: 100%;
  background-color: rgba(20, 47, 79, 0.4);
  color: white;
}

#console-header {
  font-family: "Arial", sans-serif;
  height: 30px;
  background: #163150;
  padding-left: 5px;
  display: flex;
  align-items: center;
}

#console-output {
  height: calc(100% - 75px);
  background-color: white;
  color: black;
  font-size: 0.8rem;
  padding: 10px;
  font-family: Consolas, serif;
  overflow-y: scroll;

}

pre {
  white-space: pre-wrap;
}

#console-input {
  width: 100%;
  height: 50px;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 15px;
  padding-left: 10px;
}

#console-input-field {
  width: 100%;
  height: 30px;
  margin-right: 5px;
}

#console-input-button {
  height: 30px;
  width: 25%;
  max-width: 150px;
  min-width: 130px;
  margin-left: auto;
  margin-right: 10px;
  font-size: 0.9rem;
  background-color: #163150;
  border-color: #163150;
}

#console-input-button:enabled:hover {
  background-color: #334967;
}

</style>
