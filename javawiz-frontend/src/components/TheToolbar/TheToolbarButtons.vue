<template>
  <div class="float-container-center-aligned">
    <div v-if="!generalStore.debugger.connected && !generalStore.debugger.talking" class="float-container-center-aligned">
      <button class="btn btn-sm btn-primary connect-button" @click="() => emit('connect')">
        <img class="connect-icon" src="../../assets/icons/controls/connect.svg" alt="Connect button">
        Connect
      </button>
    </div>
    <div v-if="generalStore.debugger.connected" class="float-container-center-aligned">
      <IconWithTooltip
        :tooltip="{ text: 'Help', arrow: 'left', placement: 'below' }"
        :icon="help"
        @action="() => overlayStore.toggleHelpState()" />
      <IconWithTooltip
        v-if="!generalStore.vscExtensionMode"
        :tooltip="{ text: 'Open Files', arrow: 'left', placement: 'below' }"
        :shortcut="{ firstKey: 'Alt', secondKey: 'O' }"
        :icon="open"
        @action="() => emit('openFile')" />
      <IconWithTooltip
        v-if="!generalStore.vscExtensionMode"
        :tooltip="{ text: 'Save Files', arrow: 'middle', placement: 'below' }"
        :shortcut="{ firstKey: 'Alt', secondKey: 'S' }"
        :icon="save"
        @action="() => emit('download')" />

      <!-- display the "play" button if debugger has not yet compiled -->
      <div v-if="!generalStore.debugger.compiled">
        <IconWithTooltip
          :tooltip="{ text: 'Start', arrow: 'middle', placement: 'below' }"
          :shortcut="{ firstKey: 'Alt', secondKey: 'C' }"
          :icon="start_"
          :semitransparent="generalStore.debugger.compiling"
          @action="() => emit('startCompilation')" />
      </div>
      <!-- if debugger is running, display its step buttons -->
      <TheDebuggerButtons v-if="generalStore.debugger.compiled" @start-compilation="() => emit('startCompilation')" />
    </div>
    <img
      class="toolbar-spinner"
      src="../../assets/icons/spinner-transback.gif"
      alt="Spinner"
      :style="generalStore.debugger.talking ? 'opacity: 1' : 'opacity: 0'">
  </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue'
import TheDebuggerButtons from '@/components/TheToolbar/TheDebuggerButtons.vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { useOverlayStore } from '@/store/OverlayStore'
import help from '../../assets/icons/controls/help.svg'
import open from '../../assets/icons/controls/open.svg'
import start_ from '../../assets/icons/controls/start.svg'
import save from '../../assets/icons/controls/save.svg'

defineComponent({
  name: 'TheToolbarButtons',
  components: { IconWithTooltip, TheDebuggerButtons }
})
const emit = defineEmits<{ connect: [], openFile: [], download: [], startCompilation: [] }>()
const generalStore = useGeneralStore()
const overlayStore = useOverlayStore()
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
