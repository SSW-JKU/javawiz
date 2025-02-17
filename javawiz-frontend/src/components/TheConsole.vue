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
    <div id="console-output" ref="console">
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
          sendInput()
        }">
        Send
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import * as d3 from 'd3'
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'TheConsole',
  data: function () {
    return { }
  },
  computed: {
    ...mapStores(useGeneralStore),
    compileError () {
      return this.generalStore.debugger.getCompileErrorMessage()
    },
    isInputExpected () {
      return this.generalStore.debugger.inputExpected
    },
    isLive () {
      return this.generalStore.debugger.isLive || !this.generalStore.debugger.compiled
    },
    consoleText () {
      return this.generalStore.consoleLines.map(line => line.output + line.input + line.error).join('')
    }
  },
  watch: {
    isInputExpected: function () {
      const vm = this
      if (vm.isInputExpected) {
        document.getElementById('console-input-field')?.focus()
      }
    },
    consoleText: function () {
      // scroll to bottom
      const consoleDiv = this.$refs.console as HTMLDivElement
      consoleDiv.scrollTop = consoleDiv.scrollHeight
    }
  },
  /**
  * The vue 'mounted' lifecycle hook.
  * Adds an event listener to trigger a click on the input butto after pressing Enter in the input field.
  * Also calls the first redraw.
  *
  */
  mounted () {
    d3.select('#console-input-field')
      .on('keyup', function (event) {
        event.preventDefault()
        if (event.key === 'Enter') {
          d3.select('#console-input-button').dispatch('click')
        }
      })
  },
  methods: {
    blur: function () {
      (document.activeElement as HTMLElement).blur()
    },
    sendInput () {
      this.generalStore.sendInput()
    }
  }
})
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
