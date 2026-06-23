<template>
  <div class="flex-container">
    <div class="settings" :class="{invisible: !settingsVisible}">
      <slot />
    </div>
    <button v-if="zoomIn" class="float-button" @click="_e => zoomIn()">
      ➕
    </button>
    <button v-if="zoomOut" class="float-button" @click="_e => zoomOut()">
      ➖
    </button>
    <button v-if="zoomReset" class="float-button" @click="_e => zoomReset()">
      🏠
    </button>
    <button v-if="hasDefaultSlot" class="float-button" @click="settingsVisible = !settingsVisible">
      ⚙
    </button>
    <button v-if="vizId" class="float-button" title="Close" @click="_e => removePane()">
      ❌
    </button>
  </div>
</template>

<script setup lang="ts">

import { computed, ref, useSlots } from 'vue'
import { useVisualizationStore } from '@/store/VisualizationStore'

const settingsVisible= ref(false)
const visualizationStore = useVisualizationStore()

const { zoomIn = undefined, zoomOut = undefined, zoomReset = undefined, vizId } = defineProps<{
  zoomIn?:(() => void),
  zoomOut?:(() => void),
  zoomReset?:(() => void),
  vizId: number
}>()

const slots = useSlots()

const hasDefaultSlot = computed(() => {
  return !!slots.default
})

function removePane () {
  visualizationStore.hide(vizId)
}
</script>

<style scoped>
.flex-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: absolute;
  top: 5px;
  left: 5px;
}

.float-button {
  font-size: 16px;
  padding: 0px;
  width: 25px;
  height: 25px;
  z-index: var(--visualization-buttons);
}

.invisible {
  display: none;
}

.settings {
  position: absolute;
  border: black 1px solid;
  background: lightgray;
  padding: 0px 10px 5px 5px;
  height: 300px;
  left: 35px;
  border-radius: 5px;
  overflow-y: auto;
  z-index: var(--visualization-buttons);
}
</style>
