<template>
  <div class="float-container-center-aligned">
    <div v-if="!generalStore.debugger.connected && !generalStore.debugger.talking" class="float-container-center-aligned">
      <button class="btn btn-sm btn-primary connect-button" @click="connect()">
        <img class="connect-icon" src="../../assets/icons/controls/connect.svg" alt="Connect button">
        Connect
      </button>
    </div>
    <div v-if="generalStore.debugger.connected" class="float-container-center-aligned">
      <IconWithTooltip
        :action="() => overlayStore.toggleHelpState()"
        :tooltip="{ text: 'Help', arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/controls/help.svg')" />
      <IconWithTooltip
        v-if="!generalStore.vscExtensionMode"
        :action="triggerOpenFile"
        :tooltip="{ text: 'Open Files', arrow: 'left', placement: 'below' }"
        :shortcut="{ firstKey: 'Alt', secondKey: 'O' }"
        :icon="require('../../assets/icons/controls/open.svg')" />
      <IconWithTooltip
        v-if="!generalStore.vscExtensionMode"
        :action="triggerSave"
        :tooltip="{ text: 'Save Files', arrow: 'middle', placement: 'below' }"
        :shortcut="{ firstKey: 'Alt', secondKey: 'S' }"
        :icon="require('../../assets/icons/controls/save.svg')" />

      <!-- display the "play" button if debugger has not yet compiled -->
      <div v-if="!generalStore.debugger.compiled">
        <IconWithTooltip
          :action="startCompilation"
          :tooltip="{ text: 'Start', arrow: 'middle', placement: 'below' }"
          :shortcut="{ firstKey: 'Alt', secondKey: 'C' }"
          :icon="require('../../assets/icons/controls/start.svg')"
          :semitransparent="generalStore.debugger.compiling" />
      </div>
      <!-- if debugger is running, display its step buttons -->
      <TheDebuggerButtons v-if="generalStore.debugger.compiled" :start-compilation="startCompilation" />
    </div>
    <img
      class="toolbar-spinner"
      src="../../assets/icons/spinner-transback.gif"
      alt="Spinner"
      :style="generalStore.debugger.talking ? 'opacity: 1' : 'opacity: 0'">
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TheDebuggerButtons from '@/components/TheToolbar/TheDebuggerButtons.vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'
import { useOverlayStore } from '@/store/OverlayStore'

export default defineComponent({
  name: 'TheToolbarButtons',
  components: { IconWithTooltip, TheDebuggerButtons },
  props: {
    connect: {
      type: Function,
      required: true
    },
    startCompilation: {
      type: Function,
      required: true
    },
    triggerOpenFile: {
      type: Function,
      required: true
    },
    triggerSave: {
      type: Function,
      required: true
    }
  },
  data: function () {
    return { }
  },
  computed: {
    ...mapStores(useGeneralStore, useOverlayStore)
  }
})
</script>

<style>

.connect-button {
  background-color: #5c87a8;
  border-color: #4b708c;
}

.connect-button:hover {
  background-color: #6792b8;
}

.connect-icon {
  width: 15px;
  height: 15px;
}

.toolbar-spinner {
  height: 25px;
  width: 25px;
  margin: 0 25px 0 15px;
}

</style>
